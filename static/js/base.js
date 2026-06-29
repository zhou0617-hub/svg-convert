// ==================== 全局状态 ====================
let currentUser = null;
let currentSvg = '';
let currentFilename = '';

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    checkAuth();
});

// ==================== 粒子背景 ====================
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.width = Math.random() * 4 + 2 + 'px';
        p.style.height = p.style.width;
        p.style.animationDelay = Math.random() * 20 + 's';
        p.style.animationDuration = Math.random() * 10 + 15 + 's';
        container.appendChild(p);
    }
}

// ==================== 认证状态 ====================
async function checkAuth() {
    try {
        const res = await fetch('/api/current_user');
        const data = await res.json();
        if (data.logged_in) {
            currentUser = data.username;
            updateNavUser(data.username);
        } else {
            updateNavGuest();
        }
    } catch (e) {
        console.error('Auth check failed:', e);
        updateNavGuest();
    }
}

// 已登录：显示头像+下拉菜单
function updateNavUser(username) {
    const nav = document.getElementById('navUser');
    if (!nav) return;
    nav.innerHTML = `
        <div class="user-menu">
            <div class="user-dropdown">
                <div class="user-avatar">${username.charAt(0).toUpperCase()}</div>
                <span class="user-name">${username}</span>
                <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </div>
            <div class="dropdown-menu">
                <a href="/profile" class="dropdown-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    个人中心
                </a>
                <a href="/history" class="dropdown-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    历史记录
                </a>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item danger" onclick="handleLogout()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    退出登录
                </div>
            </div>
        </div>
    `;
}

// 未登录：显示登录按钮（跳转到登录页）
function updateNavGuest() {
    const nav = document.getElementById('navUser');
    if (!nav) return;
    nav.innerHTML = `
        <a href="/" class="btn btn-ghost btn-sm">登录</a>
    `;
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showToast('已退出登录', 'info');
        setTimeout(() => window.location.href = '/', 500);
    } catch (e) {
        showToast('退出失败', 'error');
    }
}

// ==================== 弹窗 ====================
function showModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function hideModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

// ==================== Toast ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    toast.innerHTML = `${icons[type]}<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== 工具函数 ====================
function setLoading(btn, loading) {
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    if (text) text.hidden = loading;
    if (spinner) spinner.hidden = !loading;
    btn.disabled = loading;
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function requireAuth() {
    if (!currentUser) {
        showToast('请先登录', 'error');
        setTimeout(() => window.location.href = '/', 500);
        return false;
    }
    return true;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ESC 关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        document.body.style.overflow = '';
    }
});