from flask import Blueprint, request, jsonify, send_from_directory, abort
from models import db, Asset
import uuid

share_bp = Blueprint('share', __name__)

@share_bp.route('/generate_share/<int:asset_id>', methods=['POST'])
def generate_share(asset_id):
    asset = Asset.query.get_or_404(asset_id)
    if not asset.share_code:
        asset.share_code = str(uuid.uuid4())[:12]
        db.session.commit()
    return jsonify({'share_code': asset.share_code, 'url': f'/share/{asset.share_code}'})

@share_bp.route('/s/<code>')
def view_shared(code):
    asset = Asset.query.filter_by(share_code=code).first_or_404()
    return send_from_directory('static/uploads', asset.filename)
