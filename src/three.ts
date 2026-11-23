// VoxelGraft：Three.js で .vox を表示する HTML（.vox を中に埋め込む。Three.js は CDN から読むため、ネットへの接続が要る）
import type { AssetCargo } from "./cargo.ts";

export const THREE_VERSION = "0.187.0";
const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (s: string): string => s.replace(/[&<>"]/g, (ch) => ESCAPES[ch] ?? ch);

export const renderThreeHtml = (asset: AssetCargo, vox: Uint8Array): string => {
  const meta = JSON.stringify({ name: asset.name, size: asset.size, voxels: asset.voxels.size })
    .replace(/</g, "\\u003c");
  const b64 = Buffer.from(vox).toString("base64");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(asset.name)} - VoxelGraft（Three.js）</title>
<style>
  body { margin: 0; font-family: sans-serif; background: #f4f4f4; color: #222; }
  #info { position: absolute; top: 8px; left: 12px; }
  canvas { display: block; }
</style>
<script type="importmap">
{ "imports": { "three": "${CDN}/build/three.module.js", "three/addons/": "${CDN}/examples/jsm/" } }
</script>
</head>
<body>
<div id="info">Three.js を CDN から読み込み中（ネットへの接続が要る）</div>
<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as VOX from "three/addons/loaders/VOXLoader.js";

const meta = ${meta};
const info = document.getElementById("info");

// base64 → ファイルのバイトだけを持つ ArrayBuffer
const buffer = Uint8Array.from(atob("${b64}"), (c) => c.charCodeAt(0)).buffer;
const result = new VOX.VOXLoader().parse(buffer);
// 版による違い：{ chunks, scene } を返す版と、chunk の配列を返す版がある
const chunks = result && (Array.isArray(result) ? result : result.chunks);
if (!chunks || !chunks[0]) {
  info.textContent = ".vox を読めなかった";
  throw new Error("vox parse failed");
}
const mesh = VOX.buildMesh ? VOX.buildMesh(chunks[0]) : new VOX.VOXMesh(chunks[0]);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f4f4);
scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(1, 2, 1.5);
scene.add(sun);
scene.add(mesh);

const m = Math.max(...meta.size);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, m / 100, m * 20);
camera.position.set(m * 1.2, m * 0.9, m * 1.8); // 正面（z の大きい側）の斜め上
const controls = new OrbitControls(camera, renderer.domElement);
const render = () => renderer.render(scene, camera);
controls.addEventListener("change", render);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
});
info.textContent = meta.name + " / ボクセル " + meta.voxels + " 個 / 大きさ " + meta.size.join(" × ")
  + "（ドラッグで回す、ホイールで寄る）";
render();
</script>
</body>
</html>
`;
};
