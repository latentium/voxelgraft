// X9：二つの HTML の data を比べる（名、大きさ、ボクセルの集まり、Part ごとの数）
// 使い方：compare.ts ORIGINAL.html RESTORED.html
import { readData, type Data } from "./data.ts";

const cellsOf = (d: Data) =>
  new Map(d.voxels.map(([x, y, z, c]) => [`${x},${y},${z}`, d.materials[c]]));

const [pa, pb] = process.argv.slice(2);
if (!pa || !pb) {
  console.error("usage: compare.ts ORIGINAL.html RESTORED.html");
  process.exit(2);
}
const a = readData(pa), b = readData(pb);
const ca = cellsOf(a), cb = cellsOf(b);
let onlyA = 0, onlyB = 0, materialDiff = 0;
for (const [k, m] of ca) {
  if (!cb.has(k)) onlyA++;
  else if (cb.get(k) !== m) materialDiff++;
}
for (const k of cb.keys()) if (!ca.has(k)) onlyB++;
const same = onlyA === 0 && onlyB === 0 && materialDiff === 0;
console.log(JSON.stringify({
  original: pa,
  restored: pb,
  name: a.name === b.name,
  size: a.size.join() === b.size.join(),
  voxels: { original: ca.size, restored: cb.size, same, onlyOriginal: onlyA, onlyRestored: onlyB, materialDiff },
  partVoxels: { original: a.partVoxels, restored: b.partVoxels },
}));
process.exit(same ? 0 : 1);
