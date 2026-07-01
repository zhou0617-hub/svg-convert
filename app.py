import os
import sqlite3
from flask import Flask, render_template, g, redirect, url_for
from flask_login import LoginManager, UserMixin, current_user

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'change-me-in-production'
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 支持批量上传
    app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
    app.config['DATABASE'] = os.path.join(os.getcwd(), 'data.db')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    app.template_folder = os.path.join(os.path.dirname(__file__), 'templates')
    app.static_folder = os.path.join(os.path.dirname(__file__), 'static')

    init_db(app.config['DATABASE'])

    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = None

    def get_db():
        if 'db' not in g:
            g.db = sqlite3.connect(app.config['DATABASE'])
            g.db.row_factory = sqlite3.Row
        return g.db

    @app.teardown_appcontext
    def close_db(exception):
        db = g.pop('db', None)
        if db is not None:
            db.close()

    class User(UserMixin):
        def __init__(self, id, username):
            self.id = id
            self.username = username

    @login_manager.user_loader
    def load_user(user_id):
        db = get_db()
        row = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if row:
            return User(row['id'], row['username'])
        return None

    app.get_db = get_db
    app.User = User

    # 注册蓝图
    from auth import auth_bp
    from convert import convert_bp
    from history import history_bp
    from files import files_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(convert_bp)
    app.register_blueprint(history_bp)
    app.register_blueprint(files_bp)
    from enhance_advanced import enhance_advanced_bp
    app.register_blueprint(enhance_advanced_bp)

    # ========== 页面路由 ==========
    
    @app.route('/')
    def index():
        if current_user.is_authenticated:
            return redirect(url_for('convert_page'))
        return render_template('login.html')

    @app.route('/convert')
    def convert_page():
        if not current_user.is_authenticated:
            return redirect(url_for('index'))
        return render_template('index.html', active_page='index')

    @app.route('/history')
    def history_page():
        if not current_user.is_authenticated:
            return redirect(url_for('index'))
        return render_template('history.html', active_page='history')

    @app.route('/community')
    def community_page():
        return render_template('community.html', active_page='community')

    @app.route('/profile')
    def profile_page():
        if not current_user.is_authenticated:
            return redirect(url_for('index'))
        return render_template('profile.html', active_page='profile')

    @app.route('/login')
    def login_page():
        if current_user.is_authenticated:
            return redirect(url_for('convert_page'))
        return render_template('login.html')

    @app.route('/register')
    def register():
        if current_user.is_authenticated:
            return redirect(url_for('convert_page'))
        return render_template('register.html')

    return app

def init_db(db_path):
    db = sqlite3.connect(db_path)
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nickname TEXT DEFAULT "",
            avatar TEXT DEFAULT ""
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            original_filename TEXT NOT NULL,
            image_path TEXT NOT NULL,
            svg_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    db.commit()
    db.close()

if __name__ == '__main__':
    app = create_app()
    app.run(debug=False, host='0.0.0.0', port=5000)