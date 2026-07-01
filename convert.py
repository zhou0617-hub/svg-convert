import os
import sys
import subprocess
import zipfile
import io
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
import json
import threading

convert_bp = Blueprint('convert', __name__)

def run_conversion(image_path, user_params=None):
    worker_script = os.path.join(os.path.dirname(__file__), 'convert_worker.py')
    cmd = [sys.executable, worker_script, image_path]
    if user_params and isinstance(user_params, dict):
        cmd.append(json.dumps(user_params))
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            encoding="utf-8",
            errors="replace",
            bufsize=0,  # 禁用缓冲区
            universal_newlines=True
        )
        print("====worker stderr完整日志====")
        print(result.stderr)
        print("====worker stdout完整日志====")
        if result.returncode != 0:
            return None, f"脚本异常退出：{result.stderr}"
        svg_text = result.stdout.strip()
        if not svg_text or '</svg>' not in svg_text:
            return None, '生成的 SVG 格式无效'
        return svg_text, None
    except subprocess.TimeoutExpired:
        return None, '转换超时'
    except Exception as e:
        return None, f"调用脚本异常：{str(e)}"

@convert_bp.route('/api/convert', methods=['POST'])
@login_required
def convert_single():
    """单图转换（新增读取前端矢量参数）"""
    if 'image' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400
    
    # 读取前端传递的矢量配置参数
    user_params = {}
    params_raw = request.form.get("params", "")
    if params_raw:
        try:
            user_params = json.loads(params_raw)
        except json.JSONDecodeError:
            user_params = {}

    safe_name = secure_filename(file.filename) or 'image.png'
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique_name = f"{timestamp}_{current_user.id}_{safe_name}"
    image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
    file.save(image_path)
    # 传入用户自定义参数执行转换
    svg_text, error = run_conversion(image_path, user_params)
    if error:
        return jsonify({'error': error}), 500
    db = current_app.get_db()
    db.execute(
        'INSERT INTO history (user_id, original_filename, image_path, svg_text) VALUES (?, ?, ?, ?)',
        (current_user.id, safe_name, image_path, svg_text)
    )
    db.commit()
    record_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    return jsonify({'svg': svg_text, 'history_id': record_id, 'filename': safe_name})

@convert_bp.route('/api/convert/batch', methods=['POST'])
@login_required
def convert_batch():
    """批量转换（同步接收前端统一参数）"""
    if 'images' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    
    # 全局批量统一矢量参数
    user_params = {}
    params_raw = request.form.get("params", "")
    if params_raw:
        try:
            user_params = json.loads(params_raw)
        except json.JSONDecodeError:
            user_params = {}

    files = request.files.getlist('images')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': '文件名为空'}), 400
    
    if len(files) > 20:
        return jsonify({'error': '一次最多转换20张图片'}), 400
    results = []
    db = current_app.get_db()
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    for idx, file in enumerate(files):
        if file.filename == '':
            continue
        
        safe_name = secure_filename(file.filename) or f'image_{idx}.png'
        unique_name = f"{timestamp}_{current_user.id}_{idx}_{safe_name}"
        image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
        file.save(image_path)
        # 批量每张图共用前端参数
        svg_text, error = run_conversion(image_path, user_params)
        
        if error:
            results.append({
                'filename': safe_name,
                'success': False,
                'error': error
            })
            continue
        db.execute(
            'INSERT INTO history (user_id, original_filename, image_path, svg_text) VALUES (?, ?, ?, ?)',
            (current_user.id, safe_name, image_path, svg_text)
        )
        db.commit()
        record_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        results.append({
            'filename': safe_name,
            'success': True,
            'svg': svg_text,
            'history_id': record_id
        })
    return jsonify({
        'total': len(results),
        'success_count': sum(1 for r in results if r['success']),
        'results': results
    })

@convert_bp.route('/api/convert/batch/download', methods=['POST'])
@login_required
def batch_download():
    """批量下载为 ZIP（无修改，原样保留）"""
    data = request.get_json()
    svg_list = data.get('svgs', [])
    
    if not svg_list:
        return jsonify({'error': '没有要下载的 SVG'}), 400
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for item in svg_list:
            filename = item.get('filename', 'untitled.svg')
            svg = item.get('svg', '')
            if not filename.endswith('.svg'):
                filename = filename.rsplit('.', 1)[0] + '.svg'
            zf.writestr(filename, svg)
    
    memory_file.seek(0)
    return send_file(
        memory_file,
        download_name='svg_converts.zip',
        as_attachment=True,
        mimetype='application/zip'
    )