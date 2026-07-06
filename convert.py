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
from task_manager import cancel_flag, current_process, process_lock, reset_task_state

convert_bp = Blueprint('convert', __name__)

def run_conversion(image_path):
    worker_script = os.path.join(os.path.dirname(__file__), 'convert_worker.py')
    reset_task_state()
    try:
        cmd = [sys.executable, worker_script, image_path]
        creation_flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        p = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=creation_flags
        )
        with process_lock:
            current_process = p
        while True:
            if cancel_flag.is_set():
                p.terminate()
                p.wait(timeout=2)
                return None, '任务已取消'
            try:
                stdout, stderr = p.communicate(timeout=0.3)
                break
            except subprocess.TimeoutExpired:
                continue
        if cancel_flag.is_set():
            return None, '任务已取消'
        if p.returncode != 0:
            return None, stderr.strip() or '转换失败'
        svg_text = stdout.strip()
        if not svg_text or '</svg>' not in svg_text:
            return None, '生成的 SVG 格式无效'
        return svg_text, None
    except subprocess.TimeoutExpired:
        return None, '转换超时'
    except Exception as e:
        return None, str(e)
    finally:
        with process_lock:
            current_process = None

@convert_bp.route('/api/convert', methods=['POST'])
@login_required
def convert_single():
    if 'image' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400
    safe_name = secure_filename(file.filename) or 'image.png'
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique_name = f"{timestamp}_{current_user.id}_{safe_name}"
    image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
    file.save(image_path)
    svg_text, error = run_conversion(image_path)
    if error:
        if error == '任务已取消':
            return jsonify({'error': error}), 499
        return jsonify({'error': error}), 500
    db = current_app.get_db()
    db.execute(
        'INSERT INTO history (user_id, original_filename, image_path, svg_text) VALUES (%s, %s, %s, %s)',
        (current_user.id, safe_name, image_path, svg_text)
    )
    db.commit()
    cur = db.execute('SELECT LAST_INSERT_ID()')
    record_id = cur.lastrowid
    return jsonify({'svg': svg_text, 'history_id': record_id, 'filename': safe_name})

@convert_bp.route('/api/convert/batch', methods=['POST'])
@login_required
def convert_batch():
    if 'images' not in request.files:
        return jsonify({'error': '没有上传图片'}), 400
    files = request.files.getlist('images')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': '文件名为空'}), 400
    if len(files) > 20:
        return jsonify({'error': '一次最多转换20张图片'}), 400
    reset_task_state()
    results = []
    db = current_app.get_db()
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    for idx, file in enumerate(files):
        if cancel_flag.is_set():
            results.append({
                'filename': secure_filename(file.filename) or f'image_{idx}.png',
                'success': False,
                'error': '任务已取消'
            })
            continue
        if file.filename == '':
            continue
        safe_name = secure_filename(file.filename) or f'image_{idx}.png'
        unique_name = f"{timestamp}_{current_user.id}_{idx}_{safe_name}"
        image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
        file.save(image_path)
        svg_text, error = run_conversion(image_path)
        if error:
            results.append({
                'filename': safe_name,
                'success': False,
                'error': error
            })
            continue
        db.execute(
            'INSERT INTO history (user_id, original_filename, image_path, svg_text) VALUES (%s, %s, %s, %s)',
            (current_user.id, safe_name, image_path, svg_text)
        )
        db.commit()
        cur = db.execute('SELECT LAST_INSERT_ID()')
        record_id = cur.lastrowid
        results.append({
            'filename': safe_name,
            'success': True,
            'svg': svg_text,
            'history_id': record_id
        })
    if cancel_flag.is_set():
        return jsonify({
            'total': len(results),
            'success_count': sum(1 for r in results if r.get('success')),
            'results': results,
            'canceled': True
        }), 499
    return jsonify({
        'total': len(results),
        'success_count': sum(1 for r in results if r.get('success')),
        'results': results
    })

@convert_bp.route('/api/convert/batch/download', methods=['POST'])
@login_required
def batch_download():
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