// X9：HTML から DSL を戻す実験。HTML に埋め込んだ data を取り出す（src/html.ts の形による）
import { readFileSync } from "node:fs";

export type Vec = [number, number, number];
export type Data = {
  name: string;
  size: Vec;
  materials: string[];
  colors: string[];
  voxels: [number, number, number, number][]; // [x, y, z, 材質の番号]
  partVoxels: Record<string, number>;
};

export const readData = (path: string): Data => {
  const html = readFileSync(path, "utf8");
  const m = html.match(/^const data = (.*);$/m);
  if (!m) throw new Error(`data が見つからない: ${path}`);
  return JSON.parse(m[1]) as Data;
};
