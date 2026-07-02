from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    if len(password) < 4:
        return jsonify({'error': '密码至少4位'}), 400

    db = current_app.get_db()
    try:
        db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                   (username, generate_password_hash(password)))
        db.commit()
        return jsonify({'message': '注册成功'})
    except sqlite3.IntegrityError:
        return jsonify({'error': '用户名已存在'}), 409

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    db = current_app.get_db()
    row = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not row or not check_password_hash(row['password_hash'], password):
        return jsonify({'error': '用户名或密码错误'}), 401
    user = current_app.User(row['id'], row['username'])
    login_user(user, remember=True)
    return jsonify({'message': '登录成功', 'username': user.username})

@auth_bp.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': '已登出'})

@auth_bp.route('/api/current_user', methods=['GET'])
def current_user_info():
    if current_user.is_authenticated:
        return jsonify({
            'logged_in': True, 
            'username': current_user.username,
            'user_id': current_user.id
        })
    return jsonify({'logged_in': False})

@auth_bp.route('/api/change_password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json()
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')
    
    if len(new_password) < 4:
        return jsonify({'error': '新密码至少4位'}), 400
    
    db = current_app.get_db()
    row = db.execute('SELECT password_hash FROM users WHERE id = ?', 
                     (current_user.id,)).fetchone()
    
    if not check_password_hash(row['password_hash'], old_password):
        return jsonify({'error': '当前密码错误'}), 401
    
    db.execute('UPDATE users SET password_hash = ? WHERE id = ?',
               (generate_password_hash(new_password), current_user.id))
    db.commit()
    return jsonify({'message': '密码修改成功'})

# ========== 用户资料 API ==========
@auth_bp.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    db = current_app.get_db()
    row = db.execute('SELECT id, username, nickname, avatar FROM users WHERE id = ?', 
                     (current_user.id,)).fetchone()
    return jsonify({
        'id': row['id'],
        'username': row['username'],
        'nickname': row['nickname'] or row['username'],
        'avatar': row['avatar'] or ''
    })

@auth_bp.route('/api/profile', methods=['POST'])
@login_required
def update_profile():
    data = request.get_json()
    nickname = data.get('nickname', '').strip()
    avatar = data.get('avatar', '')
    db = current_app.get_db()
    if nickname:
        db.execute('UPDATE users SET nickname = ? WHERE id = ?', (nickname, current_user.id))
    if avatar and avatar.startswith('data:image'):
        db.execute('UPDATE users SET avatar = ? WHERE id = ?', (avatar, current_user.id))
    db.commit()
    return jsonify({'success': True})