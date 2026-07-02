// ==================== 格式转换页面 ====================
let selectedFile = null;
let batchFiles = [];
let batchResults = [];
let zoomState = { original: 1, svg: 1 };
let currentMode = 'single';
let isConverting = false;

document.addEventListener('DOMContentLoaded', () => {
    setupDragDrop();
});

// ==================== 模式切换 ====================
// ==================== 模式切换 ====================
// ==================== 模式切换（修复版） ====================
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // 转换模块显示控制
    document.getElementById('singleContent').style.display = mode === 'single' ? '' : 'none';
    document.getElementById('batchContent').style.display = mode === 'batch' ? '' : 'none';
    
    // 增强模块显示控制
    document.getElementById('enhanceSingleContent').style.display = mode === 'enhance_single' ? '' : 'none';
    document.getElementById('enhanceBatchContent').style.display = mode === 'enhance_batch' ? '' : 'none';

    // ========== 新增：算法选择区显隐控制 ==========
    document.getElementById('enhanceSingleAlgo').style.display = mode === 'enhance_single' ? 'grid' : 'none';
    document.getElementById('enhanceBatchAlgo').style.display = mode === 'enhance_batch' ? 'grid' : 'none';

    // 转换相关元素重置
    document.getElementById('uploadPreview').classList.remove('active');
    document.getElementById('batchFileList').classList.toggle('active', mode === 'batch' && batchFiles.length > 0);
    document.getElementById('batchActions').classList.toggle('active', mode === 'batch' && batchFiles.length > 0);
    document.getElementById('resultSection').hidden = true;
    document.getElementById('batchResultSection').hidden = true;

    // 增强相关元素重置
    document.getElementById('enhanceUploadPreview').classList.remove('active');
    document.getElementById('enhanceBatchFileList').classList.toggle('active', mode === 'enhance_batch' && enhanceBatchFiles.length > 0);
    document.getElementById('enhanceBatchActions').classList.toggle('active', mode === 'enhance_batch' && enhanceBatchFiles.length > 0);
    document.getElementById('enhanceResultSection').hidden = true;
    document.getElementById('enhanceBatchResultSection').hidden = true;

    // 全局重置
    document.getElementById('fileInput').value = '';
    document.getElementById('batchFileInput').value = '';
    selectedFile = null;
    batchFiles = [];
    enhanceSelectedFile = null;
    enhanceBatchFiles = [];
    hideProgress();
}
window.switchMode = switchMode;

// ==================== 拖拽上传 ====================
function setupDragDrop() {
    const zone = document.getElementById('uploadZone');
    const singleInput = document.getElementById('fileInput');
    const batchInput = document.getElementById('batchFileInput');

    zone.addEventListener('click', (e) => {
        // 点击按钮、单选框、模式选择、算法选择区时，不触发文件选择
        if (e.target.closest('button, input, label, .enhance-mode-select, .enhance-mode-select *')) return;

        if (currentMode === 'single' || currentMode === 'enhance_single') {
            singleInput.click();
        } else {
            batchInput.click();
        }
    });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length === 0) return;
    
        if (currentMode === 'single') {
            handleFile(files[0]);
        } else if (currentMode === 'batch') {
            handleBatchFiles(Array.from(files));
        } else if (currentMode === 'enhance_single') {
            handleEnhanceSingleFile(files[0]);
        } else if (currentMode === 'enhance_batch') {
            handleEnhanceBatchFiles(Array.from(files));
        }
    });
        singleInput.addEventListener('change', (e) => {
        if (!e.target.files.length) return;
        if (currentMode === 'enhance_single') {
            handleEnhanceSingleFile(e.target.files[0]);
        } else {
            handleFile(e.target.files[0]);
        }
    });
    batchInput.addEventListener('change', (e) => {
    if (!e.target.files.length) return;
    if (currentMode === 'enhance_batch') {
        handleEnhanceBatchFiles(Array.from(e.target.files));
    } else {
        handleBatchFiles(Array.from(e.target.files));
    }
});
}

// ==================== 单图处理 ====================
function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast('文件大小不能超过 10MB', 'error');
        return;
    }
    selectedFile = file;
    currentFilename = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('singleContent').style.display = 'none';
        document.getElementById('uploadPreview').classList.add('active');
        document.getElementById('batchFileList').classList.remove('active');
        document.getElementById('batchActions').classList.remove('active');
    };
    reader.readAsDataURL(file);
}

// ==================== 批量处理 ====================
function handleBatchFiles(files) {
    const validFiles = files.filter(f => {
        if (!f.type.startsWith('image/')) {
            showToast(`${f.name} 不是图片文件，已跳过`, 'error');
            return false;
        }
        if (f.size > 10 * 1024 * 1024) {
            showToast(`${f.name} 超过 10MB，已跳过`, 'error');
            return false;
        }
        return true;
    });
    if (batchFiles.length + validFiles.length > 20) {
        showToast('最多支持 20 张图片', 'error');
        return;
    }
    batchFiles = [...batchFiles, ...validFiles];
    renderBatchList();
    document.getElementById('batchFileList').classList.add('active');
    document.getElementById('batchActions').classList.add('active');
    document.getElementById('singleContent').style.display = 'none';
    document.getElementById('batchContent').style.display = 'none';
}

function renderBatchList() {
    const list = document.getElementById('batchFileList');
    if (!list) return;
    list.innerHTML = batchFiles.map((f, i) => `
        <div class="batch-file-item">
            <div class="file-info">
                <span>📄</span>
                <span class="name">${escapeHtml(f.name)}</span>
                <span style="font-size:0.7rem;color:var(--text-muted);">(${(f.size / 1024).toFixed(0)}KB)</span>
            </div>
            <span class="file-status pending">待转换</span>
            <button class="btn btn-ghost btn-sm" onclick="removeBatchFile(${i})" style="padding:2px 8px;">✕</button>
        </div>
    `).join('');
}

function removeBatchFile(index) {
    batchFiles.splice(index, 1);
    if (batchFiles.length === 0) {
        document.getElementById('batchFileList').classList.remove('active');
        document.getElementById('batchActions').classList.remove('active');
        document.getElementById('batchContent').style.display = '';
    } else {
        renderBatchList();
    }
}
window.removeBatchFile = removeBatchFile;

// ==================== 重置上传 ====================
function resetUpload() {
    selectedFile = null;
    batchFiles = [];
    batchResults = [];
    document.getElementById('fileInput').value = '';
    document.getElementById('batchFileInput').value = '';
    document.getElementById('singleContent').style.display = '';
    document.getElementById('batchContent').style.display = currentMode === 'batch' ? '' : 'none';
    document.getElementById('uploadPreview').classList.remove('active');
    document.getElementById('batchFileList').classList.remove('active');
    document.getElementById('batchActions').classList.remove('active');
    document.getElementById('resultSection').hidden = true;
    document.getElementById('batchResultSection').hidden = true;
    hideProgress();
    zoomState = { original: 1, svg: 1 };
}
window.resetUpload = resetUpload;

// ==================== 进度指示器 ====================
function showProgress(status, percent, step = null) {
    const container = document.getElementById('progressContainer');
    container.classList.add('active');
    document.getElementById('progressStatus').innerHTML = status;
    document.getElementById('progressFill').style.width = Math.min(percent, 100) + '%';
    document.getElementById('progressPercent').textContent = Math.round(Math.min(percent, 100)) + '%';
    if (step !== null) {
        const steps = document.querySelectorAll('.progress-step');
        steps.forEach((el, idx) => {
            el.classList.remove('active', 'done');
            if (idx < step) el.classList.add('done');
            else if (idx === step) el.classList.add('active');
        });
    }
}
function hideProgress() {
    document.getElementById('progressContainer').classList.remove('active');
}

// ==================== 单图转换 ====================
async function startConvert() {
    if (!requireAuth()) return;
    if (!selectedFile) return showToast('请选择一张图片', 'error');
    if (isConverting) return;

    const btn = document.getElementById('convertBtn');
    setLoading(btn, true);
    isConverting = true;

    const steps = ['📤', '🔍', '🎨', '✨', '✅'];
    const stepLabels = ['上传', '分析', '矢量化', '优化', '完成'];
    let stepsHtml = steps.map((icon, idx) => `
        <div class="progress-step" data-step="${idx}">
            <span class="step-icon">${icon}</span>
            ${stepLabels[idx]}
            <span class="step-line"></span>
        </div>
    `).join('');
    let stepsContainer = document.querySelector('.progress-steps');
    if (!stepsContainer) {
        const container = document.getElementById('progressContainer');
        const div = document.createElement('div');
        div.className = 'progress-steps';
        div.innerHTML = stepsHtml;
        container.appendChild(div);
    } else {
        stepsContainer.innerHTML = stepsHtml;
    }

    let progress = 0;
    const progressInterval = setInterval(() => {
        // 分阶段匀速增长，更真实不跳变
        if (progress < 30) progress += 1.5;
        else if (progress < 60) progress += 1;
        else if (progress < 90) progress += 0.6;
        else progress += 0.2;
    
        if (progress > 95) progress = 95;
        const stepIdx = Math.min(Math.floor(progress / 20), steps.length - 1);
        const statusHtml = `
            <span class="status-dot processing"></span>
            正在 <span class="highlight">${stepLabels[stepIdx]}</span>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px;">${steps[stepIdx]}</span>
        `;
        showProgress(statusHtml, progress, stepIdx);
    }, 120); // 加快更新频率，更流畅

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
        const res = await fetch('/api/convert', { method: 'POST', body: formData });
        const data = await res.json();
        clearInterval(progressInterval);
        if (res.ok) {
            currentSvg = data.svg;
            currentFilename = data.filename || selectedFile.name;
            showProgress(`<span class="status-dot done"></span> 🎉 转换完成！`, 100, steps.length - 1);
            setTimeout(() => { hideProgress(); showResult(data.svg); showToast('转换成功！', 'success'); }, 600);
        } else {
            showProgress(`<span class="status-dot error"></span> ❌ 转换失败：${escapeHtml(data.error || '未知错误')}`, 100, steps.length - 1);
            setTimeout(() => { hideProgress(); showToast(data.error || '转换失败', 'error'); }, 800);
        }
    } catch (e) {
        clearInterval(progressInterval);
        hideProgress();
        showToast('网络错误', 'error');
    } finally {
        setLoading(btn, false);
        isConverting = false;
    }
}
window.startConvert = startConvert;

// ==================== 批量转换 ====================
async function startBatchConvert() {
    if (!requireAuth()) return;
    if (batchFiles.length === 0) return showToast('请选择图片', 'error');
    if (isConverting) return;
    isConverting = true;
    batchResults = [];
    document.getElementById('batchResultSection').hidden = true;

    document.querySelectorAll('.batch-file-item .file-status').forEach(el => {
        el.className = 'file-status processing';
        el.textContent = '处理中...';
    });

    const formData = new FormData();
    batchFiles.forEach(f => formData.append('images', f));

    const steps = ['📤', '🔍', '🎨', '✨', '✅'];
    const stepLabels = ['上传', '分析', '矢量化', '优化', '完成'];
    let stepsHtml = steps.map((icon, idx) => `
        <div class="progress-step" data-step="${idx}">
            <span class="step-icon">${icon}</span>
            ${stepLabels[idx]}
            <span class="step-line"></span>
        </div>
    `).join('');
    let stepsContainer = document.querySelector('.progress-steps');
    if (!stepsContainer) {
        const container = document.getElementById('progressContainer');
        const div = document.createElement('div');
        div.className = 'progress-steps';
        div.innerHTML = stepsHtml;
        container.appendChild(div);
    } else {
        stepsContainer.innerHTML = stepsHtml;
    }

    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 1.5 + 0.5;
        if (progress > 95) progress = 95;
        const stepIdx = Math.min(Math.floor(progress / 20), steps.length - 1);
        const statusHtml = `
            <span class="status-dot processing"></span>
            批量转换中 <span class="highlight">${Math.floor(progress / 100 * batchFiles.length)}/${batchFiles.length}</span>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px;">${steps[stepIdx]}</span>
        `;
        showProgress(statusHtml, progress, stepIdx);
    }, 300);

    try {
        const res = await fetch('/api/convert/batch', { method: 'POST', body: formData });
        const data = await res.json();
        clearInterval(progressInterval);
        if (res.ok) {
            batchResults = data.results || [];
            const items = document.querySelectorAll('.batch-file-item');
            batchResults.forEach((r, i) => {
                if (items[i]) {
                    const status = items[i].querySelector('.file-status');
                    if (r.success) { status.className = 'file-status done'; status.textContent = '✅ 完成'; }
                    else { status.className = 'file-status error'; status.textContent = '❌ ' + (r.error || '失败'); }
                }
            });
            showProgress(`<span class="status-dot done"></span> 🎉 批量转换完成！成功 ${data.success_count}/${data.total}`, 100, steps.length - 1);
            setTimeout(() => { hideProgress(); showBatchResults(data); showToast(`转换完成: ${data.success_count}/${data.total} 成功`, 'success'); }, 600);
        } else {
            showProgress(`<span class="status-dot error"></span> ❌ 批量转换失败`, 100, steps.length - 1);
            setTimeout(() => { hideProgress(); showToast(data.error || '批量转换失败', 'error'); }, 800);
        }
    } catch (e) {
        clearInterval(progressInterval);
        hideProgress();
        showToast('网络错误', 'error');
    } finally {
        isConverting = false;
    }
}
window.startBatchConvert = startBatchConvert;

// ==================== 显示结果 ====================
function showResult(svg) {
    const img = document.getElementById('resultOriginal');
    img.src = document.getElementById('previewImg').src;
    zoomState = { original: 1, svg: 1 };
    img.style.transform = 'scale(1)';
    document.getElementById('zoomOriginal').textContent = '100%';
    const container = document.getElementById('svgDisplay');
    container.innerHTML = svg;
    container.style.transform = 'scale(1)';
    document.getElementById('zoomSvg').textContent = '100%';
    document.getElementById('resultSection').hidden = false;
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    initAllZoomDrag(); // 新增：初始化缩放拖拽
    initZoomDragEvents(); // 新增：结果渲染后绑定缩放事件
}

function showBatchResults(data) {
    const section = document.getElementById('batchResultSection');
    section.hidden = false;
    document.getElementById('batchTotal').textContent = data.total;
    document.getElementById('batchSuccess').textContent = data.success_count;
    document.getElementById('batchFailed').textContent = data.total - data.success_count;
    const container = document.getElementById('batchResultItems');
    container.innerHTML = data.results.map((r, i) => `
        <div class="batch-result-item">
            <div class="item-name" title="${escapeHtml(r.filename)}">${escapeHtml(r.filename)}</div>
            ${r.success ? `
                <div style="font-size:0.7rem;color:var(--success);margin-bottom:6px;">✅ 成功</div>
                <div class="item-actions"><button class="btn btn-ghost btn-sm" onclick="downloadSingleBatch(${i})">下载</button></div>
            ` : `
                <div style="font-size:0.7rem;color:var(--error);">❌ ${escapeHtml(r.error || '失败')}</div>
            `}
        </div>
    `).join('');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==================== 下载 ====================
function downloadSvg() {
    const blob = new Blob([currentSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilename.replace(/\.[^/.]+$/, '') + '.svg';
    a.click();
    URL.revokeObjectURL(url);
    showToast('下载已开始', 'success');
}
window.downloadSvg = downloadSvg;

function copySvg() {
    navigator.clipboard.writeText(currentSvg).then(() => showToast('SVG 代码已复制', 'success'));
}
window.copySvg = copySvg;

function downloadSingleBatch(index) {
    const result = batchResults[index];
    if (!result || !result.success) return;
    const blob = new Blob([result.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename.replace(/\.[^/.]+$/, '') + '.svg';
    a.click();
    URL.revokeObjectURL(url);
    showToast('下载已开始', 'success');
}
window.downloadSingleBatch = downloadSingleBatch;

async function downloadBatchZip() {
    const successResults = batchResults.filter(r => r.success);
    if (successResults.length === 0) return showToast('没有可下载的 SVG', 'error');
    const svgs = successResults.map(r => ({ filename: r.filename.replace(/\.[^/.]+$/, '') + '.svg', svg: r.svg }));
    try {
        const res = await fetch('/api/convert/batch/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ svgs })
        });
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'svg_converts.zip';
            a.click();
            URL.revokeObjectURL(url);
            showToast('下载已开始', 'success');
        } else showToast('下载失败', 'error');
    } catch (e) { showToast('下载失败', 'error'); }
}
window.downloadBatchZip = downloadBatchZip;

// ==================== 缩放控制 ====================
// 初始化缩放+拖拽事件
function initZoomDragEvents() {
    const originalWrap = document.getElementById('resultOriginal')?.closest('.compare-img-wrapper');
    const svgWrap = document.getElementById('svgDisplay')?.closest('.compare-img-wrapper');

    // 绑定原图
    if (originalWrap) {
        originalWrap.addEventListener('wheel', (e) => handleZoomWheel(e, 'original'), { passive: false });
        originalWrap.addEventListener('mousedown', (e) => handleDragStart(e, 'original'));
        originalWrap.addEventListener('dblclick', () => resetZoom('original'));
    }
    // 绑定SVG
    if (svgWrap) {
        svgWrap.addEventListener('wheel', (e) => handleZoomWheel(e, 'svg'), { passive: false });
        svgWrap.addEventListener('mousedown', (e) => handleDragStart(e, 'svg'));
        svgWrap.addEventListener('dblclick', () => resetZoom('svg'));
    }

    // 全局监听拖拽移动/松开，保证移出容器也不中断
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
}

// 滚轮缩放：以鼠标指向位置为锚点
function handleZoomWheel(e, type) {
    e.preventDefault();
    const state = zoomState[type];
    const step = 0.12;
    const delta = e.deltaY > 0 ? -step : step;
    const newScale = Math.max(0.2, Math.min(5, state.scale + delta));

    if (Math.abs(newScale - state.scale) < 0.001) return;

    // 计算鼠标在容器内的坐标
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 锚点缩放算法：保证鼠标指向的像素位置不动
    state.tx = mouseX - (mouseX - state.tx) * (newScale / state.scale);
    state.ty = mouseY - (mouseY - state.ty) * (newScale / state.scale);
    state.scale = newScale;

    updateTransform(type);
}

// 开始拖拽
function handleDragStart(e, type) {
    if (e.button !== 0) return; // 只响应左键
    e.preventDefault();
    dragState.active = true;
    dragState.type = type;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.startTx = zoomState[type].tx;
    dragState.startTy = zoomState[type].ty;
    // 拖拽时关闭过渡动画，更跟手
    const el = type === 'original' ? document.getElementById('resultOriginal') : document.getElementById('svgDisplay');
    if (el) el.style.transition = 'none';
}

// 拖拽移动
function handleDragMove(e) {
    if (!dragState.active) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const type = dragState.type;

    zoomState[type].tx = dragState.startTx + dx;
    zoomState[type].ty = dragState.startTy + dy;
    updateTransform(type);
}

// 结束拖拽
function handleDragEnd() {
    if (!dragState.active) return;
    const type = dragState.type;
    // 恢复过渡动画
    const el = type === 'original' ? document.getElementById('resultOriginal') : document.getElementById('svgDisplay');
    if (el) el.style.transition = 'transform 0.2s ease';

    dragState.active = false;
    dragState.type = null;
}

// 按钮缩放：以容器中心为锚点
function zoomImage(type, delta) {
    const state = zoomState[type];
    const newScale = Math.max(0.2, Math.min(5, state.scale + delta));
    if (Math.abs(newScale - state.scale) < 0.001) return;

    const parent = document.getElementById(type === 'original' ? 'resultOriginal' : 'svgDisplay')
        .closest('.compare-img-wrapper');
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    state.tx = centerX - (centerX - state.tx) * (newScale / state.scale);
    state.ty = centerY - (centerY - state.ty) * (newScale / state.scale);
    state.scale = newScale;

    updateTransform(type);
}
window.zoomImage = zoomImage;

// 重置缩放：自适应容器居中显示
function resetZoom(type) {
    const el = type === 'original'
        ? document.getElementById('resultOriginal')
        : document.getElementById('svgDisplay');
    const parent = el?.closest('.compare-img-wrapper');
    if (!el || !parent) return;

    // 先清空变换，获取原始尺寸
    el.style.transform = 'none';
    requestAnimationFrame(() => {
        const parentW = parent.clientWidth;
        const parentH = parent.clientHeight;
        const contentW = el.offsetWidth;
        const contentH = el.offsetHeight;

        if (contentW === 0 || contentH === 0) {
            setTimeout(() => resetZoom(type), 100);
            return;
        }

        // 等比适配容器
        const scale = Math.min(parentW / contentW, parentH / contentH);
        // 居中偏移
        const finalW = contentW * scale;
        const finalH = contentH * scale;
        const tx = (parentW - finalW) / 2;
        const ty = (parentH - finalH) / 2;

        zoomState[type] = { scale: scale, tx: tx, ty: ty };
        updateTransform(type);
    });
}
window.resetZoom = resetZoom;

// 更新元素变换样式
function updateTransform(type) {
    const el = type === 'original' 
        ? document.getElementById('resultOriginal') 
        : document.getElementById('svgDisplay');
    if (!el) return;

    const state = zoomState[type];
    el.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;

    // 同步百分比显示
    const percentEl = type === 'original' 
        ? document.getElementById('zoomOriginal') 
        : document.getElementById('zoomSvg');
    if (percentEl) percentEl.textContent = Math.round(state.scale * 100) + '%';
}

// ---------- 单图增强 ----------
function handleEnhanceSingleFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast('文件大小不能超过 10MB', 'error');
        return;
    }
    enhanceSelectedFile = file;
    currentEnhancedFilename = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('enhancePreviewImg').src = e.target.result;
        document.getElementById('enhanceSingleContent').style.display = 'none';
        document.getElementById('enhanceBatchContent').style.display = 'none';
        document.getElementById('enhanceUploadPreview').classList.add('active');
        document.getElementById('enhanceBatchFileList').classList.remove('active');
        document.getElementById('enhanceBatchActions').classList.remove('active');
        // 上传后隐藏算法选择，避免和预览重叠
        document.getElementById('enhanceSingleAlgo').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function startEnhanceSingle() {
    if (!requireAuth()) return;
    if (!enhanceSelectedFile) return showToast('请选择一张图片', 'error');
    if (isConverting) return;

    const btn = document.getElementById('enhanceBtn');
    setLoading(btn, true);
    isConverting = true;

    // 修复：读取单图增强专属的算法选项
    const algo = document.querySelector('input[name="enhanceAlgoSingle"]:checked')?.value || 'self';
    const formData = new FormData();
    formData.append('image', enhanceSelectedFile);
    formData.append('mode', algo);

    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 2 + 0.5;
        if (progress > 95) progress = 95;
        const statusText = algo === 'realesrgan' ? 'Real-ESRGAN超分' : '画质增强';
        const statusHtml = `
            <span class="status-dot processing"></span>
            正在 <span class="highlight">${statusText}</span>
        `;
        showProgress(statusHtml, progress, 2);
    }, 200);

    try {
        fetch('/api/enhance', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                clearInterval(progressInterval);
                if (data.enhanced_image) {
                    currentEnhancedImage = data.enhanced_image;
                    currentEnhancedFilename = data.filename;
                    const successText = algo === 'realesrgan' ? '超分完成' : '增强完成';
                    showProgress(`<span class="status-dot done"></span> 🎉 ${successText}！`, 100, 4);
                    setTimeout(() => {
                        hideProgress();
                        showEnhanceResult();
                        showToast(`${successText}！`, 'success');
                    }, 600);
                } else {
                    const failText = algo === 'realesrgan' ? '超分失败' : '增强失败';
                    showProgress(`<span class="status-dot error"></span> ❌ ${failText}`, 100, 4);
                    setTimeout(() => {
                        hideProgress();
                        showToast(data.error || '处理失败', 'error');
                    }, 800);
                }
            })
            .catch(() => {
                clearInterval(progressInterval);
                hideProgress();
                showToast('网络错误', 'error');
            })
            .finally(() => {
                setLoading(btn, false);
                isConverting = false;
            });
    } catch (e) {
        clearInterval(progressInterval);
        hideProgress();
        setLoading(btn, false);
        isConverting = false;
        showToast('网络错误', 'error');
    }
}

function showEnhanceResult() {
    document.getElementById('enhanceOriginalImg').src = document.getElementById('enhancePreviewImg').src;
    document.getElementById('enhanceResultImg').src = currentEnhancedImage;

    document.getElementById('enhanceResultSection').hidden = false;
    document.getElementById('enhanceResultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

    initAllZoomDrag(); // 初始化滚轮缩放+拖拽（和转换页同款）
}

function downloadEnhancedImage() {
    if (!currentEnhancedImage) return;
    const a = document.createElement('a');
    a.href = currentEnhancedImage;
    const name = currentEnhancedFilename.replace(/\.[^/.]+$/, '') + '_enhanced.png';
    a.download = name;
    a.click();
    showToast('下载已开始', 'success');
}

function convertEnhancedToSvg() {
    if (!requireAuth()) return;
    if (!enhanceSelectedFile) return;
    if (isConverting) return;
    isConverting = true;

    // 修复：读取单图增强的算法选项
    const algo = document.querySelector('input[name="enhanceAlgoSingle"]:checked')?.value || 'self';
    const formData = new FormData();
    formData.append('image', enhanceSelectedFile);
    formData.append('mode', algo);

    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 1.5 + 0.3;
        if (progress > 95) progress = 95;
        const actionText = algo === 'realesrgan' ? '超分并矢量化' : '增强并矢量化';
        const statusHtml = `
            <span class="status-dot processing"></span>
            正在 <span class="highlight">${actionText}</span>
        `;
        showProgress(statusHtml, progress, 2);
    }, 200);

    fetch('/api/enhance/convert', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            clearInterval(progressInterval);
            if (data.svg) {
                currentSvg = data.svg;
                currentFilename = data.filename || enhanceSelectedFile.name;
                showProgress(`<span class="status-dot done"></span> 🎉 转换完成！`, 100, 4);
                setTimeout(() => {
                    hideProgress();
                    showResult(data.svg);
                    showToast('处理+转换成功！', 'success');
                }, 600);
            } else {
                showProgress(`<span class="status-dot error"></span> ❌ 转换失败`, 100, 4);
                setTimeout(() => {
                    hideProgress();
                    showToast(data.error || '转换失败', 'error');
                }, 800);
            }
        })
        .catch(() => {
            clearInterval(progressInterval);
            hideProgress();
            showToast('网络错误', 'error');
        })
        .finally(() => {
            isConverting = false;
        });
}


function zoomEnhance(type, delta) {
    const selector = type === 'original'
        ? '#enhanceResultSection .compare-item:nth-child(1) .compare-img-wrapper'
        : '#enhanceResultSection .compare-item:nth-child(3) .compare-img-wrapper';
    const wrapper = document.querySelector(selector);
    if (wrapper && wrapper.zoomBy) wrapper.zoomBy(delta);
}
window.zoomEnhance = zoomEnhance;

function resetEnhanceZoom(type) {
    const selector = type === 'original'
        ? '#enhanceResultSection .compare-item:nth-child(1) .compare-img-wrapper'
        : '#enhanceResultSection .compare-item:nth-child(3) .compare-img-wrapper';
    const wrapper = document.querySelector(selector);
    if (wrapper && wrapper.resetZoom) wrapper.resetZoom();
}
window.resetEnhanceZoom = resetEnhanceZoom;

function resetEnhanceUpload() {
    enhanceSelectedFile = null;
    enhanceBatchFiles = [];
    enhanceBatchResults = [];
    currentEnhancedImage = '';
    
    document.getElementById('fileInput').value = '';
    document.getElementById('batchFileInput').value = '';
    
    document.getElementById('enhanceSingleContent').style.display = currentMode === 'enhance_single' ? '' : 'none';
    document.getElementById('enhanceBatchContent').style.display = currentMode === 'enhance_batch' ? '' : 'none';
    document.getElementById('enhanceUploadPreview').classList.remove('active');
    document.getElementById('enhanceBatchFileList').classList.remove('active');
    document.getElementById('enhanceBatchActions').classList.remove('active');
    document.getElementById('enhanceResultSection').hidden = true;
    document.getElementById('enhanceBatchResultSection').hidden = true;
    
    // 重置时重新显示算法选择
    if (currentMode === 'enhance_single') {
        document.getElementById('enhanceSingleAlgo').style.display = 'grid';
    } else if (currentMode === 'enhance_batch') {
        document.getElementById('enhanceBatchAlgo').style.display = 'grid';
    }
    
    hideProgress();
    enhanceZoomState = { original: 1, result: 1 };
}
// ---------- 批量增强 ----------
function handleEnhanceBatchFiles(files) {
    const validFiles = files.filter(f => {
        if (!f.type.startsWith('image/')) {
            showToast(`${f.name} 不是图片文件，已跳过`, 'error');
            return false;
        }
        if (f.size > 10 * 1024 * 1024) {
            showToast(`${f.name} 超过 10MB，已跳过`, 'error');
            return false;
        }
        return true;
    });
    if (enhanceBatchFiles.length + validFiles.length > 20) {
        showToast('最多支持 20 张图片', 'error');
        return;
    }
    enhanceBatchFiles = [...enhanceBatchFiles, ...validFiles];
    renderEnhanceBatchList();
    
    document.getElementById('enhanceBatchFileList').classList.add('active');
    document.getElementById('enhanceBatchActions').classList.add('active');
    document.getElementById('enhanceSingleContent').style.display = 'none';
    document.getElementById('enhanceBatchContent').style.display = 'none';
    // 上传后隐藏算法选择
    document.getElementById('enhanceBatchAlgo').style.display = 'none';
}

function renderEnhanceBatchList() {
    const list = document.getElementById('enhanceBatchFileList');
    if (!list) return;
    list.innerHTML = enhanceBatchFiles.map((f, i) => `
        <div class="batch-file-item">
            <div class="file-info">
                <span>📄</span>
                <span class="name">${escapeHtml(f.name)}</span>
                <span style="font-size:0.7rem;color:var(--text-muted);">(${(f.size / 1024).toFixed(0)}KB)</span>
            </div>
            <span class="file-status pending">待增强</span>
            <button class="btn btn-ghost btn-sm" onclick="removeEnhanceBatchFile(${i})" style="padding:2px 8px;">✕</button>
        </div>
    `).join('');
}

function removeEnhanceBatchFile(index) {
    enhanceBatchFiles.splice(index, 1);
    if (enhanceBatchFiles.length === 0) {
        document.getElementById('enhanceBatchFileList').classList.remove('active');
        document.getElementById('enhanceBatchActions').classList.remove('active');
        document.getElementById('enhanceBatchContent').style.display = '';
    } else {
        renderEnhanceBatchList();
    }
}

function startEnhanceBatch() {
    if (!requireAuth()) return;
    if (enhanceBatchFiles.length === 0) return showToast('请选择图片', 'error');
    if (isConverting) return;
    isConverting = true;
    enhanceBatchResults = [];
    document.getElementById('enhanceBatchResultSection').hidden = true;
    
    document.querySelectorAll('#enhanceBatchFileList .file-status').forEach(el => {
        el.className = 'file-status processing';
        el.textContent = '处理中...';
    });

    // 修复：读取批量增强专属的算法选项
    const algo = document.querySelector('input[name="enhanceAlgoBatch"]:checked')?.value || 'self';
    const formData = new FormData();
    enhanceBatchFiles.forEach(f => formData.append('images', f));
    formData.append('mode', algo);

    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 1.5 + 0.5;
        if (progress > 95) progress = 95;
        const actionText = algo === 'realesrgan' ? '超分' : '增强';
        const statusHtml = `
            <span class="status-dot processing"></span>
            批量${actionText}中 <span class="highlight">${Math.floor(progress / 100 * enhanceBatchFiles.length)}/${enhanceBatchFiles.length}</span>
        `;
        showProgress(statusHtml, progress, 2);
    }, 300);

    fetch('/api/enhance/batch', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            clearInterval(progressInterval);
            if (data.results) {
                enhanceBatchResults = data.results || [];
                const items = document.querySelectorAll('#enhanceBatchFileList .batch-file-item');
                enhanceBatchResults.forEach((r, i) => {
                    if (items[i]) {
                        const status = items[i].querySelector('.file-status');
                        if (r.success) { status.className = 'file-status done'; status.textContent = '✅ 完成'; }
                        else { status.className = 'file-status error'; status.textContent = '❌ ' + (r.error || '失败'); }
                    }
                });
                const actionText = algo === 'realesrgan' ? '超分' : '增强';
                showProgress(`<span class="status-dot done"></span> 🎉 批量${actionText}完成！成功 ${data.success_count}/${data.total}`, 100, 4);
                setTimeout(() => {
                    hideProgress();
                    showEnhanceBatchResults(data);
                    showToast(`处理完成: ${data.success_count}/${data.total} 成功`, 'success');
                }, 600);
            } else {
                showProgress(`<span class="status-dot error"></span> ❌ 批量处理失败`, 100, 4);
                setTimeout(() => {
                    hideProgress();
                    showToast(data.error || '批量处理失败', 'error');
                }, 800);
            }
        })
        .catch(() => {
            clearInterval(progressInterval);
            hideProgress();
            showToast('网络错误', 'error');
        })
        .finally(() => {
            isConverting = false;
        });
}


function showEnhanceBatchResults(data) {
    const section = document.getElementById('enhanceBatchResultSection');
    section.hidden = false;
    document.getElementById('enhanceBatchTotal').textContent = data.total;
    document.getElementById('enhanceBatchSuccess').textContent = data.success_count;
    document.getElementById('enhanceBatchFailed').textContent = data.total - data.success_count;

    const container = document.getElementById('enhanceBatchResultItems');
    container.innerHTML = data.results.map((r, i) => `
        <div class="batch-result-item">
            <div class="item-name" title="${escapeHtml(r.filename)}">${escapeHtml(r.filename)}</div>
            ${r.success ? `
                <div style="font-size:0.7rem;color:var(--success);margin-bottom:6px;">✅ 成功</div>
                <div class="item-actions"><button class="btn btn-ghost btn-sm" onclick="downloadSingleEnhanceBatch(${i})">下载</button></div>
            ` : `
                <div style="font-size:0.7rem;color:var(--error);">❌ ${escapeHtml(r.error || '失败')}</div>
            `}
        </div>
    `).join('');

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadSingleEnhanceBatch(index) {
    const result = enhanceBatchResults[index];
    if (!result || !result.success) return;
    const a = document.createElement('a');
    a.href = result.enhanced_image;
    a.download = result.filename.replace(/\.[^/.]+$/, '') + '_enhanced.png';
    a.click();
    showToast('下载已开始', 'success');
}

function downloadEnhanceBatchZip() {
    const successResults = enhanceBatchResults.filter(r => r.success);
    if (successResults.length === 0) return showToast('没有可下载的图片', 'error');
    
    const images = successResults.map(r => ({ 
        filename: r.filename.replace(/\.[^/.]+$/, '') + '_enhanced.png', 
        image: r.enhanced_image 
    }));

    fetch('/api/enhance/batch/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
    })
    .then(res => {
        if (res.ok) return res.blob();
        throw new Error('下载失败');
    })
    .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'enhanced_images.zip';
        a.click();
        URL.revokeObjectURL(url);
        showToast('下载已开始', 'success');
    })
    .catch(() => showToast('下载失败', 'error'));
}

// 挂载全局
window.handleEnhanceSingleFile = handleEnhanceSingleFile;
window.handleEnhanceBatchFiles = handleEnhanceBatchFiles;
window.startEnhanceSingle = startEnhanceSingle;
window.startEnhanceBatch = startEnhanceBatch;
window.downloadEnhancedImage = downloadEnhancedImage;
window.convertEnhancedToSvg = convertEnhancedToSvg;
window.zoomEnhance = zoomEnhance;
window.resetEnhanceUpload = resetEnhanceUpload;
window.removeEnhanceBatchFile = removeEnhanceBatchFile;
window.downloadSingleEnhanceBatch = downloadSingleEnhanceBatch;
window.downloadEnhanceBatchZip = downloadEnhanceBatchZip;

// ==================== 通用滚轮缩放 + 拖拽平移 ====================
function initImageZoom(wrapperSelector, targetSelector) {
    const wrapper = document.querySelector(wrapperSelector);
    const target = document.querySelector(targetSelector);
    if (!wrapper || !target) return;

    // 状态挂载在容器上，避免全局冲突
    wrapper.zoomData = { scale: 1, x: 0, y: 0 };
    const state = wrapper.zoomData;

    function apply() {
        target.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
        const label = wrapper.querySelector('.zoom-level');
        if (label) label.textContent = Math.round(state.scale * 100) + '%';
    }

    // 滚轮缩放：以鼠标指向位置为中心
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const oldScale = state.scale;
        const step = e.deltaY > 0 ? -0.1 : 0.1;
        state.scale = Math.max(0.2, Math.min(4, state.scale + step));
        const ratio = state.scale / oldScale;

        // 保持鼠标指向的点位置不变
        state.x = mx - (mx - state.x) * ratio;
        state.y = my - (my - state.y) * ratio;
        apply();
    }, { passive: false });

    // 拖拽平移
    let dragging = false;
    let startX = 0, startY = 0;
    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        startX = e.clientX - state.x;
        startY = e.clientY - state.y;
        target.style.transition = 'none';
        wrapper.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        state.x = e.clientX - startX;
        state.y = e.clientY - startY;
        apply();
    });
    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            target.style.transition = 'transform 0.2s ease';
            wrapper.style.cursor = 'grab';
        }
    });

    // 双击重置
    wrapper.addEventListener('dblclick', () => {
        state.scale = 1;
        state.x = 0;
        state.y = 0;
        apply();
    });

    // 暴露给按钮调用
    wrapper.zoomBy = (delta) => {
        state.scale = Math.max(0.2, Math.min(4, state.scale + delta));
        apply();
    };
    wrapper.resetZoom = () => {
        state.scale = 1;
        state.x = 0;
        state.y = 0;
        apply();
    };
}

// 初始化所有模式的图片缩放
function initAllZoomDrag() {
    // 单图转换
    initImageZoom('#resultSection .compare-item:nth-child(1) .compare-img-wrapper', '#resultOriginal');
    initImageZoom('#resultSection .compare-item:nth-child(3) .compare-img-wrapper', '#svgDisplay');
    // 单图增强
    initImageZoom('#enhanceResultSection .compare-item:nth-child(1) .compare-img-wrapper', '#enhanceOriginalImg');
    initImageZoom('#enhanceResultSection .compare-item:nth-child(3) .compare-img-wrapper', '#enhanceResultImg');
}