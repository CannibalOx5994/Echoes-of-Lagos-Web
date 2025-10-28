import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
const deepPurple = 0x2b0033; 
renderer.setClearColor(deepPurple);

document.body.appendChild(renderer.domElement);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(deepPurple);

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enableZoom = true;
controls.enableRotate = true;
controls.rotateSpeed = 0.5;

// Lock the tilt
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 3;

// Horizontal rotation limits
controls.minAzimuthAngle = -Math.PI / 4;
controls.maxAzimuthAngle = Math.PI / 4;

// ✅ SHIFT + LEFT DRAG for Forward/Backward Movement
let isShiftDragging = false;
let previousY = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0 && e.shiftKey) {
    // Disable OrbitControls temporarily
    controls.enabled = false;
    isShiftDragging = true;
    previousY = e.clientY;
    e.preventDefault();
  }
});

renderer.domElement.addEventListener('mouseup', (e) => {
  if (isShiftDragging) {
    controls.enabled = true;
    isShiftDragging = false;
  }
});

renderer.domElement.addEventListener('mousemove', (e) => {
  if (isShiftDragging) {
    const deltaY = e.clientY - previousY;
    previousY = e.clientY;

    // Move camera forward/backward
    const zoomSpeed = 0.5;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    camera.position.addScaledVector(direction, -deltaY * zoomSpeed);
  }
});

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 100);
scene.add(dirLight);

// Loader
const loader = new GLTFLoader();
loader.load(
  './lagos.glb',
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);
    model.scale.set(2, 2.5, 2);

    // Compute bounding box
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Recenter model
    model.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    
    let distance = maxDim / (2 * Math.tan(fov / 2));
    distance *= 1.2;

    // Position camera
    const angle = Math.PI / 4;
    const zoomMultiplier = 0.18;
    const heightMultiplier = 0.4;

    camera.position.set(
      distance * zoomMultiplier * Math.cos(angle),
      distance * heightMultiplier,
      distance * zoomMultiplier * Math.sin(angle)
    );

    camera.lookAt(0, 0, 0);

    // Update camera clipping planes
    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    // Update controls
    controls.target.set(0, 0, 0);
    controls.minDistance = maxDim * 0.1;
    controls.maxDistance = maxDim * 5;
    controls.update();

    // Save initial state
    controls.saveState();

    // Hide loading indicator
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }

    // Show instruction
    showInstruction();

    console.log('✅ Model loaded and framed');
  },
  (xhr) => {
    const progressElement = document.getElementById('progress');
    if (progressElement && xhr.total > 0) {
      progressElement.innerText = `Loading ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`;
    }
  },
  (error) => {
    console.error('❌ Error loading model:', error);
  }
);

// Show instruction overlay
function showInstruction() {
  const instruction = document.createElement('div');
  instruction.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.9);
    padding: 12px 24px;
    border-radius: 8px;
    color: #2b0033;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
  `;
  instruction.innerHTML = `
    <strong>Controls:</strong> 
    Drag to rotate  • Hold <strong>Shift</strong> + Drag to move forward/back
  `;
  document.body.appendChild(instruction);
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Reset button
const resetBtn = document.getElementById('resetView');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    controls.reset();
  });
}

// Animate
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();