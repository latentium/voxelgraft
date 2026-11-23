// VoxelGraft：MagicaVoxel の .vox（版 150）への書き出し。MAIN の下に SIZE、XYZI、RGBA だけを置く
// 軸：VoxelGraft は y が上・正面が z の大きい側。.vox は z が上。
//   Three.js の VOXLoader は .vox の (x, y, z) を (x, z, -y) に写すため、
//   VoxelGraft の (x, y, z) を .vox の (x, sz-1-z, y) に置くと、Three.js の上で元の向きに戻る
import type { AssetCargo } from "./cargo.ts";
import { coordsOf } from "./voxels.ts";

const FALLBACK_COLOR = "#ff00ff"; // パレットに無い材質（html.ts と同じ）
export const MAX_VOX_COLORS = 255;

const ascii = (s: string): Uint8Array => Uint8Array.from(s, (ch) => ch.charCodeAt(0));

const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

// チャンク：id（4 バイト）、中身の長さ、子の長さ（いずれも little endian の 4 バイト）、中身、子
const chunk = (id: string, content: Uint8Array, children: Uint8Array = new Uint8Array(0)): Uint8Array => {
  const head = new Uint8Array(12);
  head.set(ascii(id), 0);
  const view = new DataView(head.buffer);
  view.setUint32(4, content.length, true);
  view.setUint32(8, children.length, true);
  return concat([head, content, children]);
};

export const encodeVox = (asset: AssetCargo, palette: Record<string, string>): Uint8Array => {
  const [sx, sy, sz] = asset.size;
  const materials = [...new Set(asset.voxels.values())].sort();
  if (materials.length > MAX_VOX_COLORS) {
    throw new Error(`vox: 材質が ${materials.length} 種（上限 ${MAX_VOX_COLORS}）`);
  }
  const index = new Map(materials.map((m, i) => [m, i + 1])); // 色の番号は 1 から（0 は空）

  const size = new Uint8Array(12);
  const sv = new DataView(size.buffer);
  sv.setInt32(0, sx, true);
  sv.setInt32(4, sz, true); // .vox の y ← VoxelGraft の z
  sv.setInt32(8, sy, true); // .vox の z（上）← VoxelGraft の y

  const xyzi = new Uint8Array(4 + 4 * asset.voxels.size);
  new DataView(xyzi.buffer).setInt32(0, asset.voxels.size, true);
  let p = 4;
  for (const [k, m] of asset.voxels) {
    const [x, y, z] = coordsOf(k);
    if (x >= sx || y >= sy || z >= sz) throw new Error(`vox: asset.size の外のボクセル ${k}`);
    xyzi.set([x, sz - 1 - z, y, index.get(m)!], p);
    p += 4;
  }

  const rgba = new Uint8Array(256 * 4); // 項目 i が色の番号 i + 1
  materials.forEach((m, i) => {
    const n = parseInt((palette[m] ?? FALLBACK_COLOR).slice(1), 16);
    rgba.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
  });

  const header = new Uint8Array(8);
  header.set(ascii("VOX "), 0);
  new DataView(header.buffer).setInt32(4, 150, true);
  const children = concat([chunk("SIZE", size), chunk("XYZI", xyzi), chunk("RGBA", rgba)]);
  return concat([header, chunk("MAIN", new Uint8Array(0), children)]);
};
