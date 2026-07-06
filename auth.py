import sqlite3
from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from flask_login import UserMixin, login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = Blueprint('auth', __name__)

# ==================== 用户模型 ====================
class User(UserMixin):
    def __init__(self, user_id, username, password):
        self.id = user_id
        self.username = username
        self.password = password

# ==================== 数据库辅助方法 ====================
def get_db():
    from db import get_db
    return get_db()

# ==================== 页面路由 ====================
@auth_bp.route('/login', methods=['GET'])
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    return render_template('login.html')

@auth_bp.route('/register', methods=['GET'])
def register_page():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    return render_template('register.html')

# ==================== 登录接口 ====================
@auth_bp.route('/api/login', methods=['POST'])
def login_api():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'code': 1, 'msg': '请输入用户名和密码'})

    db = get_db()
    cur = db.execute('SELECT * FROM users WHERE username = %s', (username,))
    user_row = cur.fetchone()

    if not user_row:
        return jsonify({'code': 1, 'msg': '用户名不存在'})

    # 账号状态校验
    if user_row.get('status', 1) == 0:
        return jsonify({'code': 1, 'msg': '账号已被禁用'})

    stored_pwd = user_row['password']
    password_valid = False
    try:
        password_valid = check_password_hash(stored_pwd, password)
    except:
        password_valid = (stored_pwd == password)

    if not password_valid:
        return jsonify({'code': 1, 'msg': '密码错误'})

    user = User(user_row['id'], user_row['username'], stored_pwd)
    login_user(user, remember=True)

    # 更新最后登录时间
    db.execute('UPDATE users SET last_login_time = CURRENT_TIMESTAMP WHERE id = %s', (user.id,))
    db.commit()

    return jsonify({'code': 0, 'msg': '登录成功', 'data': {'username': user_row['username']}})

# ==================== 注册接口 ====================
@auth_bp.route('/api/register', methods=['POST'])
def register_api():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'code': 1, 'msg': '请输入用户名和密码'})
    if len(username) < 3:
        return jsonify({'code': 1, 'msg': '用户名长度至少3位'})
    # 统一密码规则：至少6位
    if len(password) < 6:
        return jsonify({'code': 1, 'msg': '密码长度至少6位'})

    try:
        db = get_db()
        cur = db.execute('SELECT id FROM users WHERE username = %s', (username,))
        if cur.fetchone():
            return jsonify({'code': 1, 'msg': '用户名已存在'})

        hashed_pw = generate_password_hash(password)
        db.execute(
            'INSERT INTO users (username, password, nickname) VALUES (%s, %s, %s)',
            (username, hashed_pw, username)
        )
        db.commit()
        return jsonify({'code': 0, 'msg': '注册成功'})
    except Exception as e:
        print(f"[注册错误] {str(e)}")
        try:
            db.conn.rollback()
        except:
            pass
        return jsonify({'code': 1, 'msg': '注册失败，服务器异常'}), 500

# ==================== 登出接口 ====================
@auth_bp.route('/api/logout', methods=['POST'])
def logout_api():
    logout_user()
    return jsonify({'code': 0, 'msg': '已退出登录'})

# ==================== 当前用户信息 ====================
@auth_bp.route('/api/current_user', methods=['GET'])
def current_user_info():
    if current_user.is_authenticated:
        return jsonify({
            'code': 0,
            'data': {'id': current_user.id, 'username': current_user.username},
            'msg': 'ok'
        })
    return jsonify({'code': 1, 'data': None, 'msg': '未登录'})

# ==================== 个人信息接口 ====================
@auth_bp.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    db = get_db()
    cur = db.execute(
        'SELECT id, username, nickname, avatar, create_time FROM users WHERE id = %s',
        (current_user.id,)
    )
    user_row = cur.fetchone()
    
    if not user_row:
        return jsonify({'code': 1, 'msg': '用户不存在'}), 404
    
    return jsonify({
        'id': user_row['id'],
        'username': user_row['username'],
        'nickname': user_row['nickname'] or user_row['username'],
        'avatar': user_row['avatar'] or '',
        'create_time': user_row['create_time'],
        'success': True
    })

@auth_bp.route('/api/profile', methods=['POST'])
@login_required
def update_profile():
    data = request.get_json()
    db = get_db()
    
    # 更新昵称
    if 'nickname' in data:
        nickname = data['nickname'].strip()
        if len(nickname) > 50:
            return jsonify({'success': False, 'msg': '昵称不能超过50字'}), 400
        db.execute(
            'UPDATE users SET nickname = %s WHERE id = %s',
            (nickname, current_user.id)
        )
    
    # 更新头像
    if 'avatar' in data:
        avatar = data['avatar']
        if avatar and not avatar.startswith('data:image'):
            return jsonify({'success': False, 'msg': '头像格式错误'}), 400
        db.execute(
            'UPDATE users SET avatar = %s WHERE id = %s',
            (avatar, current_user.id)
        )
    
    db.commit()
    return jsonify({'success': True, 'msg': '更新成功'})

# ==================== 修改密码接口 ====================
@auth_bp.route('/api/change_password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json()
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')

    if not old_password or not new_password:
        return jsonify({'error': '请输入完整密码信息'}), 400
    # 统一密码规则：至少6位
    if len(new_password) < 6:
        return jsonify({'error': '新密码长度至少6位'}), 400

    db = get_db()
    cur = db.execute('SELECT password FROM users WHERE id = %s', (current_user.id,))
    user_row = cur.fetchone()

    if not check_password_hash(user_row['password'], old_password):
        return jsonify({'error': '原密码错误'}), 400

    hashed_pw = generate_password_hash(new_password)
    db.execute('UPDATE users SET password = %s WHERE id = %s', (hashed_pw, current_user.id))
    db.commit()
    return jsonify({'success': True, 'msg': '密码修改成功'})