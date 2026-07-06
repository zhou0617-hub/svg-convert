// ==================== 核心工具库 ====================
// 主题切换
function getPreferredTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const checkbox = document.getElementById('themeCheckbox');
    if (checkbox) checkbox.checked = theme === 'dark';
    const menuItem = document.getElementById('themeMenuItem');
    if (menuItem) menuItem.textContent = theme === 'dark' ? '亮色模式' : '暗色模式';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
}

// Toast
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
    toast.innerHTML = `${icons[type] || ''}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Modal
function showModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}
function hideModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 工具函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
        return d.toLocaleDateString('zh-CN');
    } catch {
        return '—';
    }
}

function setLoading(btn, loading) {
    if (!btn) return;
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    if (text) text.hidden = loading;
    if (spinner) spinner.hidden = !loading;
    btn.disabled = loading;
}

// ==================== 缩放引擎（核心） ====================
function initImageZoom(wrapperSelector, targetSelector) {
    const wrapper = document.querySelector(wrapperSelector);
    const targetEl = document.querySelector(targetSelector);
    if (!wrapper || !targetEl) return;

    if (wrapper.__zoomInited) {
        if (wrapper.resetZoom) wrapper.resetZoom();
        return;
    }

    targetEl.style.transformOrigin = 'center center';
    targetEl.style.display = 'block';

    let originalWidth = 1, originalHeight = 1;
    const state = { scale: 1, x: 0, y: 0 };
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let originX = 0, originY = 0;

    function getTargetDimensions() {
        const wrapperRect = wrapper.getBoundingClientRect();
        const containerWidth = wrapperRect.width || 100;
        const containerHeight = wrapperRect.height || 100;
        let w = 0, h = 0;
        const img = targetEl.querySelector('img');
        if (img) {
            w = img.naturalWidth || img.width || containerWidth;
            h = img.naturalHeight || img.height || containerHeight;
        } else {
            const svg = targetEl.querySelector('svg');
            if (svg) {
                let viewBox = svg.getAttribute('viewBox');
                if (viewBox) {
                    const parts = viewBox.split(/[\s,]+/).filter(s => s);
                    if (parts.length === 4) {
                        w = parseFloat(parts[2]);
                        h = parseFloat(parts[3]);
                    }
                }
                if (!w || w <= 0) {
                    const sw = svg.getAttribute('width');
                    const sh = svg.getAttribute('height');
                    if (sw && sh) {
                        w = parseFloat(sw);
                        h = parseFloat(sh);
                    }
                }
                if (!w || w <= 0) {
                    const rect = svg.getBoundingClientRect();
                    w = rect.width || containerWidth;
                    h = rect.height || containerHeight;
                }
            } else {
                const rect = targetEl.getBoundingClientRect();
                w = rect.width || containerWidth;
                h = rect.height || containerHeight;
            }
        }
        if (w <= 0) w = containerWidth;
        if (h <= 0) h = containerHeight;
        const maxDim = Math.max(containerWidth, containerHeight) * 10;
        if (w > maxDim) w = maxDim;
        if (h > maxDim) h = maxDim;
        w = Math.max(1, w);
        h = Math.max(1, h);
        return { width: w, height: h };
    }

    function fitToContainer() {
        const wrapperRect = wrapper.getBoundingClientRect();
        const cw = wrapperRect.width || 100;
        const ch = wrapperRect.height || 100;
        const dim = getTargetDimensions();
        originalWidth = dim.width;
        originalHeight = dim.height;
        let scaleX = cw / originalWidth;
        let scaleY = ch / originalHeight;
        if (!isFinite(scaleX)) scaleX = 1;
        if (!isFinite(scaleY)) scaleY = 1;
        let scale = Math.min(scaleX, scaleY) * 0.92;
        scale = Math.min(1.5, Math.max(0.05, scale));
        state.scale = scale;
        state.x = 0;     // 强制归零，防止残留偏移
        state.y = 0;
        targetEl.style.transition = 'none';
        applyTransform();
    }

    function applyTransform() {
        if (!isFinite(state.scale) || state.scale < 0.001) state.scale = 1;
        if (!isFinite(state.x)) state.x = 0;
        if (!isFinite(state.y)) state.y = 0;
        targetEl.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
        const label = wrapper.querySelector('.zoom-level');
        if (label) label.textContent = Math.round(state.scale * 100) + '%';
    }

    wrapper.zoomData = state;
    wrapper._applyTransform = applyTransform;

    // ---- 核心：平滑缩放 ----
    wrapper.zoomBy = function(delta) {
        const oldScale = state.scale;
        // 每次缩放变化量调整为 0.04（delta 为 ±1）
        let newScale = oldScale + delta * 0.04;
        newScale = Math.max(0.1, Math.min(4, newScale));
        const centerX = state.x + originalWidth * oldScale / 2;
        const centerY = state.y + originalHeight * oldScale / 2;
        state.x = centerX - originalWidth * newScale / 2;
        state.y = centerY - originalHeight * newScale / 2;
        state.scale = newScale;
        // 设置过渡动画，让缩放顺滑
        targetEl.style.transition = 'transform 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)';
        applyTransform();
    };

    wrapper.resetZoom = function() {
        state.x = 0;
        state.y = 0;
        fitToContainer();
        targetEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        applyTransform();
    };

    setTimeout(fitToContainer, 50);

    const img = targetEl.querySelector('img');
    if (img && !img.complete) {
        img.addEventListener('load', fitToContainer);
    }

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => fitToContainer());
        ro.observe(wrapper);
        wrapper.__resizeObserver = ro;
    }

    // ---- 滚轮事件 ----
    wrapper.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;  // 统一方向
        wrapper.zoomBy(delta);
    }, { passive: false });

    // ---- 拖拽 ----
    wrapper.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        originX = state.x;
        originY = state.y;
        targetEl.style.transition = 'none';  // 拖拽时取消动画
        wrapper.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        state.x = originX + (e.clientX - dragStartX);
        state.y = originY + (e.clientY - dragStartY);
        applyTransform();
    });
    window.addEventListener('mouseup', function() {
        if (!isDragging) return;
        isDragging = false;
        targetEl.style.transition = 'transform 0.2s ease';
        wrapper.style.cursor = 'default';
    });

    wrapper.addEventListener('dblclick', function() {
        wrapper.resetZoom();
    });

    wrapper.__zoomInited = true;
}

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

// ==================== 暴露全局 ====================
window.getPreferredTheme = getPreferredTheme;
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.showToast = showToast;
window.showModal = showModal;
window.hideModal = hideModal;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.setLoading = setLoading;
window.initImageZoom = initImageZoom;
window.initParticles = initParticles;

// 初始化主题与粒子
document.addEventListener('DOMContentLoaded', () => {
    setTheme(getPreferredTheme());
    initParticles();
});
