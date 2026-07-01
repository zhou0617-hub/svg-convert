# ai_enhance.py
import cv2
import numpy as np
# 缺失的PIL导入补上
from PIL import Image, ImageEnhance

def color_quantize(img_cv, color_count):
    pixels = img_cv.reshape((-1, 3)).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, centers = cv2.kmeans(pixels, color_count, None, criteria, 8, cv2.KMEANS_RANDOM_CENTERS)
    return np.uint8(centers[labels]).reshape(img_cv.shape)

def remove_jpeg_artifact(img_cv):
    blur = cv2.bilateralFilter(img_cv, 5, 25, 25)
    return cv2.fastNlMeansDenoisingColored(blur, None, 3, 3, 5, 7)

def enhance_for_vectorize(img_cv, scale=1.8, max_side=2400, denoise_strength=6, contrast=1.15):
    h, w = img_cv.shape[:2]
    img_cv = remove_jpeg_artifact(img_cv)
    do_super_res = max(h, w) < 900
    if do_super_res:
        new_w, new_h = int(w * scale), int(h * scale)
        if max(new_w, new_h) > max_side:
            scale = max_side / max(w, h)
            new_w, new_h = int(w * scale)
        img_cv = cv2.resize(img_cv, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    ycbcr = cv2.cvtColor(img_cv, cv2.COLOR_BGR2YCrCb)
    y, cr, cb = cv2.split(ycbcr)

    y_denoised = cv2.fastNlMeansDenoising(y, None, h=denoise_strength, templateWindowSize=7, searchWindowSize=21)
    cr_smooth = cv2.GaussianBlur(cr, (11, 11), 3.5)
    cb_smooth = cv2.GaussianBlur(cb, (11, 11), 3.5)

    # 修复：必须合并 y cr cb 三个通道
    denoised = cv2.cvtColor(cv2.merge([y_denoised, cr_smooth, cb_smooth]), cv2.COLOR_YCrCb2BGR)
    smoothed = cv2.bilateralFilter(denoised, d=13, sigmaColor=70, sigmaSpace=70)

    kernel = np.ones((3, 3), np.uint8)
    smoothed = cv2.morphologyEx(smoothed, cv2.MORPH_CLOSE, kernel)

    pil_img = Image.fromarray(smoothed)
    pil_img = ImageEnhance.Contrast(pil_img).enhance(contrast)
    smoothed = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    total_pixel = h * w
    if total_pixel < 50000:
        quant_img = color_quantize(smoothed, 8)
    elif total_pixel < 500000:
        quant_img = color_quantize(smoothed, 24)
    else:
        quant_img = color_quantize(smoothed, 64)
    return quant_img

def enhance_image(img_cv, config):
    if not config["enhance"]["enable"]:
        return img_cv
    return enhance_for_vectorize(
        img_cv,
        scale=config["enhance"]["scale"],
        max_side=config["enhance"]["max_side"],
        denoise_strength=config["enhance"].get("denoise_strength", 6),
        contrast=config["enhance"].get("contrast_boost", 1.15)
    )