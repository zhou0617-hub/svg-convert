// ==================== 社区广场 ====================
let currentModalSvg = '';
let currentModalFilename = '';

document.addEventListener('DOMContentLoaded', () => {
    loadCommunityData();
    initTagCloud();
    animateStats();
});

// ==================== 数据加载 ====================
async function loadCommunityData() {
    // 模拟数据（后续替换为真实 API）
    const mockData = generateMockData();
    
    renderWorksGrid('hotWorksGrid', mockData.hot);
    renderWorksGrid('latestWorksGrid', mockData.latest);
    
    // 更新统计数字
    document.getElementById('totalWorks').textContent = mockData.totalWorks;
    document.getElementById('totalUsers').textContent = mockData.totalUsers;
    document.getElementById('todayConverts').textContent = mockData.todayConverts;
}

function generateMockData() {
    const categories = ['logo', 'icon', 'illustration', 'portrait', 'landscape', 'pattern'];
    const authors = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank'];
    
    const generateWork = (id, isHot = false) => {
        const author = authors[Math.floor(Math.random() * authors.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const date = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        
        return {
            id: id,
            title: `${category.charAt(0).toUpperCase() + category.slice(1)} 作品 #${id}`,
            author: author,
            authorAvatar: author.charAt(0),
            category: category,
            date: date.toLocaleDateString('zh-CN'),
            views: isHot ? Math.floor(Math.random() * 5000) + 1000 : Math.floor(Math.random() * 500),
            likes: isHot ? Math.floor(Math.random() * 500) + 100 : Math.floor(Math.random() * 50),
            imageUrl: `https://picsum.photos/seed/${id}/400/400`,
            svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                <defs>
                    <linearGradient id="g${id}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#6366f1"/>
                        <stop offset="100%" style="stop-color:#c084fc"/>
                    </linearGradient>
                </defs>
                <rect width="100" height="100" fill="url(#g${id})" rx="12"/>
                <text x="50" y="55" text-anchor="middle" fill="white" font-size="14" font-weight="bold">SVG ${id}</text>
            </svg>`
        };
    };

    return {
        totalWorks: 12847,
        totalUsers: 3421,
        todayConverts: 156,
        hot: Array.from({ length: 8 }, (_, i) => generateWork(i + 1, true)),
        latest: Array.from({ length: 8 }, (_, i) => generateWork(i + 100))
    };
}

// ==================== 渲染作品网格 ====================
function renderWorksGrid(gridId, works) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (!works || works.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                </svg>
                <h3>暂无作品</h3>
                <p>成为第一个分享作品的人吧！</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = works.map(work => `
        <div class="work-card" onclick="showWorkDetail(${work.id})" data-id="${work.id}">
            <div class="work-image">
                <img src="${work.imageUrl}" alt="${escapeHtml(work.title)}" loading="lazy">
                <div class="work-overlay">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); showWorkDetail(${work.id})">
                        查看详情
                    </button>
                </div>
            </div>
            <div class="work-info">
                <h4 class="work-title">${escapeHtml(work.title)}</h4>
                <div class="work-meta">
                    <div class="work-author">
                        <div class="work-author-avatar">${work.authorAvatar}</div>
                        <span>${escapeHtml(work.author)}</span>
                    </div>
                    <span>👁 ${formatNumber(work.views)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ==================== 标签云 ====================
function initTagCloud() {
    const tagItems = document.querySelectorAll('.tag-item');
    tagItems.forEach(item => {
        item.addEventListener('click', () => {
            // 切换激活状态
            tagItems.forEach(t => t.classList.remove('active'));
            item.classList.toggle('active');
            
            const tag = item.dataset.tag;
            filterByTag(tag);
        });
    });
}

function filterByTag(tag) {
    // 显示提示
    showToast(`筛选标签: ${tag}`, 'info');
    
    // 模拟筛选效果：让作品网格闪烁一下
    const grids = ['hotWorksGrid', 'latestWorksGrid'];
    grids.forEach(gridId => {
        const grid = document.getElementById(gridId);
        if (grid) {
            grid.style.opacity = '0.4';
            setTimeout(() => {
                grid.style.opacity = '1';
            }, 300);
        }
    });
}

// ==================== 作品详情弹窗 ====================
function showWorkDetail(workId) {
    // 从当前页面数据中查找作品
    const allWorks = [...document.querySelectorAll('.work-card')];
    const workCard = allWorks.find(card => card.dataset.id == workId);
    if (!workCard) return;

    const img = workCard.querySelector('.work-image img');
    const title = workCard.querySelector('.work-title').textContent;
    const author = workCard.querySelector('.work-author span').textContent;
    const avatar = workCard.querySelector('.work-author-avatar').textContent;
    
    // 生成模拟 SVG（实际应从数据中获取）
    currentModalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
        <defs>
            <linearGradient id="modalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#6366f1"/>
                <stop offset="100%" style="stop-color:#c084fc"/>
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <rect width="400" height="400" fill="url(#modalGrad)" rx="20"/>
        <circle cx="200" cy="200" r="120" fill="none" stroke="white" stroke-width="2" opacity="0.3" filter="url(#glow)"/>
        <circle cx="200" cy="200" r="80" fill="none" stroke="white" stroke-width="3" opacity="0.5"/>
        <text x="200" y="210" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="Inter, sans-serif">SVG ${workId}</text>
        <text x="200" y="240" text-anchor="middle" fill="white" font-size="14" opacity="0.7" font-family="Inter, sans-serif">Vector Art</text>
    </svg>`;
    
    currentModalFilename = `svg-work-${workId}.svg`;

    // 填充弹窗内容
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalAuthor').textContent = author;
    document.getElementById('modalAvatar').textContent = avatar;
    document.getElementById('modalOriginal').src = img.src;
    document.getElementById('modalSvgWrapper').innerHTML = currentModalSvg;
    document.getElementById('modalDate').textContent = new Date().toLocaleDateString('zh-CN');

    showModal('workModal');
}

function copyModalSvg() {
    navigator.clipboard.writeText(currentModalSvg).then(() => {
        showToast('SVG 代码已复制', 'success');
    });
}

function downloadModalSvg() {
    const blob = new Blob([currentModalSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentModalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('下载已开始', 'success');
}

// ==================== 数字动画 ====================
function animateStats() {
    const stats = document.querySelectorAll('.stat-num');
    stats.forEach(stat => {
        const target = parseInt(stat.textContent) || 0;
        if (target === 0) return;
        
        let current = 0;
        const increment = target / 60;
        const duration = 1000;
        const stepTime = duration / 60;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                stat.textContent = formatNumber(target);
                clearInterval(timer);
            } else {
                stat.textContent = formatNumber(Math.floor(current));
            }
        }, stepTime);
    });
}

// ==================== 工具函数 ====================
function formatNumber(num) {
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + 'w';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}