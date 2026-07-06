// ==================== 格式转换页（index） ====================
// 依赖 core.js, auth.js



let selectedFile = null;
let batchFiles = [];
let batchResults = [];
let currentMode = 'single';
let currentXhr = null;
let isTaskRunning = false;
let enhanceSelectedFile = null;
let enhanceBatchFiles = [];
let enhanceBatchResults = [];
let currentEnhancedImage = '';
let currentEnhancedFilename = '';

const stepLabels = ['上传文件', '图像分析', '矢量化处理', '结果优化', '处理完成'];
const stepWeight = [0.15, 0.2, 0.45, 0.15, 0.05];

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('beforeunload', cancelCurrentTask);
    setupDragDrop();
});

// ==================== 模式切换 ====================
function switchMode(mode) {
    // 取消正在进行的任务
    cancelCurrentTask();

    // 更新当前模式
    currentMode = mode;

    // 清空文件输入框，防止残留
    document.getElementById('fileInput').value = '';
    document.getElementById('batchFileInput').value = '';

    // 重置所有文件变量
    selectedFile = null;
    batchFiles = [];
    enhanceSelectedFile = null;
    enhanceBatchFiles = [];

    // 切换标签页 active 样式
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // 显示/隐藏对应的上传提示内容
    document.getElementById('singleContent').style.display = mode === 'single' ? '' : 'none';
    document.getElementById('batchContent').style.display = mode === 'batch' ? '' : 'none';
    document.getElementById('enhanceSingleContent').style.display = mode === 'enhance_single' ? '' : 'none';
    document.getElementById('enhanceBatchContent').style.display = mode === 'enhance_batch' ? '' : 'none';

    // 增强算法选择框：仅在增强模式下显示
    const globalAlgoBox = document.getElementById('globalEnhanceAlgo');
    if (globalAlgoBox) {
        globalAlgoBox.style.display = (mode === 'enhance_single' || mode === 'enhance_batch') ? 'grid' : 'none';
    }

    // ---- 单图转换预览 ----
    const uploadPreview = document.getElementById('uploadPreview');
    if (uploadPreview) uploadPreview.classList.remove('active');

    // ---- 批量转换列表 ----
    const batchFileList = document.getElementById('batchFileList');
    if (batchFileList) {
        batchFileList.classList.toggle('active', mode === 'batch' && batchFiles.length > 0);
    }
    const batchActions = document.getElementById('batchActions');
    if (batchActions) {
        batchActions.classList.toggle('active', mode === 'batch' && batchFiles.length > 0);
    }

    // ---- 单图增强预览 ----
    const enhanceUploadPreview = document.getElementById('enhanceUploadPreview');
    if (enhanceUploadPreview) enhanceUploadPreview.classList.remove('active');

    // ---- 批量增强列表 ----
    const enhanceBatchFileList = document.getElementById('enhanceBatchFileList');
    if (enhanceBatchFileList) {
        enhanceBatchFileList.classList.toggle('active', mode === 'enhance_batch' && enhanceBatchFiles.length > 0);
    }
    const enhanceBatchActions = document.getElementById('enhanceBatchActions');
    if (enhanceBatchActions) {
        enhanceBatchActions.classList.toggle('active', mode === 'enhance_batch' && enhanceBatchFiles.length > 0);
    }

    // ---- 隐藏所有结果区（安全调用） ----
    const resultSections = ['resultSection', 'batchResultSection', 'enhanceResultSection', 'enhanceBatchResultSection'];
    resultSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
    });

    // 隐藏进度弹窗（如果有）
    hideProgressModal();
}
window.switchMode = switchMode;

// ==================== 拖拽上传 ====================
function setupDragDrop() {
    const zone = document.getElementById('uploadZone');
    const singleInput = document.getElementById('fileInput');
    const batchInput = document.getElementById('batchFileInput');

    zone.addEventListener('click', (e) => {
        if (e.target.closest('button, button *, input, label, .enhance-mode-select, .enhance-mode-select *')) return;
        if (currentMode === 'single' || currentMode === 'enhance_single') {
            singleInput.click();
        } else {
            batchInput.click();
        }
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

// 单图文件输入
    singleInput.addEventListener('change', function(e) {
        console.log('[文件选择] singleInput change 触发, files:', e.target.files.length);
        if (!e.target.files.length) {
            // 没有选择文件，重置以便下次
            this.value = '';
            return;
        }
        const file = e.target.files[0];
        // 立即重置，确保下次选择同一文件也能触发
        this.value = '';
        
        if (currentMode === 'enhance_single') {
            handleEnhanceSingleFile(file);
        } else {
            handleFile(file);
        }
    });

    // 批量文件输入
    batchInput.addEventListener('change', function(e) {
        console.log('[文件选择] batchInput change 触发, files:', e.target.files.length);
        if (!e.target.files.length) {
            this.value = '';
            return;
        }
        const files = Array.from(e.target.files);
        // 立即重置，确保下次选择同一文件也能触发
        this.value = '';
        
        if (currentMode === 'enhance_batch') {
            handleEnhanceBatchFiles(files);
        } else {
            handleBatchFiles(files);
        }
    });
}

// ==================== 单图转换 - 文件处理 ====================
function handleFile(file) {
    console.log('[handleFile] 收到文件:', file.name, file.size);
    showToast(`已选择: ${file.name}`, 'info');
    cancelCurrentTask();
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

// ==================== 批量转换 - 文件处理 ====================
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
    cancelCurrentTask();
    selectedFile = null;
    batchFiles = [];
    batchResults = [];
    currentSvg = '';
    currentFilename = '';

    const fileInput = document.getElementById('fileInput');
    const batchInput = document.getElementById('batchFileInput');
    if (fileInput) fileInput.value = '';
    if (batchInput) batchInput.value = '';
    
    // 安全隐藏所有结果区
    ['resultSection', 'batchResultSection'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
    });
    
    const singleContent = document.getElementById('singleContent');
    const batchContent = document.getElementById('batchContent');
    if (singleContent) singleContent.style.display = currentMode === 'single' ? '' : 'none';
    if (batchContent) batchContent.style.display = currentMode === 'batch' ? '' : 'none';
    
    const preview = document.getElementById('uploadPreview');
    if (preview) preview.classList.remove('active');
    
    const list = document.getElementById('batchFileList');
    if (list) list.classList.remove('active');
    
    const actions = document.getElementById('batchActions');
    if (actions) actions.classList.remove('active');
    
    hideProgressModal();
}
window.resetUpload = resetUpload;

function resetEnhanceUpload() {
    cancelCurrentTask();
    enhanceSelectedFile = null;
    enhanceBatchFiles = [];
    enhanceBatchResults = [];
    currentEnhancedImage = '';
    
    const fileInput = document.getElementById('fileInput');
    const batchInput = document.getElementById('batchFileInput');
    if (fileInput) fileInput.value = '';
    if (batchInput) batchInput.value = '';
    
    // 安全隐藏所有可能的结果区
    ['enhanceResultSection', 'enhanceBatchResultSection'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
    });
    
    const singleContent = document.getElementById('enhanceSingleContent');
    const batchContent = document.getElementById('enhanceBatchContent');
    if (singleContent) singleContent.style.display = currentMode === 'enhance_single' ? '' : 'none';
    if (batchContent) batchContent.style.display = currentMode === 'enhance_batch' ? '' : 'none';
    
    const preview = document.getElementById('enhanceUploadPreview');
    if (preview) preview.classList.remove('active');
    
    const list = document.getElementById('enhanceBatchFileList');
    if (list) list.classList.remove('active');
    
    const actions = document.getElementById('enhanceBatchActions');
    if (actions) actions.classList.remove('active');
    
    hideProgressModal();
}
window.resetEnhanceUpload = resetEnhanceUpload;
// ==================== 进度指示器 ====================
function showProgressModal() {
    document.getElementById('progressModal').classList.add('active');
    document.querySelectorAll('.progress-step-item').forEach(el => {
        el.classList.remove('active', 'done');
        el.querySelector('.step-status').textContent = '等待中';
    });
    updateGlobalProgress(0, '准备中...');
}

function hideProgressModal() {
    document.getElementById('progressModal').classList.remove('active');
    currentXhr = null;
    isTaskRunning = false;
}

function setStepActive(stepIndex) {
    const items = document.querySelectorAll('.progress-step-item');
    items.forEach((el, idx) => {
        el.classList.remove('active');
        if (idx < stepIndex) {
            el.classList.add('done');
            el.querySelector('.step-status').textContent = '已完成';
        } else if (idx === stepIndex) {
            el.classList.add('active');
            el.querySelector('.step-status').textContent = '进行中';
        }
    });
}

function updateGlobalProgress(percent, statusText) {
    percent = Math.min(100, Math.max(0, percent));
    document.getElementById('globalProgressFill').style.width = percent + '%';
    document.getElementById('progressPercentText').textContent = Math.round(percent) + '%';
    if (statusText) {
        document.getElementById('progressStatusText').innerHTML = statusText;
    }
}

function calcStepProgress(stepIndex, stepPercent) {
    let base = 0;
    for (let i = 0; i < stepIndex; i++) {
        base += stepWeight[i];
    }
    return (base + stepWeight[stepIndex] * stepPercent) * 100;
}

// ==================== 单图转换 - 执行 ====================
async function startConvert(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!requireAuth()) return;
    if (!selectedFile) {
        showToast('请选择一张图片', 'error');
        return;
    }
    if (isTaskRunning) {
        showToast('正在处理中，请稍候', 'info');
        return;
    }

    const btn = document.getElementById('convertBtn');
    const progressModal = document.getElementById('progressModal');
    if (!btn || !progressModal) {
        showToast('页面元素异常，请刷新后重试', 'error');
        return;
    }

    cancelCurrentTask();
    isTaskRunning = true;
    const batchBtn = document.getElementById('batchConvertBtn');
    setLoading(batchBtn, true);
    setLoading(btn, true);

    try {
        showProgressModal();
        setStepActive(0);
    } catch (err) {
        console.error('打开进度弹窗失败:', err);
        isTaskRunning = false;
        setLoading(btn, false);
        showToast('初始化失败，请刷新重试', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);

    const xhr = new XMLHttpRequest();
    currentXhr = xhr;

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = e.loaded / e.total;
            const totalPercent = calcStepProgress(0, percent);
            updateGlobalProgress(totalPercent, `正在 <span class="highlight">上传文件</span>`);
        }
    });

    xhr.upload.addEventListener('load', () => {
        if (isTaskRunning) simulateProcessProgress();
    });

    xhr.addEventListener('load', () => {
        try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
                setStepActive(4);
                updateGlobalProgress(100, `<span class="status-dot done"></span> 🎉 转换完成！`);
                
                currentSvg = data.svg;
                currentFilename = data.filename || selectedFile.name;
                
                setTimeout(() => {
                    hideProgressModal();
                    showResult(data.svg);
                    showToast('转换成功！', 'success');
                }, 600);
            } else {
                updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 转换失败`);
                setTimeout(() => {
                    hideProgressModal();
                    showToast(data.error || '转换失败', 'error');
                }, 800);
            }
        } catch (e) {
            updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 响应解析失败`);
            setTimeout(() => {
                hideProgressModal();
                showToast('网络错误', 'error');
            }, 800);
        } finally {
            setLoading(btn, false);
            isTaskRunning = false;
            currentXhr = null;
        }
    });

    xhr.addEventListener('error', () => {
        updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 网络错误`);
        setTimeout(() => {
            hideProgressModal();
            showToast('网络错误', 'error');
        }, 800);
        setLoading(btn, false);
        isTaskRunning = false;
        currentXhr = null;
    });

    xhr.addEventListener('abort', () => {
        updateGlobalProgress(0, `<span class="status-dot error"></span> 已取消处理`);
        setTimeout(() => {
            hideProgressModal();
            showToast('已取消处理', 'info');
        }, 400);
        setLoading(btn, false);
        isTaskRunning = false;
        currentXhr = null;
    });

    xhr.open('POST', '/api/convert');
    xhr.send(formData);
}
window.startConvert = startConvert;

function simulateProcessProgress() {
    setStepActive(1);
    let p = 0;
    const timer1 = setInterval(() => {
        if (!isTaskRunning) return clearInterval(timer1);
        p += 0.05;
        if (p >= 1) { 
            clearInterval(timer1); 
            setStepActive(2);
            let p2 = 0;
            const timer2 = setInterval(() => {
                if (!isTaskRunning) return clearInterval(timer2);
                p2 += 0.02;
                if (p2 >= 1) { 
                    clearInterval(timer2);
                    setStepActive(3);
                    let p3 = 0;
                    const timer3 = setInterval(() => {
                        if (!isTaskRunning) return clearInterval(timer3);
                        p3 += 0.08;
                        if (p3 >= 1) { clearInterval(timer3); return; }
                        updateGlobalProgress(calcStepProgress(3, p3), `正在 <span class="highlight">结果优化</span>`);
                    }, 150);
                    return; 
                }
                updateGlobalProgress(calcStepProgress(2, p2), `正在 <span class="highlight">矢量化处理</span>`);
            }, 120);
            return; 
        }
        updateGlobalProgress(calcStepProgress(1, p), `正在 <span class="highlight">图像分析</span>`);
    }, 150);
}

function cancelCurrentTask() {
    // 异步取消，不等待响应
    fetch('/api/cancel', { method: 'POST' }).catch(() => {});
    if (currentXhr && isTaskRunning) {
        currentXhr.abort();
        currentXhr = null;
        isTaskRunning = false;
    }
}
window.cancelCurrentTask = cancelCurrentTask;

// ==================== 批量转换 - 执行 ====================
function startBatchConvert(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!requireAuth()) return;
    if (batchFiles.length === 0) return showToast('请选择图片', 'error');
    if (isTaskRunning) return;

    const progressModal = document.getElementById('progressModal');
    if (!progressModal) {
        showToast('页面元素异常，请刷新重试', 'error');
        return;
    }

    cancelCurrentTask();
    isTaskRunning = true;
    showProgressModal();
    setStepActive(0);

    const formData = new FormData();
    batchFiles.forEach(f => formData.append('images', f));

    const xhr = new XMLHttpRequest();
    currentXhr = xhr;

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = e.loaded / e.total;
            const totalPercent = calcStepProgress(0, percent);
            updateGlobalProgress(totalPercent, `正在 <span class="highlight">批量上传文件</span>`);
        }
    });

    xhr.addEventListener('load', () => {
        try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
                setStepActive(4);
                updateGlobalProgress(100, `<span class="status-dot done"></span> 🎉 批量转换完成！成功 ${data.success_count}/${data.total}`);
                
                batchResults = data.results || [];
                const items = document.querySelectorAll('#batchFileList .batch-file-item');
                data.results.forEach((resItem, idx) => {
                    if(items[idx]){
                        const statusDom = items[idx].querySelector('.file-status');
                        if(resItem.success){
                            statusDom.className = 'file-status done';
                            statusDom.textContent = '✅ 完成';
                        }else{
                            statusDom.className = 'file-status error';
                            statusDom.textContent = '❌ 失败';
                        }
                    }
                });

                setTimeout(() => {
                    hideProgressModal();
                    showBatchResults(data);
                    showToast(`转换完成: ${data.success_count}/${data.total} 成功`, 'success');
                }, 600);
            } else {
                updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 批量转换失败`);
                setTimeout(() => {
                    hideProgressModal();
                    showToast(data.error || '批量转换失败', 'error');
                }, 800);
            }
        } catch (e) {
            updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 响应解析失败`);
            setTimeout(() => {
                hideProgressModal();
                showToast('网络错误', 'error');
            }, 800);
        } finally {
            isTaskRunning = false;
            currentXhr = null;
        }
    });

    xhr.addEventListener('error', () => {
        updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 网络错误`);
        setTimeout(() => {
            hideProgressModal();
            showToast('网络错误', 'error');
        }, 800);
        isTaskRunning = false;
        currentXhr = null;
    });

    xhr.addEventListener('abort', () => {
        updateGlobalProgress(0, `<span class="status-dot error"></span> 已取消处理`);
        setTimeout(() => {
            hideProgressModal();
            showToast('已取消处理', 'info');
        }, 400);
        isTaskRunning = false;
        currentXhr = null;
    });

    xhr.open('POST', '/api/convert/batch');
    xhr.send(formData);
    simulateBatchProcessProgress(batchFiles.length);
}
window.startBatchConvert = startBatchConvert;

function simulateBatchProcessProgress(total) {
    setStepActive(1);
    let p = 0;
    const timer1 = setInterval(() => {
        if (!isTaskRunning) return clearInterval(timer1);
        p += 0.05;
        if (p >= 1) {
            clearInterval(timer1);
            setStepActive(2);
            let p2 = 0;
            const timer2 = setInterval(() => {
                if (!isTaskRunning) return clearInterval(timer2);
                p2 += 0.02;
                if (p2 >= 1) {
                    clearInterval(timer2);
                    setStepActive(3);
                    let p3 = 0;
                    const timer3 = setInterval(() => {
                        if (!isTaskRunning) return clearInterval(timer3);
                        p3 += 0.08;
                        if (p3 >= 1) clearInterval(timer3);
                        updateGlobalProgress(calcStepProgress(3, p3), `正在 <span class="highlight">批量优化结果</span>`);
                    }, 150);
                    return;
                }
                const curr = Math.floor(p2 * total);
                updateGlobalProgress(calcStepProgress(2, p2), `正在 <span class="highlight">批量矢量化</span> ${curr}/${total}`);
            }, 120);
            return;
        }
        updateGlobalProgress(calcStepProgress(1, p), `正在 <span class="highlight">批量图像分析</span>`);
    }, 150);
}

// ==================== 结果展示 ====================
function showResult(svg) {
    const img = document.getElementById('resultOriginal');
    const container = document.getElementById('svgDisplay');
    const resultSection = document.getElementById('resultSection');
    const previewDom = document.getElementById('previewImg');
    const origWrapper = document.getElementById('originalWrapper');
    const svgWrapper = document.getElementById('svgWrapper');

    if (!img || !container || !previewDom || !resultSection || !origWrapper || !svgWrapper) {
        showToast('页面元素异常，请刷新重试', 'error');
        return;
    }

    // 1. 设置原图
    img.src = previewDom.src;

    // 2. 确保 SVG 有 xmlns
    if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    }

    // 3. 将 SVG 文本转换为 Blob URL，赋给一个 <img> 标签
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    // 4. 清空容器，放入一个新的 <img> 元素
    container.innerHTML = '';  // 清除旧的 SVG 节点
    const svgImg = document.createElement('img');
    svgImg.src = url;
    svgImg.alt = 'SVG';
    svgImg.id = 'svgImg';  // 可选，便于调试
    container.appendChild(svgImg);

    // 5. 统一设置两个图片的样式（绝对定位 + object-fit 填满容器）
    const styleBoth = (el) => {
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'contain';     // 保持比例，居中缩放
        el.style.display = 'block';
    };
    styleBoth(img);
    styleBoth(svgImg);

    // 6. 设置容器样式
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '400px';   // 与 wrapper 高度一致
    container.style.overflow = 'hidden';

    // 7. wrapper 保持 flex 居中（虽已用绝对定位，但无妨）
    [origWrapper, svgWrapper].forEach(w => {
        w.style.display = 'flex';
        w.style.alignItems = 'center';
        w.style.justifyContent = 'center';
        w.style.position = 'relative';
    });

    // 8. 清理 transform 残留
    [img, container].forEach(el => {
        el.style.transform = '';
        el.style.transition = '';
        el.style.transformOrigin = 'center center';
    });

    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 9. 等待图片加载完成后初始化缩放（确保尺寸准确）
    const initWhenReady = () => {
        if (img.complete && svgImg.complete) {
            initAllZoomDrag();
        } else {
            // 如果图片还没加载完，监听 load 事件
            let loaded = 0;
            const onLoad = () => {
                loaded++;
                if (loaded === 2) initAllZoomDrag();
            };
            if (!img.complete) img.addEventListener('load', onLoad, { once: true });
            else loaded++;
            if (!svgImg.complete) svgImg.addEventListener('load', onLoad, { once: true });
            else loaded++;
            if (loaded === 2) initAllZoomDrag();
        }
    };
    setTimeout(initWhenReady, 100);  // 稍微延迟，确保 DOM 已挂载
}
window.showResult = showResult;

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

// ==================== 下载相关 ====================
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
    
    const svgs = successResults.map(r => ({ 
        filename: r.filename.replace(/\.[^/.]+$/, '') + '.svg', 
        svg: r.svg 
    }));
    try {
        const res = await fetch('/api/convert/batch/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ svgs })
        });
        if (!res.ok) throw new Error('请求异常');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'svg_converts.zip';
        a.click();
        URL.revokeObjectURL(url);
        showToast('ZIP 打包下载已开始', 'success');
    } catch (err) {
        showToast('打包下载失败，请重试', 'error');
    }
}
window.downloadBatchZip = downloadBatchZip;

// ==================== 单图增强 ====================
function handleEnhanceSingleFile(file) {
    cancelCurrentTask();
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
        document.getElementById('enhanceUploadPreview').classList.add('active');
        document.getElementById('enhanceBatchFileList').classList.remove('active');
        document.getElementById('enhanceBatchActions').classList.remove('active');
    };
    reader.readAsDataURL(file);
}

function startEnhanceSingle(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!requireAuth()) return;
    if (!enhanceSelectedFile) return showToast('请选择一张图片', 'error');
    if (isTaskRunning) return showToast('正在处理中，请稍候', 'info');

    const btn = document.getElementById('enhanceBtn');
    const progressModal = document.getElementById('progressModal');
    if (!btn || !progressModal) {
        showToast('页面元素异常，请刷新重试', 'error');
        return;
    }

    cancelCurrentTask();
    isTaskRunning = true;
    setLoading(btn, true);
    showProgressModal();
    setStepActive(0);

    const algo = document.querySelector('input[name="globalEnhanceAlgo"]:checked')?.value || 'self';
    const formData = new FormData();
    formData.append('image', enhanceSelectedFile);
    formData.append('mode', algo);

    const xhr = new XMLHttpRequest();
    currentXhr = xhr;

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = e.loaded / e.total;
            const totalPercent = calcStepProgress(0, percent);
            updateGlobalProgress(totalPercent, `正在 <span class="highlight">上传文件</span>`);
        }
    });

    xhr.upload.addEventListener('load', () => {
        if (!isTaskRunning) return;
        setStepActive(2);
        let progress = 0;
        const timer = setInterval(() => {
            if (!isTaskRunning) return clearInterval(timer);
            progress += Math.random() * 2 + 0.5;
            if (progress > 95) progress = 95;
            const statusText = algo === 'realesrgan' ? 'Real-ESRGAN超分' : '画质增强';
            updateGlobalProgress(calcStepProgress(2, progress / 100), `正在 <span class="highlight">${statusText}</span>`);
        }, 200);
        xhr._progressTimer = timer;
    });

    xhr.addEventListener('load', () => {
        clearInterval(xhr._progressTimer);
        try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data.enhanced_image) {
                setStepActive(4);
                updateGlobalProgress(100, `<span class="status-dot done"></span> 🎉 处理完成！`);
                
                currentEnhancedImage = data.enhanced_image;
                currentEnhancedFilename = data.filename;
                
                setTimeout(() => {
                    hideProgressModal();
                    showEnhanceResult();
                    showToast('增强完成！', 'success');
                }, 600);
            } else {
                setStepActive(4);
                updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 处理失败`);
                setTimeout(() => {
                    hideProgressModal();
                    showToast(data.error || '处理失败', 'error');
                }, 800);
            }
        } catch (e) {
            updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 响应解析失败`);
            setTimeout(() => {
                hideProgressModal();
                showToast('网络错误', 'error');
            }, 800);
        } finally {
            setLoading(btn, false);
            isTaskRunning = false;
            currentXhr = null;
        }
    });

    xhr.addEventListener('error', () => {
        clearInterval(xhr._progressTimer);
        updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 网络错误`);
        setTimeout(() => {
            hideProgressModal();
            showToast('网络错误', 'error');
        }, 800);
        setLoading(btn, false);
        isTaskRunning = false;
        currentXhr = null;
    });

    xhr.addEventListener('abort', () => {
        clearInterval(xhr._progressTimer);
        updateGlobalProgress(0, `<span class="status-dot error"></span> 已取消处理`);
        setTimeout(() => {
            hideProgressModal();
            showToast('已取消处理', 'info');
        }, 400);
        setLoading(btn, false);
        isTaskRunning = false;
        currentXhr = null;
    });

    xhr.open('POST', '/api/enhance');
    xhr.send(formData);
}
window.startEnhanceSingle = startEnhanceSingle;

function showEnhanceResult() {
    const originalImg = document.getElementById('enhanceOriginalImg');
    const resultImg = document.getElementById('enhanceResultImg');
    const section = document.getElementById('enhanceResultSection');

    if (!originalImg || !resultImg || !section) {
        showToast('页面元素异常，请刷新重试', 'error');
        return;
    }

    originalImg.src = document.getElementById('enhancePreviewImg').src;
    resultImg.src = currentEnhancedImage;
    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    setTimeout(initAllZoomDrag, 100);
}
window.showEnhanceResult = showEnhanceResult;

function downloadEnhancedImage() {
    if (!currentEnhancedImage) return;
    const a = document.createElement('a');
    a.href = currentEnhancedImage;
    const name = currentEnhancedFilename.replace(/\.[^/.]+$/, '') + '_enhanced.png';
    a.download = name;
    a.click();
    showToast('下载已开始', 'success');
}
window.downloadEnhancedImage = downloadEnhancedImage;

function convertEnhancedToSvg() {
    if (!requireAuth()) return;
    if (!enhanceSelectedFile) return showToast('请先选择图片', 'error');
    if (isTaskRunning) return showToast('正在处理中，请稍候', 'info');

    isTaskRunning = true;
    showProgressModal();
    setStepActive(0);

    const algo = document.querySelector('input[name="globalEnhanceAlgo"]:checked')?.value || 'self';
    const formData = new FormData();
    formData.append('image', enhanceSelectedFile);
    formData.append('mode', algo);

    const xhr = new XMLHttpRequest();
    currentXhr = xhr;

    xhr.upload.addEventListener('load', () => {
        if (!isTaskRunning) return;
        setStepActive(2);
        let progress = 0;
        const timer = setInterval(() => {
            if (!isTaskRunning) return clearInterval(timer);
            progress += Math.random() * 1.5 + 0.3;
            if (progress > 95) progress = 95;
            const actionText = algo === 'realesrgan' ? '超分并矢量化' : '增强并矢量化';
            updateGlobalProgress(calcStepProgress(2, progress / 100), `正在 <span class="highlight">${actionText}</span>`);
        }, 200);
        xhr._progressTimer = timer;
    });

    xhr.addEventListener('load', () => {
        clearInterval(xhr._progressTimer);
        try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data.svg) {
                setStepActive(4);
                updateGlobalProgress(100, `<span class="status-dot done"></span> 🎉 转换完成！`);
                
                currentSvg = data.svg;
                currentFilename = data.filename || enhanceSelectedFile.name;
                
                setTimeout(() => {
                    hideProgressModal();
                    showResult(data.svg);
                    showToast('处理+转换成功！', 'success');
                }, 600);
            } else {
                setStepActive(4);
                updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 转换失败`);
                setTimeout(() => {
                    hideProgressModal();
                    showToast(data.error || '转换失败', 'error');
                }, 800);
            }
        } catch (e) {
            updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 响应解析失败`);
            setTimeout(() => {
                hideProgressModal();
                showToast('网络错误', 'error');
            }, 800);
        } finally {
            isTaskRunning = false;
            currentXhr = null;
        }
    });

    xhr.addEventListener('error', () => {
        clearInterval(xhr._progressTimer);
        updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 网络错误`);
        setTimeout(() => {
            hideProgressModal();
            showToast('网络错误', 'error');
        }, 800);
        isTaskRunning = false;
        currentXhr = null;
    });

    xhr.open('POST', '/api/enhance/convert');
    xhr.send(formData);
}
window.convertEnhancedToSvg = convertEnhancedToSvg;

// ==================== 批量增强 ====================
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
    
    document.getElementById('enhanceBatchContent').style.display = 'none';
    document.getElementById('enhanceBatchFileList').classList.add('active');
    document.getElementById('enhanceBatchActions').classList.add('active');
    document.getElementById('enhanceSingleContent').style.display = 'none';
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
window.removeEnhanceBatchFile = removeEnhanceBatchFile;

function startEnhanceBatch(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!requireAuth()) return;
    if (enhanceBatchFiles.length === 0) return showToast('请选择图片', 'error');
    if (isTaskRunning) return showToast('正在处理中，请稍候', 'info');

    const progressModal = document.getElementById('progressModal');
    if (!progressModal) {
        showToast('页面元素异常，请刷新重试', 'error');
        return;
    }

    cancelCurrentTask();
    isTaskRunning = true;
    enhanceBatchResults = [];
    showProgressModal();
    setStepActive(0);

    document.querySelectorAll('#enhanceBatchFileList .file-status').forEach(el => {
        el.className = 'file-status processing';
        el.textContent = '处理中...';
    });

    const algo = document.querySelector('input[name="globalEnhanceAlgo"]:checked')?.value || 'self';
    const formData = new FormData();
    enhanceBatchFiles.forEach(f => formData.append('images', f));
    formData.append('mode', algo);

    const xhr = new XMLHttpRequest();
    currentXhr = xhr;

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = e.loaded / e.total;
            const totalPercent = calcStepProgress(0, percent);
            updateGlobalProgress(totalPercent, `正在 <span class="highlight">批量上传文件</span>`);
        }
    });

    xhr.upload.addEventListener('load', () => {
        if (!isTaskRunning) return;
        setStepActive(2);
        let progress = 0;
        const timer = setInterval(() => {
            if (!isTaskRunning) return clearInterval(timer);
            progress += Math.random() * 1.5 + 0.5;
            if (progress > 95) progress = 95;
            const actionText = algo === 'realesrgan' ? '超分' : '增强';
            updateGlobalProgress(calcStepProgress(2, progress / 100), `批量${actionText}中 <span class="highlight">${Math.floor(progress / 100 * enhanceBatchFiles.length)}/${enhanceBatchFiles.length}</span>`);
        }, 300);
        xhr._progressTimer = timer;
    });

    xhr.addEventListener('load', () => {
        clearInterval(xhr._progressTimer);
        try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data.results) {
                setStepActive(4);
                enhanceBatchResults = data.results || [];

                const items = document.querySelectorAll('#enhanceBatchFileList .batch-file-item');
                data.results.forEach((resItem, idx) => {
                    if(items[idx]){
                        const statusDom = items[idx].querySelector('.file-status');
                        if(resItem.success){
                            statusDom.className = 'file-status done';
                            statusDom.textContent = '✅ 完成';
                        }else{
                            statusDom.className = 'file-status error';
                            statusDom.textContent = '❌ 失败';
                        }
                    }
                });

                updateGlobalProgress(100, `<span class="status-dot done"></span> 🎉 批量处理完成！成功 ${data.success_count}/${data.total}`);
                setTimeout(() => {
                    hideProgressModal();
                    showEnhanceBatchResults(data);
                    showToast(`处理完成: ${data.success_count}/${data.total} 成功`, 'success');
                }, 600);
            } else {
                setStepActive(4);
                updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 批量处理失败`);
                setTimeout(() => {
                    hideProgressModal();
                    showToast(data.error || '批量处理失败', 'error');
                }, 800);
            }
        } catch (e) {
            updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 响应解析失败`);
            setTimeout(() => {
                hideProgressModal();
                showToast('网络错误', 'error');
            }, 800);
        } finally {
            isTaskRunning = false;
            currentXhr = null;
        }
    });

    xhr.addEventListener('error', () => {
        clearInterval(xhr._progressTimer);
        updateGlobalProgress(100, `<span class="status-dot error"></span> ❌ 网络错误`);
        setTimeout(() => {
            hideProgressModal();
            showToast('网络错误', 'error');
        }, 800);
        isTaskRunning = false;
        currentXhr = null;
    });

    xhr.addEventListener('abort', () => {
        clearInterval(xhr._progressTimer);
        updateGlobalProgress(0, `<span class="status-dot error"></span> 已取消处理`);
        setTimeout(() => {
            hideProgressModal();
            showToast('已取消处理', 'info');
        }, 400);
        isTaskRunning = false;
        currentXhr = null;
    });

    xhr.open('POST', '/api/enhance/batch');
    xhr.send(formData);
}
window.startEnhanceBatch = startEnhanceBatch;

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
window.downloadSingleEnhanceBatch = downloadSingleEnhanceBatch;

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
window.downloadEnhanceBatchZip = downloadEnhanceBatchZip;

// ==================== 缩放控制 ====================
function zoomImage(type, delta) {
    let wrapper;
    if (type === 'original') {
        wrapper = document.querySelector('#resultSection .compare-item:first-child .compare-img-wrapper');
    } else {
        wrapper = document.querySelector('#resultSection .compare-item:last-child .compare-img-wrapper');
    }
    if (wrapper && wrapper.zoomBy) wrapper.zoomBy(delta);
}
window.zoomImage = zoomImage;

function resetZoom(type) {
    let wrapper;
    if (type === 'original') {
        wrapper = document.querySelector('#resultSection .compare-item:first-child .compare-img-wrapper');
    } else {
        wrapper = document.querySelector('#resultSection .compare-item:last-child .compare-img-wrapper');
    }
    if (wrapper && wrapper.resetZoom) wrapper.resetZoom();
}
window.resetZoom = resetZoom;

function zoomEnhance(type, delta) {
    let wrapper;
    if (type === 'original') {
        wrapper = document.querySelector('#enhanceResultSection .compare-item:first-child .compare-img-wrapper');
    } else {
        wrapper = document.querySelector('#enhanceResultSection .compare-item:last-child .compare-img-wrapper');
    }
    if (wrapper && wrapper.zoomBy) wrapper.zoomBy(delta);
}
window.zoomEnhance = zoomEnhance;

function resetEnhanceZoom(type) {
    let wrapperId;
    if (type === 'original') {
        wrapperId = 'enhanceOriginalWrapper';
    } else {
        wrapperId = 'enhanceResultWrapper';
    }
    const wrapper = document.getElementById(wrapperId);
    if (wrapper && wrapper.resetZoom) {
        wrapper.resetZoom();
    }
}
window.resetEnhanceZoom = resetEnhanceZoom;




function initAllZoomDrag() {
    initImageZoom('#originalWrapper', '#resultOriginal');
    // SVG 容器内的新 img 元素
    initImageZoom('#svgWrapper', '#svgDisplay img');
    // 增强区域保持不变
    initImageZoom('#enhanceOriginalWrapper', '#enhanceOriginalImg');
    initImageZoom('#enhanceResultWrapper', '#enhanceResultImg');
}

// ==================== 独立缩放按钮绑定 ====================
window.zoomImage = (type, delta) => {
    const wrapper = document.getElementById(type === 'original' ? 'originalWrapper' : 'svgWrapper');
    if (wrapper && wrapper.zoomBy) wrapper.zoomBy(delta);
};
window.zoomEnhance = (type, delta) => {
    const wrapper = document.getElementById(type === 'original' ? 'enhanceOriginalWrapper' : 'enhanceResultWrapper');
    if (wrapper && wrapper.zoomBy) wrapper.zoomBy(delta);
};
// 如果你还有重置按钮，也可以绑定：

window.resetEnhanceZoom = () => { if (enhanceZoom) enhanceZoom.reset(); };