import os
import subprocess
import tempfile
import cv2
import numpy as np
import platform

# 区分系统自动配置potrace路径
if platform.system() == "Windows":
    POTRACE_EXE = r"C:\potrace-1.16.win64\potrace.exe"
else:
    # Linux线上服务器全局命令
    POTRACE_EXE = "potrace"


def is_logo_type(img_cv):
    """判断是否为黑白logo/单色图标，满足则走potrace"""
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    unique_colors = len(np.unique(gray))
    img_std = np.std(gray)
    # 颜色数量少、对比度高判定为logo素材
    return unique_colors < 16 and img_std > 85


def potrace_trace(img_cv):
    """调用本地potrace生成svg，捕获异常失败返回None自动降级vtracer"""
    try:
        tmp_png = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp_svg = tempfile.NamedTemporaryFile(suffix=".svg", delete=False)
        tmp_png.close()
        tmp_svg.close()

        # 转白底黑二值图适配potrace
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        _, bin_img = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
        cv2.imwrite(tmp_png.name, bin_img)

        # 执行potrace命令
        cmd = [
            POTRACE_EXE,
            "-b", "svg",
            "-o", tmp_svg.name,
            tmp_png.name
        ]
        subprocess.run(cmd, capture_output=True, text=True, timeout=10)

        # 读取生成的svg
        with open(tmp_svg.name, "r", encoding="utf-8") as f:
            svg = f.read()
        return svg

    except Exception as err:
        print(f"[Potrace 执行失败] {err}")
        return None
    finally:
        # 强制清理临时文件
        temp_files = [tmp_png.name, tmp_svg.name]
        for f_path in temp_files:
            if os.path.exists(f_path):
                os.unlink(f_path)