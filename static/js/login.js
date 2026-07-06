// ==================== 登录 & 注册页面共用脚本 ====================
// 依赖 core.js

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
                username: form.username.value.trim(),
                password: form.password.value.trim()
            })
        });
        const data = await res.json();

        if (data.code === 0) {
            showToast('登录成功', 'success');
            setTimeout(() => window.location.href = '/', 500);
        } else {
            showToast(data.msg || '登录失败', 'error');
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

    if (form.password.value !== form.confirm_password.value) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }
    if (form.password.value.length < 6) {
        showToast('密码至少 6 位', 'error');
        return;
    }

    const btn = document.getElementById('registerBtn');
    setLoading(btn, true);

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: form.username.value.trim(),
                password: form.password.value.trim()
            })
        });
        const data = await res.json();

        if (data.code === 0) {
            showToast('注册成功，即将跳转登录', 'success');
            setTimeout(() => window.location.href = '/login', 1200);
        } else {
            showToast(data.msg || data.error || '注册失败', 'error');
        }
    } catch (err) {
        showToast('网络错误，请稍后重试', 'error');
    } finally {
        setLoading(btn, false);
    }
}

// 已登录自动跳转首页
(async function checkLogin() {
    try {
        const res = await fetch('/api/current_user');
        const data = await res.json();
        if (data.code === 0 && data.data) {
            window.location.href = '/';
        }
    } catch (e) {}
})();