import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { gsap } from "gsap";
import {
  Blend,
  createIcons,
  Aperture,
  BookmarkPlus,
  Download,
  ImagePlus,
  Layers3,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Waves,
  X,
} from "lucide";

const icons = {
  Aperture,
  BookmarkPlus,
  Blend,
  Download,
  ImagePlus,
  Layers3,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Waves,
  X,
};
createIcons({ icons });

const app = document.querySelector("#app");
const stage = document.querySelector("#drop-target");
const canvas = document.querySelector("#particle-canvas");
const fileInput = document.querySelector("#file-input");
const chooseButton = document.querySelector("#choose-button");
const replaceButton = document.querySelector("#replace-button");
const resetButton = document.querySelector("#reset-button");
const tuneButton = document.querySelector("#tune-button");
const scatterButton = document.querySelector("#scatter-button");
const pauseButton = document.querySelector("#pause-button");
const captureButton = document.querySelector("#capture-button");
const captureActions = document.querySelector("#capture-actions");
const captureExit = document.querySelector("#capture-exit");
const exportButton = document.querySelector("#export-button");
const parameterPanel = document.querySelector("#parameter-panel");
const canvasHint = document.querySelector("#canvas-hint");
const processing = document.querySelector("#processing");
const toast = document.querySelector("#toast");
const sourcePreview = document.querySelector("#source-preview");
const sourceName = document.querySelector("#source-name");
const sourceMeta = document.querySelector("#source-meta");
const depthRange = document.querySelector("#depth-range");
const motionRange = document.querySelector("#motion-range");
const sizeRange = document.querySelector("#size-range");
const depthOutput = document.querySelector("#depth-output");
const motionOutput = document.querySelector("#motion-output");
const sizeOutput = document.querySelector("#size-output");
const presetSelect = document.querySelector("#preset-select");
const savePresetButton = document.querySelector("#save-preset");
const deletePresetButton = document.querySelector("#delete-preset");
const presetDialog = document.querySelector("#preset-dialog");
const presetForm = document.querySelector("#preset-form");
const presetName = document.querySelector("#preset-name");
const presetCancel = document.querySelector("#preset-cancel");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);
const isMobile = () => innerWidth <= 640;

let points = null;
let currentSource = null;
let customImageLoaded = false;
let elapsed = Math.random() * 30;
let paused = false;
let scattered = false;
let panelOpen = false;
let captureMode = false;
let exporting = false;
let dragActive = false;
let dragMoved = false;
let dragDepth = 0;
const activePointers = new Map();
let pinchStartDistance = 0;
let pinchStartZoom = 0;
let toastTimer;
let revealStartedAt = performance.now();
let lastPointer = { x: 0, y: 0 };
let rotationTarget = { x: -0.04, y: 0.02 };
let zoomTarget = isMobile() ? 7.2 : 6.55;
let rootYTarget = 0;
let worldSize = { width: 4.65, height: 4.15 };
let fittedZoom = zoomTarget;
const PRESET_KEY = "prism.presets.v1";
const LAST_PRESET_KEY = "prism.lastPreset.v1";
const builtInPresets = {
  reveal: { label: "显影", mode: "relief", depth: 1.2, motion: 0.26, size: 1.1 },
  tide: { label: "潮汐", mode: "wave", depth: 1.05, motion: 0.52, size: 1.0 },
  drift: { label: "游离", mode: "dust", depth: 1.4, motion: 0.36, size: 0.86 },
  ember: { label: "余烬", mode: "relief", depth: 1.65, motion: 0.12, size: 0.8 },
};
let customPresets = loadCustomPresets();
let applyingPreset = false;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
camera.position.set(0, 0, zoomTarget);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), isMobile() ? 0.34 : 0.48, 0.58, 0.2);
composer.addPass(bloom);

const particleRoot = new THREE.Group();
particleRoot.position.y = rootYTarget;
particleRoot.rotation.set(rotationTarget.x, rotationTarget.y, 0);
scene.add(particleRoot);

const pointer = new THREE.Vector2(0, 0);
const uniforms = {
  uTime: { value: elapsed },
  uReveal: { value: 0 },
  uScatter: { value: 0 },
  uDepth: { value: Number(depthRange.value) },
  uMotion: { value: Number(motionRange.value) },
  uPointSize: { value: Number(sizeRange.value) },
  uPixelRatio: { value: 1 },
  uModes: { value: new THREE.Vector3(1, 0, 0) },
  uPointer: { value: pointer },
};

const vertexShader = /* glsl */ `
  attribute vec3 aOrigin;
  attribute vec3 aScatter;
  attribute float aLuma;
  attribute float aRandom;
  attribute float aEdge;
  attribute float aAlpha;

  uniform float uTime;
  uniform float uReveal;
  uniform float uScatter;
  uniform float uDepth;
  uniform float uMotion;
  uniform float uPointSize;
  uniform float uPixelRatio;
  uniform vec3 uModes;
  uniform vec2 uPointer;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vEdge;

  float easeOut(float value) {
    return 1.0 - pow(1.0 - value, 3.0);
  }

  void main() {
    float revealStart = aRandom * .26;
    float reveal = smoothstep(revealStart, min(1.0, revealStart + .7), uReveal);
    vec3 p = mix(aOrigin, position, easeOut(reveal));
    float time = uTime * (.34 + uMotion * 1.35);

    float reliefZ = (aLuma - .43) * uDepth * 1.22 + aEdge * .11 * uDepth;
    float waveZ = (
      sin(position.x * 2.35 + time + aRandom * 2.0) *
      cos(position.y * 2.7 - time * .72)
    ) * uDepth * .3;
    float dustZ = (aRandom - .5) * uDepth * 2.15;
    p.z += reliefZ * uModes.x + waveZ * uModes.y + dustZ * uModes.z;

    float breathe = sin(time * 1.25 + position.y * 2.4 + aRandom * 4.0) * uMotion;
    p.z += breathe * (.018 + uModes.y * .07 + uModes.z * .11);
    p.x += sin(time * .54 + position.y * 2.9 + aRandom * 5.0) * uMotion * .013;
    p.y += cos(time * .47 + position.x * 2.4 + aRandom * 4.0) * uMotion * .011;

    p += aScatter * uScatter * (.42 + aRandom * .8);

    float cursorDistance = distance(position.xy, uPointer * 2.35);
    float cursorField = exp(-cursorDistance * cursorDistance * 2.0);
    p.z += cursorField * sin(time * 2.0 + aRandom * 7.0) * .09 * uMotion;

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = 11.0 / max(1.0, -viewPosition.z);
    gl_PointSize = uPointSize * (1.08 + aRandom * .58 + aEdge * .62) * uPixelRatio * perspective;

    vColor = color;
    vAlpha = aAlpha * (.48 + aRandom * .48);
    vEdge = aEdge;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vEdge;

  void main() {
    float distanceToCenter = length(gl_PointCoord - .5);
    if (distanceToCenter > .5) discard;
    float core = smoothstep(.5, .06, distanceToCenter);
    float halo = smoothstep(.5, .2, distanceToCenter);
    vec3 lifted = pow(max(vColor, vec3(.004)), vec3(.82));
    float luminance = dot(lifted, vec3(.2126, .7152, .0722));
    vec3 saturated = mix(vec3(luminance), lifted, 1.32);
    vec3 colorOut = mix(saturated, vec3(1.0, .96, .94), vEdge * .045);
    gl_FragColor = vec4(colorOut, (core * .78 + halo * .22) * vAlpha);
  }
`;

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
});

function pseudo(index, salt) {
  const value = Math.sin(index * 91.173 + salt * 47.771) * 43758.5453;
  return value - Math.floor(value);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("默认图像读取失败"));
    image.src = url;
  });
}

async function decodeFile(file) {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取这张图片"));
    };
    image.src = url;
  });
}

function getSourceSize(source) {
  return {
    width: source.naturalWidth || source.videoWidth || source.width,
    height: source.naturalHeight || source.videoHeight || source.height,
  };
}

function getSampleSize(width, height) {
  const limit = isMobile() ? 14500 : 23500;
  if (width * height <= limit) return { width, height };
  const ratio = width / height;
  let sampleWidth = Math.max(1, Math.floor(Math.sqrt(limit * ratio)));
  let sampleHeight = Math.max(1, Math.floor(sampleWidth / ratio));
  while (sampleWidth * sampleHeight > limit) sampleHeight -= 1;
  return { width: sampleWidth, height: sampleHeight };
}

function drawPreview(source) {
  const context = sourcePreview.getContext("2d");
  const { width, height } = getSourceSize(source);
  const scale = Math.max(sourcePreview.width / width, sourcePreview.height / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  context.clearRect(0, 0, sourcePreview.width, sourcePreview.height);
  context.fillStyle = "#171019";
  context.fillRect(0, 0, sourcePreview.width, sourcePreview.height);
  context.drawImage(source, (sourcePreview.width - drawWidth) / 2, (sourcePreview.height - drawHeight) / 2, drawWidth, drawHeight);
}

function sampleImage(source) {
  const original = getSourceSize(source);
  const sample = getSampleSize(original.width, original.height);
  const sampler = document.createElement("canvas");
  sampler.width = sample.width;
  sampler.height = sample.height;
  const context = sampler.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, sample.width, sample.height);
  context.drawImage(source, 0, 0, sample.width, sample.height);
  return {
    original,
    sample,
    pixels: context.getImageData(0, 0, sample.width, sample.height).data,
  };
}

function getDarkThreshold(pixels, width, height) {
  let total = 0;
  let count = 0;
  const edge = Math.max(2, Math.floor(Math.min(width, height) * 0.04));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= edge && x < width - edge && y >= edge && y < height - edge) continue;
      const offset = (y * width + x) * 4;
      total += Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      count += 1;
    }
  }
  const edgeAverage = total / Math.max(1, count);
  return edgeAverage < 48 ? Math.min(72, edgeAverage + 26) : 0;
}

function isVisiblePixel(pixels, offset, threshold) {
  const alpha = pixels[offset + 3] / 255;
  if (alpha <= 0.06) return false;
  if (threshold <= 0) return true;
  const maxChannel = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
  return maxChannel > threshold;
}

function buildParticles(source, name, custom = false) {
  const { original, sample, pixels } = sampleImage(source);
  let threshold = getDarkThreshold(pixels, sample.width, sample.height);
  let visibleCount = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (isVisiblePixel(pixels, offset, threshold)) visibleCount += 1;
  }
  if (visibleCount < sample.width * sample.height * 0.08) {
    threshold = 0;
    visibleCount = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (isVisiblePixel(pixels, offset, threshold)) visibleCount += 1;
    }
  }
  if (!visibleCount) throw new Error("图片完全透明，请选择包含可见内容的图片");

  const positions = new Float32Array(visibleCount * 3);
  const origins = new Float32Array(visibleCount * 3);
  const scatter = new Float32Array(visibleCount * 3);
  const colors = new Float32Array(visibleCount * 3);
  const lumas = new Float32Array(visibleCount);
  const randoms = new Float32Array(visibleCount);
  const edges = new Float32Array(visibleCount);
  const alphas = new Float32Array(visibleCount);

  const maxWidth = 4.65;
  const maxHeight = 4.15;
  const worldScale = Math.min(maxWidth / sample.width, maxHeight / sample.height);
  worldSize = { width: sample.width * worldScale, height: sample.height * worldScale };
  let pointIndex = 0;

  for (let y = 0; y < sample.height; y += 1) {
    for (let x = 0; x < sample.width; x += 1) {
      const offset = (y * sample.width + x) * 4;
      if (!isVisiblePixel(pixels, offset, threshold)) continue;

      const r = pixels[offset] / 255;
      const g = pixels[offset + 1] / 255;
      const b = pixels[offset + 2] / 255;
      const alpha = pixels[offset + 3] / 255;
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const nextX = Math.min(sample.width - 1, x + 1);
      const nextY = Math.min(sample.height - 1, y + 1);
      const right = (y * sample.width + nextX) * 4;
      const down = (nextY * sample.width + x) * 4;
      const rightLuma = (pixels[right] * 0.2126 + pixels[right + 1] * 0.7152 + pixels[right + 2] * 0.0722) / 255;
      const downLuma = (pixels[down] * 0.2126 + pixels[down + 1] * 0.7152 + pixels[down + 2] * 0.0722) / 255;
      const edge = Math.min(1, (Math.abs(luma - rightLuma) + Math.abs(luma - downLuma)) * 3.1);
      const arrayOffset = pointIndex * 3;

      positions[arrayOffset] = (x - (sample.width - 1) / 2) * worldScale;
      positions[arrayOffset + 1] = ((sample.height - 1) / 2 - y) * worldScale;
      positions[arrayOffset + 2] = 0;

      const angle = pseudo(pointIndex, 1) * Math.PI * 2;
      const phi = Math.acos(2 * pseudo(pointIndex, 2) - 1);
      const radius = 2.4 + pseudo(pointIndex, 3) * 3.2;
      origins[arrayOffset] = Math.sin(phi) * Math.cos(angle) * radius;
      origins[arrayOffset + 1] = Math.cos(phi) * radius;
      origins[arrayOffset + 2] = Math.sin(phi) * Math.sin(angle) * radius;

      const scatterAngle = pseudo(pointIndex, 5) * Math.PI * 2;
      const scatterLift = pseudo(pointIndex, 6) * 2 - 1;
      const scatterRadius = Math.sqrt(Math.max(0, 1 - scatterLift * scatterLift));
      const scatterPower = 0.8 + pseudo(pointIndex, 7) * 1.8;
      scatter[arrayOffset] = Math.cos(scatterAngle) * scatterRadius * scatterPower;
      scatter[arrayOffset + 1] = scatterLift * scatterPower;
      scatter[arrayOffset + 2] = Math.sin(scatterAngle) * scatterRadius * scatterPower;

      colors[arrayOffset] = r;
      colors[arrayOffset + 1] = g;
      colors[arrayOffset + 2] = b;
      lumas[pointIndex] = luma;
      randoms[pointIndex] = pseudo(pointIndex, 4);
      edges[pointIndex] = edge;
      alphas[pointIndex] = Math.max(0.18, alpha);
      pointIndex += 1;
    }
  }

  // Frame visible pixels, so transparent margins do not shrink the artwork.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    maxX = Math.max(maxX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    maxY = Math.max(maxY, positions[index + 1]);
  }
  for (let index = 0; index < positions.length; index += 3) {
    positions[index] -= (minX + maxX) / 2;
    positions[index + 1] -= (minY + maxY) / 2;
  }
  worldSize = { width: Math.max(worldScale, maxX - minX), height: Math.max(worldScale, maxY - minY) };

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aOrigin", new THREE.BufferAttribute(origins, 3));
  geometry.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aLuma", new THREE.BufferAttribute(lumas, 1));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
  geometry.setAttribute("aEdge", new THREE.BufferAttribute(edges, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

  if (points) {
    particleRoot.remove(points);
    points.geometry.dispose();
  }

  points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  particleRoot.add(points);
  currentSource = source;

  drawPreview(source);
  sourceName.textContent = name;
  sourceMeta.textContent = `${visibleCount.toLocaleString("zh-CN")} 个粒子`;
  uniforms.uReveal.value = 0;
  revealStartedAt = performance.now();
  uniforms.uScatter.value = 0;
  scattered = false;
  scatterButton.classList.remove("active");
  scatterButton.setAttribute("aria-pressed", "false");
  scatterButton.setAttribute("aria-label", "散开粒子");
  scatterButton.querySelector("span").textContent = "散开";
  resize();
  resetView(false);

  gsap.fromTo(
    particleRoot.scale,
    { x: 0.84, y: 0.84, z: 0.84 },
    { x: 1, y: 1, z: 1, duration: reducedMotion ? 0.01 : 1.8, ease: "power3.out" },
  );

  if (custom) enterFocusMode();
}

function enterFocusMode() {
  customImageLoaded = true;
  app.classList.add("has-custom");
  resetView(false);
}

async function handleFile(file) {
  if (!file) return;
  if (!allowedTypes.has(file.type)) {
    showToast("请选择 JPG、PNG、WEBP 或 AVIF 图片");
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    showToast("图片需要小于 30 MB");
    return;
  }

  processing.classList.add("visible");
  await new Promise((resolve) => requestAnimationFrame(resolve));

  try {
    const image = await decodeFile(file);
    const name = file.name.replace(/\.[^.]+$/, "").slice(0, 64) || "未命名图像";
    buildParticles(image, name, true);
    showToast("图像已经进入空间");
  } catch (error) {
    showToast(error.message || "图片处理失败，请换一张重试");
  } finally {
    processing.classList.remove("visible");
    fileInput.value = "";
  }
}

function openFilePicker() {
  fileInput.click();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1800);
}

function loadCustomPresets() {
  try {
    const value = JSON.parse(localStorage.getItem(PRESET_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" && typeof item.label === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveCustomPresets() {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(customPresets));
  } catch {
    showToast("浏览器未允许保存气质");
  }
}

function renderPresetOptions(selectedValue) {
  presetSelect.querySelectorAll("optgroup").forEach((group) => group.remove());
  if (customPresets.length) {
    const group = document.createElement("optgroup");
    group.label = "我的气质";
    customPresets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      group.append(option);
    });
    presetSelect.append(group);
  }
  if ([...presetSelect.options].some((option) => option.value === selectedValue)) presetSelect.value = selectedValue;
  deletePresetButton.disabled = !customPresets.some((preset) => preset.id === presetSelect.value);
}

function currentPresetSnapshot(label, id = `user-${Date.now()}`) {
  return {
    id,
    label,
    mode: document.querySelector(".mode-button.active")?.dataset.mode || "relief",
    depth: Number(depthRange.value),
    motion: Number(motionRange.value),
    size: Number(sizeRange.value),
  };
}

function markPresetManual() {
  if (applyingPreset) return;
  presetSelect.value = "manual";
  deletePresetButton.disabled = true;
  try { localStorage.setItem(LAST_PRESET_KEY, "manual"); } catch {}
}

function applyPreset(id, announce = true) {
  const preset = builtInPresets[id] || customPresets.find((item) => item.id === id);
  if (!preset) return;
  applyingPreset = true;
  setMode(preset.mode);
  const values = [
    [depthRange, depthOutput, preset.depth, 0, 2, uniforms.uDepth],
    [motionRange, motionOutput, preset.motion, 0, 1, uniforms.uMotion],
    [sizeRange, sizeOutput, preset.size, 0.55, 1.8, uniforms.uPointSize],
  ];
  values.forEach(([range, output, value, min, max, uniform]) => {
    range.value = value;
    updateRange(range, output, value, min, max);
    gsap.to(uniform, { value, duration: reducedMotion ? 0.01 : 0.72, ease: "power2.inOut" });
  });
  presetSelect.value = id;
  deletePresetButton.disabled = !customPresets.some((item) => item.id === id);
  applyingPreset = false;
  try { localStorage.setItem(LAST_PRESET_KEY, id); } catch {}
  if (announce) showToast(`已切换为「${preset.label}」`);
}

function openPresetDialog() {
  if (customPresets.length >= 12) {
    showToast("最多保存 12 个气质");
    return;
  }
  presetName.value = `我的气质 ${String(customPresets.length + 1).padStart(2, "0")}`;
  presetDialog.showModal();
  requestAnimationFrame(() => presetName.select());
}

function saveCurrentPreset(labelValue) {
  const label = labelValue.trim().slice(0, 18);
  if (!label) return;
  const preset = currentPresetSnapshot(label);
  customPresets.push(preset);
  saveCustomPresets();
  renderPresetOptions(preset.id);
  try { localStorage.setItem(LAST_PRESET_KEY, preset.id); } catch {}
  showToast(`已保存「${label}」`);
}

function deleteCurrentPreset() {
  const index = customPresets.findIndex((preset) => preset.id === presetSelect.value);
  if (index < 0) return;
  const [removed] = customPresets.splice(index, 1);
  saveCustomPresets();
  renderPresetOptions("reveal");
  applyPreset("reveal", false);
  showToast(`已删除「${removed.label}」`);
}

function setMode(mode) {
  const modes = {
    relief: { x: 1, y: 0, z: 0 },
    wave: { x: 0, y: 1, z: 0 },
    dust: { x: 0, y: 0, z: 1 },
  };
  if (!modes[mode]) return;

  document.querySelectorAll(".mode-button").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  gsap.to(uniforms.uModes.value, {
    ...modes[mode],
    duration: reducedMotion ? 0.01 : 0.8,
    ease: "power2.inOut",
  });
  markPresetManual();
}

function toggleParameters(force) {
  panelOpen = typeof force === "boolean" ? force : !panelOpen;
  if (!panelOpen && parameterPanel.contains(document.activeElement)) tuneButton.focus();
  app.classList.toggle("parameters-open", panelOpen);
  tuneButton.classList.toggle("active", panelOpen);
  tuneButton.setAttribute("aria-expanded", String(panelOpen));
  parameterPanel.classList.toggle("open", panelOpen);
  parameterPanel.setAttribute("aria-hidden", String(!panelOpen));
  parameterPanel.inert = !panelOpen;
  if (panelOpen && !reducedMotion) gsap.fromTo(parameterPanel, { opacity: 0 }, { opacity: 1, duration: 0.2 });
}

function toggleScatter() {
  scattered = !scattered;
  scatterButton.classList.toggle("active", scattered);
  scatterButton.setAttribute("aria-pressed", String(scattered));
  scatterButton.setAttribute("aria-label", scattered ? "聚合粒子" : "散开粒子");
  scatterButton.querySelector("span").textContent = scattered ? "聚合" : "散开";
  gsap.to(uniforms.uScatter, {
    value: scattered ? 1 : 0,
    duration: reducedMotion ? 0.01 : scattered ? 1.15 : 0.9,
    ease: scattered ? "power2.out" : "power3.inOut",
  });
}

function replacePauseIcon() {
  pauseButton.innerHTML = `<i data-lucide="${paused ? "play" : "pause"}" aria-hidden="true"></i><span>${paused ? "继续" : "暂停"}</span>`;
  createIcons({ icons });
}

function togglePause() {
  paused = !paused;
  pauseButton.classList.toggle("active", paused);
  pauseButton.setAttribute("aria-pressed", String(paused));
  pauseButton.setAttribute("aria-label", paused ? "继续动画" : "暂停动画");
  replacePauseIcon();
}

function setCaptureMode(active) {
  captureMode = active;
  if (active && panelOpen) toggleParameters(false);
  app.classList.toggle("capture-mode", active);
  captureActions.inert = !active;
  captureActions.setAttribute("aria-hidden", String(!active));
  captureButton.setAttribute("aria-pressed", String(active));
  requestAnimationFrame(() => {
    resize();
    resetView(false);
    (active ? exportButton : captureButton).focus();
  });
}

function exportName() {
  const source = sourceName.textContent.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "") || "image";
  const preset = presetSelect.options[presetSelect.selectedIndex]?.textContent.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-") || "custom";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `prism-${source}-${preset}-${stamp}.png`;
}

async function exportPng() {
  if (exporting) return;
  exporting = true;
  exportButton.disabled = true;
  exportButton.querySelector("span").textContent = "正在显影";
  const rect = stage.getBoundingClientRect();
  const exportScale = Math.min(2, 4096 / Math.max(rect.width, rect.height));
  const originalPixelRatio = renderer.getPixelRatio();
  const originalZoom = camera.position.z;
  try {
    renderer.setPixelRatio(exportScale);
    renderer.setSize(rect.width, rect.height, false);
    composer.setPixelRatio(exportScale);
    composer.setSize(rect.width, rect.height);
    uniforms.uPixelRatio.value = exportScale;
    camera.position.z = zoomTarget;
    composer.render();
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("无法读取导出画面")), "image/png"));
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`已导出 ${(blob.size / 1024 / 1024).toFixed(1)} MB · ${Math.round(rect.width * exportScale)} × ${Math.round(rect.height * exportScale)}`);
  } catch (error) {
    showToast(error.message || "导出失败，请重试");
  } finally {
    renderer.setPixelRatio(originalPixelRatio);
    composer.setPixelRatio(originalPixelRatio);
    resize();
    camera.position.z = originalZoom;
    exportButton.disabled = false;
    exportButton.querySelector("span").textContent = "导出 2× PNG";
    exporting = false;
  }
}

function resetView(showMessage = true) {
  rotationTarget = { x: -0.04, y: 0.02 };
  zoomTarget = fittedZoom;
  publishViewState();
  gsap.set(canvasHint, { clearProps: "opacity,visibility" });
  if (showMessage) showToast("视角已复位");
}

function publishViewState() {
  canvas.dataset.rotationX = rotationTarget.x.toFixed(3);
  canvas.dataset.rotationY = rotationTarget.y.toFixed(3);
  canvas.dataset.cameraDistance = zoomTarget.toFixed(3);
}

function updateRange(range, output, value, min, max) {
  output.textContent = Number(value).toFixed(2);
  range.style.setProperty("--fill", `${((value - min) / (max - min)) * 100}%`);
}

function onPointerDown(event) {
  if (event.target.closest("button, input, .parameter-panel, .control-dock, .source-chip")) return;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activePointers.size === 2) {
    const [first, second] = [...activePointers.values()];
    pinchStartDistance = Math.hypot(second.x - first.x, second.y - first.y);
    pinchStartZoom = zoomTarget;
  }
  dragActive = true;
  dragMoved = false;
  lastPointer = { x: event.clientX, y: event.clientY };
  try { canvas.setPointerCapture?.(event.pointerId); } catch {}
}

function onPointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1),
  );
  if (!dragActive) return;
  if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activePointers.size >= 2) {
    const [first, second] = [...activePointers.values()];
    const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
    zoomTarget = THREE.MathUtils.clamp(pinchStartZoom * (pinchStartDistance / distance), fittedZoom * 0.55, fittedZoom * 1.8);
    publishViewState();
    dragMoved = true;
    return;
  }

  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;
  rotationTarget.y += dx * 0.0064;
  rotationTarget.x += dy * 0.0048;
  rotationTarget.x = THREE.MathUtils.clamp(rotationTarget.x, -1.0, 1.0);
  lastPointer = { x: event.clientX, y: event.clientY };

  if (Math.abs(dx) + Math.abs(dy) > 2) {
    dragMoved = true;
    gsap.to(canvasHint, { autoAlpha: 0, duration: 0.25 });
  }
}

function onPointerUp(event) {
  activePointers.delete(event.pointerId);
  dragActive = false;
  if (activePointers.size === 1) {
    const remaining = [...activePointers.values()][0];
    lastPointer = { ...remaining };
    dragActive = true;
  }
  if (activePointers.size < 2) pinchStartDistance = 0;
  if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

function onWheel(event) {
  event.preventDefault();
  zoomTarget = THREE.MathUtils.clamp(zoomTarget + event.deltaY * fittedZoom * 0.0003, fittedZoom * 0.55, fittedZoom * 1.8);
  publishViewState();
}

function resize() {
  const rect = stage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const pixelRatio = Math.min(devicePixelRatio, isMobile() ? 1.25 : 1.6);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(rect.width, rect.height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const previousFit = fittedZoom;
  fittedZoom = Math.max(worldSize.height / (2 * halfFov), worldSize.width / (2 * halfFov * camera.aspect)) * 1.2 + 0.9;
  zoomTarget = fittedZoom * (zoomTarget / previousFit);
  camera.position.z = zoomTarget;
  uniforms.uPixelRatio.value = pixelRatio;
  bloom.strength = isMobile() ? 0.34 : 0.48;
}

function playIntro() {
  if (reducedMotion) return;
  gsap.from(".identity, .hero h1, .hero p, .primary-button, .control-dock, .source-chip", {
    opacity: 0, y: 6, stagger: 0.05, duration: 0.6, ease: "power2.out", clearProps: "transform,opacity",
  });
}

[chooseButton, replaceButton].forEach((button) => button.addEventListener("click", openFilePicker));
fileInput.addEventListener("change", () => handleFile(fileInput.files?.[0]));
resetButton.addEventListener("click", () => resetView());
tuneButton.addEventListener("click", () => toggleParameters());
scatterButton.addEventListener("click", toggleScatter);
pauseButton.addEventListener("click", togglePause);
captureButton.addEventListener("click", () => setCaptureMode(true));
captureExit.addEventListener("click", () => setCaptureMode(false));
exportButton.addEventListener("click", exportPng);

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

presetSelect.addEventListener("change", () => applyPreset(presetSelect.value));
savePresetButton.addEventListener("click", openPresetDialog);
deletePresetButton.addEventListener("click", deleteCurrentPreset);
presetCancel.addEventListener("click", () => presetDialog.close("cancel"));
presetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCurrentPreset(presetName.value);
  presetDialog.close("save");
});
presetDialog.addEventListener("click", (event) => {
  if (event.target === presetDialog) presetDialog.close("cancel");
});

depthRange.addEventListener("input", () => {
  const value = Number(depthRange.value);
  updateRange(depthRange, depthOutput, value, 0, 2);
  gsap.to(uniforms.uDepth, { value, duration: 0.24, ease: "power1.out" });
  markPresetManual();
});

motionRange.addEventListener("input", () => {
  const value = Number(motionRange.value);
  updateRange(motionRange, motionOutput, value, 0, 1);
  gsap.to(uniforms.uMotion, { value, duration: 0.24, ease: "power1.out" });
  markPresetManual();
});

sizeRange.addEventListener("input", () => {
  const value = Number(sizeRange.value);
  updateRange(sizeRange, sizeOutput, value, 0.55, 1.8);
  gsap.to(uniforms.uPointSize, { value, duration: 0.24, ease: "power1.out" });
  markPresetManual();
});

stage.addEventListener("pointerdown", onPointerDown);
stage.addEventListener("pointermove", onPointerMove);
stage.addEventListener("pointerup", onPointerUp);
stage.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener("wheel", onWheel, { passive: false });

document.addEventListener("pointerdown", (event) => {
  if (panelOpen && !parameterPanel.contains(event.target) && !tuneButton.contains(event.target)) toggleParameters(false);
});

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
});

window.addEventListener("dragenter", (event) => {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
  dragDepth += 1;
  app.classList.add("drag-active");
});

window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) app.classList.remove("drag-active");
});

window.addEventListener("drop", (event) => {
  dragDepth = 0;
  app.classList.remove("drag-active");
  handleFile(event.dataTransfer?.files?.[0]);
});

window.addEventListener("paste", (event) => {
  if (event.target instanceof Element && event.target.matches("input, textarea, [contenteditable='true']")) return;
  const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.kind === "file" && item.type.startsWith("image/"));
  const file = imageItem?.getAsFile();
  if (!file) return;
  event.preventDefault();
  handleFile(new File([file], file.name || `clipboard-${Date.now()}.png`, { type: file.type }));
});

window.addEventListener("keydown", (event) => {
  if (presetDialog.open) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
    event.preventDefault();
    openFilePicker();
  }
  if (event.key === "Escape") {
    if (captureMode) setCaptureMode(false);
    else if (panelOpen) toggleParameters(false);
    else resetView();
  }
  if (event.target === canvas && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "ArrowLeft") rotationTarget.y -= 0.12;
    if (event.key === "ArrowRight") rotationTarget.y += 0.12;
    if (event.key === "ArrowUp") rotationTarget.x = Math.max(-1, rotationTarget.x - 0.12);
    if (event.key === "ArrowDown") rotationTarget.x = Math.min(1, rotationTarget.x + 0.12);
    publishViewState();
  }
  if (event.code === "Space" && !event.repeat && !event.target.closest("button, input, select, textarea, a, [contenteditable='true']")) {
    event.preventDefault();
    togglePause();
  }
});

window.addEventListener("resize", resize);
new ResizeObserver(resize).observe(stage);

updateRange(depthRange, depthOutput, Number(depthRange.value), 0, 2);
updateRange(motionRange, motionOutput, Number(motionRange.value), 0, 1);
updateRange(sizeRange, sizeOutput, Number(sizeRange.value), 0.55, 1.8);
renderPresetOptions(localStorage.getItem(LAST_PRESET_KEY) || "reveal");
applyPreset(presetSelect.value === "manual" ? "reveal" : presetSelect.value, false);
resize();
playIntro();

loadImage("/flower-signal.png")
  .then((image) => buildParticles(image, "Flower signal"))
  .catch((error) => showToast(error.message));

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, 0.05);
  const transitionDelta = Math.min(rawDelta, 0.22);
  if (!paused) elapsed += delta * (reducedMotion ? 0.08 : 1);

  uniforms.uTime.value = elapsed;
  if (uniforms.uReveal.value < 1) {
    const revealProgress = reducedMotion ? 1 : Math.min(1, (performance.now() - revealStartedAt) / 1250);
    uniforms.uReveal.value = 1 - Math.pow(1 - revealProgress, 3);
  }
  particleRoot.position.y = THREE.MathUtils.damp(particleRoot.position.y, rootYTarget, 3.4, transitionDelta);
  particleRoot.rotation.x = THREE.MathUtils.damp(particleRoot.rotation.x, rotationTarget.x, 5, transitionDelta);
  particleRoot.rotation.y = THREE.MathUtils.damp(particleRoot.rotation.y, rotationTarget.y, 5, transitionDelta);

  if (!paused && !dragActive) {
    const idleTilt = Math.sin(elapsed * 0.2) * 0.022;
    particleRoot.rotation.z = THREE.MathUtils.damp(particleRoot.rotation.z, idleTilt, 1.5, delta);
  }

  camera.position.z = THREE.MathUtils.damp(camera.position.z, zoomTarget, 4, transitionDelta);
  camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 0.045, 2, transitionDelta);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, pointer.y * 0.028, 2, transitionDelta);
  camera.lookAt(0, 0, 0);
  composer.render();
}

animate();
