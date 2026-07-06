import os
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
import io
import zipfile

history_bp = Blueprint('history', __name__)

@history_bp.route('/api/history', methods=['GET'])
@login_required
def get_history():
    db = current_app.get_db()
    cur = db.execute(
        'SELECT id, original_filename, image_path, create_time FROM history WHERE user_id = %s ORDER BY create_time DESC',
        (current_user.id,)
    )
    rows = cur.fetchall()
    history = []
    for row in rows:
        history.append({
            'id': row['id'],
            'filename': row['original_filename'],
            'image_url': f'/api/files/{os.path.basename(row["image_path"])}',
            'created_at': row['create_time']
        })
    return jsonify(history)

@history_bp.route('/api/history/<int:history_id>', methods=['DELETE'])
@login_required
def delete_history(history_id):
    db = current_app.get_db()
    cur = db.execute('SELECT * FROM history WHERE id = %s AND user_id = %s', (history_id, current_user.id))
    row = cur.fetchone()
    if not row:
        return jsonify({'error': '记录不存在'}), 404
    if os.path.exists(row['image_path']):
        os.remove(row['image_path'])
    db.execute('DELETE FROM history WHERE id = %s', (history_id,))
    db.commit()
    return jsonify({'message': '已删除'})

@history_bp.route('/api/history/<int:history_id>/svg', methods=['GET'])
@login_required
def get_history_svg(history_id):
    db = current_app.get_db()
    cur = db.execute('SELECT svg_text FROM history WHERE id = %s AND user_id = %s', (history_id, current_user.id))
    row = cur.fetchone()
    if not row:
        return jsonify({'error': '记录不存在'}), 404
    return jsonify({'svg': row['svg_text']})

@history_bp.route('/api/history/<int:history_id>/detail', methods=['GET'])
@login_required
def get_history_detail(history_id):
    db = current_app.get_db()
    cur = db.execute(
        'SELECT id, original_filename, image_path, svg_text, create_time FROM history WHERE id = %s AND user_id = %s',
        (history_id, current_user.id)
    )
    row = cur.fetchone()
    if not row:
        return jsonify({'error': '记录不存在'}), 404
    return jsonify({
        'id': row['id'],
        'filename': row['original_filename'],
        'image_url': f'/api/files/{os.path.basename(row["image_path"])}',
        'svg_text': row['svg_text'],
        'created_at': row['create_time']
    })

@history_bp.route('/api/history/batch', methods=['DELETE'])
@login_required
def batch_delete_history():
    data = request.get_json()
    ids = data.get('ids', [])
    if not ids:
        return jsonify({'error': '未选择记录'}), 400
    db = current_app.get_db()
    placeholders = ','.join(['%s'] * len(ids))
    cur = db.execute(
        f'SELECT id, image_path FROM history WHERE id IN ({placeholders}) AND user_id = %s',
        (*ids, current_user.id)
    )
    rows = cur.fetchall()
    deleted = 0
    for row in rows:
        if os.path.exists(row['image_path']):
            os.remove(row['image_path'])
        db.execute('DELETE FROM history WHERE id = %s', (row['id'],))
        deleted += 1
    db.commit()
    return jsonify({'message': f'已删除 {deleted} 条记录', 'deleted': deleted})

@history_bp.route('/api/history/export', methods=['POST'])
@login_required
def export_history():
    data = request.get_json()
    ids = data.get('ids', [])
    if not ids:
        return jsonify({'error': '未选择记录'}), 400
    db = current_app.get_db()
    placeholders = ','.join(['%s'] * len(ids))
    cur = db.execute(
        f'SELECT original_filename, svg_text FROM history WHERE id IN ({placeholders}) AND user_id = %s',
        (*ids, current_user.id)
    )
    rows = cur.fetchall()
    if not rows:
        return jsonify({'error': '没有找到记录'}), 404
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for row in rows:
            filename = row['original_filename']
            if not filename.endswith('.svg'):
                filename = filename.rsplit('.', 1)[0] + '.svg'
            zf.writestr(filename, row['svg_text'])
    memory_file.seek(0)
    return send_file(
        memory_file,
        download_name='history_export.zip',
        as_attachment=True,
        mimetype='application/zip'
    )