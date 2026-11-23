// VoxelGraft：人間が見るための HTML（1ファイル。描く処理も中に持つ。X6 で比べるまでの仮の形）
// 斜め上から見た図と、真正面から見た図（正面・右・背面・左・上・下、六面の並び）を canvas に描く。
// y が上。正面は z の大きい側。ボタンで図を切り替え、斜めの図は縦の軸のまわりに 90 度ずつ回す（見るだけ）
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
<div>
  <button data-mode="iso">斜め</button> <button data-mode="front">正面</button>
  <button data-mode="right">右</button> <button data-mode="back">背面</button>
  <button data-mode="left">左</button> <button data-mode="top">上</button>
  <button data-mode="bottom">下</button> <button data-mode="six">六面</button>
</div>
<div><button id="rotLeft">← 回す</button> <button id="rotRight">回す →</button> <span id="info"></span></div>
<canvas id="view" width="960" height="540"></canvas>
<table id="materials"><tr><th>材質</th><th>色</th></tr></table>
<table id="parts"><tr><th>Part</th><th>ボクセル</th></tr></table>
<script>
const data = ${data};
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
let turn = 0;
let mode = "iso";

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

// ---- 斜め上から見た図 ----
const drawIso = () => {
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
    ctx.strokeStyle = color; // 同じ色の縁で、隣の面とのすき間を埋める
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; // 格子
    ctx.stroke();
  };

  for (const q of cubes) {
    const col = data.colors[q.c];
    const x = q.x, y = q.y, z = q.z;
    if (!has(x, y + 1, z)) face([P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], shade(col, 1));
    if (!has(x + 1, y, z)) face([P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z + 1)], shade(col, 0.8));
    if (!has(x, y, z + 1)) face([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], shade(col, 0.6));
  }
};

// ---- 真正面から見た図 ----
// map は、ボクセルの座標を [横のマス, 上からの行, 奥行き] に写す。奥行きは大きいほど手前
const S = data.size;
const VIEWS = {
  front: { label: "正面", w: S[0], h: S[1], map: (x, y, z) => [x, S[1] - 1 - y, z] },
  right: { label: "右", w: S[2], h: S[1], map: (x, y, z) => [S[2] - 1 - z, S[1] - 1 - y, x] },
  back: { label: "背面", w: S[0], h: S[1], map: (x, y, z) => [S[0] - 1 - x, S[1] - 1 - y, -z] },
  left: { label: "左", w: S[2], h: S[1], map: (x, y, z) => [z, S[1] - 1 - y, -x] },
  top: { label: "上", w: S[0], h: S[2], map: (x, y, z) => [x, z, y] },
  bottom: { label: "下", w: S[0], h: S[2], map: (x, y, z) => [x, S[2] - 1 - z, -y] },
};

// 一つの向きの図を、左上 (left, top) から、一マス cell 画素で描く
const drawOrtho = (name, left, top, cell) => {
  const v = VIEWS[name];
  const front = new Map(); // マスごとに、一番手前のボクセル
  for (const q of data.voxels) {
    const m = v.map(q[0], q[1], q[2]);
    const k = m[0] + "," + m[1];
    const cur = front.get(k);
    if (!cur || m[2] > cur.d) front.set(k, { u: m[0], r: m[1], d: m[2], c: q[3] });
  }
  let dmin = Infinity, dmax = -Infinity;
  front.forEach((p) => { dmin = Math.min(dmin, p.d); dmax = Math.max(dmax, p.d); });
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#dddddd";
  ctx.strokeRect(left + 0.5, top + 0.5, v.w * cell, v.h * cell); // asset.size の枠
  front.forEach((p) => {
    const f = dmax > dmin ? 0.65 + (0.35 * (p.d - dmin)) / (dmax - dmin) : 1; // 手前ほど明るい
    const px = left + p.u * cell, py = top + p.r * cell;
    ctx.fillStyle = shade(data.colors[p.c], f);
    ctx.fillRect(px, py, cell, cell);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
  });
  ctx.fillStyle = "#222222";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(v.label, left + (v.w * cell) / 2, top + v.h * cell + 18);
};

// 図をマス目に並べる。rows は行ごとの図の名前。同じマスの大きさで描き、
// 列ごとの最大の幅、行ごとの最大の高さで枠を取り、枠の中で横は中央、縦は下の端にそろえる
const drawGrid = (rows) => {
  const PAD = 20, LABEL_H = 24, GAP = 2; // GAP はマスの数
  const cols = Math.max.apply(null, rows.map((r) => r.length));
  const colW = [];
  for (let c = 0; c < cols; c++) {
    colW.push(Math.max.apply(null, rows.map((r) => (r[c] ? VIEWS[r[c]].w : 0))));
  }
  const rowH = rows.map((r) => Math.max.apply(null, r.map((k) => VIEWS[k].h)));
  const totalW = colW.reduce((a, b) => a + b, 0) + GAP * (cols - 1);
  const totalH = rowH.reduce((a, b) => a + b, 0) + GAP * (rows.length - 1);
  const cell = Math.max(1, Math.floor(Math.min(
    (canvas.width - PAD * 2) / totalW,
    (canvas.height - PAD * 2 - LABEL_H * rows.length) / totalH,
  )));
  let top = Math.floor((canvas.height - (totalH * cell + LABEL_H * rows.length)) / 2);
  rows.forEach((r, i) => {
    let left = Math.floor((canvas.width - totalW * cell) / 2);
    r.forEach((k, c) => {
      const v = VIEWS[k];
      drawOrtho(k, left + Math.floor(((colW[c] - v.w) * cell) / 2), top + (rowH[i] - v.h) * cell, cell);
      left += (colW[c] + GAP) * cell;
    });
    top += rowH[i] * cell + LABEL_H + GAP * cell;
  });
};

// ---- 切り替え ----
const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (mode === "iso") drawIso();
  else if (mode === "six") drawGrid([["front", "right", "top"], ["back", "left", "bottom"]]);
  else drawGrid([[mode]]);
  document.getElementById("rotLeft").disabled = mode !== "iso";
  document.getElementById("rotRight").disabled = mode !== "iso";
  document.querySelectorAll("[data-mode]").forEach((b) => {
    b.style.fontWeight = b.dataset.mode === mode ? "bold" : "normal";
  });
};

document.querySelectorAll("[data-mode]").forEach((b) => {
  b.onclick = () => { mode = b.dataset.mode; render(); };
});
document.getElementById("rotLeft").onclick = () => { turn = (turn + 3) % 4; render(); };
document.getElementById("rotRight").onclick = () => { turn = (turn + 1) % 4; render(); };
render();
</script>
</body>
</html>
`;
};
