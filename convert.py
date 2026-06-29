import os
import sys
import subprocess
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

convert_bp = Blueprint('convert', __name__)

@convert_bp.route('/api/convert', methods=['POST'])
@login_required
def convert_to_svg():
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

    worker_script = os.path.join(os.path.dirname(__file__), 'convert_worker.py')
    try:
        result = subprocess.run(
            [sys.executable, worker_script, image_path],
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode != 0:
            return jsonify({'error': f'转换失败: {result.stderr.strip()}'}), 500
        svg_text = result.stdout.strip()
        if not svg_text or '</svg>' not in svg_text:
            return jsonify({'error': '生成的 SVG 格式无效'}), 500
    except Exception as e:
        return jsonify({'error': f'服务器内部错误: {str(e)}'}), 500

    db = current_app.get_db()
    db.execute(
        'INSERT INTO history (user_id, original_filename, image_path, svg_text) VALUES (?, ?, ?, ?)',
        (current_user.id, safe_name, image_path, svg_text)
    )
    db.commit()
    record_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    return jsonify({'svg': svg_text, 'history_id': record_id})
