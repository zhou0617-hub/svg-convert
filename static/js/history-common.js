// ==================== 历史详情弹窗（共用） ====================
// 依赖 core.js

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

        // 初始化缩放
        setTimeout(() => {
            initImageZoom('#historyDetailModal .compare-item:nth-child(1) .compare-img-wrapper', '#detailOriginalImg');
            initImageZoom('#historyDetailModal .compare-item:nth-child(3) .compare-img-wrapper', '#detailSvgDisplay');
        }, 100);
    } catch (e) {
        console.error('加载详情失败:', e);
        showToast('加载详情失败', 'error');
    }

    setTimeout(() => {
        // 使用弹窗内的特定选择器
        initImageZoom('#detailOriginalWrapper', '#detailOriginalImg');
        initImageZoom('#detailSvgWrapper', '#detailSvgDisplay');
    }, 100);
}

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

function resetDetailZoom(type) {
    const target = 1;
    const current = type === 'original' ? detailZoomState.original : detailZoomState.svg;
    const delta = target - current;
    zoomDetailImage(type, delta);
}

function copyDetailSvg() {
    if (!currentDetailSvg) return showToast('没有可复制的 SVG', 'error');
    navigator.clipboard.writeText(currentDetailSvg).then(() => {
        showToast('SVG 代码已复制', 'success');
    });
}

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

// ==================== 暴露全局 ====================
window.showHistoryDetail = showHistoryDetail;
window.zoomDetailImage = zoomDetailImage;
window.resetDetailZoom = resetDetailZoom;
window.copyDetailSvg = copyDetailSvg;
window.downloadDetailSvg = downloadDetailSvg;