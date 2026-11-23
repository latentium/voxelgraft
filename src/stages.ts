// VoxelGraft：段（build、inspect、export）と、組み立ての Recipe
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Vesicle, annotator } from "./cell/core.ts";
import type { Stage } from "./cell/core.ts";
import type { Recipe } from "./cell/ext_stock.ts";
import type { AssetDsl } from "./dsl.ts";
import { SIG_ASSET, cargoOf } from "./cargo.ts";
import type { AssetCargo, BlueprintCargo, PartCargo } from "./cargo.ts";
import { applyOps, coordsOf, overlay } from "./voxels.ts";
import { renderHtml } from "./html.ts";
import { encodeVox } from "./vox.ts";
import { renderThreeHtml } from "./three.ts";

// 段から外へ知らせる記録（世界の動きには影響しない）。
// 管は段の例外の理由を捨てるので、検査の問題の文は、ここに書く
export interface Report {
  problems: Map<string, string[]>; // Part の名 → 検査で見つかった問題
  outputs: string[]; // 書き出したファイル
}

// 荷札はそのまま、cargo だけ替えた vesicle
const withCargo = (v: Vesicle, cargo: unknown): Vesicle =>
  new Vesicle({ annotation: v.envelope.annotation, cargo });

// ---- 段 build：Part の操作を当てて、ボクセルの表にする ----
export const buildStage: Stage = (v) => {
  const c = cargoOf(v);
  if (c.kind !== "part") return v;
  const built: PartCargo = { ...c, voxels: applyOps(c.ops) };
  return withCargo(v, built);
};

// ---- 段 inspect：assembly.inspect の検査。落ちたら例外を投げる（管が廃棄し、C に error を書く）----
export const makeInspectStage = (dsl: AssetDsl, report: Report): Stage => (v) => {
  const c = cargoOf(v);
  if (c.kind !== "part" || !c.voxels) return v;
  const problems: string[] = [];
  const [sx, sy, sz] = dsl.asset.size;
  if (dsl.assembly.inspect.includes("bounds")) {
    const outside = [...c.voxels.keys()].filter((k) => {
      const [x, y, z] = coordsOf(k);
      return x >= sx || y >= sy || z >= sz;
    });
    if (outside.length > 0) {
      problems.push(`bounds: ${outside.length} 個が asset.size [${sx}, ${sy}, ${sz}] の外（例: ${outside[0]}）`);
    }
  }
  if (dsl.assembly.inspect.includes("palette")) {
    const unknown = [...new Set(c.voxels.values())].filter((m) => !(m in dsl.asset.palette));
    if (unknown.length > 0) problems.push(`palette: asset.palette に無い材質 ${unknown.join(", ")}`);
  }
  if (problems.length > 0) {
    report.problems.set(c.name, problems);
    throw new Error(problems.join(" / "));
  }
  return v;
};

// ---- 段 export：組み立てたアセットを、assembly.export の形で書き出す ----
export const makeExportStage = (dsl: AssetDsl, outDir: string, report: Report): Stage => (v) => {
  const c = cargoOf(v);
  if (c.kind !== "asset") return v;
  const kinds = dsl.assembly.export;
  if (kinds.length === 0) return v;
  mkdirSync(outDir, { recursive: true });
  const base = join(outDir, c.name.replace(/[\/\\:*?"<>|]/g, "_"));
  const write = (file: string, data: string | Uint8Array): void => {
    writeFileSync(file, data);
    report.outputs.push(file);
  };
  if (kinds.includes("html")) write(`${base}.html`, renderHtml(c, dsl.asset.palette));
  if (kinds.includes("vox") || kinds.includes("three")) {
    const vox = encodeVox(c, dsl.asset.palette);
    if (kinds.includes("vox")) write(`${base}.vox`, vox);
    if (kinds.includes("three")) write(`${base}.three.html`, renderThreeHtml(c, vox));
  }
  return v;
};

// ---- 組み立て：設計図の needs の順に Part を重ねる（後の Part が上書き）。荷札は合流の世代 ----
export const assetRecipe: Recipe = {
  needs: (v) => {
    const c = cargoOf(v);
    return c.kind === "blueprint" ? c.needs : undefined;
  },
  partNo: (v) => {
    const c = cargoOf(v);
    return c.kind === "part" ? c.name : undefined;
  },
  assemble: (blueprint, parts) => {
    const bp = cargoOf(blueprint) as BlueprintCargo;
    const built = parts.map((p) => cargoOf(p) as PartCargo);
    const maps = built.map((p) => p.voxels ?? new Map<string, string>());
    const cargo: AssetCargo = {
      kind: "asset",
      name: bp.name,
      size: bp.size,
      voxels: overlay(maps),
      partVoxels: Object.fromEntries(built.map((p, i) => [p.name, maps[i].size])),
    };
    const product = new Vesicle({
      annotation: { ontogeny: [], phylogeny: [], window: { signature: SIG_ASSET } },
      cargo,
    });
    annotator.mergeGenerations([blueprint, ...parts], product);
    return product;
  },
};
