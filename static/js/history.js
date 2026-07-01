// ==================== 历史记录页 ====================
let historyData = [];
let selectedIds = new Set();
let currentRenameId = null;
let detailZoomState = { original: 1, svg: 1 };
let currentDetailSvg = '';
let currentDetailFilename = '';

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
});

// ==================== 加载历史 ====================
async function loadHistory() {
    const grid = document.getElementById('historyGrid');
    const empty = document.getElementById('historyEmpty');

    grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>加载中...</p></div>`;

    try {
        const res = await fetch('/api/history');
        if (!res.ok) throw new Error('加载失败');
        const data = await res.json();
        historyData = data;
        selectedIds.clear();
        updateBatchBar();
        renderHistory();
    } catch (e) {
        showToast('加载历史记录失败', 'error');
        grid.innerHTML = '';
        empty.hidden = false;
    }
}
window.loadHistory = loadHistory;

function renderHistory() {
    const grid = document.getElementById('historyGrid');
    const empty = document.getElementById('historyEmpty');

    if (!historyData.length) {
        grid.innerHTML = '';
        empty.hidden = false;
        document.getElementById('batchBar').hidden = true;
        return;
    }
    empty.hidden = true;
    document.getElementById('batchBar').hidden = false;

    grid.innerHTML = historyData.map(item => `
        <div class="history-card ${selectedIds.has(item.id) ? 'selected' : ''}" data-id="${item.id}">
            <input type="checkbox" class="card-select" 
                ${selectedIds.has(item.id) ? 'checked' : ''}
                onchange="toggleSelect(${item.id})">
            <div class="card-image" onclick="showHistoryDetail(${item.id})">
                <img src="${item.image_url}" alt="${escapeHtml(item.filename)}" loading="lazy">
                <div class="card-overlay">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); showHistoryDetail(${item.id})">查看详情</button>
                </div>
            </div>
            <div class="card-info">
                <p class="card-name" onclick="showHistoryDetail(${item.id})">${escapeHtml(item.filename)}</p>
                <div class="card-meta">
                    <span>${formatDate(item.created_at)}</span>
                    <div class="card-actions">
                        <button class="card-action-btn" onclick="event.stopPropagation(); startRename(${item.id})" title="重命名">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="card-action-btn" onclick="event.stopPropagation(); exportSvg(${item.id})" title="导出">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </button>
                        <button class="card-action-btn danger" onclick="event.stopPropagation(); deleteHistory(${item.id})" title="删除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// ==================== 选择 ====================
function toggleSelect(id) {
    selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
    renderHistory();
    updateBatchBar();
}
window.toggleSelect = toggleSelect;

function toggleSelectAll() {
    const checked = document.getElementById('selectAll').checked;
    if (checked) historyData.forEach(item => selectedIds.add(item.id));
    else selectedIds.clear();
    renderHistory();
    updateBatchBar();
}
window.toggleSelectAll = toggleSelectAll;

function updateBatchBar() {
    const count = selectedIds.size;
    document.getElementById('batchCount').textContent = count > 0 ? `已选择 ${count} 项` : '';
    document.getElementById('batchDeleteBtn').hidden = count === 0;
    document.getElementById('exportBtn').hidden = count === 0;

    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        if (count === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
        else if (count === historyData.length) { selectAll.checked = true; selectAll.indeterminate = false; }
        else { selectAll.checked = false; selectAll.indeterminate = true; }
    }
}

// ==================== 重命名 ====================
function startRename(id) {
    currentRenameId = id;
    const item = historyData.find(h => h.id === id);
    if (!item) return;
    document.getElementById('renameInput').value = item.filename.replace(/\.[^/.]+$/, '');
    showModal('renameModal');
    setTimeout(() => document.getElementById('renameInput').focus(), 100);
}
window.startRename = startRename;

async function confirmRename() {
    const newName = document.getElementById('renameInput').value.trim();
    if (!newName) return showToast('名称不能为空', 'error');
    const item = historyData.find(h => h.id === currentRenameId);
    if (item) {
        item.filename = newName + (item.filename.match(/\.[^/.]+$/)?.[0] || '');
        renderHistory();
        showToast('重命名成功', 'success');
    }
    hideModal('renameModal');
    currentRenameId = null;
}
window.confirmRename = confirmRename;

// ==================== 导出 ====================
async function exportSvg(id) {
    try {
        const res = await fetch(`/api/history/${id}/svg`);
        const data = await res.json();
        if (res.ok && data.svg) {
            const item = historyData.find(h => h.id === id);
            const filename = item ? item.filename.replace(/\.[^/.]+$/, '') + '.svg' : 'export.svg';
            const blob = new Blob([data.svg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            showToast('导出成功', 'success');
        }
    } catch (e) {
        showToast('导出失败', 'error');
    }
}
window.exportSvg = exportSvg;

async function exportSelected() {
    if (selectedIds.size === 0) return showToast('请选择要导出的记录', 'error');
    try {
        const res = await fetch('/api/history/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'history_export.zip';
            a.click();
            URL.revokeObjectURL(url);
            showToast('导出成功', 'success');
        } else {
            showToast('导出失败', 'error');
        }
    } catch (e) {
        showToast('导出失败', 'error');
    }
}
window.exportSelected = exportSelected;

// ==================== 删除 ====================
async function deleteHistory(id) {
    if (!confirm('确定要删除这条记录吗？')) return;
    try {
        const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('已删除', 'success');
            selectedIds.delete(id);
            loadHistory();
        } else {
            showToast('删除失败', 'error');
        }
    } catch (e) {
        showToast('删除失败', 'error');
    }
}
window.deleteHistory = deleteHistory;

async function batchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？`)) return;
    try {
        const res = await fetch('/api/history/batch', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        if (res.ok) {
            showToast(`已删除 ${selectedIds.size} 条记录`, 'success');
            selectedIds.clear();
            loadHistory();
        } else {
            showToast('批量删除失败', 'error');
        }
    } catch (e) {
        showToast('批量删除失败', 'error');
    }
}
window.batchDelete = batchDelete;

// ==================== 历史详情（使用全局弹窗） ====================
async function showHistoryDetail(historyId) {
    try {
        const res = await fetch(`/api/history/${historyId}/detail`);
        const data = await res.json();
        if (!res.ok) return showToast('加载失败', 'error');

        document.getElementById('detailModalTitle').textContent = data.filename;
        document.getElementById('detailOriginalImg').src = data.image_url;
        document.getElementById('detailSvgDisplay').innerHTML = data.svg_text;
        document.getElementById('detailDate').textContent = formatDate(data.created_at);

        currentDetailSvg = data.svg_text;
        currentDetailFilename = data.filename.replace(/\.[^/.]+$/, '') + '.svg';

        detailZoomState = { original: 1, svg: 1 };
        document.getElementById('detailOriginalImg').style.transform = 'scale(1)';
        document.getElementById('detailSvgDisplay').style.transform = 'scale(1)';
        document.getElementById('detailZoomOriginal').textContent = '100%';
        document.getElementById('detailZoomSvg').textContent = '100%';

        showModal('historyDetailModal');
    } catch (e) {
        showToast('加载失败', 'error');
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
    navigator.clipboard.writeText(currentDetailSvg).then(() => showToast('SVG 代码已复制', 'success'));
}
window.copyDetailSvg = copyDetailSvg;

function downloadDetailSvg() {
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

// ==================== 工具函数 ====================
function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return d.toLocaleDateString('zh-CN');
}