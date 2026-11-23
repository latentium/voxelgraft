// VoxelGraft：DSL から世界（Root Cell ＝ Voxel Engine）を組み、Part と設計図を流し込む。
//   Root Cell（sig-voxelgraft）
//   `-- OrganellePipeline（sig-part）段: build → inspect
//       `-- StockOrganelle（sig-assembly）組み立て。出口の管の段: export
// 段はどれも同期。同じ子は並べない。管の時間切れは事実上なくす（X5 で扱うまでの扱い）。
import { Canal, Cell, Outside, Vesicle, VesicleDisposer } from "./cell/core.ts";
import type { Stage } from "./cell/core.ts";
import { OrganellePipeline } from "./cell/ext_wrappers.ts";
import { StockOrganelle } from "./cell/ext_stock.ts";
import type { AssetDsl } from "./dsl.ts";
import { SIG_ASSEMBLY, SIG_PART, SIG_ROOT } from "./cargo.ts";
import type { BlueprintCargo, PartCargo } from "./cargo.ts";
import { assetRecipe, buildStage, makeExportStage, makeInspectStage } from "./stages.ts";
import type { Report } from "./stages.ts";

const NO_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 事実上の時間切れなし

export const buildWorld = (dsl: AssetDsl, outDir: string) => {
  const report: Report = { problems: new Map(), outputs: [] };
  const disposer = new VesicleDisposer();
  const capacity = dsl.asset.parts.length + 1; // Part と設計図がすべて入る
  const canal = (id: string, stage?: Stage) => new Canal(id, capacity, disposer, 10, NO_TIMEOUT_MS, stage);

  const stock = new StockOrganelle(
    SIG_ASSEMBLY,
    canal("assembly.inlet"),
    canal("assembly.outlet", makeExportStage(dsl, outDir, report)),
    { parts: Object.fromEntries(dsl.asset.parts.map((p) => [p, 1])), blueprints: 1 },
    assetRecipe,
  );
  const pipeline = new OrganellePipeline(SIG_PART, stock, [buildStage, makeInspectStage(dsl, report)], {
    idPrefix: "part",
    capacity,
    disposer,
    timeoutMs: NO_TIMEOUT_MS,
  });
  const root = new Cell(SIG_ROOT, canal("root.inlet"), canal("root.outlet"), [pipeline]);
  const outside = new Outside();
  root.outlet.downstream = outside;

  const pack = (cargo: PartCargo | BlueprintCargo): Vesicle =>
    new Vesicle({ annotation: { ontogeny: [], phylogeny: [], window: { signature: SIG_PART } }, cargo });
  const inputs = [
    pack({ kind: "blueprint", name: dsl.asset.name, size: dsl.asset.size, needs: [...dsl.asset.parts] }),
    ...dsl.asset.parts.map((name) => pack({ kind: "part", name, ops: dsl.parts[name] })),
  ];
  for (const v of inputs) {
    if (root.inlet.canReceive(v)) root.inlet.receive(v);
  }
  return { root, outside, disposer, stock, report };
};
