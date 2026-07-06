import pymysql

# 与项目数据库配置保持一致
DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "Znyh617617",  # 替换为你的数据库密码
    "database": "svg_data",
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor
}

from models import TABLES

def sync_database():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()
    print("=" * 55)
    print("开始同步数据库表结构...")
    print("=" * 55)

    for table_name, table_def in TABLES.items():
        print(f"\n📋 处理表: {table_name} ({table_def['comment']})")

        # 1. 表不存在则新建
        cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
        if not cursor.fetchone():
            columns_sql = ",\n    ".join(
                [f"`{col}` {defi}" for col, defi in table_def["columns"].items()]
            )
            indexes_sql = ",\n    ".join(list(table_def["indexes"].values()))
            create_sql = f"""
            CREATE TABLE `{table_name}` (
                {columns_sql},
                {indexes_sql}
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='{table_def["comment"]}';
            """
            cursor.execute(create_sql)
            print("  ✅ 新建表成功")
            continue

        # 2. 表已存在，补齐缺失字段
        cursor.execute(f"DESCRIBE `{table_name}`")
        exist_cols = {row["Field"] for row in cursor.fetchall()}
        for col, defi in table_def["columns"].items():
            if col not in exist_cols:
                cursor.execute(f"ALTER TABLE `{table_name}` ADD COLUMN `{col}` {defi}")
                print(f"  ➕ 新增字段: {col}")

        # 3. 补齐缺失索引
        cursor.execute(f"SHOW INDEX FROM `{table_name}`")
        exist_idx = {row["Key_name"] for row in cursor.fetchall()}
        for idx_name, idx_def in table_def["indexes"].items():
            if idx_name not in exist_idx:
                cursor.execute(f"ALTER TABLE `{table_name}` ADD {idx_def}")
                print(f"  🔗 新增索引: {idx_name}")

    # 4. 老用户默认昵称初始化
    cursor.execute("UPDATE users SET nickname = username WHERE nickname IS NULL")
    print("\n✅ 已为老用户初始化默认昵称")

    conn.commit()
    cursor.close()
    conn.close()
    print("\n" + "=" * 55)
    print("🎉 数据库同步完成，所有字段、索引已完善")
    print("=" * 55)

if __name__ == "__main__":
    sync_database()