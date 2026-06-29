import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'app.db')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
MAX_CONTENT_LENGTH = 16 * 1024 * 1024
SECRET_KEY = os.environ.get('SECRET_KEY') or 'change-me-in-production'
# Hugging Face API token（免费注册 https://huggingface.co/settings/tokens）
HF_API_TOKEN = os.environ.get('HF_API_TOKEN') or ''
