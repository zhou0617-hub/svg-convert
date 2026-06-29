// ==================== 登录 & 注册页面共用脚本 ====================

// 工具函数
function setLoading(btn, loading) {
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    if (text) text.hidden = loading;
    if (spinner) spinner.hidden = !loading;
    btn.disabled = loading;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 登录处理
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('loginBtn');
    setLoading(btn, true);

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: form.username.value,
                password: form.password.value
            })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('登录成功', 'success');
            setTimeout(() => window.location.href = '/convert', 500);
        } else {
            showToast(data.error || '登录失败', 'error');
        }
    } catch (err) {
        showToast('网络错误，请稍后重试', 'error');
    } finally {
        setLoading(btn, false);
    }
}

// 注册处理
async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;

    // 前端密码校验
    if (form.password.value !== form.confirm_password.value) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }
    if (form.password.value.length < 4) {
        showToast('密码至少 4 位', 'error');
        return;
    }

    const btn = document.getElementById('registerBtn');
    setLoading(btn, true);

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: form.username.value,
                password: form.password.value
            })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('注册成功，即将跳转登录', 'success');
            setTimeout(() => window.location.href = '/login', 1200);
        } else {
            showToast(data.error || '注册失败', 'error');
        }
    } catch (err) {
        showToast('网络错误，请稍后重试', 'error');
    } finally {
        setLoading(btn, false);
    }
}

// 已登录自动跳转
(async function checkLogin() {
    try {
        const res = await fetch('/api/current_user');
        const data = await res.json();
        if (data.logged_in) {
            window.location.href = '/convert';
        }
    } catch (e) {}
})();