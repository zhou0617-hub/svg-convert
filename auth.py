from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    user = User(
        username=data['username'],
        password_hash=generate_password_hash(data['password'])
    )
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return jsonify({'message': 'Registered successfully', 'username': user.username})

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user and check_password_hash(user.password_hash, data.get('password')):
        login_user(user)
        return jsonify({'message': 'Logged in', 'username': user.username})
    return jsonify({'error': 'Invalid credentials'}), 401

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out'})

@auth_bp.route('/me')
def me():
    if current_user.is_authenticated:
        return jsonify({'username': current_user.username})
    return jsonify({'username': None})
