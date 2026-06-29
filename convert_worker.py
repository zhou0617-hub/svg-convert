import sys, os, tempfile, re, traceback
from PIL import Image, ImageFilter
import numpy as np
import cv2
import vtracer

def fix_svg_viewbox(svg_string, width, height):
    if 'viewBox=' in svg_string:
        svg_string = re.sub(r'viewBox="[^"]*"', f'viewBox="0 0 {width} {height}"', svg_string)
    else:
        svg_string = re.sub(r'<svg ', f'<svg viewBox="0 0 {width} {height}" ', svg_string, count=1)
    return svg_string

def smooth_svg_paths(svg_data, tolerance=0.8):
    try:
        def round_match(m):
            val = float(m.group(0))
            rounded = round(val / tolerance) * tolerance
            if rounded == int(rounded):
                return str(int(rounded))
            return f"{rounded:.2f}".rstrip('0').rstrip('.')
        svg_data = re.sub(r'(?<=[\s,])-?\d+\.?\d*(?=[\s,])', round_match, svg_data)
    except:
        pass
    return svg_data

def convert_to_svg(input_path):
    image_size = 1600
    img = Image.open(input_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img.thumbnail((image_size, image_size), Image.Resampling.LANCZOS)
    w, h = img.size

    # ---------- 双边滤波 + 颜色量化（模拟渐变） ----------
    cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    cv_img = cv2.bilateralFilter(cv_img, 5, 50, 50)   # 轻度滤波，保留边缘
    # 颜色量化：每通道 24 级，更接近原色
    div = 256 // 24
    cv_img = (cv_img // div) * div + div // 2
    img = Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))
    # -------------------------------------------------

    img = img.filter(ImageFilter.MedianFilter(size=3))

    vt_params = {
      'colormode': 'color',
        'hierarchical': 'stacked',
        'mode': 'spline',               # 换回 spline，线条更平滑
        'filter_speckle': 4,
        'color_precision': 8,           # 稳定值
        'layer_difference': 6,          # 回升到 8，避免纯色
        'corner_threshold': 60,         # 拐角适度平滑
        'length_threshold': 2.0,
        'max_iterations': 20,
        'splice_threshold': 30,
    }

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        img.save(tmp, format='PNG')
        processed_path = tmp.name

    svg_path = processed_path.replace('.png', '.svg')
    abs_in = os.path.abspath(processed_path)
    abs_out = os.path.abspath(svg_path)

    try:
        vtracer.convert_image_to_svg_py(abs_in, abs_out, **vt_params)
        with open(abs_out, 'r', encoding='utf-8') as f:
            svg_data = f.read()
        if len(svg_data) < 50 or not svg_data.strip().startswith('<'):
            raise ValueError('VTracer 返回了无效 SVG')
        svg_data = fix_svg_viewbox(svg_data, w, h)
        svg_data = smooth_svg_paths(svg_data, tolerance=0.8)
        return svg_data
    finally:
        for p in [processed_path, svg_path]:
            if os.path.exists(p):
                os.unlink(p)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("ERROR: Missing image path", file=sys.stderr)
        sys.exit(1)
    img_path = sys.argv[1]
    if not os.path.exists(img_path):
        print(f"ERROR: File not found: {img_path}", file=sys.stderr)
        sys.exit(1)
    try:
        svg_str = convert_to_svg(img_path)
        print(svg_str)
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)