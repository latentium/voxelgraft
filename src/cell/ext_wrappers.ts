// セルアーキテクチャの拡張：包み型とパイプライン型
import { Canal, fullMatchSignatureChecker } from "./core.ts";
import type {
  Organelle,
  Signature,
  SignatureChecker,
  Stage,
  VesicleDisposer,
} from "./core.ts";

// ---- 段を持つ部品の共通の設定 ----
export interface StageOptions {
  capacity: number;
  disposer: VesicleDisposer;
  retryIntervalMs?: number;
  timeoutMs?: number;
  signatureChecker?: SignatureChecker; // 親がこの部品を照合するときに使う
}

// ---- 包み型 ----
// 中の部品（targetOrganelle）を、段を持つ入口の管で包む。出口は中の部品と共有する。
// inlet（段で処理）→ targetOrganelle.inlet（内側の管の役）→ targetOrganelle
export class OrganelleDecorator implements Organelle {
  readonly inlet: Canal;
  readonly outlet: Canal;
  readonly signatureChecker: SignatureChecker;

  constructor(
    readonly signature: Signature,
    readonly targetOrganelle: Organelle,
    stage: Stage,
    opts: StageOptions & { inletId: string },
  ) {
    this.inlet = new Canal(
      opts.inletId,
      opts.capacity,
      opts.disposer,
      opts.retryIntervalMs ?? 10,
      opts.timeoutMs ?? 1000,
      stage,
    );
    this.inlet.downstream = targetOrganelle.inlet;
    this.outlet = targetOrganelle.outlet;
    this.signatureChecker = opts.signatureChecker ?? fullMatchSignatureChecker;
  }
}

// ---- パイプライン型 ----
// 段ごとに段を持つ管を作り、順につないで、中の部品（targetOrganelle）の入口の管へつなぐ。出口は中の部品と共有する。
// {idPrefix}.inlet（段1）→ {idPrefix}.stage2（段2）→ … → targetOrganelle.inlet → targetOrganelle
export class OrganellePipeline implements Organelle {
  readonly inlet: Canal;
  readonly outlet: Canal;
  readonly signatureChecker: SignatureChecker;
  readonly canals: Canal[]; // 段を持つ管の並び

  constructor(
    readonly signature: Signature,
    readonly targetOrganelle: Organelle,
    stages: Stage[],
    opts: StageOptions & { idPrefix: string },
  ) {
    if (stages.length === 0) {
      throw new Error("OrganellePipeline には段が一つ以上要る");
    }

    this.canals = stages.map(
      (stage, i) =>
        new Canal(
          i === 0 ? `${opts.idPrefix}.inlet` : `${opts.idPrefix}.stage${i + 1}`,
          opts.capacity,
          opts.disposer,
          opts.retryIntervalMs ?? 10,
          opts.timeoutMs ?? 1000,
          stage,
        ),
    );

    for (let i = 0; i < this.canals.length - 1; i++) {
      this.canals[i].downstream = this.canals[i + 1];
    }
    this.canals[this.canals.length - 1].downstream = targetOrganelle.inlet;

    this.inlet = this.canals[0];
    this.outlet = targetOrganelle.outlet;
    this.signatureChecker = opts.signatureChecker ?? fullMatchSignatureChecker;
  }
}
