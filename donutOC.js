import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0.6, 6);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearAlpha(0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 4);
keyLight.position.set(4, 8, 6);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xff8844, 1.2);
fillLight.position.set(-4, -1, -3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x4488ff, 0.8);
rimLight.position.set(0, -3, 5);
scene.add(rimLight);

const donutGroup = new THREE.Group();
scene.add(donutGroup);

let model = null;
const mouse = { x: 0, y: 0 };
const targetTilt = { x: 0, y: 0 };
const currentTilt = { x: 0, y: 0 };
let spinVelocity = 0;
let tiltVelocity = 0;
let isDragging = false;
let prevPointer = { x: 0, y: 0 };
let isSpinning = false;
let idleTime = 0;
let autoRotateSpeed = 0.004;
let selectedIndex = 0;
let menuItems = [];
let targetZoom = 6;
const clock = new THREE.Clock();

const loader = new GLTFLoader();
loader.load('./models/Donut.glb', (gltf) => {
    model = gltf.scene;
    model.scale.set(18, 18, 18);
    donutGroup.add(model);
});

const PARTICLE_COUNT = 250;
const geo = new THREE.BufferGeometry();
const pos = new Float32Array(PARTICLE_COUNT * 3);
const cols = new Float32Array(PARTICLE_COUNT * 3);
const sizes = new Float32Array(PARTICLE_COUNT);
const pVel = [];

const palette = [
    [1.0, 0.3, 0.3], [1.0, 0.7, 0.1], [0.3, 0.7, 1.0],
    [0.3, 1.0, 0.5], [1.0, 0.4, 0.7], [0.7, 0.3, 1.0],
    [1.0, 0.9, 0.2], [0.3, 0.9, 0.9],
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = 1.8 + Math.random() * 2.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.6;
    pos[i * 3 + 2] = Math.cos(phi) * r;

    const c = palette[Math.floor(Math.random() * palette.length)];
    cols[i * 3] = c[0];
    cols[i * 3 + 1] = c[1];
    cols[i * 3 + 2] = c[2];

    sizes[i] = 0.015 + Math.random() * 0.04;
    pVel.push({
        x: (Math.random() - 0.5) * 0.004,
        y: (Math.random() - 0.5) * 0.004,
        z: (Math.random() - 0.5) * 0.004,
        orbit: 0.001 + Math.random() * 0.003,
        phase: Math.random() * Math.PI * 2,
        radius: r,
    });
}

geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const pMat = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
});

const particles = new THREE.Points(geo, pMat);
scene.add(particles);

function updateParticles(time) {
    const p = particles.geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const v = pVel[i];
        p[i * 3] += v.x + Math.sin(time * v.orbit + v.phase) * 0.001;
        p[i * 3 + 1] += v.y + Math.cos(time * v.orbit * 0.7 + v.phase) * 0.001;
        p[i * 3 + 2] += v.z + Math.sin(time * v.orbit * 0.5 + v.phase * 1.3) * 0.001;

        const dx = p[i * 3], dy = p[i * 3 + 1], dz = p[i * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const target = v.radius;
        if (dist > target * 1.4) {
            p[i * 3] *= 0.999;
            p[i * 3 + 1] *= 0.999;
            p[i * 3 + 2] *= 0.999;
        } else if (dist < target * 0.6) {
            p[i * 3] *= 1.001;
            p[i * 3 + 1] *= 1.001;
            p[i * 3 + 2] *= 1.001;
        }
    }
    particles.geometry.attributes.position.needsUpdate = true;
}

const canvas = renderer.domElement;

canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    isSpinning = false;
    spinVelocity = 0;
    tiltVelocity = 0;
    prevPointer.x = e.clientX;
    prevPointer.y = e.clientY;
});

canvas.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (isDragging) {
        const dx = e.clientX - prevPointer.x;
        const dy = e.clientY - prevPointer.y;
        spinVelocity = dx * 0.008;
        tiltVelocity = dy * 0.004;
        donutGroup.rotation.y += dx * 0.008;
        donutGroup.rotation.x += dy * 0.004;
        donutGroup.rotation.x = Math.max(-0.8, Math.min(0.8, donutGroup.rotation.x));
        prevPointer.x = e.clientX;
        prevPointer.y = e.clientY;
        idleTime = 0;
    }
});

canvas.addEventListener('pointerup', () => {
    if (isDragging && (Math.abs(spinVelocity) > 0.002 || Math.abs(tiltVelocity) > 0.002)) {
        isSpinning = true;
    }
    isDragging = false;
});

canvas.addEventListener('pointerleave', () => {
    if (isDragging) {
        isDragging = false;
        if (Math.abs(spinVelocity) > 0.002) isSpinning = true;
    }
    mouse.x = 0;
    mouse.y = 0;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZoom += e.deltaY * 0.008;
    targetZoom = Math.max(3.5, Math.min(14, targetZoom));
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function setupMenu() {
    const items = document.querySelectorAll('.menu-item');
    items.forEach((item, i) => {
        menuItems.push(item);
        item.addEventListener('click', () => onSelect(i));
        item.addEventListener('mouseenter', () => {
            selectedIndex = i;
            updateSelection();
        });
        item.addEventListener('mousemove', (e) => {
            const rect = item.getBoundingClientRect();
            targetTilt.x = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
            targetTilt.y = -((rect.top + rect.height / 2) / window.innerHeight) * 2 + 1;
        });
        item.addEventListener('mouseleave', () => {
            targetTilt.x = mouse.x;
            targetTilt.y = mouse.y;
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + menuItems.length) % menuItems.length;
            updateSelection();
            flashItem(selectedIndex);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % menuItems.length;
            updateSelection();
            flashItem(selectedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            onSelect(selectedIndex);
        } else if (e.key === 'o' || e.key === 'O') {
            const idx = menuItems.findIndex(item => item.dataset.action === 'options');
            if (idx >= 0) onSelect(idx);
        } else if (e.key === 'c' || e.key === 'C') {
            const idx = menuItems.findIndex(item => item.dataset.action === 'credits');
            if (idx >= 0) onSelect(idx);
        }
    });

    updateSelection();
}

function updateSelection() {
    menuItems.forEach((item, i) => {
        item.classList.toggle('selected', i === selectedIndex);
    });
    const item = menuItems[selectedIndex];
    if (item) {
        const rect = item.getBoundingClientRect();
        targetTilt.x = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
        targetTilt.y = -((rect.top + rect.height / 2) / window.innerHeight) * 2 + 1;
    }
}

function flashItem(index) {
    const item = menuItems[index];
    item.style.transform = 'scale(0.92)';
    item.style.transition = 'transform 0.1s ease';
    setTimeout(() => {
        item.style.transform = '';
    }, 100);
}

let bounceTime = 0;
let bounceActive = false;
let selectFlashTime = 0;

function onSelect(index) {
    const action = menuItems[index].dataset.action;
    bounceActive = true;
    bounceTime = 0;
    selectFlashTime = 1;

    const item = menuItems[index];
    item.style.transform = 'scale(0.9)';
    item.style.transition = 'transform 0.08s ease';
    setTimeout(() => {
        item.style.transform = '';
        item.style.transition = '';
    }, 150);

    console.log(`[MENU] ${action.toUpperCase()}`);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.getElapsedTime();

    if (model) {
        const bob = Math.sin(time * 0.7) * 0.04;
        const bobZ = Math.sin(time * 0.5 + 1) * 0.02;
        model.position.y = bob;
        model.position.z = bobZ;
    }

    if (!isDragging) {
        if (isSpinning) {
            donutGroup.rotation.y += spinVelocity;
            donutGroup.rotation.x += tiltVelocity;
            spinVelocity *= 0.97;
            tiltVelocity *= 0.97;
            if (Math.abs(spinVelocity) < 0.0005 && Math.abs(tiltVelocity) < 0.0005) {
                isSpinning = false;
            }
        } else {
            idleTime += delta;
            const tiltStrength = Math.min(idleTime / 2, 1);
            const followX = targetTilt.x * 0.4 * (1 - tiltStrength * 0.7);
            const followY = targetTilt.y * 0.25 * (1 - tiltStrength * 0.7);

            currentTilt.x += (followX - currentTilt.x) * 0.04;
            currentTilt.y += (followY - currentTilt.y) * 0.04;

            if (Math.abs(mouse.x) > 0.02 || Math.abs(mouse.y) > 0.02 || tiltStrength > 0.1) {
                const tiltSmooth = 0.03;
                const targetY = donutGroup.rotation.y + (currentTilt.y * 0.5 - 0) * tiltSmooth;
                donutGroup.rotation.y += (currentTilt.x * 0.3) * tiltSmooth + autoRotateSpeed * (1 - Math.abs(currentTilt.x) * 0.3);
                donutGroup.rotation.x += (currentTilt.y * 0.5 - donutGroup.rotation.x) * 0.03;
                donutGroup.rotation.x = Math.max(-0.5, Math.min(0.5, donutGroup.rotation.x));
            } else {
                donutGroup.rotation.y += autoRotateSpeed;
                donutGroup.rotation.x += (0 - donutGroup.rotation.x) * 0.02;
            }
        }
    }

    if (bounceActive) {
        bounceTime += delta;
        const progress = bounceTime / 0.6;
        if (progress < 1) {
            const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.08 * (1 - progress);
            if (model) model.scale.set(18 * scale, 18 * scale, 18 * scale);
        } else {
            if (model) model.scale.set(18, 18, 18);
            bounceActive = false;
        }
    }

    if (selectFlashTime > 0) {
        selectFlashTime -= delta * 2;
        const intensity = Math.max(0, selectFlashTime);
        pMat.opacity = 0.7 + intensity * 0.3;
    } else {
        pMat.opacity += (0.7 - pMat.opacity) * 0.05;
    }

    updateParticles(time);

    camera.position.z += (targetZoom - camera.position.z) * 0.05;
    camera.position.y += (0.6 + Math.sin(time * 0.3) * 0.08 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

setupMenu();
animate();
