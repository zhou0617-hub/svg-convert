# path_optimizer.py
import re

def simplify_path_coords(svg_data, tolerance=0.3):
    def round_match(m):
        val = float(m.group(0))
        rounded = round(val / tolerance) * tolerance
        if rounded == int(rounded):
            return str(int(rounded))
        return f"{rounded:.1f}" # 只保留1位小数，大幅精简
    return re.sub(r'(?<=[\s,])-?\d+\.?\d*(?=[\s,])', round_match, svg_data)

def remove_tiny_paths(svg_data, min_len=18):
    """过滤极短噪点路径，vectorize核心去杂逻辑"""
    pattern = rf'<path\s+d="m[^"]{{0,{min_len}}}"[^>]*?/>'
    return re.sub(pattern, '', svg_data)

def merge_same_color_geometry(svg_data):
    """增强同色路径合并，区分连续几何"""
    from collections import defaultdict
    color_groups = defaultdict(list)
    matches = re.findall(r'<path d="([^"]+)" fill="(#\w{6})"/>', svg_data)
    for d, fill in matches:
        color_groups[fill].append(d)
    # 清空原有path
    clean = re.sub(r'<path d="[^"]+" fill="#[0-9a-f]{6}"/>', '', svg_data)
    new_paths = []
    for fill, d_list in color_groups.items():
        combined = " ".join(d_list)
        new_paths.append(f'<path fill="{fill}" d="{combined}"/>')
    insert = "\n".join(new_paths)
    return clean.replace("</svg>", insert + "\n</svg>")

def optimize_svg(svg_data, config):
    if not config["path_opt"]["enable"]:
        return svg_data
    svg_data = simplify_path_coords(svg_data, config["path_opt"]["simplify_tolerance"])
    svg_data = remove_tiny_paths(svg_data, min_len=config["path_opt"]["min_path_length"])
    if config["path_opt"]["merge_same_color"]:
        svg_data = merge_same_color_geometry(svg_data)
    return svg_data