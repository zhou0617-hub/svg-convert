# models.py - 数据库表结构唯一数据源
TABLES = {
    # ========== 用户表（注册/登录/个人中心）==========
    "users": {
        "comment": "用户账号表",
        "columns": {
            "id": "INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID'",
            "username": "VARCHAR(50) NOT NULL COMMENT '用户名'",
            "password": "VARCHAR(255) NOT NULL COMMENT '加密后的密码'",
            "nickname": "VARCHAR(50) DEFAULT NULL COMMENT '用户昵称'",
            "avatar": "MEDIUMTEXT DEFAULT NULL COMMENT '头像(base64存储)'",
            "status": "TINYINT DEFAULT 1 COMMENT '账号状态：1正常 0禁用'",
            "create_time": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间'",
            "last_login_time": "TIMESTAMP NULL DEFAULT NULL COMMENT '最后登录时间'",
        },
        "indexes": {
            "uk_username": "UNIQUE KEY uk_username (username)",
            "idx_status": "KEY idx_status (status)",
        }
    },

    # ========== 转换历史表（图片SVG记录）==========
    "history": {
        "comment": "图片转SVG历史记录表",
        "columns": {
            "id": "INT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID'",
            "user_id": "INT NOT NULL COMMENT '所属用户ID'",
            "original_name": "VARCHAR(255) DEFAULT NULL COMMENT '原始文件名'",
            "svg_path": "VARCHAR(255) DEFAULT NULL COMMENT '生成的SVG文件路径'",
            "file_size": "INT DEFAULT 0 COMMENT '原始文件大小(字节)'",
            "create_time": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '转换时间'",
        },
        "indexes": {
            "idx_user_id": "KEY idx_user_id (user_id)",
            "idx_create_time": "KEY idx_create_time (create_time)",
        }
    }
}