import os
import pymysql
from flask import Flask, g, jsonify, render_template, request, redirect, url_for
from flask_login import LoginManager, current_user, login_required
import task_manager
import base64
from io import BytesIO
from PIL import Image

app = Flask(__name__)

# ==================== 基础配置 ====================
app.config['SECRET_KEY'] = 'svg_tool_secret_key_2024'
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
# 修复：单请求上限从10MB调整为200MB，适配20张图批量上传
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ==================== MySQL 数据库配置 ====================
DB_CONFIG_BASE = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "Znyh617617",
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor
}
DB_NAME = "svg_data"

# 兼容封装类，保持和SQLite一致的调用写法
class CompatibleDB:
    def __init__(self, conn):
        self.conn = conn
        self.cursor = None

    def execute(self, sql, params=None):
        self.cursor = self.conn.cursor()
        if params:
            self.cursor.execute(sql, params)
        else:
            self.cursor.execute(sql)
        return self.cursor

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()

# ==================== 数据库连接 ====================
def get_db():
    if 'db' not in g:
        conn = pymysql.connect(**DB_CONFIG_BASE)
        # 自动创建库
        cur = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;")
        conn.commit()
        cur.close()
        # 切换数据库
        conn.select_db(DB_NAME)
        # 包装一层兼容对象
        g.db = CompatibleDB(conn)
    return g.db

app.get_db = get_db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

# ==================== 登录认证配置 ====================
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login_page'
login_manager.login_message = '请先登录后操作'

from auth import User

@login_manager.user_loader
def load_user(user_id):
    try:
        db = get_db()
        cur = db.execute('SELECT id, username, password FROM users WHERE id = %s', (user_id,))
        user_row = cur.fetchone()
        if not user_row:
            return None
        return User(user_row['id'], user_row['username'], user_row['password'])
    except Exception:
        return None

# ==================== 全局登录拦截 ====================
@app.before_request
def global_auth_check():
    allow_paths = [
        '/login', '/register',
        '/api/login', '/api/register',
        '/static/'
    ]
    for path in allow_paths:
        if request.path.startswith(path):
            return None
    if not current_user.is_authenticated:
        return redirect(url_for('auth.login_page'))

# ==================== 导入并注册业务蓝图 ====================
from auth import auth_bp
from convert import convert_bp
from enhance import enhance_bp
from history import history_bp
from files import files_bp

app.register_blueprint(auth_bp)
app.register_blueprint(convert_bp)
app.register_blueprint(enhance_bp)
app.register_blueprint(history_bp)
app.register_blueprint(files_bp)

# ==================== 自动初始化数据库表 ====================
from db import init_db
with app.app_context():
    init_db()

# ==================== 取消任务接口 ====================
@app.route('/api/cancel', methods=['POST'])
def cancel_task():
    task_manager.cancel_flag.set()
    with task_manager.process_lock:
        if task_manager.current_process is not None:
            try:
                task_manager.current_process.terminate()
                task_manager.current_process.wait(timeout=2)
            except Exception:
                pass
            task_manager.current_process = None
    return jsonify({"status": "ok", "message": "任务已取消"})


# ==================== 页面路由 ====================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/convert')
def convert_page():
    return render_template('index.html')

@app.route('/community')
def community_page():
    return render_template('community.html')

@app.route('/history')
def history_page():
    return render_template('history.html')

@app.route('/profile')
def profile_page():
    return render_template('profile.html')


# ==================== 启动入口 ====================
if __name__ == '__main__':
    app.run(
        debug=False,
        host='127.0.0.1',
        port=5000
    )