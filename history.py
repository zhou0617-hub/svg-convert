import os
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user

history_bp = Blueprint('history', __name__)

@history_bp.route('/api/history', methods=['GET'])
@login_required
def get_history():
    db = current_app.get_db()
    rows = db.execute(
        'SELECT id, original_filename, image_path, created_at FROM history WHERE user_id = ? ORDER BY created_at DESC',
        (current_user.id,)
    ).fetchall()
    history = []
    for row in rows:
        history.append({
            'id': row['id'],
            'filename': row['original_filename'],
            'image_url': f'/api/files/{os.path.basename(row["image_path"])}',
            'created_at': row['created_at']
        })
    return jsonify(history)

@history_bp.route('/api/history/<int:history_id>', methods=['DELETE'])
@login_required
def delete_history(history_id):
    db = current_app.get_db()
    row = db.execute('SELECT * FROM history WHERE id = ? AND user_id = ?',
                     (history_id, current_user.id)).fetchone()
    if not row:
        return jsonify({'error': '记录不存在'}), 404
    if os.path.exists(row['image_path']):
        os.remove(row['image_path'])
    db.execute('DELETE FROM history WHERE id = ?', (history_id,))
    db.commit()
    return jsonify({'message': '已删除'})

@history_bp.route('/api/history/<int:history_id>/svg', methods=['GET'])
@login_required
def get_history_svg(history_id):
    db = current_app.get_db()
    row = db.execute('SELECT svg_text FROM history WHERE id = ? AND user_id = ?',
                     (history_id, current_user.id)).fetchone()
    if not row:
        return jsonify({'error': '记录不存在'}), 404
    return jsonify({'svg': row['svg_text']})

@history_bp.route('/api/history/batch', methods=['DELETE'])
@login_required
def batch_delete_history():
    data = request.get_json()
    ids = data.get('ids', [])
    if not ids:
        return jsonify({'error': '未选择记录'}), 400
    
    db = current_app.get_db()
    # 只删除属于当前用户的记录
    placeholders = ','.join('?' * len(ids))
    rows = db.execute(
        f'SELECT id, image_path FROM history WHERE id IN ({placeholders}) AND user_id = ?',
        (*ids, current_user.id)
    ).fetchall()
    
    deleted = 0
    for row in rows:
        if os.path.exists(row['image_path']):
            os.remove(row['image_path'])
        db.execute('DELETE FROM history WHERE id = ?', (row['id'],))
        deleted += 1
    
    db.commit()
    return jsonify({'message': f'已删除 {deleted} 条记录', 'deleted': deleted})