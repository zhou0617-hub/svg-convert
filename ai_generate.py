import os, io, requests, uuid
from PIL import Image
from config import HF_API_TOKEN
from vectorize import convert_to_svg

API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1-base"
HEADERS = {"Authorization": f"Bearer {HF_API_TOKEN}"}

def generate_image_from_text(prompt):
    """调用 Hugging Face 免费 API 生成图标风格的位图"""
    # 如果未配置 token，返回 None，前端会提示
    if not HF_API_TOKEN:
        return None
    payload = {
        "inputs": f"icon style, simple flat vector, {prompt}, white background, clean lines",
        "options": {"wait_for_model": True}
    }
    response = requests.post(API_URL, headers=HEADERS, json=payload)
    if response.status_code == 200:
        return Image.open(io.BytesIO(response.content)).convert('RGB')
    else:
        print(f"HF API error: {response.text}")
        return None

def text_to_vector_svg(prompt, style='artistic'):
    """完整流程：文本 -> AI生成位图 -> 矢量化，返回 SVG 字符串"""
    # 尝试 AI 生成
    img = generate_image_from_text(prompt)
    if img is None:
        # 降级：返回一个带文字的简单 SVG
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><text x="10" y="100" font-size="20">{prompt}</text></svg>'
    # 保存临时 PNG
    temp_path = os.path.join('static', 'uploads', f'temp_ai_{uuid.uuid4().hex}.png')
    img.save(temp_path)
    svg = convert_to_svg(temp_path, style=style)
    os.remove(temp_path)
    return svg
