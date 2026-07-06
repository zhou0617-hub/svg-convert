from flask import Blueprint, send_from_directory, current_app
from flask_login import login_required, current_user
files_bp = Blueprint('files', __name__)

@files_bp.route('/api/files/<filename>')
@login_required
def serve_file(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)