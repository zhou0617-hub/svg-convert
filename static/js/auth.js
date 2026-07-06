// ==================== 用户认证模块 ====================
// 依赖 core.js (window.showToast, window.escapeHtml 等)

let currentUser = null;

async function checkAuth() {
    try {
        const res = await fetch('/api/current_user');
        const data = await res.json();
        if (data.code === 0 && data.data) {
            currentUser = data.data.username;
            await refreshNavUser();
        } else {
            updateNavGuest();
        }
    } catch (e) {
        console.error('Auth check failed:', e);
        updateNavGuest();
    }
}

async function refreshNavUser() {
    try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data.success) {
            updateNavUserWithProfile(data.username, data);
        } else {
            updateNavGuest();
        }
    } catch (e) {
        console.error('刷新导航栏失败:', e);
        updateNavGuest();
    }
}

function updateNavUserWithProfile(username, profile) {
    const nav = document.getElementById('navUser');
    if (!nav) return;
    const displayName = profile.nickname || username;
    const avatarHtml = profile.avatar && profile.avatar.startsWith('data:image')
        ? `<img src="${profile.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
        : `<span style="font-size:0.875rem;font-weight:600;">${displayName.charAt(0).toUpperCase()}</span>`;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const themeIcon = currentTheme === 'dark' ? ' 亮色模式' : ' 暗色模式';

    nav.innerHTML = `
        <div class="user-menu">
            <div class="user-dropdown">
                <div class="user-avatar" style="background:linear-gradient(135deg, var(--accent), var(--accent-dark));display:flex;align-items:center;justify-content:center;overflow:hidden;">
                    ${avatarHtml}
                </div>
                <span class="user-name">${escapeHtml(displayName)}</span>
                <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </div>
            <div class="dropdown-menu">
                <a href="/profile" class="dropdown-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    个人中心
                </a>
                <a href="/history" class="dropdown-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    历史记录
                </a>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" onclick="toggleTheme()" style="cursor:pointer;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    <span id="themeMenuItem">${themeIcon}</span>
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item danger" onclick="handleLogout()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    退出登录
                </div>
            </div>
        </div>
    `;
}

function updateNavGuest() {
    const nav = document.getElementById('navUser');
    if (!nav) return;
    nav.innerHTML = `<a href="/login" class="btn btn-ghost btn-sm" style="margin-left:4px;">登录</a>`;
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

// 登录守卫（同步检测）
function requireAuth() {
    if (window.__userInfo) return true;
    let isLogin = false;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/current_user', false);
    xhr.onload = function() {
        try {
            const data = JSON.parse(xhr.responseText);
            if (data.code === 0 && data.data) {
                window.__userInfo = data.data;
                isLogin = true;
            }
        } catch(e) {}
    };
    xhr.send();
    if (!isLogin) {
        showToast('请先登录后再使用', 'warning');
        setTimeout(() => { window.location.href = '/login'; }, 800);
    }
    return isLogin;
}

// ==================== 暴露全局 ====================
window.checkAuth = checkAuth;
window.refreshNavUser = refreshNavUser;
window.handleLogout = handleLogout;
window.requireAuth = requireAuth;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

function ensureThemeSwitch() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    if (!navRight.querySelector('.theme-switch-wrapper')) {
        const switchHTML = `
            <div class="theme-switch-wrapper">
                <label class="theme-switch">
                    <input type="checkbox" id="themeCheckbox" onchange="toggleTheme()">
                    <span class="theme-slider">
                        <span class="theme-icons">
                            <span class="theme-icon sun">☀️</span>
                            <span class="theme-icon moon">🌙</span>
                        </span>
                    </span>
                </label>
            </div>
        `;
        navRight.insertAdjacentHTML('afterbegin', switchHTML);
    }
    // 同步主题状态
    const theme = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
    const checkbox = document.getElementById('themeCheckbox');
    if (checkbox) checkbox.checked = (theme === 'dark');
}

document.addEventListener('DOMContentLoaded', () => {
    ensureThemeSwitch();  // 先确保滑块存在
    checkAuth();          // 再检查登录（更新 navUser）
});