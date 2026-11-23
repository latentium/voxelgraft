// VoxelGraft：人間が見るための HTML（1ファイル。描く処理も中に持つ。X6 で比べるまでの仮の形）
// 斜め上から見た図を canvas に描く。y が上。ボタンで縦の軸のまわりに 90 度ずつ回す（見るだけ）
import type { AssetCargo } from "./cargo.ts";
import { coordsOf } from "./voxels.ts";

const FALLBACK_COLOR = "#ff00ff"; // パレットに無い材質

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (s: string): string => s.replace(/[&<>"]/g, (ch) => ESCAPES[ch] ?? ch);

export const renderHtml = (asset: AssetCargo, palette: Record<string, string>): string => {
  const materials = [...new Set(asset.voxels.values())].sort();
  const index = new Map(materials.map((m, i) => [m, i]));
  const data = JSON.stringify({
    name: asset.name,
    size: asset.size,
    materials,
    colors: materials.map((m) => palette[m] ?? FALLBACK_COLOR),
    voxels: [...asset.voxels].map(([k, m]) => [...coordsOf(k), index.get(m)]),
    partVoxels: asset.partVoxels,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(asset.name)} - VoxelGraft</title>
<style>
  body { font-family: sans-serif; margin: 16px; background: #f4f4f4; color: #222; }
  canvas { background: #fff; border: 1px solid #ccc; display: block; margin: 8px 0; }
  table { border-collapse: collapse; display: inline-table; margin-right: 16px; vertical-align: top; }
  td, th { border: 1px solid #ccc; padding: 2px 8px; }
</style>
</head>
<body>
<h1 id="title"></h1>
<div><button id="left">← 回す</button> <button id="right">回す →</button> <span id="info"></span></div>
<canvas id="view" width="720" height="540"></canvas>
<table id="materials"><tr><th>材質</th><th>色</th></tr></table>
<table id="parts"><tr><th>Part</th><th>ボクセル</th></tr></table>
<script>
const data = ${data};
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
let turn = 0;

document.getElementById("title").textContent = data.name;
document.getElementById("info").textContent =
  "ボクセル " + data.voxels.length + " 個 / 大きさ " + data.size.join(" × ");
const row = (table, cells, color) => {
  const tr = document.createElement("tr");
  cells.forEach((text, i) => {
    const td = document.createElement("td");
    td.textContent = text;
    if (color && i === 1) td.style.background = color;
    tr.append(td);
  });
  document.getElementById(table).append(tr);
};
data.materials.forEach((m, i) => row("materials", [m, data.colors[i]], data.colors[i]));
Object.entries(data.partVoxels).forEach(([name, n]) => row("parts", [name, String(n)]));

// 縦の軸のまわりに 90 度ずつ回す
const rotate = (x, y, z) => {
  const sx = data.size[0], sz = data.size[2];
  if (turn === 1) return [sz - 1 - z, y, x];
  if (turn === 2) return [sx - 1 - x, y, sz - 1 - z];
  if (turn === 3) return [z, y, sx - 1 - x];
  return [x, y, z];
};

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return "rgb(" + c.join(",") + ")";
};

const draw = () => {
  const cubes = data.voxels.map((v) => {
    const p = rotate(v[0], v[1], v[2]);
    return { x: p[0], y: p[1], z: p[2], c: v[3] };
  });
  const filled = new Set(cubes.map((q) => q.x + "," + q.y + "," + q.z));
  const has = (x, y, z) => filled.has(x + "," + y + "," + z);
  cubes.sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z) || a.y - b.y); // 遠いものから描く

  const C = Math.cos(Math.PI / 6);
  const proj = (x, y, z) => [(x - z) * C, (x + z) * 0.5 - y];
  const SX = turn % 2 ? data.size[2] : data.size[0];
  const SY = data.size[1];
  const SZ = turn % 2 ? data.size[0] : data.size[2];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  [0, SX].forEach((x) => [0, SY].forEach((y) => [0, SZ].forEach((z) => {
    const p = proj(x, y, z);
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  })));
  const scale = Math.min((canvas.width - 40) / (maxX - minX), (canvas.height - 40) / (maxY - minY));
  const ox = (canvas.width - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (canvas.height - (maxY - minY) * scale) / 2 - minY * scale;
  const P = (x, y, z) => {
    const p = proj(x, y, z);
    return [ox + p[0] * scale, oy + p[1] * scale];
  };
  const face = (pts, color) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.stroke();
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const q of cubes) {
    const col = data.colors[q.c];
    const x = q.x, y = q.y, z = q.z;
    if (!has(x, y + 1, z)) face([P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], shade(col, 1));
    if (!has(x + 1, y, z)) face([P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z + 1)], shade(col, 0.8));
    if (!has(x, y, z + 1)) face([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], shade(col, 0.6));
  }
};

document.getElementById("left").onclick = () => { turn = (turn + 3) % 4; draw(); };
document.getElementById("right").onclick = () => { turn = (turn + 1) % 4; draw(); };
draw();
</script>
</body>
</html>
`;
};
