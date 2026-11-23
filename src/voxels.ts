// VoxelGraft：ボクセルの表（疎な座標の表）と、操作、重ね合わせ。どれも純粋（新しい表を返す）
import type { Op, Vec3 } from "./dsl.ts";

export type VoxelMap = Map<string, string>; // "x,y,z" → 材質名

export const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`;
export const coordsOf = (key: string): Vec3 => key.split(",").map(Number) as Vec3;

// from と to を両端に含む箱の、すべての座標を順に渡す
const eachInBox = (from: Vec3, to: Vec3, f: (x: number, y: number, z: number) => void): void => {
  const lo = from.map((n, i) => Math.min(n, to[i]));
  const hi = from.map((n, i) => Math.max(n, to[i]));
  for (let x = lo[0]; x <= hi[0]; x++) {
    for (let y = lo[1]; y <= hi[1]; y++) {
      for (let z = lo[2]; z <= hi[2]; z++) f(x, y, z);
    }
  }
};

// 操作を上から順に当てる
export const applyOps = (ops: readonly Op[]): VoxelMap => {
  const voxels: VoxelMap = new Map();
  for (const op of ops) {
    if ("fill" in op) {
      const { from, to, material } = op.fill;
      eachInBox(from, to, (x, y, z) => voxels.set(keyOf(x, y, z), material));
    } else {
      eachInBox(op.remove.from, op.remove.to, (x, y, z) => voxels.delete(keyOf(x, y, z)));
    }
  }
  return voxels;
};

// 表を順に重ねる。後の表が上書きする
export const overlay = (maps: readonly VoxelMap[]): VoxelMap => {
  const out: VoxelMap = new Map();
  for (const m of maps) for (const [k, v] of m) out.set(k, v);
  return out;
};
