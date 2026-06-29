// ==================== 首页：上传 & 转换 ====================
let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
    setupDragDrop();
});

function setupDragDrop() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('fileInput');
    if (!zone || !input) return;

    zone.addEventListener('click', (e) => {
        // 如果点击的是按钮，不触发文件选择
        if (e.target.closest('button')) return;
        input.click();
    });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) { showToast('请选择图片文件', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('文件大小不能超过 10MB', 'error'); return; }
    selectedFile = file;
    currentFilename = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.querySelector('.upload-content').hidden = true;
        document.getElementById('uploadPreview').hidden = false;
    };
    reader.readAsDataURL(file);
}

function resetUpload() {
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.querySelector('.upload-content').hidden = false;
    document.getElementById('uploadPreview').hidden = true;
    document.getElementById('resultSection').hidden = true;
}

async function startConvert() {
    if (!requireAuth()) return;
    if (!selectedFile) return;

    const btn = document.getElementById('convertBtn');
    setLoading(btn, true);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
        const res = await fetch('/api/convert', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
            currentSvg = data.svg;
            showResult(data.svg);
            showToast('转换成功！', 'success');
        } else {
            showToast(data.error || '转换失败', 'error');
        }
    } catch (e) {
        showToast('网络错误', 'error');
    } finally {
        setLoading(btn, false);
    }
}

function showResult(svg) {
    document.getElementById('resultOriginal').src = document.getElementById('previewImg').src;
    document.getElementById('svgWrapper').innerHTML = svg;
    document.getElementById('resultSection').hidden = false;
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function copySvg() {
    navigator.clipboard.writeText(currentSvg).then(() => showToast('SVG 代码已复制', 'success'));
}

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