# semantic_segment.py
import cv2
import numpy as np

def segment_regions(img_cv, config):
    if not config["segment"]["enable"]:
        return None, None, None
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    h, w = img_cv.shape[:2]
    edges = cv2.Canny(img_cv, 80, 220)
    dark_mask = gray < 70
    line_mask = edges.astype(bool) & dark_mask
    kernel = np.ones((config["segment"]["line_thickness"], config["segment"]["line_thickness"]), np.uint8)
    line_mask = cv2.dilate(line_mask.astype(np.uint8), kernel, iterations=1).astype(bool)
    # 渐变区域优化，避开线条
    ycbcr = cv2.cvtColor(img_cv, cv2.COLOR_BGR2YCrCb)
    y = ycbcr[:,:,0]
    grad_x = cv2.Sobel(y, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(y, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(grad_x**2 + grad_y**2)
    gradient_mask = (grad_mag > 3) & (grad_mag < 30) & ~line_mask
    fill_mask = ~line_mask & ~gradient_mask
    return line_mask, fill_mask, gradient_mask