// ==================== 个人中心页 ====================

document.addEventListener('DOMContentLoaded', () => {
    loadProfileInfo();
    loadProfileHistory();
});

// 工具函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// Toast 提示
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' 
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// 加载用户信息
async function loadProfileInfo() {
    try {
        const res = await fetch('/api/current_user');
        const data = await res.json();
        if (data.logged_in) {
            document.getElementById('profileUsername').textContent = data.username;
            document.getElementById('profileId').textContent = `ID: ${data.user_id || '—'}`;
            document.getElementById('profileAvatar').textContent = data.username.charAt(0).toUpperCase();
        }
    } catch (e) {
        console.error('加载用户信息失败:', e);
    }
}

// 加载历史记录
async function loadProfileHistory() {
    const list = document.getElementById('profileHistoryList');
    const empty = document.getElementById('profileHistoryEmpty');
    const countEl = document.getElementById('historyCount');

    try {
        const res = await fetch('/api/history');
        const data = await res.json();

        // 更新统计
        const total = data.length;
        document.getElementById('statTotal').textContent = total;

        // 计算本月数量
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const thisMonth = data.filter(item => {
            const d = new Date(item.created_at);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;
        document.getElementById('statPublic').textContent = thisMonth;

        countEl.textContent = `${total} 条记录`;

        if (!total) {
            if (list) list.innerHTML = '';
            if (empty) empty.hidden = false;
            return;
        }
        if (empty) empty.hidden = true;

        if (list) {
            list.innerHTML = data.slice(0, 8).map(item => `
                <div class="mini-history-card" onclick="showHistorySvg(${item.id}, '${escapeHtml(item.filename)}')">
                    <img src="${item.image_url}" alt="${escapeHtml(item.filename)}" loading="lazy">
                    <div class="mini-info">
                        <p class="mini-name" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</p>
                        <p class="mini-date">${formatDate(item.created_at)}</p>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        if (list) list.innerHTML = '';
        if (empty) empty.hidden = false;
        countEl.textContent = '0 条记录';
    }
}

// ==================== 修改密码弹窗 ====================

function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // 聚焦到第一个输入框
    setTimeout(() => {
        modal.querySelector('input[name="old_password"]').focus();
    }, 100);
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // 重置表单
    const form = document.getElementById('changePasswordForm');
    form.reset();
}

// 点击遮罩关闭弹窗
document.addEventListener('click', (e) => {
    const modal = document.getElementById('passwordModal');
    if (e.target === modal) {
        closePasswordModal();
    }
});

// ESC 键关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePasswordModal();
    }
});

// 修改密码提交
async function handleChangePassword(e) {
    e.preventDefault();
    const form = e.target;
    const oldPwd = form.old_password.value;
    const newPwd = form.new_password.value;
    const confirmPwd = form.confirm_password.value;

    if (newPwd.length < 4) { 
        showToast('新密码至少 4 位', 'error'); 
        return; 
    }
    if (newPwd !== confirmPwd) { 
        showToast('两次输入的密码不一致', 'error'); 
        return; 
    }

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true);

    try {
        const res = await fetch('/api/change_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_password: oldPwd, new_password: newPwd })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('密码修改成功', 'success');
            form.reset();
            setTimeout(closePasswordModal, 500);
        } else {
            showToast(data.error || '修改失败', 'error');
        }
    } catch (err) {
        showToast('网络错误，请稍后重试', 'error');
    } finally { 
        setLoading(btn, false); 
    }
}

// 查看历史 SVG 详情（占位函数）
function showHistorySvg(id, filename) {
    console.log('查看历史记录:', id, filename);
    // 这里可以实现弹窗展示 SVG 详情的逻辑
}