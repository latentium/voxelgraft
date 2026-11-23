// VoxelGraft：結果の形（JSON。X3 で比べるまでの仮の形）
import type { Outside, Vesicle, VesicleDisposer } from "./cell/core.ts";
import type { StockOrganelle } from "./cell/ext_stock.ts";
import type { AssetDsl, DslError, ParseResult, Vec3 } from "./dsl.ts";
import { cargoOf } from "./cargo.ts";
import type { AssetCargo, PartCargo } from "./cargo.ts";
import type { Report } from "./stages.ts";

export type Status =
  | "ok"
  | "dsl_error"
  | "inspect_failed"
  | "incomplete"
  | "export_failed"
  | "timeout"
  | "usage_error";

export interface PartResult {
  name: string;
  status: "assembled" | "failed" | "held";
  voxels?: number;
  problems?: string[];
  route?: string; // 落ちた Part の C
}

export interface Result {
  command: string;
  file: string | null;
  status: Status;
  errors: DslError[];
  parts: PartResult[];
  asset: { name: string; size: Vec3; voxels: number } | null;
  outputs: string[];
}

export interface BuiltWorld {
  outside: Outside;
  disposer: VesicleDisposer;
  stock: StockOrganelle;
  report: Report;
}

export const exitCodeOf = (s: Status): number => (s === "ok" ? 0 : s === "usage_error" ? 2 : 1);

const base = (command: string, file: string | null): Result => ({
  command,
  file,
  status: "ok",
  errors: [],
  parts: [],
  asset: null,
  outputs: [],
});

export const usageResult = (command: string, file: string | null, message: string): Result => ({
  ...base(command, file),
  status: "usage_error",
  errors: [{ path: "$", message }],
});

export const checkResult = (command: string, file: string, parsed: ParseResult): Result =>
  parsed.ok ? base(command, file) : { ...base(command, file), status: "dsl_error", errors: parsed.errors };

const routeOf = (v: Vesicle): string =>
  v.envelope.annotation.ontogeny.map((e) => `${e.kind}:${e.canalId}`).join(" → ");

const assetIn = (vs: readonly Vesicle[]): AssetCargo | undefined =>
  vs.map(cargoOf).find((c): c is AssetCargo => c.kind === "asset");

export const buildResult = (file: string, dsl: AssetDsl, w: BuiltWorld, finished: boolean): Result => {
  const delivered = assetIn(w.outside.received);
  const discarded = assetIn(w.disposer.retained); // 書き出しに失敗したアセット
  const assembled = delivered ?? discarded;

  const failed = new Map<string, Vesicle>();
  for (const v of w.disposer.retained) {
    const c = cargoOf(v);
    if (c.kind === "part") failed.set(c.name, v);
  }
  const held = new Map<string, PartCargo>();
  for (const v of w.stock.held()) {
    const c = cargoOf(v);
    if (c.kind === "part") held.set(c.name, c);
  }

  // 並びは asset.parts の順（届いた順には頼らない）
  const parts = dsl.asset.parts.map((name): PartResult => {
    if (assembled && name in assembled.partVoxels) {
      return { name, status: "assembled", voxels: assembled.partVoxels[name] };
    }
    const f = failed.get(name);
    if (f) return { name, status: "failed", problems: w.report.problems.get(name) ?? [], route: routeOf(f) };
    return { name, status: "held", voxels: held.get(name)?.voxels?.size };
  });

  const status: Status = !finished
    ? "timeout"
    : failed.size > 0
      ? "inspect_failed"
      : delivered
        ? "ok"
        : discarded
          ? "export_failed"
          : "incomplete";

  return {
    ...base("build", file),
    status,
    parts,
    asset: delivered ? { name: delivered.name, size: delivered.size, voxels: delivered.voxels.size } : null,
    outputs: w.report.outputs,
  };
};
