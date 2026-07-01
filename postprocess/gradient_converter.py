import re
import numpy as np
from collections import defaultdict

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def color_similarity(c1, c2):
    return np.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

def extract_color_layers(svg_data):
    paths = re.findall(r'<path\s+d="([^"]+)"\s+fill="(#[0-9a-fA-F]{6})"', svg_data)
    layers = defaultdict(list)
    for d, fill in paths:
        coords = re.findall(r'-?\d+\.?\d*', d)
        if len(coords) < 4:
            continue
        nums = [float(x) for x in coords]
        xs = nums[0::2]
        ys = nums[1::2]
        if not xs or not ys:
            continue
        bbox = (min(xs), min(ys), max(xs), max(ys))
        layers[fill].append((d, bbox))
    return layers

def find_gradient_groups(layers, color_threshold=30, min_layers=4):
    colors = list(layers.keys())
    visited = set()
    groups = []
    
    for i, c1 in enumerate(colors):
        if c1 in visited:
            continue
        group = [c1]
        visited.add(c1)
        rgb1 = hex_to_rgb(c1)
        
        for j, c2 in enumerate(colors[i+1:], i+1):
            if c2 in visited:
                continue
            rgb2 = hex_to_rgb(c2)
            if color_similarity(rgb1, rgb2) < color_threshold:
                group.append(c2)
                visited.add(c2)
        
        if len(group) >= min_layers:
            group.sort(key=lambda c: sum(hex_to_rgb(c)))
            groups.append(group)
    
    return groups

def convert_stacked_to_gradient(svg_data, config):
    if not config["gradient"]["enable"]:
        return svg_data
    
    try:
        layers = extract_color_layers(svg_data)
        groups = find_gradient_groups(
            layers,
            color_threshold=config["gradient"]["color_similarity"],
            min_layers=config["gradient"]["min_layers"]
        )
        
        if not groups:
            return svg_data
        
        grad_defs = []
        grad_id = 0
        
        for group in groups:
            stops = []
            for i, color in enumerate(group):
                offset = int(i / (len(group)-1) * 100)
                stops.append(f'<stop offset="{offset}%" stop-color="{color}"/>')
            
            grad_id += 1
            grad_def = f'<linearGradient id="grad_{grad_id}" x1="0%" y1="0%" x2="0%" y2="100%">{"".join(stops)}</linearGradient>'
            grad_defs.append(grad_def)
            
            for color in group:
                svg_data = svg_data.replace(f'fill="{color}"', f'fill="url(#grad_{grad_id})"')
        
        # 修复：正确插入defs，不破坏svg根标签属性
        defs_block = f'<defs>{"".join(grad_defs)}</defs>'
        # 匹配第一个<svg ...>的闭合尖括号，在后面插入defs
        svg_data = re.sub(r'(<svg[^>]*>)', r'\1' + defs_block, svg_data, count=1)
        
        return svg_data
    except Exception:
        # 渐变转换失败直接返回原图，绝不破坏SVG结构
        return svg_data