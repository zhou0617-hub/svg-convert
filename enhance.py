import os
import io
import base64
import zipfile
import traceback
import subprocess
import tempfile
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np
import cv2

enhance_bp = Blueprint('enhance', __name__)

# ==================== Real-ESRGAN 调用 ====================

def upscale_with_realesrgan(input_path, output_path, scale=4):
    """使用 realesrgan-ncnn-vulkan 工具进行超分"""
    try:
        # 工具路径（根据你解压的位置调整）
        tool_dir = os.path.join(os.path.dirname(__file__), 'tools', 'realesrgan-ncnn-vulkan')
        exe_path = os.path.join(tool_dir, 'realesrgan-ncnn-vulkan.exe')
        
        # 如果工具不存在，尝试在系统 PATH 中查找
        if not os.path.exists(exe_path):
            import shutil
            exe_path = shutil.which('realesrgan-ncnn-vulkan')
            if not exe_path:
                raise RuntimeError("找不到 realesrgan-ncnn-vulkan.exe，请确认已下载到 tools/ 目录")
        
        # 构建命令
        cmd = [
            exe_path,
            "-i", input_path,
            "-o", output_path,
            "-s", str(scale),  # 放大倍数：2、4
            "-n", "realesrgan-x4plus",  # 默认模型
            "-f", "png"  # 输出格式
        ]
        
        print(f"执行命令: {' '.join(cmd)}")
        
        # 执行命令
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,  # 超分适当延长超时时间
            encoding='utf-8',
            errors='ignore'
        )
        
        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or "未知错误"
            raise RuntimeError(f"Real-ESRGAN 执行失败: {error_msg}")
        
        if not os.path.exists(output_path):
            raise RuntimeError("Real-ESRGAN 未生成输出文件")
        
        return output_path
        
    except subprocess.TimeoutExpired:
        raise RuntimeError("Real-ESRGAN 超时（超过120秒）")
    except Exception as e:
        traceback.print_exc()
        raise RuntimeError(f"超分失败: {str(e)}")

# ==================== 核心增强算法 ====================

def enhance_basic(image_path):
    """普通模式：均值漂移色块同化，优化 SVG 转换效果（保留给转SVG前置优化用）"""
    try:
        img = Image.open(image_path).convert('RGB')
        img_array = np.array(img)
        
        mean_shifted = cv2.pyrMeanShiftFiltering(
            img_array, 
            sp=10,
            sr=45,
            maxLevel=2,
            termcrit=(cv2.TERM_CRITERIA_MAX_ITER, 5, 1)
        )
        
        result = Image.fromarray(mean_shifted)
        enhancer = ImageEnhance.Contrast(result)
        result = enhancer.enhance(1.1)
        
        output_buffer = io.BytesIO()
        result.save(output_buffer, format='PNG', optimize=True)
        output_buffer.seek(0)
        base64_data = base64.b64encode(output_buffer.read()).decode('utf-8')
        return f"data:image/png;base64,{base64_data}", result, None
    except Exception as e:
        traceback.print_exc()
        return None, None, str(e)

def enhance_self(image_path):
    """自研画质增强：纯传统算法，不调用AI超分（对应前端「自研画质增强」入口）"""
    try:
        img = Image.open(image_path).convert('RGB')
        img_array = np.array(img)
        h, w = img_array.shape[:2]
        
        # 分通道降噪
        ycbcr = cv2.cvtColor(img_array, cv2.COLOR_RGB2YCrCb)
        y, cr, cb = cv2.split(ycbcr)
        y_denoised = cv2.fastNlMeansDenoising(y, None, h=8, templateWindowSize=7, searchWindowSize=21)
        cr_smooth = cv2.medianBlur(cr, 3)
        cb_smooth = cv2.medianBlur(cb, 3)
        denoised = cv2.cvtColor(cv2.merge([y_denoised, cr_smooth, cb_smooth]), cv2.COLOR_YCrCb2RGB)
        
        # 双边滤波保边缘
        smoothed = cv2.bilateralFilter(denoised, 7, 25, 25)
        
        # Unsharp Mask 锐化（轻度）
        blurred = cv2.GaussianBlur(smoothed, (0, 0), 2.0)
        high_freq = smoothed.astype(np.float32) - blurred.astype(np.float32)
        sharpened = smoothed.astype(np.float32) + high_freq * 0.8
        sharpened = np.clip(sharpened, 0, 255).astype(np.uint8)
        
        # 轻度消光晕
        final = cv2.bilateralFilter(sharpened, 5, 15, 15)
        
        # 自适应直方图均衡化（平衡曝光）
        lab = cv2.cvtColor(final, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        lab = cv2.merge([l, a, b])
        final = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
        
        result = Image.fromarray(final)
        
        # 轻度增强
        enhancer = ImageEnhance.Contrast(result)
        result = enhancer.enhance(1.05)
        enhancer = ImageEnhance.Sharpness(result)
        result = enhancer.enhance(1.1)
        enhancer = ImageEnhance.Color(result)
        result = enhancer.enhance(1.05)
        
        # 高光修剪
        img_array = np.array(result)
        img_array = np.clip(img_array, 0, 255)
        mask = img_array > 235
        img_array[mask] = img_array[mask] * 0.8 + 50
        result = Image.fromarray(img_array.astype(np.uint8))
        
        output_buffer = io.BytesIO()
        result.save(output_buffer, format='PNG', optimize=True)
        output_buffer.seek(0)
        base64_data = base64.b64encode(output_buffer.read()).decode('utf-8')
        return f"data:image/png;base64,{base64_data}", result, None
    except Exception as e:
        traceback.print_exc()
        return None, None, str(e)

def enhance_super_res(image_path, scale=4):
    """Real-ESRGAN 纯超分：只做AI放大，不叠加传统增强（对应前端「Real-ESRGAN 超清超分」入口）"""
    try:
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_out:
            ai_output_path = tmp_out.name
        
        try:
            # 纯超分处理
            upscale_with_realesrgan(image_path, ai_output_path, scale=scale)
            img = Image.open(ai_output_path)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # 超分后仅做基础格式优化，不叠加画质算法
            img_array = np.array(img)
            # 轻度抗锯齿
            final = cv2.bilateralFilter(img_array, 3, 10, 10)
            result = Image.fromarray(final)
            
            output_buffer = io.BytesIO()
            result.save(output_buffer, format='PNG', optimize=True)
            output_buffer.seek(0)
            base64_data = base64.b64encode(output_buffer.read()).decode('utf-8')
            return f"data:image/png;base64,{base64_data}", result, None
            
        finally:
            # 清理临时文件
            if os.path.exists(ai_output_path):
                try:
                    os.unlink(ai_output_path)
                except:
                    pass
    except Exception as e:
        traceback.print_exc()
        return None, None, str(e)

# 兼容旧调用（保留原函数名，内部转发）
def enhance_advanced(image_path, use_ai=True):
    if use_ai:
        return enhance_super_res(image_path)
    else:
        return enhance_self(image_path)

# ==================== API 接口 ====================

@enhance_bp.route('/api/enhance', methods=['POST'])
@login_required
def enhance_image():
    """单图增强：支持 self（自研增强）/ realesrgan（超分）两种模式"""
    if 'image' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400
    
    mode = request.form.get('mode', 'self')
    safe_name = secure_filename(file.filename) or 'image.png'
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique_name = f"enhance_{timestamp}_{current_user.id}_{safe_name}"
    image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
    file.save(image_path)
    
    try:
        if mode == 'realesrgan':
            enhanced_base64, _, error = enhance_super_res(image_path)
        else:
            # 默认走自研增强
            enhanced_base64, _, error = enhance_self(image_path)
        
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify({
            'enhanced_image': enhanced_base64,
            'filename': safe_name,
            'mode': mode
        })
    finally:
        if os.path.exists(image_path):
            os.unlink(image_path)

@enhance_bp.route('/api/enhance/convert', methods=['POST'])
@login_required
def enhance_and_convert():
    """增强后直接转 SVG：支持两种增强模式"""
    if 'image' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400
    
    mode = request.form.get('mode', 'self')
    safe_name = secure_filename(file.filename) or 'image.png'
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique_name = f"enh_conv_{timestamp}_{current_user.id}_{safe_name}"
    image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
    file.save(image_path)
    
    try:
        # 第一步：增强处理
        if mode == 'realesrgan':
            _, pil_img, error = enhance_super_res(image_path)
        else:
            _, pil_img, error = enhance_self(image_path)
        
        if error:
            return jsonify({'error': f'增强失败: {error}'}), 500
        
        # 保存增强后的临时图片
        enhanced_path = image_path + '_enhanced.png'
        pil_img.save(enhanced_path, format='PNG')
        
        # 第二步：调用转换逻辑
        from convert import run_conversion
        svg_text, convert_error = run_conversion(enhanced_path)
        
        if convert_error:
            return jsonify({'error': f'转换失败: {convert_error}'}), 500
        
        # 写入历史记录
        db = current_app.get_db()
        db.execute(
            'INSERT INTO history (user_id, original_filename, image_path, svg_text) VALUES (?, ?, ?, ?)',
            (current_user.id, safe_name, enhanced_path, svg_text)
        )
        db.commit()
        record_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        return jsonify({
            'svg': svg_text,
            'history_id': record_id,
            'filename': safe_name,
            'enhanced_mode': mode
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(image_path):
            try: os.unlink(image_path)
            except: pass

@enhance_bp.route('/api/enhance/batch', methods=['POST'])
@login_required
def enhance_batch():
    """批量增强：两种模式分开限制数量"""
    if 'images' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    
    files = request.files.getlist('images')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': '文件名为空'}), 400
    
    mode = request.form.get('mode', 'self')
    # 超分更耗时，限制更少数量
    max_count = 5 if mode == 'realesrgan' else 20
    if len(files) > max_count:
        return jsonify({'error': f'该模式一次最多处理{max_count}张图片'}), 400
    
    results = []
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    
    for idx, file in enumerate(files):
        if file.filename == '':
            continue
        
        safe_name = secure_filename(file.filename) or f'image_{idx}.png'
        unique_name = f"enhance_{timestamp}_{current_user.id}_{idx}_{safe_name}"
        image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
        file.save(image_path)
        
        if mode == 'realesrgan':
            enhanced_base64, _, error = enhance_super_res(image_path)
        else:
            enhanced_base64, _, error = enhance_self(image_path)
        
        if error:
            results.append({'filename': safe_name, 'success': False, 'error': error})
        else:
            results.append({'filename': safe_name, 'success': True, 'enhanced_image': enhanced_base64})
        
        if os.path.exists(image_path):
            os.unlink(image_path)
    
    return jsonify({
        'total': len(results),
        'success_count': sum(1 for r in results if r.get('success')),
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