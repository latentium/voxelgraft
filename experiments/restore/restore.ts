// X9：HTML → DSL。形 a（1 個ずつ）と形 b（材質ごとに箱へまとめる）を書き出す
// 使い方：restore.ts HTML OUT_PREFIX → OUT_PREFIX.a.json、OUT_PREFIX.b.json
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { readData, type Vec } from "./data.ts";

type Op = { fill: { from: Vec; to: Vec; material: string } };

// 同じ材質のマスの集まりを、x → y → z の順に伸ばした箱で覆う（欲張り法。最小とは限らない）
const toBoxes = (cells: Vec[]): [Vec, Vec][] => {
  const left = new Set(cells.map((c) => c.join(",")));
  const has = (x: number, y: number, z: number) => left.has(`${x},${y},${z}`);
  const sorted = [...cells].sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const boxes: [Vec, Vec][] = [];
  for (const [x0, y0, z0] of sorted) {
    if (!has(x0, y0, z0)) continue;
    let x1 = x0;
    while (has(x1 + 1, y0, z0)) x1++;
    const rowFull = (y: number, z: number) => {
      for (let x = x0; x <= x1; x++) if (!has(x, y, z)) return false;
      return true;
    };
    let y1 = y0;
    while (rowFull(y1 + 1, z0)) y1++;
    const slabFull = (z: number) => {
      for (let y = y0; y <= y1; y++) if (!rowFull(y, z)) return false;
      return true;
    };
    let z1 = z0;
    while (slabFull(z1 + 1)) z1++;
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) left.delete(`${x},${y},${z}`);
    boxes.push([[x0, y0, z0], [x1, y1, z1]]);
  }
  return boxes;
};

const [htmlPath, prefix] = process.argv.slice(2);
if (!htmlPath || !prefix) {
  console.error("usage: restore.ts HTML OUT_PREFIX");
  process.exit(2);
}
const data = readData(htmlPath);
const palette = Object.fromEntries(data.materials.map((m, i) => [m, data.colors[i]]));
const assembly = { inspect: ["bounds", "palette"], export: ["html"] }; // HTML に無いので仮定
const dsl = (parts: Record<string, Op[]>) => ({
  asset: { name: data.name, size: data.size, palette, parts: Object.keys(parts) },
  parts,
  assembly,
});

// 形 a：Part 一つ、1 個ずつ
const formA = dsl({
  all: data.voxels.map(([x, y, z, c]) => ({
    fill: { from: [x, y, z] as Vec, to: [x, y, z] as Vec, material: data.materials[c] },
  })),
});

// 形 b：材質ごとに Part を分け、箱にまとめる
const byMaterial = new Map<number, Vec[]>();
for (const [x, y, z, c] of data.voxels) {
  if (!byMaterial.has(c)) byMaterial.set(c, []);
  byMaterial.get(c)!.push([x, y, z]);
}
const formB = dsl(Object.fromEntries(
  [...byMaterial].map(([c, cells]) => [
    data.materials[c],
    toBoxes(cells).map(([from, to]) => ({ fill: { from, to, material: data.materials[c] } })),
  ]),
));

mkdirSync(dirname(prefix), { recursive: true });
writeFileSync(`${prefix}.a.json`, JSON.stringify(formA) + "\n");
writeFileSync(`${prefix}.b.json`, JSON.stringify(formB, null, 1) + "\n");
console.log(JSON.stringify({ html: htmlPath, voxels: data.voxels.length, outputs: [`${prefix}.a.json`, `${prefix}.b.json`] }));
