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
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    document.getElementById('singleContent').style.display = mode === 'single' ? '' : 'none';
    document.getElementById('batchContent').style.display = mode === 'batch' ? '' : 'none';
    document.getElementById('batchFileList').classList.toggle('active', mode === 'batch' && batchFiles.length > 0);
    document.getElementById('batchActions').classList.toggle('active', mode === 'batch' && batchFiles.length > 0);
    document.getElementById('uploadPreview').classList.remove('active');
    document.getElementById('resultSection').hidden = true;
    document.getElementById('batchResultSection').hidden = true;
    document.getElementById('fileInput').value = '';
    document.getElementById('batchFileInput').value = '';
    selectedFile = null;
    batchFiles = [];
    hideProgress();
}
window.switchMode = switchMode;

// ==================== 拖拽上传 ====================
function setupDragDrop() {
    const zone = document.getElementById('uploadZone');
    const singleInput = document.getElementById('fileInput');
    const batchInput = document.getElementById('batchFileInput');

    zone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (currentMode === 'single') singleInput.click();
        else batchInput.click();
    });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length === 0) return;
        if (currentMode === 'single') handleFile(files[0]);
        else handleBatchFiles(Array.from(files));
    });
    singleInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
    batchInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleBatchFiles(Array.from(e.target.files));
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
    document.getElementById('progressPercent').textContent = Math.min(percent, 100) + '%';
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
        progress += Math.random() * 2 + 0.5;
        if (progress > 95) progress = 95;
        const stepIdx = Math.min(Math.floor(progress / 20), steps.length - 1);
        const statusHtml = `
            <span class="status-dot processing"></span>
            正在 <span class="highlight">${stepLabels[stepIdx]}</span>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px;">${steps[stepIdx]}</span>
        `;
        showProgress(statusHtml, progress, stepIdx);
    }, 200);

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
function zoomImage(type, delta) {
    const img = type === 'original' ? document.getElementById('resultOriginal') : document.getElementById('svgDisplay');
    if (!img) return;
    let newScale = (type === 'original' ? zoomState.original : zoomState.svg) + delta;
    newScale = Math.max(0.2, Math.min(3, newScale));
    img.style.transform = `scale(${newScale})`;
    if (type === 'original') {
        zoomState.original = newScale;
        document.getElementById('zoomOriginal').textContent = Math.round(newScale * 100) + '%';
    } else {
        zoomState.svg = newScale;
        document.getElementById('zoomSvg').textContent = Math.round(newScale * 100) + '%';
    }
}
window.zoomImage = zoomImage;

function resetZoom(type) {
    const target = 1;
    const current = type === 'original' ? zoomState.original : zoomState.svg;
    zoomImage(type, target - current);
}
window.resetZoom = resetZoom;