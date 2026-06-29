import os
import re
from PIL import Image, ImageFilter
import vtracer


def fix_svg_viewbox(svg_string, width, height):
    if 'viewBox=' in svg_string:
        svg_string = re.sub(
            r'viewBox="[^"]*"',
            f'viewBox="0 0 {width} {height}"',
            svg_string
        )
    else:
        svg_string = re.sub(
            r'<svg ',
            f'<svg viewBox="0 0 {width} {height}" ',
            svg_string,
            count=1
        )
    return svg_string


def smooth_svg_paths(svg_data, tolerance=0.8):
    """
    对 SVG 路径坐标做轻微量化平滑。
    tolerance: 量化步长，0.8 意味着小于 0.8px 的锯齿被抹平
    """
    def round_match(m):
        val = float(m.group(0))
        rounded = round(val / tolerance) * tolerance
        if rounded == int(rounded):
            return str(int(rounded))
        return f"{rounded:.2f}".rstrip('0').rstrip('.')
    
    # 修复：只匹配路径 d 属性中的数字（带小数点或负号），不匹配路径命令字母
    # 匹配整数或浮点数，前面必须是逗号、空格、负号或开头
    svg_data = re.sub(
        r'(?<=[\s,])-?\d+\.?\d*(?=[\s,])',
        round_match,
        svg_data
    )
    return svg_data


def convert_to_svg(input_path, style='default'):
    image_size = 1600
    img = Image.open(input_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img.thumbnail((image_size, image_size), Image.Resampling.LANCZOS)
    w, h = img.size

    # 预处理：中值滤波去噪
    img = img.filter(ImageFilter.MedianFilter(size=3))

    # VTracer 参数：平滑曲线
    vt_params = {
        'colormode': 'color',
        'hierarchical': 'stacked',
        'mode': 'spline',
        'filter_speckle': 4,
        'color_precision': 6,
        'layer_difference': 12,
        'corner_threshold': 80,
        'length_threshold': 3.5,
        'max_iterations': 15,
        'splice_threshold': 30,
        'path_precision': 3
    }

    temp_dir = os.path.dirname(input_path) or '.'
    processed_path = os.path.join(temp_dir, 'processed_temp.png')
    img.save(processed_path, 'PNG')

    temp_svg_path = processed_path.replace('.png', '.svg')
    try:
        vtracer.convert_image_to_svg_py(processed_path, temp_svg_path, **vt_params)
        with open(temp_svg_path, 'r', encoding='utf-8') as f:
            svg_data = f.read()
        if len(svg_data) < 50 or not svg_data.strip().startswith('<'):
            raise ValueError('VTracer 返回了无效 SVG')
        svg_data = fix_svg_viewbox(svg_data, w, h)
        # 后处理：坐标量化平滑（修复后不会再误匹配路径命令）
        svg_data = smooth_svg_paths(svg_data, tolerance=0.8)
    finally:
        for p in [processed_path, temp_svg_path]:
            if os.path.exists(p):
                os.remove(p)
    return svg_data