# multi_region_trace.py 完整替换代码
import os
import tempfile
import re
import cv2
import numpy as np
from PIL import Image

def get_region_params(region_type):
    if region_type == "line":
        return {
            'colormode': 'color',
            'hierarchical': 'stacked',
            'mode': 'spline',
            'filter_speckle': 4,
            'color_precision': 9,
            'layer_difference': 3,
            'corner_threshold': 70,
            'length_threshold': 1.5,
            'max_iterations': 16,
            'splice_threshold': 65,
            'path_precision': 8
        }
    elif region_type == "gradient":
        return {
            'colormode': 'color',
            'hierarchical': 'stacked',
            'mode': 'spline',
            'filter_speckle': 4,
            'color_precision': 10,
            'layer_difference': 2,
            'corner_threshold': 150,
            'length_threshold': 2.0,
            'max_iterations': 18,
            'splice_threshold': 60,
            'path_precision': 9
        }
    else: # fill填充区
        return {
            'colormode': 'color',
            'hierarchical': 'cutout',
            'mode': 'spline',
            'filter_speckle': 6,
            'color_precision': 6,
            'layer_difference': 12,
            'corner_threshold': 80,
            'length_threshold': 3.5,
            'max_iterations': 12,
            'splice_threshold': 50,
            'path_precision': 6
        }

def trace_single_region(img_cv, mask, region_type, tmp_dir):
    region_img = img_cv.copy()
    region_img[~mask] = [255, 255, 255]
    pil_img = Image.fromarray(cv2.cvtColor(region_img, cv2.RGB))
    tmp_in = os.path.join(tmp_dir, f"region_{region_type}.png")
    tmp_out = os.path.join(tmp_dir, f"region_{region_type}.svg")
    pil.save(tmp_in, format='PNG')
    import vtracer
    params = get_region_params(region_type)
    vtracer.convert_image_to_svg_py(tmp_in, tmp_out,** params)
    with open(tmp_out, 'r', encoding='utf-8') as f:
        svg_content = f.read()
    os.unlink(tmp_in)
    os.unlink(tmp_out)
    return svg_content

def extract_all_paths(svg):
    return re.findall(r'<path\s+[^>]*?/>', svg)

def multi_region_trace(img_cv, masks, tmp_dir):
    line_mask, fill_mask, gradient_mask = masks
    if line_mask is None:
        return ""
    try:
        kernel_line = np.ones((3, 3), np.uint8)
        kernel_fill = np.ones((4, 4), np.uint8)
        line_mask = cv2.erode(line_mask.astype(np.uint8), kernel_line, iterations=2).astype(bool)
        fill_mask = cv2.dilate(fill_mask.astype(np.uint8), kernel_fill, iterations=2).astype(bool)
        gradient_mask = cv2.dilate(gradient_mask.astype(np.uint8), kernel_fill, iterations=1) & ~line_mask
        fill_svg = trace_single_region(img_cv, fill_mask, "fill", tmp_dir)
        gradient_svg = trace_single_region(img_cv, "gradient", tmp_dir)
        line_svg = trace_single_region(img_cv, "line", tmp_dir)
        fill_paths = extract_all_paths(fill_svg)
        grad_paths = extract_all_paths(gradient_svg)
        line_paths = extract_all_paths(line_svg)
        all_paths = fill_paths + grad_paths
        paths_str = '\n'.join(all_paths)
        line_str = '\n'.join(line_paths)
        return paths_str + "\n" + line_str
    except Exception:
        # 第94行这里，加pass，彻底消除语法报错
        pass
    return ""