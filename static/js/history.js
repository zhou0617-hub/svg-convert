// ==================== 历史记录页 ====================
let historyData = [];
let selectedIds = new Set();
let currentRenameId = null;
let currentSvgData = '';
let currentSvgName = '';

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
});

async function loadHistory() {
    const grid = document.getElementById('historyGrid');
    const empty = document.getElementById('historyEmpty');
    
    grid.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>加载中...</p>
        </div>
    `;
    
    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        historyData = data;
        selectedIds.clear();
        updateBatchBar();
        renderHistory();
    } catch (e) {
        showToast('加载历史记录失败', 'error');
        grid.innerHTML = '';
        if (empty) empty.hidden = false;
    }
}

function renderHistory() {
    const grid = document.getElementById('historyGrid');
    const empty = document.getElementById('historyEmpty');
    
    if (!grid) return;

    if (!historyData.length) {
        grid.innerHTML = '';
        if (empty) empty.hidden = false;
        document.getElementById('batchBar').hidden = true;
        return;
    }
    
    if (empty) empty.hidden = true;
    document.getElementById('batchBar').hidden = false;

    grid.innerHTML = historyData.map(item => `
        <div class="history-card ${selectedIds.has(item.id) ? 'selected' : ''}" data-id="${item.id}">
            <input type="checkbox" class="card-select" 
                ${selectedIds.has(item.id) ? 'checked' : ''}
                onchange="toggleSelect(${item.id})"
                title="选择">
            <div class="card-image" onclick="showHistorySvg(${item.id}, '${escapeHtml(item.filename)}')">
                <img src="${item.image_url}" alt="${escapeHtml(item.filename)}" loading="lazy">
                <div class="card-overlay">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); showHistorySvg(${item.id}, '${escapeHtml(item.filename)}')">
                        查看 SVG
                    </button>
                </div>
            </div>
            <div class="card-info">
                <p class="card-name" onclick="showHistorySvg(${item.id}, '${escapeHtml(item.filename)}')" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</p>
                <div class="card-meta">
                    <span>${formatDate(item.created_at)}</span>
                    <div class="card-actions">
                        <button class="card-action-btn" onclick="event.stopPropagation(); startRename(${item.id}, '${escapeHtml(item.filename)}')" title="重命名">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="card-action-btn" onclick="event.stopPropagation(); exportSvg(${item.id})" title="导出 SVG">
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

// ==================== 选择相关 ====================
function toggleSelect(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    renderHistory();
    updateBatchBar();
}

function toggleSelectAll() {
    const checkbox = document.getElementById('selectAll');
    if (checkbox.checked) {
        historyData.forEach(item => selectedIds.add(item.id));
    } else {
        selectedIds.clear();
    }
    renderHistory();
    updateBatchBar();
}

function updateBatchBar() {
    const count = selectedIds.size;
    const batchCount = document.getElementById('batchCount');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    
    if (batchCount) {
        batchCount.textContent = count > 0 ? `已选择 ${count} 项` : '';
    }
    if (batchDeleteBtn) {
        batchDeleteBtn.hidden = count === 0;
    }
    
    // 同步全选框状态
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        if (count === 0) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        } else if (count === historyData.length) {
            selectAll.checked = true;
            selectAll.indeterminate = false;
        } else {
            selectAll.checked = false;
            selectAll.indeterminate = true;
        }
    }
}

// ==================== 重命名 ====================
function startRename(id, currentName) {
    currentRenameId = id;
    const input = document.getElementById('renameInput');
    input.value = currentName.replace(/\.[^/.]+$/, ''); // 去掉扩展名
    showModal('renameModal');
    setTimeout(() => input.focus(), 100);
}

async function confirmRename() {
    const newName = document.getElementById('renameInput').value.trim();
    if (!newName) {
        showToast('名称不能为空', 'error');
        return;
    }
    
    // 前端临时存储重命名（实际应该调后端 API）
    const item = historyData.find(h => h.id === currentRenameId);
    if (item) {
        item.filename = newName + (item.filename.match(/\.[^/.]+$/)?.[0] || '');
        renderHistory();
        showToast('重命名成功', 'success');
    }
    
    hideModal('renameModal');
    currentRenameId = null;
}

// ==================== 导出 SVG ====================
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
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('导出成功', 'success');
        } else {
            showToast('导出失败', 'error');
        }
    } catch (e) {
        showToast('导出失败', 'error');
    }
}

// ==================== 查看 SVG ====================
async function showHistorySvg(id, filename) {
    try {
        const res = await fetch(`/api/history/${id}/svg`);
        const data = await res.json();
        if (res.ok) {
            currentSvgData = data.svg;
            currentSvgName = filename.replace(/\.[^/.]+$/, '') + '.svg';
            document.getElementById('svgModalTitle').textContent = filename;
            document.getElementById('svgPreviewLarge').innerHTML = data.svg;
            document.getElementById('svgCode').value = data.svg;
            showModal('svgModal');
        }
    } catch (e) {
        showToast('加载失败', 'error');
    }
}

function copySvgFromModal() {
    navigator.clipboard.writeText(currentSvgData).then(() => {
        showToast('SVG 代码已复制', 'success');
    });
}

function downloadSvgFromModal() {
    const blob = new Blob([currentSvgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentSvgName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('下载已开始', 'success');
}

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
            const data = await res.json();
            showToast(data.error || '删除失败', 'error');
        }
    } catch (e) {
        showToast('删除失败', 'error');
    }
}

async function batchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？此操作不可恢复！`)) return;
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
            const data = await res.json();
            showToast(data.error || '批量删除失败', 'error');
        }
    } catch (e) {
        showToast('批量删除失败', 'error');
    }
}

// ==================== 工具函数 ====================
function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + '分钟前';
    if (diff < day) return Math.floor(diff / hour) + '小时前';
    if (diff < 7 * day) return Math.floor(diff / day) + '天前';
    
    return d.toLocaleDateString('zh-CN');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}