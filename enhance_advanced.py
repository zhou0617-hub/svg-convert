import os
import io
import base64
import zipfile
import traceback
import sys
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from PIL import Image, ImageEnhance
import numpy as np
import cv2

enhance_advanced_bp = Blueprint('enhance_advanced', __name__)


def enhance_single_image_advanced(image_path):
    """图像增强：去噪 + 锐化 + 对比度 + 饱和度"""
    try:
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        img_array = np.array(img)
        h, w = img_array.shape[:2]
        
        # 判断是否小图（需要超分辨率）
        do_super_res = max(h, w) < 800
        
        if do_super_res:
            # 超分辨率：放大 2 倍
            img_array = cv2.resize(img_array, (w*2, h*2), interpolation=cv2.INTER_LANCZOS4)
        
        # ===== 步骤 1: 降噪 =====
        # 对亮度通道做 NLM 降噪，色度通道轻度平滑
        ycbcr = cv2.cvtColor(img_array, cv2.COLOR_RGB2YCrCb)
        y, cr, cb = cv2.split(ycbcr)
        
        # NLM 去噪（强度 8，较强但不过度）
        y_denoised = cv2.fastNlMeansDenoising(y, None, h=8, templateWindowSize=7, searchWindowSize=21)
        
        # 色度通道轻度中值滤波（去色度噪点，不跨边缘）
        cr_smooth = cv2.medianBlur(cr, 3)
        cb_smooth = cv2.medianBlur(cb, 3)
        
        # 合并回 RGB
        denoised = cv2.cvtColor(cv2.merge([y_denoised, cr_smooth, cb_smooth]), cv2.COLOR_YCrCb2RGB)
        
        # ===== 步骤 2: 双边滤波（保护边缘的平滑） =====
        # sigmaColor=35: 合并相似颜色，让渐变平滑
        # sigmaSpace=35: 空间范围适中
        smoothed = cv2.bilateralFilter(denoised, 9, 35, 35)
        
        # ===== 步骤 3: Unsharp Mask 锐化（强） =====
        # 高斯模糊半径 3.0，强度 2.5
        blurred = cv2.GaussianBlur(smoothed, (0, 0), 3.0)
        high_freq = smoothed.astype(np.float32) - blurred.astype(np.float32)
        sharpened = smoothed.astype(np.float32) + high_freq * 1.5  # 1.5 = 额外增强 50%
        sharpened = np.clip(sharpened, 0, 255).astype(np.uint8)
        
        # ===== 步骤 4: 再次轻度双边滤波（消除锐化 halo） =====
        final = cv2.bilateralFilter(sharpened, 5, 15, 15)
        
        # 缩放回原始尺寸
        if do_super_res:
            final = cv2.resize(final, (w, h), interpolation=cv2.INTER_LANCZOS4)
        
        # ===== 步骤 5: PIL 增强 =====
        result = Image.fromarray(final)
        
        # 对比度 +20%
        enhancer = ImageEnhance.Contrast(result)
        result = enhancer.enhance(1.2)
        
        # 锐度 +40%
        enhancer = ImageEnhance.Sharpness(result)
        result = enhancer.enhance(1.4)
        
        # 饱和度 +10%
        enhancer = ImageEnhance.Color(result)
        result = enhancer.enhance(1.1)
        
        # 亮度微调 +5%
        enhancer = ImageEnhance.Brightness(result)
        result = enhancer.enhance(1.05)
        
        output_buffer = io.BytesIO()
        result.save(output_buffer, format='PNG', optimize=True)
        output_buffer.seek(0)
        base64_data = base64.b64encode(output_buffer.read()).decode('utf-8')
        
        return f"data:image/png;base64,{base64_data}", None
        
    except Exception as e:
        traceback.print_exc()
        return None, str(e)


@enhance_advanced_bp.route('/api/enhance/advanced', methods=['POST'])
@login_required
def enhance_image_advanced():
    if 'image' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400

    safe_name = secure_filename(file.filename) or 'image.png'
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique_name = f"enhance_adv_{timestamp}_{current_user.id}_{safe_name}"
    image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
    file.save(image_path)

    try:
        enhanced_base64, error = enhance_single_image_advanced(image_path)
        if error:
            return jsonify({'error': error}), 500
        return jsonify({
            'enhanced_image': enhanced_base64,
            'filename': safe_name,
            'mode': 'advanced'
        })
    finally:
        if os.path.exists(image_path):
            os.unlink(image_path)


@enhance_advanced_bp.route('/api/enhance/advanced/batch', methods=['POST'])
@login_required
def enhance_batch_advanced():
    if 'images' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    files = request.files.getlist('images')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': '文件名为空'}), 400
    if len(files) > 10:
        return jsonify({'error': '高级模式一次最多处理10张图片'}), 400

    results = []
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    for idx, file in enumerate(files):
        if file.filename == '':
            continue
        safe_name = secure_filename(file.filename) or f'image_{idx}.png'
        unique_name = f"enhance_adv_{timestamp}_{current_user.id}_{idx}_{safe_name}"
        image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
        file.save(image_path)
        enhanced_base64, error = enhance_single_image_advanced(image_path)
        if error:
            results.append({'filename': safe_name, 'success': False, 'error': error})
        else:
            results.append({'filename': safe_name, 'success': True, 'enhanced_image': enhanced_base64})
        if os.path.exists(image_path):
            os.unlink(image_path)

    return jsonify({
        'total': len(results),
        'success_count': sum(1 for r in results if r['success']),
        'results': results
    })


@enhance_advanced_bp.route('/api/enhance/advanced/batch/download', methods=['POST'])
@login_required
def batch_enhance_advanced_download():
    data = request.get_json()
    images = data.get('images', [])
    if not images:
        return jsonify({'error': '没有要下载的图片'}), 400
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for item in images:
            filename = item.get('filename', 'untitled.png')
            image_data = item.get('image', '')
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            try:
                binary_data = base64.b64decode(image_data)
                zf.writestr(filename, binary_data)
            except:
                continue
    memory_file.seek(0)
    return send_file(
        memory_file,
        download_name='enhanced_advanced_images.zip',
        as_attachment=True,
        mimetype='application/zip'
    )

def enhance_for_vectorize(image_path):
    """
    矢量化专属图像增强：保色块、净边缘、轻降噪
    完全适配 vtracer 算法，不会出现填充丢失、发灰镂空的问题
    """
    try:
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        img_array = np.array(img)
        h, w = img_array.shape[:2]

        # 小图超分：只放大不缩小，给矢量化提供更高分辨率输入
        do_super_res = max(h, w) < 800
        if do_super_res:
            img_array = cv2.resize(img_array, (w*2, h*2), interpolation=cv2.INTER_LANCZOS4)

        # 1. 分通道降噪：只去噪，不糊边缘
        ycbcr = cv2.cvtColor(img_array, cv2.COLOR_RGB2YCrCb)
        y, cr, cb = cv2.split(ycbcr)
        
        # 亮度通道轻度NLM降噪，消除压缩噪点
        y_denoised = cv2.fastNlMeansDenoising(y, None, h=4, templateWindowSize=7, searchWindowSize=21)
        # 色度通道强平滑，让渐变更连续、色块更均匀
        cr_smooth = cv2.GaussianBlur(cr, (5,5), 1.5)
        cb_smooth = cv2.GaussianBlur(cb, (5,5), 1.5)
        
        denoised = cv2.cvtColor(cv2.merge([y_denoised, cr_smooth, cb_smooth]), cv2.COLOR_YCrCb2RGB)

        # 2. 强双边滤波：合并相似颜色，让纯色块更均匀、渐变更顺滑
        smoothed = cv2.bilateralFilter(denoised, d=9, sigmaColor=40, sigmaSpace=6)

        # 3. 极轻度锐化：只强化主边缘，不产生光晕
        blurred = cv2.GaussianBlur(smoothed, (0, 0), 3.0)
        high_freq = smoothed.astype(np.float32) - blurred.astype(np.float32)
        sharpened = smoothed.astype(np.float32) + high_freq * 0.4  # 强度极低，无光晕
        sharpened = np.clip(sharpened, 0, 255).astype(np.uint8)

        # 4. 极微调色：绝对不碰对比度、饱和度，保护色块均匀性
        result = Image.fromarray(sharpened)
        enhancer = ImageEnhance.Brightness(result)
        result = enhancer.enhance(1.02)

        # 直接返回 PIL 对象，给矢量化模块调用（不用转base64）
        return result, None
        
    except Exception as e:
        traceback.print_exc()
        return None, str(e)