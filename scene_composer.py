import random

def parse_scene_description(text):
    """
    极简 LLM 模拟：提取关键词和位置
    实际项目可接入 GPT API 解析
    """
    objects = []
    # 简单规则：按逗号分割，每个片段尝试解析物体名称和位置
    for part in text.split(','):
        part = part.strip()
        if not part:
            continue
        # 假设格式 "物体 位置"，如 "桌子 左边"
        words = part.split()
        if len(words) >= 1:
            obj = words[0]
            position = words[1] if len(words) > 1 else 'center'
            objects.append({'name': obj, 'position': position})
    return objects

def layout_objects(objects, canvas_w=800, canvas_h=600):
    """根据对象位置关键词，分配坐标"""
    positions_map = {
        '左边': (150, 300),
        '右边': (650, 300),
        '上面': (400, 150),
        '下面': (400, 450),
        '中间': (400, 300),
        'center': (400, 300)
    }
    layout = []
    for obj in objects:
        pos = positions_map.get(obj['position'], (random.randint(100, 700), random.randint(100, 500)))
        layout.append({'name': obj['name'], 'x': pos[0], 'y': pos[1]})
    return layout
