import sys
import os
import tempfile
import re
import traceback
import numpy as np
from PIL import Image, ImageOps
import cv2
import vtracer
import subprocess
import platform
# 自定义模块（最容易崩）
from vectorize.engine_switch import is_logo_type, potrace_trace
from config.vectorize_config import CONFIG
from preprocess.ai_enhance import enhance_image
from vectorize.multi_region_trace import multi_region_trace
from postprocess.gradient_converter import convert_stacked_to_gradient
from postprocess.path_optimizer import optimize_svg

def svgo_optimize_raw(svg_text):
    try:
        tmp_in = tempfile.NamedTemporaryFile(suffix=".svg", delete=False)
        tmp_out = tempfile.NamedTemporaryFile(suffix=".svg", delete=False)
        tmp_in.close()
        tmp_out.close()
        with open(tmp_in.name, "w", encoding="utf-8") as f:
            f.write(svg_text)
        # 跨平台兼容写法，不硬编码用户路径
        if platform.system() == "Windows":
            import shutil
            svgo_path = shutil.which("svgo")
            if not svgo_path:
                svgo_path = "svgo.cmd"
            cmd = [svgo_path, tmp_in.name, "-o", tmp_out.name, "--multipass", "--precision=2"]
        else:
            cmd = ["svgo", tmp_in.name, "-o", tmp_out.name, "--multipass", "--precision=2"]
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=20,
            encoding="utf-8",
            errors="ignore"
        )
        with open(tmp_out.name, "r", encoding="utf-8") as f:
            result_svg = f.read()
        return result_svg
    except Exception as err:
        print(f"SVGO优化失败，返回原始SVG: {err}")
        return svg_text
    finally:
        for file_path in (tmp_in.name, tmp_out.name):
            if os.path.exists(file_path):
                os.unlink(file_path)

# 合并同色路径（基础前置优化）
def merge_same_color_paths(svg_data):
    path_groups = {}
    path_match = re.findall(r'(<path\s+(.*?)fill="(#[\da-fA-F]{6})"[^>]*?/>)', svg_data)
    for full, attr, fill in path_match:
        d_match = re.search(r'd="([^"]+)"', full)
        if not d_match:
            continue
        d_val = d_match.group(1)
        if fill not in path_groups:
            path_groups[fill] = []
        path_groups[fill].append(d_val)
    svg_clean = re.sub(r'<path\s+[^>]*?/>', '', svg_data)
    new_path_list = []
    for fill, d_list in path_groups.items():
        combined_d = "".join(d_list)
        new_path_list.append(f'<path fill="{fill}" d="{combined_d}"/>')
    full_paths = "\n".join(new_path_list)
    return svg_clean.replace("</svg>", full_paths + "\n</svg>")

def classify_image(img_cv):
    h, w = img_cv.shape[:2]
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    ycbcr = cv2.cvtColor(img_cv, cv2.COLOR_BGR2YCrCb)
    y, cr, cb = cv2.split(ycbcr)
    color_var = np.var(y) + np.var(cr) + np.var(cb)
    edges_strong = cv2.Canny(img_cv, 80, 200)
    edges_weak = cv2.Canny(img_cv, 30, 100)
    strong_ratio = np.count_nonzero(edges_strong) / (h * w)
    weak_ratio = np.count_nonzero(edges_weak) / (h * w)
    if weak_ratio < 0.08 and color_var < 1000:
        return "simple"
    elif strong_ratio > 0.02 and weak_ratio < 0.2:
        return "line_art"
    elif 0.08 <= weak_ratio < 0.28:
        return "illustration"
    else:
        return "photo"

def get_base_params(img_type, user_config):
    from config.vectorize_config import CONFIG

    # 基础默认
    params = {
        "colormode": 'color',
        "hierarchical": 'cutout',
        "mode": 'spline',
        "filter_speckle": user_config.get("speckle", 6),
        "color_precision": user_config.get("color_prec", 8),
        "layer_difference": user_config.get("layer_diff", 12),
        "corner_threshold": 120,  # 提高拐角阈值，曲线更平滑
        "length_threshold": user_config.get("min_path_len", 3.0),
        "max_iterations": 14,
        "splice_threshold": 70,
        "path_precision": 6
    }
    if img_type == "line_art":
        params["hierarchical"] = "stacked"
        params["layer_difference"] = user_config.get("layer_diff", 6)
        params["corner_threshold"] = 90
    elif img_type == "photo":
        params["hierarchical"] = "stacked"
        params["filter_speckle"] = user_config.get("speckle", 8)
    return params

def fix_svg_viewbox(svg_string, width, height):
    import re
    coords = []
    # 提取所有路径数字
    all_d = re.findall(r'd="([^"]+)"', svg_string)
    for d_str in all_d:
        nums = re.findall(r'-?\d+\.?\d*', d_str)
        coords.extend([float(n) for n in nums])
    if coords:
        min_x = min(coords)
        min_y = min(coords)
        max_x = max(coords)
        max_y = max(coords)
        new_view = f'viewBox="{min_x} {min_y} {max_x - min_x} {max_y - min_y}"'
        # 清空旧viewBox，写入动态计算的
        svg_string = re.sub(r'\s+viewBox="[^"]*"', '', svg_string)
        svg_string = re.sub(r'(<svg[^>]*)>', rf'\1 {new_view}>', svg_string, count=1)
    return svg_string

def convert_to_svg(input_path, user_param=None):
    processed_path = None
    svg_path = None
    user = user_param or {}
    runtime_config = CONFIG.copy()
    if "enhance_scale" in user:
        runtime_config["enhance"]["scale"] = float(user["enhance_scale"])
    if "enable_segment" in user:
        runtime_config["segment"]["enable"] = bool(user["enable_segment"])
    if "enable_gradient" in user:
        runtime_config["gradient"]["enable"] = bool(user["enable_gradient"])
    if "path_tol" in user:
        runtime_config["path_opt"]["simplify_tolerance"] = float(user["path_tol"])
    # 新增默认层差参数
    user.setdefault("layer_diff", 12)

    try:
        img = Image.open(input_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img = ImageOps.expand(img, border=1, fill=(255, 255, 255))
        img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_BGR2RGB)

        # Potrace 容错分支，失败自动走vtracer
        logo_svg = None
        try:
            if is_logo_type(img_cv):
                logo_svg = potrace_trace(img_cv)
        except Exception as e:
            print(f"[Logo引擎异常] {e}")
        if logo_svg is not None:
            return logo_svg

        # 彩色/普通图片走vtracer管线
        img_cv = enhance_image(img_cv, runtime_config)
        h, w = img_cv.shape[:2]
        img_type = classify_image(img_cv)
        vt_params = get_base_params(img_type, user)
        processed_pil = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
        with tempfile.TemporaryDirectory() as tmp_dir:
            processed_path = os.path.join(tmp_dir, "tmp_process.png")
            processed_pil.save(processed_path, format='PNG')
            svg_path = processed_path.replace('.png', '.svg')
            vtracer.convert_image_to_svg_py(
                processed_path.replace('\\', '/'),
                svg_path.replace('\\', '/'),
                **vt_params
            )
            if not os.path.exists(svg_path):
                raise RuntimeError("VTracer 未生成SVG")
            with open(svg_path, 'r', encoding='utf-8') as f:
                svg_data = f.read()
            if len(svg_data) < 100 or '</svg>' not in svg_data or '<path' not in svg_data:
                raise ValueError("生成SVG无效")
            # 语义分层处理（修正传参：传入临时目录）
            #masks = segment_regions(img_cv, runtime_config)
            #svg_data = multi_region_trace(img_cv, masks, tmp_dir)
            # 后处理优化 仅执行一次
            svg_data = optimize_svg(svg_data, runtime_config)
            svg_data = merge_same_color_paths(svg_data)
            try:
                svg_data = convert_stacked_to_gradient(svg_data, runtime_config)
            except Exception:
                pass
            # 修正画布边界
            svg_data = fix_svg_viewbox(svg_data, w, h)
            # 最终SVGO压缩
            svg_data = svgo_optimize_raw(svg_data)
            return svg_data
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        raise RuntimeError(f"转换失败: {str(e)}")
    finally:
        # 使用TemporaryDirectory自动清理，这里无需手动删文件
        processed_path = None
        svg_path = None

if __name__ == "__main__":
    import sys, json, traceback
    try:
        args = sys.argv
        param_dict = json.loads(args[2]) if len(args)>=3 else {}
        img_path = args[1]
        svg_str = convert_to_svg(img_path, param_dict)
        print(svg_str, flush=True)
    except Exception as err:
        # 强制把完整错误栈输出到标准错误，刷新缓冲区
        traceback.print_exc(file=sys.stderr)
        print(f"转换崩溃：{err}", file=sys.stderr, flush=True)
        sys.exit(1)