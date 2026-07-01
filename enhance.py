import os
import io
import base64
import zipfile
import traceback
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np
import cv2

enhance_bp = Blueprint('enhance', __name__)

def enhance_single_image(image_path):
    try:
        img = Image.open(image_path).convert('RGB')
        img_array = np.array(img)
        
        # ========== 核心替换：均值漂移（专门用来同化颜色）==========
        # sp: 空间半径（越大，越忽略物理距离远的像素，建议 5~15）
        # sr: 颜色半径（越大，色差小的越容易被同化，针对你的需求设到 30~50）
        # maxLevel: 金字塔层数，加快速度
        mean_shifted = cv2.pyrMeanShiftFiltering(
            img_array, 
            sp=10,          # 空间窗口半径
            sr=45,          # 颜色窗口半径（关键！45意味着色差小于45的都视为同类）
            maxLevel=2,
            termcrit=(cv2.TERM_CRITERIA_MAX_ITER, 5, 1)
        )
        
        # ========== 微调：轻微增强对比度让边缘更清晰 ==========
        result = Image.fromarray(mean_shifted)
        enhancer = ImageEnhance.Contrast(result)
        result = enhancer.enhance(1.1)  # 稍微提一点对比度，帮助VTracer区分边缘
        
        # ========== 保存 ==========
        output_buffer = io.BytesIO()
        result.save(output_buffer, format='PNG', optimize=True)
        output_buffer.seek(0)
        base64_data = base64.b64encode(output_buffer.read()).decode('utf-8')
        return f"data:image/png;base64,{base64_data}", None
        
    except Exception as e:
        traceback.print_exc()
        return None, str(e)

@enhance_bp.route('/api/enhance', methods=['POST'])
@login_required
def enhance_image():
    """单图增强"""
    if 'image' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400

    safe_name = secure_filename(file.filename) or 'image.png'
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique_name = f"enhance_{timestamp}_{current_user.id}_{safe_name}"
    image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
    file.save(image_path)

    try:
        enhanced_base64, error = enhance_single_image(image_path)
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify({
            'enhanced_image': enhanced_base64,
            'filename': safe_name
        })
    finally:
        if os.path.exists(image_path):
            os.unlink(image_path)

@enhance_bp.route('/api/enhance/batch', methods=['POST'])
@login_required
def enhance_batch():
    """批量增强"""
    if 'images' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    
    files = request.files.getlist('images')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': '文件名为空'}), 400
    
    if len(files) > 20:
        return jsonify({'error': '一次最多增强20张图片'}), 400

    results = []
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')

    for idx, file in enumerate(files):
        if file.filename == '':
            continue
        
        safe_name = secure_filename(file.filename) or f'image_{idx}.png'
        unique_name = f"enhance_{timestamp}_{current_user.id}_{idx}_{safe_name}"
        image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
        file.save(image_path)

        enhanced_base64, error = enhance_single_image(image_path)
        
        if error:
            results.append({
                'filename': safe_name,
                'success': False,
                'error': error
            })
        else:
            results.append({
                'filename': safe_name,
                'success': True,
                'enhanced_image': enhanced_base64
            })
        
        if os.path.exists(image_path):
            os.unlink(image_path)

    return jsonify({
        'total': len(results),
        'success_count': sum(1 for r in results if r['success']),
        'results': results
    })

@enhance_bp.route('/api/enhance/batch/download', methods=['POST'])
@login_required
def batch_enhance_download():
    """批量下载增强后的图片为 ZIP"""
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
        download_name='enhanced_images.zip',
        as_attachment=True,
        mimetype='application/zip'
    )