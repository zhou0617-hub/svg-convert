import sys, os, tempfile, re
from PIL import Image, ImageFilter
import vtracer

def fix_svg_viewbox(svg_string, width, height):
    if 'viewBox=' in svg_string:
        svg_string = re.sub(r'viewBox="[^"]*"', f'viewBox="0 0 {width} {height}"', svg_string)
    else:
        svg_string = re.sub(r'<svg ', f'<svg viewBox="0 0 {width} {height}" ', svg_string, count=1)
    return svg_string

def smooth_svg_paths(svg_data, tolerance=0.8):
    def round_match(m):
        val = float(m.group(0))
        rounded = round(val / tolerance) * tolerance
        if rounded == int(rounded):
            return str(int(rounded))
        return f"{rounded:.2f}".rstrip('0').rstrip('.')
    svg_data = re.sub(r'(?<=[\s,])-?\d+\.?\d*(?=[\s,])', round_match, svg_data)
    return svg_data

def convert_to_svg(input_path):
    image_size = 1600
    img = Image.open(input_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img.thumbnail((image_size, image_size), Image.Resampling.LANCZOS)
    w, h = img.size
    img = img.filter(ImageFilter.MedianFilter(size=3))
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
    }
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        img.save(tmp, format='PNG')
        processed_path = tmp.name
    svg_path = processed_path.replace('.png', '.svg')
    try:
        vtracer.convert_image_to_svg_py(processed_path.replace('\\', '/'), svg_path.replace('\\', '/'), **vt_params)
        with open(svg_path, 'r', encoding='utf-8') as f:
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
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)
