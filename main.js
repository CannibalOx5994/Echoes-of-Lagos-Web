import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// Background color: #F5F5F5 (alpha ignored, so #E7E7E7)
const bgColor = 0xF5F5F5;
renderer.setClearColor(bgColor, 1.0);
document.body.appendChild(renderer.domElement);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(bgColor);

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
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 3;
controls.minAzimuthAngle = -Math.PI / 4;
controls.maxAzimuthAngle = Math.PI / 4;

// SHIFT + DRAG forward/back
let isShiftDragging = false;
let previousY = 0;
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0 && e.shiftKey) {
    controls.enabled = false;
    isShiftDragging = true;
    previousY = e.clientY;
    e.preventDefault();
  }
});
renderer.domElement.addEventListener('mouseup', () => {
  if (isShiftDragging) {
    controls.enabled = true;
    isShiftDragging = false;
  }
});
renderer.domElement.addEventListener('mousemove', (e) => {
  if (isShiftDragging) {
    const deltaY = e.clientY - previousY;
    previousY = e.clientY;
    const zoomSpeed = 0.5;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    camera.position.addScaledVector(direction, -deltaY * zoomSpeed);
  }
});

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(100, 200, 100);
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-50, 100, -50);
scene.add(fillLight);
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcccccc, 0.6);
scene.add(hemiLight);

// Load model
const loader = new GLTFLoader();
loader.load(
  './lagos.glb',
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);
    model.scale.set(2, 2.5, 2);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let distance = maxDim / (2 * Math.tan(fov / 2));
    distance *= 1.2;

    const angle = Math.PI / 4;
    const zoomMultiplier = 0.18;
    const heightMultiplier = 0.4;

    camera.position.set(
      distance * zoomMultiplier * Math.cos(angle),
      distance * heightMultiplier,
      distance * zoomMultiplier * Math.sin(angle)
    );
    camera.lookAt(0, 0, 0);

    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    controls.minDistance = maxDim * 0.1;
    controls.maxDistance = maxDim * 5;
    controls.update();
    controls.saveState();

    document.getElementById('progress-container').style.display = 'none';
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

// --- Radial Fog Shader (fade to #E7E7E7 edges) ---
const FogShader = {
  uniforms: {
    tDiffuse: { value: null },
    fogColor: { value: new THREE.Color(bgColor) }, // fade into same gray
    strength: { value: 1.0 },
    radius: { value: 0.85 },
    softness: { value: 0.2 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 fogColor;
    uniform float strength;
    uniform float radius;
    uniform float softness;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.5);
      float dist = distance(vUv, center);
      float fogFactor = smoothstep(radius, radius + softness, dist);

      vec4 sceneColor = texture2D(tDiffuse, vUv);
      vec3 finalColor = mix(sceneColor.rgb, fogColor, fogFactor * strength);

      gl_FragColor = vec4(finalColor, sceneColor.a);
    }
  `
};

// Composer
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const fogPass = new ShaderPass(FogShader);
composer.addPass(fogPass);

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Reset button
const resetBtn = document.getElementById('resetView');
if (resetBtn) resetBtn.addEventListener('click', () => controls.reset());

// Animate
let t = 0;
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Subtle breathing effect
  t += 0.01;
  fogPass.uniforms.radius.value = 0.85 + Math.sin(t) * 0.01;

  composer.render();
}
animate();
