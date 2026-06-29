def parse_text_to_svg(text):
    """简单规则解析文本，生成 SVG 字符串"""
    shapes = []
    for part in text.split(','):
        part = part.strip()
        parts = part.split()
        color_map = {
            '红': 'red', '红色': 'red', '蓝': 'blue', '蓝色': 'blue',
            '绿': 'green', '绿色': 'green', '黄': 'yellow', '黄色': 'yellow',
            '黑': 'black', '黑色': 'black', '白': 'white', '白色': 'white'
        }
        shape_map = {'圆': 'circle', '矩形': 'rect', '正方形': 'rect'}
        if not parts:
            continue
        color = None
        shape = None
        params = []
        for w in parts:
            if w in color_map:
                color = color_map[w]
            elif w in shape_map:
                shape = shape_map[w]
            else:
                try:
                    params.append(float(w))
                except:
                    pass
        if shape and color and params:
            shapes.append({'shape': shape, 'color': color, 'params': params})
    
    if not shapes:
        shapes.append({'shape': 'circle', 'color': 'gray', 'params': [50]})
    
    svg_lines = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">']
    for s in shapes:
        if s['shape'] == 'circle':
            cx = cy = 100
            r = s['params'][0] if s['params'] else 50
            svg_lines.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{s["color"]}" />')
        elif s['shape'] == 'rect':
            if len(s['params']) >= 2:
                w, h = s['params'][0], s['params'][1]
            else:
                w = h = s['params'][0] if s['params'] else 80
            x, y = 100 - w/2, 100 - h/2
            svg_lines.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{s["color"]}" />')
    svg_lines.append('</svg>')
    return '\n'.join(svg_lines)
