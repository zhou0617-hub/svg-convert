/*
// ==================== Three.js 粒子连线背景（优化版）====================

(function() {
    const canvas = document.getElementById('three-bg');
    if (!canvas) return;

    // 检测性能等级
    const isMobile = window.innerWidth < 768;
    const isLowPower = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    
    // 根据性能调整参数
    const PARTICLE_COUNT = isMobile ? 25 : (isLowPower ? 35 : 50);
    const CONNECTION_DISTANCE = 100;
    const MOUSE_DISTANCE = 120;
    const LINE_UPDATE_INTERVAL = 3; // 每3帧更新一次连线
    const MAX_CONNECTIONS = 3; // 每个粒子最大连线数

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // 使用低精度渲染器
    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        alpha: true, 
        antialias: false, // 关闭抗锯齿
        powerPreference: 'low-power'
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 限制像素比
    
    // 关闭不必要的渲染特性
    renderer.autoClear = true;
    
    camera.position.z = 60;

    // 粒子数据
    const particles = [];
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    
    // 统一使用一种颜色，减少计算
    const baseColor = new THREE.Color(0x6366f1);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = (Math.random() - 0.5) * 80;
        const y = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 40;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        particles.push({
            x: x, y: y, z: z,
            vx: (Math.random() - 0.5) * 0.02,
            vy: (Math.random() - 0.5) * 0.02,
            vz: (Math.random() - 0.5) * 0.005,
        });
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.4,
        color: 0x818cf8,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // 预创建连线对象池，避免每帧创建销毁
    const MAX_LINES = PARTICLE_COUNT * MAX_CONNECTIONS;
    const linePool = [];
    const lineGeometryPool = [];
    
    for (let i = 0; i < MAX_LINES; i++) {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(6); // 2 points * 3 coordinates
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const mat = new THREE.LineBasicMaterial({
            color: 0x6366f1,
            transparent: true,
            opacity: 0
        });
        
        const line = new THREE.Line(geo, mat);
        line.visible = false;
        scene.add(line);
        
        linePool.push(line);
        lineGeometryPool.push(positions);
    }

    let activeLineCount = 0;
    const mouse = { x: 9999, y: 9999 };
    let mouseInactive = true;

    // 节流鼠标事件
    let mouseTimeout;
    document.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        mouseInactive = false;
        
        clearTimeout(mouseTimeout);
        mouseTimeout = setTimeout(() => { mouseInactive = true; }, 100);
    });

    // 触摸事件节流
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
            mouseInactive = false;
        }
    }, { passive: true });

    function updateParticles() {
        const posArray = particleGeometry.attributes.position.array;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const p = particles[i];

            // 基础移动
            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;

            // 边界反弹
            if (Math.abs(p.x) > 40) p.vx *= -1;
            if (Math.abs(p.y) > 40) p.vy *= -1;
            if (Math.abs(p.z) > 20) p.vz *= -1;

            // 简化的鼠标交互（仅当鼠标活跃时）
            if (!mouseInactive) {
                const mouseWorldX = mouse.x * 40;
                const mouseWorldY = mouse.y * 40;
                const dx = mouseWorldX - p.x;
                const dy = mouseWorldY - p.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < MOUSE_DISTANCE * MOUSE_DISTANCE && distSq > 25) {
                    const force = 0.001;
                    p.x += dx * force;
                    p.y += dy * force;
                }
            }

            posArray[i * 3] = p.x;
            posArray[i * 3 + 1] = p.y;
            posArray[i * 3 + 2] = p.z;
        }

        particleGeometry.attributes.position.needsUpdate = true;
    }

    function updateLines() {
        // 隐藏所有旧连线
        for (let i = 0; i < activeLineCount; i++) {
            linePool[i].visible = false;
        }
        activeLineCount = 0;

        const posArray = particleGeometry.attributes.position.array;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            let connections = 0;
            
            for (let j = i + 1; j < PARTICLE_COUNT; j++) {
                if (connections >= MAX_CONNECTIONS) break;
                
                const dx = posArray[i * 3] - posArray[j * 3];
                const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1];
                const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
                    const dist = Math.sqrt(distSq);
                    const lineIdx = activeLineCount;
                    
                    if (lineIdx >= MAX_LINES) break;

                    // 更新几何体
                    const linePos = lineGeometryPool[lineIdx];
                    linePos[0] = posArray[i * 3];
                    linePos[1] = posArray[i * 3 + 1];
                    linePos[2] = posArray[i * 3 + 2];
                    linePos[3] = posArray[j * 3];
                    linePos[4] = posArray[j * 3 + 1];
                    linePos[5] = posArray[j * 3 + 2];
                    
                    linePool[lineIdx].geometry.attributes.position.needsUpdate = true;
                    
                    // 更新透明度
                    const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.12;
                    linePool[lineIdx].material.opacity = opacity;
                    linePool[lineIdx].visible = true;
                    
                    activeLineCount++;
                    connections++;
                }
            }
        }
    }

    let frameCount = 0;
    let lastTime = performance.now();
    let isVisible = true;

    // 页面不可见时暂停
    document.addEventListener('visibilitychange', () => {
        isVisible = !document.hidden;
    });

    function animate() {
        requestAnimationFrame(animate);
        
        if (!isVisible) return;

        const now = performance.now();
        const delta = now - lastTime;
        
        // 限制帧率到 30fps
        if (delta < 33) return;
        lastTime = now;

        frameCount++;

        updateParticles();

        // 间隔更新连线
        if (frameCount % LINE_UPDATE_INTERVAL === 0) {
            updateLines();
        }

        // 极慢旋转
        scene.rotation.y += 0.0001;

        renderer.render(scene, camera);
    }

    // 窗口大小调整（节流）
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }, 200);
    });

    animate();
})();
*/