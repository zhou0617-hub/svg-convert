// ==================== 个人中心页 ====================

document.addEventListener('DOMContentLoaded', () => {
    loadProfileInfo();
    loadProfileHistory();
});

// ==================== 加载用户信息 ====================
async function loadProfileInfo() {
    try {
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error('加载用户信息失败');
        const data = await res.json();
        document.getElementById('profileUsername').textContent = data.nickname || data.username;
        document.getElementById('profileId').textContent = `ID: ${data.id}`;
        const avatarEl = document.getElementById('profileAvatar');
        if (data.avatar && data.avatar.startsWith('data:image')) {
            avatarEl.innerHTML = `<img src="${data.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
            avatarEl.textContent = (data.nickname || data.username)[0].toUpperCase();
        }
        document.getElementById('nicknameInput').value = data.nickname || '';
    } catch (e) {
        console.error('加载用户信息失败:', e);
        showToast('加载用户信息失败', 'error');
    }
}

// ==================== 更新昵称 ====================
async function updateNickname() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    if (!nickname) return showToast('请输入昵称', 'error');
    try {
        const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname })
        });
        const result = await res.json();
        if (result.success) {
            showToast('昵称更新成功', 'success');
            loadProfileInfo();
            if (window.refreshNavUser) refreshNavUser();
        } else {
            showToast('更新失败', 'error');
        }
    } catch (e) {
        showToast('网络错误', 'error');
    }
}
window.updateNickname = updateNickname;

// ==================== 上传头像 ====================
async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 200 * 1024) return showToast('头像不能超过200KB', 'error');
    const reader = new FileReader();
    reader.onload = async function(ev) {
        const base64 = ev.target.result;
        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar: base64 })
            });
            const result = await res.json();
            if (result.success) {
                showToast('头像更新成功', 'success');
                loadProfileInfo();
                if (window.refreshNavUser) refreshNavUser();
            } else {
                showToast('更新失败', 'error');
            }
        } catch (e) {
            showToast('网络错误', 'error');
        }
    };
    reader.readAsDataURL(file);
}
window.uploadAvatar = uploadAvatar;

// ==================== 加载历史记录（最终修复版） ====================
async function loadProfileHistory() {
    const list = document.getElementById('profileHistoryList');
    const empty = document.getElementById('profileHistoryEmpty');
    const countEl = document.getElementById('historyCount');
    const footer = document.getElementById('historyFooter');

    // 确保元素存在
    if (!list || !empty || !countEl || !footer) {
        console.error('个人中心 DOM 元素缺失，请检查 HTML');
        return;
    }

    // 显示加载状态
    list.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>加载中...</p></div>`;
    empty.hidden = true;
    footer.hidden = true;

    try {
        const res = await fetch('/api/history');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log('✅ 历史记录数据:', data); // 调试日志

        // 确保 data 是数组
        if (!Array.isArray(data)) {
            throw new Error('返回数据不是数组');
        }

        const total = data.length;
        console.log(`📊 共 ${total} 条记录`);

        // 更新统计数字
        document.getElementById('statTotal').textContent = total;
        document.getElementById('bannerTotal').textContent = total;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const thisMonth = data.filter(item => {
            if (!item.created_at) return false;
            const d = new Date(item.created_at);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;
        document.getElementById('statPublic').textContent = thisMonth;
        document.getElementById('bannerMonth').textContent = thisMonth;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const lastWeek = data.filter(item => {
            if (!item.created_at) return false;
            return new Date(item.created_at) >= sevenDaysAgo;
        }).length;
        document.getElementById('statLastWeek').textContent = lastWeek;
        document.getElementById('statTotalSvg').textContent = total;

        // Banner 问候语
        const hour = now.getHours();
        let greeting = '晚上好';
        if (hour < 6) greeting = '夜深了';
        else if (hour < 12) greeting = '早上好';
        else if (hour < 18) greeting = '下午好';
        document.getElementById('bannerGreeting').textContent = `${greeting}，您已完成了 ${total} 次转换`;

        countEl.textContent = `${total} 条记录`;

        // 清空列表
        list.innerHTML = '';

        if (total === 0) {
            // 无数据：显示空状态
            empty.hidden = false;
            footer.hidden = true;
            console.log('📭 无历史记录，显示空状态');
            return;
        }

        // 有数据：隐藏空状态，显示列表
        empty.hidden = true;
        footer.hidden = false;

        // 渲染卡片（最多8个）
        const cardsHtml = data.slice(0, 8).map((item, index) => {
            const filename = item.filename || '未命名';
            const imageUrl = item.image_url || '';
            const createdAt = item.created_at || new Date().toISOString();
            return `
                <div class="mini-history-card" onclick="showHistoryDetail(${item.id})">
                    <div class="card-image-wrap">
                        <img src="${imageUrl}" alt="${escapeHtml(filename)}" loading="lazy" onerror="this.style.display='none'">
                    </div>
                    <div class="mini-info">
                        <p class="mini-name" title="${escapeHtml(filename)}">${escapeHtml(filename)}</p>
                        <p class="mini-date">${formatDate(createdAt)}</p>
                    </div>
                </div>
            `;
        }).join('');

        list.innerHTML = cardsHtml;
        console.log(`✅ 已渲染 ${data.slice(0, 8).length} 张卡片`);

    } catch (e) {
        console.error('❌ 加载历史记录失败:', e);
        list.innerHTML = '';
        empty.hidden = false;
        footer.hidden = true;
        countEl.textContent = '0 条记录';
        // 显示错误信息
        const emptyTitle = empty.querySelector('h3');
        const emptyDesc = empty.querySelector('p');
        if (emptyTitle) emptyTitle.textContent = '加载失败';
        if (emptyDesc) emptyDesc.textContent = '请刷新页面重试';
        showToast('加载历史记录失败，请刷新', 'error');
    }
}

// ==================== 历史详情（使用全局弹窗） ====================
let detailZoomState = { original: 1, svg: 1 };
let currentDetailSvg = '';
let currentDetailFilename = '';

async function showHistoryDetail(historyId) {
    try {
        const res = await fetch(`/api/history/${historyId}/detail`);
        if (!res.ok) throw new Error('加载详情失败');
        const data = await res.json();

        document.getElementById('detailModalTitle').textContent = data.filename || '详情';
        document.getElementById('detailOriginalImg').src = data.image_url || '';
        document.getElementById('detailSvgDisplay').innerHTML = data.svg_text || '';
        document.getElementById('detailDate').textContent = formatDate(data.created_at);

        currentDetailSvg = data.svg_text || '';
        currentDetailFilename = (data.filename || 'export').replace(/\.[^/.]+$/, '') + '.svg';

        detailZoomState = { original: 1, svg: 1 };
        document.getElementById('detailOriginalImg').style.transform = 'scale(1)';
        document.getElementById('detailSvgDisplay').style.transform = 'scale(1)';
        document.getElementById('detailZoomOriginal').textContent = '100%';
        document.getElementById('detailZoomSvg').textContent = '100%';

        showModal('historyDetailModal');
    } catch (e) {
        console.error('加载详情失败:', e);
        showToast('加载详情失败', 'error');
    }
}
window.showHistoryDetail = showHistoryDetail;

// ==================== 详情缩放 ====================
function zoomDetailImage(type, delta) {
    const img = type === 'original'
        ? document.getElementById('detailOriginalImg')
        : document.getElementById('detailSvgDisplay');
    if (!img) return;
    let newScale = (type === 'original' ? detailZoomState.original : detailZoomState.svg) + delta;
    newScale = Math.max(0.2, Math.min(3, newScale));
    img.style.transform = `scale(${newScale})`;
    if (type === 'original') {
        detailZoomState.original = newScale;
        document.getElementById('detailZoomOriginal').textContent = Math.round(newScale * 100) + '%';
    } else {
        detailZoomState.svg = newScale;
        document.getElementById('detailZoomSvg').textContent = Math.round(newScale * 100) + '%';
    }
}
window.zoomDetailImage = zoomDetailImage;

function resetDetailZoom(type) {
    const target = 1;
    const current = type === 'original' ? detailZoomState.original : detailZoomState.svg;
    const delta = target - current;
    zoomDetailImage(type, delta);
}
window.resetDetailZoom = resetDetailZoom;

function copyDetailSvg() {
    if (!currentDetailSvg) return showToast('没有可复制的 SVG', 'error');
    navigator.clipboard.writeText(currentDetailSvg).then(() => {
        showToast('SVG 代码已复制', 'success');
    });
}
window.copyDetailSvg = copyDetailSvg;

function downloadDetailSvg() {
    if (!currentDetailSvg) return showToast('没有可下载的 SVG', 'error');
    const blob = new Blob([currentDetailSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentDetailFilename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('下载已开始', 'success');
}
window.downloadDetailSvg = downloadDetailSvg;

// ==================== 修改密码弹窗 ====================
function openPasswordModal() {
    document.getElementById('passwordModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        document.querySelector('#passwordModal input[name="old_password"]').focus();
    }, 100);
}
window.openPasswordModal = openPasswordModal;

function closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('changePasswordForm').reset();
}
window.closePasswordModal = closePasswordModal;

document.addEventListener('click', (e) => {
    const modal = document.getElementById('passwordModal');
    if (e.target === modal) closePasswordModal();
});

async function handleChangePassword(e) {
    e.preventDefault();
    const form = e.target;
    const oldPwd = form.old_password.value;
    const newPwd = form.new_password.value;
    const confirmPwd = form.confirm_password.value;

    if (newPwd.length < 4) return showToast('新密码至少4位', 'error');
    if (newPwd !== confirmPwd) return showToast('两次输入的密码不一致', 'error');

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
        showToast('网络错误', 'error');
    } finally {
        setLoading(btn, false);
    }
}
window.handleChangePassword = handleChangePassword;

// ESC 关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePasswordModal();
});