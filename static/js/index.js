// ==================== 格式转换页面 ====================
let selectedFile = null;
let batchFiles = [];
let batchResults = [];
let enhanceFile = null;
let enhancedImageData = null;
let enhanceZoomState = { original: 1, result: 1 };
let batchEnhanceFiles = [];
let batchEnhanceResults = [];
let currentMode = 'single';
let isConverting = false;
let zoomState = { original: 1, svg: 1 };

document.addEventListener('DOMContentLoaded', () => {
    setupDragDrop();
});

// ==================== 模式切换 ====================
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    
    // 隐藏所有上传内容
    document.getElementById('singleContent').style.display = 'none';
    document.getElementById('batchContent').style.display = 'none';
    document.getElementById('enhanceContent').style.display = 'none';
    document.getElementById('batchEnhanceContent').style.display = 'none';
    
    // 显示当前模式对应的内容
    if (mode === 'single') {
        document.getElementById('singleContent').style.display = '';
    } else if (mode === 'batch') {
        document.getElementById('batchContent').style.display = '';
    } else if (mode === 'enhance') {
        document.getElementById('enhanceContent').style.display = '';
    } else if (mode === 'batchEnhance') {
        document.getElementById('batchEnhanceContent').style.display = '';
    }
    
    // 隐藏预览和结果
    document.getElementById('uploadPreview').classList.remove('active');
    document.getElementById('batchFileList').classList.remove('active');
    document.getElementById('batchActions').classList.remove('active');
    document.getElementById('resultSection').hidden = true;
    document.getElementById('batchResultSection').hidden = true;
    document.getElementById('enhanceResultSection').hidden = true;
    document.getElementById('batchEnhanceResultSection').hidden = true;
    
    // 重置所有输入
    document.getElementById('fileInput').value = '';
    document.getElementById('batchFileInput').value = '';
    document.getElementById('enhanceFileInput').value = '';
    document.getElementById('batchEnhanceFileInput').value = '';
    
    // 重置状态
    selectedFile = null;
    batchFiles = [];
    batchResults = [];
    enhanceFile = null;
    enhancedImageData = null;
    batchEnhanceFiles = [];
    batchEnhanceResults = [];
    
    // 恢复按钮默认
    const btn = document.getElementById('convertBtn');
    btn.querySelector('.btn-text').textContent = '开始转换';
    btn.onclick = startConvert;
    
    const batchBtn = document.getElementById('batchActionBtn');
    batchBtn.querySelector('.btn-text').textContent = '开始批量转换';
    batchBtn.onclick = startBatchConvert;
    
    hideProgress();
    zoomState = { original: 1, svg: 1 };
    enhanceZoomState = { original: 1, result: 1 };
}

// ==================== 拖拽上传 ====================
function setupDragDrop() {
    const zone = document.getElementById('uploadZone');
    const singleInput = document.getElementById('fileInput');
    const batchInput = document.getElementById('batchFileInput');
    const enhanceInput = document.getElementById('enhanceFileInput');
    const batchEnhanceInput = document.getElementById('batchEnhanceFileInput');

    zone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (currentMode === 'single') singleInput.click();
        else if (currentMode === 'batch') batchInput.click();
        else if (currentMode === 'enhance') enhanceInput.click();
        else if (currentMode === 'batchEnhance') batchEnhanceInput.click();
    });
    
    zone.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        zone.classList.add('dragover'); 
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length === 0) return;
        if (currentMode === 'single') handleFile(files[0]);
        else if (currentMode === 'batch') handleBatchFiles(Array.from(files));
        else if (currentMode === 'enhance') handleEnhanceFile(files[0]);
        else if (currentMode === 'batchEnhance') handleBatchEnhanceFiles(Array.from(files));
    });
    
    singleInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
    batchInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleBatchFiles(Array.from(e.target.files));
    });
    enhanceInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleEnhanceFile(e.target.files[0]);
    });
    batchEnhanceInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleBatchEnhanceFiles(Array.from(e.target.files));
    });
}

// ==================== 单图处理 ====================
// index.js handleFile 替换
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
    // 前端Canvas预降噪，减少后端色块压力
    const reader = new FileReader();
    reader.onload = (rawSrc) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            // 限制大图尺寸，防止后端生成海量色块
            let maxW = 1600, maxH = 1600;
            let drawW = img.width, drawH = img.height;
            if (drawW > maxW || drawH > maxH) {
                const scale = Math.min(maxW / drawW, maxH / drawH);
                drawW = Math.floor(img.width * scale);
                drawH = Math.floor(img.height * scale);
            }
            canvas.width = drawW;
            canvas.height = drawH;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, drawW, drawH);
            // 输出预处理后的图片预览
            const previewSrc = canvas.toDataURL("image/png", 0.96);
            document.getElementById('previewImg').src = previewSrc;
            hideAllUploadContent();
            document.getElementById('uploadPreview').classList.add('active');
            // 重生成File传给后端
            canvas.toBlob((blob) => {
                selectedFile = new File([blob], file.name, {type: "image/png"});
            }, "image/png", 0.96);
        };
        img.src = rawSrc.target.result;
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
    hideAllUploadContent();
    document.getElementById('batchFileList').classList.add('active');
    document.getElementById('batchActions').classList.add('active');
    
    const btn = document.getElementById('batchActionBtn');
    btn.querySelector('.btn-text').textContent = '开始批量转换';
    btn.onclick = startBatchConvert;
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
        resetUpload();
    } else {
        renderBatchList();
    }
}
window.removeBatchFile = removeBatchFile;

// ==================== 图像增强处理（合并版：使用高级增强 API）====================
function handleEnhanceFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast('文件大小不能超过 10MB', 'error');
        return;
    }
    enhanceFile = file;
    currentFilename = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        hideAllUploadContent();
        document.getElementById('uploadPreview').classList.add('active');
        const btn = document.getElementById('convertBtn');
        btn.querySelector('.btn-text').textContent = '开始增强';
        btn.onclick = startEnhance;
    };
    reader.readAsDataURL(file);
}
window.handleEnhanceFile = handleEnhanceFile;

// ==================== 批量增强处理（合并版：使用高级增强 API）====================
function handleBatchEnhanceFiles(files) {
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
    if (batchEnhanceFiles.length + validFiles.length > 10) {
        showToast('批量增强最多支持 10 张图片', 'error');
        return;
    }
    batchEnhanceFiles = [...batchEnhanceFiles, ...validFiles];
    renderBatchEnhanceList();
    hideAllUploadContent();
    document.getElementById('batchFileList').classList.add('active');
    document.getElementById('batchActions').classList.add('active');
    
    const btn = document.getElementById('batchActionBtn');
    btn.querySelector('.btn-text').textContent = '开始批量增强';
    btn.onclick = startBatchEnhance;
}

function renderBatchEnhanceList() {
    const list = document.getElementById('batchFileList');
    if (!list) return;
    list.innerHTML = batchEnhanceFiles.map((f, i) => `
        <div class="batch-file-item">
            <div class="file-info">
                <span>📄</span>
                <span class="name">${escapeHtml(f.name)}</span>
                <span style="font-size:0.7rem;color:var(--text-muted);">(${(f.size / 1024).toFixed(0)}KB)</span>
            </div>
            <span class="file-status pending">待增强</span>
            <button class="btn btn-ghost btn-sm" onclick="removeBatchEnhanceFile(${i})" style="padding:2px 8px;">✕</button>
        </div>
    `).join('');
}

function removeBatchEnhanceFile(index) {
    batchEnhanceFiles.splice(index, 1);
    if (batchEnhanceFiles.length === 0) {
        resetUpload();
    } else {
        renderBatchEnhanceList();
    }
}
window.removeBatchEnhanceFile = removeBatchEnhanceFile;

// ==================== 辅助函数 ====================
function hideAllUploadContent() {
    document.getElementById('singleContent').style.display = 'none';
    document.getElementById('batchContent').style.display = 'none';
    document.getElementById('enhanceContent').style.display = 'none';
    document.getElementById('batchEnhanceContent').style.display = 'none';
}

// ==================== 重置上传 ====================
function resetUpload() {
    selectedFile = null;
    batchFiles = [];
    batchResults = [];
    enhanceFile = null;
    enhancedImageData = null;
    batchEnhanceFiles = [];
    batchEnhanceResults = [];
    
    document.getElementById('fileInput').value = '';
    document.getElementById('batchFileInput').value = '';
    document.getElementById('enhanceFileInput').value = '';
    document.getElementById('batchEnhanceFileInput').value = '';
    
    document.getElementById('singleContent').style.display = currentMode === 'single' ? '' : 'none';
    document.getElementById('batchContent').style.display = currentMode === 'batch' ? '' : 'none';
    document.getElementById('enhanceContent').style.display = currentMode === 'enhance' ? '' : 'none';
    document.getElementById('batchEnhanceContent').style.display = currentMode === 'batchEnhance' ? '' : 'none';
    
    document.getElementById('uploadPreview').classList.remove('active');
    document.getElementById('batchFileList').classList.remove('active');
    document.getElementById('batchActions').classList.remove('active');
    document.getElementById('resultSection').hidden = true;
    document.getElementById('batchResultSection').hidden = true;
    document.getElementById('enhanceResultSection').hidden = true;
    document.getElementById('batchEnhanceResultSection').hidden = true;
    
    const btn = document.getElementById('convertBtn');
    btn.querySelector('.btn-text').textContent = '开始转换';
    btn.onclick = startConvert;
    
    const batchBtn = document.getElementById('batchActionBtn');
    batchBtn.querySelector('.btn-text').textContent = '开始批量转换';
    batchBtn.onclick = startBatchConvert;
    
    hideProgress();
    zoomState = { original: 1, svg: 1 };
    enhanceZoomState = { original: 1, result: 1 };
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
    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 95) progress += Math.random() * 2 + 0.5;
        else progress += 0.2;
        if (progress > 99) progress = 99;
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
    // 携带前端自定义参数
    formData.append('params', JSON.stringify(getCurrentParams()));
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
    // 批量携带矢量参数
    formData.append('params', JSON.stringify(getCurrentParams()));

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
        if (progress < 95) {
            progress += Math.random() * 1.5 + 0.5;
        } else {
            progress += 0.15;
        }
        if (progress > 99) progress = 99;
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

// ==================== 图像增强（合并版：调用高级增强 API）====================
async function startEnhance() {
    if (!requireAuth()) return;
    if (!enhanceFile) return showToast('请选择一张图片', 'error');
    if (isConverting) return;

    const btn = document.getElementById('convertBtn');
    setLoading(btn, true);
    isConverting = true;

    const steps = ['📤', '🔍', '🧠', '✨', '🎨', '✅'];
    const stepLabels = ['上传', '分析', 'AI处理', '去噪', '量化', '完成'];
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
        if (progress < 95) {
            progress += Math.random() * 2 + 0.5;
        } else {
            progress += 0.2;
        }
        if (progress > 99) progress = 99;
        const stepIdx = Math.min(Math.floor(progress / (100/6)), steps.length - 1);
        const statusHtml = `
            <span class="status-dot processing"></span>
            正在 <span class="highlight">${stepLabels[stepIdx]}</span>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px;">${steps[stepIdx]}</span>
        `;
        showProgress(statusHtml, progress, stepIdx);
    }, 400);

    const formData = new FormData();
    formData.append('image', enhanceFile);

    try {
        // 使用高级增强 API（合并后统一用高级版）
        const res = await fetch('/api/enhance/advanced', { method: 'POST', body: formData });
        const data = await res.json();
        clearInterval(progressInterval);
        if (res.ok) {
            enhancedImageData = data.enhanced_image;
            showProgress(`<span class="status-dot done"></span> 🎉 增强完成！`, 100, steps.length - 1);
            setTimeout(() => { 
                hideProgress(); 
                showEnhanceResult(data.enhanced_image); 
                showToast('图像增强成功！', 'success'); 
            }, 600);
        } else {
            showProgress(`<span class="status-dot error"></span> ❌ 增强失败：${escapeHtml(data.error || '未知错误')}`, 100, steps.length - 1);
            setTimeout(() => { hideProgress(); showToast(data.error || '增强失败', 'error'); }, 800);
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
window.startEnhance = startEnhance;

// ==================== 批量增强（合并版：调用高级增强 API）====================
async function startBatchEnhance() {
    if (!requireAuth()) return;
    if (batchEnhanceFiles.length === 0) return showToast('请选择图片', 'error');
    if (isConverting) return;
    isConverting = true;
    batchEnhanceResults = [];
    document.getElementById('batchEnhanceResultSection').hidden = true;

    document.querySelectorAll('.batch-file-item .file-status').forEach(el => {
        el.className = 'file-status processing';
        el.textContent = '增强中...';
    });

    const formData = new FormData();
    batchEnhanceFiles.forEach(f => formData.append('images', f));

    const steps = ['📤', '🔍', '🧠', '✨', '🎨', '✅'];
    const stepLabels = ['上传', '分析', 'AI处理', '去噪', '量化', '完成'];
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
        if (progress < 95) {
            progress += Math.random() * 1.5 + 0.5;
        } else {
            progress += 0.15;
        }
        if (progress > 99) progress = 99;
        const stepIdx = Math.min(Math.floor(progress / (100/6)), steps.length - 1);
        const statusHtml = `
            <span class="status-dot processing"></span>
            批量增强中 <span class="highlight">${Math.floor(progress / 100 * batchEnhanceFiles.length)}/${batchEnhanceFiles.length}</span>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px;">${steps[stepIdx]}</span>
        `;
        showProgress(statusHtml, progress, stepIdx);
    }, 500);

    try {
        // 使用高级批量增强 API
        const res = await fetch('/api/enhance/advanced/batch', { method: 'POST', body: formData });
        const data = await res.json();
        clearInterval(progressInterval);
        if (res.ok) {
            batchEnhanceResults = data.results || [];
            const items = document.querySelectorAll('.batch-file-item');
            batchEnhanceResults.forEach((r, i) => {
                if (items[i]) {
                    const status = items[i].querySelector('.file-status');
                    if (r.success) { status.className = 'file-status done'; status.textContent = '✅ 完成'; }
                    else { status.className = 'file-status error'; status.textContent = '❌ ' + (r.error || '失败'); }
                }
            });
            showProgress(`<span class="status-dot done"></span> 🎉 批量增强完成！成功 ${data.success_count}/${data.total}`, 100, steps.length - 1);
            setTimeout(() => { hideProgress(); showBatchEnhanceResults(data); showToast(`增强完成: ${data.success_count}/${data.total} 成功`, 'success'); }, 600);
        } else {
            showProgress(`<span class="status-dot error"></span> ❌ 批量增强失败`, 100, steps.length - 1);
            setTimeout(() => { hideProgress(); showToast(data.error || '批量增强失败', 'error'); }, 800);
        }
    } catch (e) {
        clearInterval(progressInterval);
        hideProgress();
        showToast('网络错误', 'error');
    } finally {
        isConverting = false;
    }
}
window.startBatchEnhance = startBatchEnhance;

// ==================== 显示结果 ====================
function showResult(svg) {
    // 1. 清理 XML 声明和注释（必须清理干净）
    let cleanSvg = svg
        .replace(/<\?xml.*?\?>\s*/, '')
        .replace(/<!--.*?-->\s*/, '');

    console.log('cleanSvg 开头:', cleanSvg.substring(0, 100));

    // 2. 获取容器（只声明一次！）
    const container = document.getElementById('svgDisplay');
    
    // 3. 插入清理后的 SVG（关键：必须用 cleanSvg）
    container.innerHTML = cleanSvg;


    // 5. 显示原图
    const img = document.getElementById('resultOriginal');
    img.src = document.getElementById('previewImg').src;
    zoomState = { original: 1, svg: 1 };
    img.style.transform = 'scale(1)';
    document.getElementById('zoomOriginal').textContent = '100%';

    // 6. 重置 SVG 缩放
    container.style.transform = 'scale(1)';
    document.getElementById('zoomSvg').textContent = '100%';

    // 7. 显示结果区
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

function showEnhanceResult(enhancedBase64) {
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('enhanceOriginal').src = e.target.result;
    };
    reader.readAsDataURL(enhanceFile);
    
    document.getElementById('enhanceResult').src = enhancedBase64;
    enhanceZoomState = { original: 1, result: 1 };
    document.getElementById('enhanceOriginal').style.transform = 'scale(1)';
    document.getElementById('enhanceResult').style.transform = 'scale(1)';
    document.getElementById('zoomEnhanceOriginal').textContent = '100%';
    document.getElementById('zoomEnhanceResult').textContent = '100%';
    document.getElementById('enhanceResultSection').hidden = false;
    document.getElementById('enhanceResultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showBatchEnhanceResults(data) {
    const section = document.getElementById('batchEnhanceResultSection');
    section.hidden = false;
    document.getElementById('batchEnhanceTotal').textContent = data.total;
    document.getElementById('batchEnhanceSuccess').textContent = data.success_count;
    document.getElementById('batchEnhanceFailed').textContent = data.total - data.success_count;
    const container = document.getElementById('batchEnhanceResultItems');
    container.innerHTML = data.results.map((r, i) => `
        <div class="batch-result-item">
            <div class="item-name" title="${escapeHtml(r.filename)}">${escapeHtml(r.filename)}</div>
            ${r.success ? `
                <div style="font-size:0.7rem;color:var(--success);margin-bottom:6px;">✅ 成功</div>
                <div class="item-actions">
                    <button class="btn btn-ghost btn-sm" onclick="downloadSingleEnhanced(${i})">下载</button>
                    <button class="btn btn-primary btn-sm" onclick="convertSingleEnhancedToSvg(${i})">转SVG</button>
                </div>
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

// ==================== 增强相关下载 ====================
function downloadEnhancedImage() {
    if (!enhancedImageData) return showToast('没有可下载的图像', 'error');
    const a = document.createElement('a');
    a.href = enhancedImageData;
    a.download = currentFilename.replace(/\.[^/.]+$/, '') + '_enhanced.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('下载已开始', 'success');
}
window.downloadEnhancedImage = downloadEnhancedImage;

async function convertEnhancedToSvg() {
    if (!enhancedImageData) return showToast('没有可转换的图像', 'error');
    const response = await fetch(enhancedImageData);
    const blob = await response.blob();
    const file = new File([blob], currentFilename, { type: 'image/png' });
    switchMode('single');
    handleFile(file);
    setTimeout(() => startConvert(), 300);
}
window.convertEnhancedToSvg = convertEnhancedToSvg;

function downloadSingleEnhanced(index) {
    const result = batchEnhanceResults[index];
    if (!result || !result.success) return;
    const a = document.createElement('a');
    a.href = result.enhanced_image;
    a.download = result.filename.replace(/\.[^/.]+$/, '') + '_enhanced.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('下载已开始', 'success');
}
window.downloadSingleEnhanced = downloadSingleEnhanced;

async function convertSingleEnhancedToSvg(index) {
    const result = batchEnhanceResults[index];
    if (!result || !result.success) return;
    const response = await fetch(result.enhanced_image);
    const blob = await response.blob();
    const file = new File([blob], result.filename, { type: 'image/png' });
    switchMode('single');
    handleFile(file);
    setTimeout(() => startConvert(), 300);
}
window.convertSingleEnhancedToSvg = convertSingleEnhancedToSvg;

async function downloadBatchEnhancedZip() {
    const successResults = batchEnhanceResults.filter(r => r.success);
    if (successResults.length === 0) return showToast('没有可下载的图像', 'error');
    const images = successResults.map(r => ({ 
        filename: r.filename.replace(/\.[^/.]+$/, '') + '_enhanced.png', 
        image: r.enhanced_image 
    }));
    try {
        const res = await fetch('/api/enhance/advanced/batch/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images })
        });
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'enhanced_images.zip';
            a.click();
            URL.revokeObjectURL(url);
            showToast('下载已开始', 'success');
        } else showToast('下载失败', 'error');
    } catch (e) { showToast('下载失败', 'error'); }
}
window.downloadBatchEnhancedZip = downloadBatchEnhancedZip;

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

function zoomEnhanceImage(type, delta) {
    const img = type === 'original' 
        ? document.getElementById('enhanceOriginal') 
        : document.getElementById('enhanceResult');
    if (!img) return;
    let newScale = (type === 'original' ? enhanceZoomState.original : enhanceZoomState.result) + delta;
    newScale = Math.max(0.2, Math.min(3, newScale));
    img.style.transform = `scale(${newScale})`;
    if (type === 'original') {
        enhanceZoomState.original = newScale;
        document.getElementById('zoomEnhanceOriginal').textContent = Math.round(newScale * 100) + '%';
    } else {
        enhanceZoomState.result = newScale;
        document.getElementById('zoomEnhanceResult').textContent = Math.round(newScale * 100) + '%';
    }
}
window.zoomEnhanceImage = zoomEnhanceImage;

function resetEnhanceZoom(type) {
    const target = 1;
    const current = type === 'original' ? enhanceZoomState.original : enhanceZoomState.result;
    zoomEnhanceImage(type, target - current);
}
window.resetEnhanceZoom = resetEnhanceZoom;

let paramOpen = false;
document.getElementById('toggleParam').addEventListener('click', () => {
    paramOpen = !paramOpen;
    document.querySelector('.param-grid').classList.toggle('open', paramOpen);
});

// 场景预设按钮逻辑
const presetBtns = document.querySelectorAll('.preset-btn');
presetBtns.forEach(btn => {
    btn.onclick = () => {
        presetBtns.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;
        const cfg = {
            logo: {speckle:10, colorPrec:4, layerDiff:4, pathTol:3.0, grad:false},
            lineart: {speckle:3, colorPrec:9, layerDiff:3, pathTol:1.5, grad:false},
            illustration: {speckle:6, colorPrec:7, layerDiff:10, pathTol:3.0, grad:true},
            photo: {speckle:8, colorPrec:10, layerDiff:14, pathTol:2.0, grad:true}
        }[preset];
        document.getElementById('speckle').value = cfg.speckle;
        document.getElementById('colorPrec').value = cfg.colorPrec;
        document.getElementById('layerDiff').value = cfg.layerDiff;
        document.getElementById('pathTol').value = cfg.pathTol;
        document.getElementById('enableGradient').checked = cfg.grad;
        // 同步更新显示文字
        document.getElementById('speckleVal').text = cfg.speckle;
        document.getElementById('colorPrecVal').text = cfg.colorPrec;
        document.getElementById('layerDiffVal').text = cfg.layerDiff;
        document.getElementById('pathTolVal').text = cfg.pathTol;
    }
})

// 滑块实时显示数值
const sliders = [
    {id:"enhanceScale", show:"scaleVal"},
    {id:"speckle", show:"speckleVal"},
    {id:"colorPrec", show:"colorPrecVal"},
    {id:"pathTol", show:"pathTolVal"},
];
sliders.forEach(s=>{
    const el = document.getElementById(s.id);
    const show = document.getElementById(s.show);
    el.addEventListener('input', ()=>show.textContent = el.value);
})

function getCurrentParams(){
    return {
        enhance_scale: parseFloat(document.getElementById('enhanceScale').value),
        speckle: parseInt(document.getElementById('speckle').value),
        color_prec: parseInt(document.getElementById('colorPrec').value),
        layer_diff: parseInt(document.getElementById('layerDiff').value),
        path_tol: parseFloat(document.getElementById('pathTol').value),
        enable_segment: document.getElementById('enableSegment').checked,
        enable_gradient: document.getElementById('enableGradient').checked
    }
}