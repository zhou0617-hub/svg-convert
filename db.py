import pymysql
from flask import g

# MySQL 基础配置
DB_CONFIG_BASE = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "Znyh617617",  # 替换成你自己的root密码
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor
}
DB_NAME = "svg_data"

# 兼容封装类，统一 execute 写法，兼容原有业务代码
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

# 获取数据库连接
def get_db():
    if 'db' not in g:
        conn = pymysql.connect(**DB_CONFIG_BASE)
        # 自动创建数据库
        cur = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;")
        conn.commit()
        cur.close()
        # 切换到目标库
        conn.select_db(DB_NAME)
        g.db = CompatibleDB(conn)
    return g.db

# 初始化数据表（全项目唯一表结构定义）
def init_db():
    db = get_db()
    # 用户表：补全所有业务依赖的字段
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            nickname VARCHAR(50) DEFAULT NULL,
            avatar MEDIUMTEXT DEFAULT NULL,
            status TINYINT DEFAULT 1 COMMENT '账号状态：1正常 0禁用',
            create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
            last_login_time TIMESTAMP NULL DEFAULT NULL COMMENT '最后登录时间'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ''')

    # 历史记录表
    db.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            image_path VARCHAR(500) NOT NULL,
            svg_text MEDIUMTEXT NOT NULL,
            create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ''')
    db.commit()

# 关闭数据库连接
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()