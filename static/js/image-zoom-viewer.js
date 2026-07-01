class ImageZoomViewer {
    constructor(container, options = {}) {
        this.container = container;
        this.content = container.querySelector('.zoom-content');
        this.scale = 1;
        this.minScale = options.minScale || 0.5;
        this.maxScale = options.maxScale || 6;
        this.step = options.step || 0.12;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.init();
    }

    init() {
        this.container.addEventListener('wheel', (e) => this.handleWheel(e));
        this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());
        this.content.addEventListener('dragstart', e => e.preventDefault());
        this.updateTransform();
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -this.step : this.step;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale + delta));
        
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        this.translateX = mouseX - (mouseX - this.translateX) * (newScale / this.scale);
        this.translateY = mouseY - (mouseY - this.translateY) * (newScale / this.scale);
        
        this.scale = newScale;
        this.updateTransform();
        this.updateScaleText();
    }

    handleMouseDown(e) {
        if (e.button !== 0) return;
        this.isDragging = true;
        this.startX = e.clientX - this.translateX;
        this.startY = e.clientY - this.translateY;
        this.container.style.cursor = 'grabbing';
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        this.translateX = e.clientX - this.startX;
        this.translateY = e.clientY - this.startY;
        this.updateTransform();
    }

    handleMouseUp() {
        this.isDragging = false;
        this.container.style.cursor = 'grab';
    }

    updateTransform() {
        this.content.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    }

    updateScaleText() {
        const text = this.container.querySelector('.scale-text');
        if (text) text.textContent = `${Math.round(this.scale * 100)}%`;
    }

    reset() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateTransform();
        this.updateScaleText();
    }

    zoomIn() {
        this.scale = Math.min(this.maxScale, this.scale + this.step);
        this.updateTransform();
        this.updateScaleText();
    }

    zoomOut() {
        this.scale = Math.max(this.minScale, this.scale - this.step);
        this.updateTransform();
        this.updateScaleText();
    }
}

function initZoomViewers() {
    const viewers = document.querySelectorAll('.zoom-viewer');
    const instances = [];
    viewers.forEach(viewer => {
        const instance = new ImageZoomViewer(viewer);
        instances.push(instance);
        
        viewer.querySelector('.zoom-out').addEventListener('click', () => instance.zoomOut());
        viewer.querySelector('.zoom-in').addEventListener('click', () => instance.zoomIn());
        viewer.querySelector('.zoom-reset').addEventListener('click', () => instance.reset());
    });
    return instances;
}