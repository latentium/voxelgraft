// セルアーキテクチャの本体
//   - Organelle（親が子に求める約束）。Cell の子は Organelle
//   - Canal は任意の段（Stage）を持てる。段は、管が送るときに処理する（同期でも非同期でもよい）
//   - 段の処理の失敗は、C に error として記録し、廃棄モジュールへ送る
//   - 包み型 OrganelleDecorator とパイプライン型 OrganellePipeline は ext_wrappers.ts、
//     ストック用の小器官 StockOrganelle と製造の役 Recipe は ext_stock.ts、
//     終わりの検出は ext_completion.ts に置く

// ---- 基本の型 ----
export type Signature = string;

export interface OntogenyEntry {
  kind: "route" | "timeout" | "error";
  canalId: string;
}

// 窓に出す情報（荷札が指定する）。見ても記録されない
export interface AnnotationWindow {
  signature: Signature;
}

// D の一つの世代：一本の世代、合流の世代、分岐の世代
export type Generation = LinearGeneration | MergeGeneration | SplitGeneration;

// 一本の世代（kind は省いてよい）
export interface LinearGeneration {
  kind?: "linear";
  ontogeny: OntogenyEntry[]; // 前の世代の C
  window: AnnotationWindow; // 前の世代の窓の中身
}

// 合流の世代：入力ごとの来歴を枝として持つ
export interface MergeGeneration {
  kind: "merge";
  branches: Lineage[];
}

// 分岐の世代：元の C と窓、何番目か、全部で何個か
export interface SplitGeneration {
  kind: "split";
  ontogeny: OntogenyEntry[]; // 元の C
  window: AnnotationWindow; // 元の窓
  index: number; // 何番目か（0 から）
  count: number; // 全部で何個か
}

// 一つの入力の来歴（その入力の D、C、窓）
export interface Lineage {
  phylogeny: Generation[];
  ontogeny: OntogenyEntry[];
  window: AnnotationWindow;
}

const copyEntries = (entries: OntogenyEntry[]): OntogenyEntry[] => entries.map((e) => ({ ...e }));

const copyLineage = (l: Lineage): Lineage => ({
  phylogeny: l.phylogeny.map(copyGeneration),
  ontogeny: copyEntries(l.ontogeny),
  window: { ...l.window },
});

// 世代を深く写す（3つの種類のどれも）
export function copyGeneration(g: Generation): Generation {
  switch (g.kind) {
    case "merge":
      return { kind: "merge", branches: g.branches.map(copyLineage) };
    case "split":
      return {
        kind: "split",
        ontogeny: copyEntries(g.ontogeny),
        window: { ...g.window },
        index: g.index,
        count: g.count,
      };
    default:
      return { ...g, ontogeny: copyEntries(g.ontogeny), window: { ...g.window } };
  }
}

// vesicle にロジックは書かない
export class Vesicle {
  constructor(
    readonly envelope: {
      annotation: {
        ontogeny: OntogenyEntry[]; // C
        phylogeny: Generation[]; // D（古い世代が先）
        window: AnnotationWindow; // 窓（梱包時に半開封を既定）
      };
      cargo: unknown;
    },
  ) {}
}

// 荷札に触れるのは annotator だけ（構造で守る仕組みは後回し）
export const annotator = {
  recordRoute(v: Vesicle, canal: Canal): void {
    v.envelope.annotation.ontogeny.push({ kind: "route", canalId: canal.id });
  },

  recordTimeout(v: Vesicle, canal: Canal): void {
    v.envelope.annotation.ontogeny.push({ kind: "timeout", canalId: canal.id });
  },

  // 段の処理が失敗したことを記録する
  recordError(v: Vesicle, canal: Canal): void {
    v.envelope.annotation.ontogeny.push({ kind: "error", canalId: canal.id });
  },

  // 窓を見る。記録はしない。写しを返す
  viewWindow(v: Vesicle): AnnotationWindow {
    return { ...v.envelope.annotation.window };
  },

  // 再梱包のときに、世代を交代する。
  // previous の D を next に写し、previous の C と窓の中身を、新しい世代として D に加える。
  // next の C は空から始まる。
  advanceGeneration(previous: Vesicle, next: Vesicle): void {
    for (const g of previous.envelope.annotation.phylogeny) {
      next.envelope.annotation.phylogeny.push(copyGeneration(g));
    }
    next.envelope.annotation.phylogeny.push({
      ontogeny: copyEntries(previous.envelope.annotation.ontogeny),
      window: { ...previous.envelope.annotation.window },
    });
  },

  // 合流のときの世代の交代。
  // inputs のそれぞれの D、C、窓を写して枝にし、合流の世代として next の D に加える。next の C は空から始まる。
  mergeGenerations(inputs: Vesicle[], next: Vesicle): void {
    next.envelope.annotation.phylogeny.push({
      kind: "merge",
      branches: inputs.map((v) => copyLineage(v.envelope.annotation)),
    });
  },

  // 分岐のときの世代の交代。必須ではない（呼ばなければ、分けた先は新規になる）。
  // previous の D を、nexts のそれぞれに写し、previous の C と窓を、分岐の世代として加える。
  // nexts の C は空から始まる。
  splitGenerations(previous: Vesicle, nexts: Vesicle[]): void {
    nexts.forEach((next, index) => {
      for (const g of previous.envelope.annotation.phylogeny) {
        next.envelope.annotation.phylogeny.push(copyGeneration(g));
      }
      next.envelope.annotation.phylogeny.push({
        kind: "split",
        ontogeny: copyEntries(previous.envelope.annotation.ontogeny),
        window: { ...previous.envelope.annotation.window },
        index,
        count: nexts.length,
      });
    });
  },
};

export const schedule = (fn: () => void): void => {
  setTimeout(fn, 0); // 非同期の合図
};

// ---- 共通の口 ----
export interface Receiver {
  canReceive(v: Vesicle): boolean;
  receive(v: Vesicle): void;
}

// ---- 廃棄モジュール（全体で一つ。いつでも受け取る。そのまま保持）----
export class VesicleDisposer implements Receiver {
  readonly retained: Vesicle[] = [];

  canReceive(_v: Vesicle): boolean {
    return true;
  }

  receive(v: Vesicle): void {
    this.retained.push(v);
  }
}

// ---- 段 ----
// vesicle を受け取って vesicle を返す。同期でも非同期でもよい。
// 例外を投げると、処理の失敗として扱う。
export type Stage = (v: Vesicle) => Vesicle | Promise<Vesicle>;

// ---- 管 ----
export class Canal implements Receiver {
  downstream!: Receiver;
  private readonly queue: Vesicle[] = [];
  private sending = false;
  private headProcessed = false; // 先頭の vesicle を、段で処理し終えたか
  private idleWaiters: (() => void)[] = []; // 静まるのを待つ者（whenIdle）

  constructor(
    readonly id: string,
    readonly capacity: number, // 管ごと。初期実装はキューのサイズ
    readonly disposer: VesicleDisposer, // Cell が廃棄するときにも使う
    private readonly retryIntervalMs = 10,
    private readonly timeoutMs = 1000,
    private readonly stage?: Stage, // 任意の段。管が送るときに処理する
  ) {}

  // ---- 状態の確認（読むだけ）----
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  canReceive(_v: Vesicle): boolean {
    return this.queue.length < this.capacity;
  }

  // 送る動きが止まっていて、キューが空か（読むだけ）
  isIdle(): boolean {
    return !this.sending && this.isEmpty();
  }

  // 次に静まったときに解決する。今静まっていれば、すぐ解決する
  whenIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  // キューの使用率（キューの長さ ÷ 容量、0〜1）。容量 0 の管は、いつもいっぱいとみなす
  usage(): number {
    return this.capacity === 0 ? 1 : this.queue.length / this.capacity;
  }

  // ---- 受け取り ----
  receive(v: Vesicle): void {
    this.queue.push(v);
    annotator.recordRoute(v, this); // 入った直後。管そのものを書く
    this.wake();
  }

  // ---- 送る機構 ----
  private wake(): void {
    if (this.sending) return;
    this.sending = true;
    schedule(() => this.send(Date.now()));
  }

  private send(startedAt: number): void {
    if (this.isEmpty()) {
      this.sending = false; // 待機
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      for (const w of waiters) w();
      return;
    }

    // 段があれば、先に処理する。処理した後の vesicle で下流に問い合わせる
    if (this.stage && !this.headProcessed) {
      this.process();
      return;
    }

    const v = this.queue[0];

    if (this.downstream.canReceive(v)) {
      this.queue.shift();
      this.headProcessed = false;
      this.downstream.receive(v);
      schedule(() => this.send(Date.now()));
      return;
    }

    if (Date.now() - startedAt >= this.timeoutMs) {
      this.discard();
      schedule(() => this.send(Date.now()));
      return;
    }

    setTimeout(() => this.send(startedAt), this.retryIntervalMs); // リトライ
  }

  // 先頭の vesicle を段で処理する。処理は一度だけ。
  // 処理を待つ間も vesicle は管の中にあり、容量を占めたままである。
  private process(): void {
    const original = this.queue[0];
    Promise.resolve()
      .then(() => this.stage!(original))
      .then(
        (processed) => {
          this.queue[0] = processed;
          this.headProcessed = true;
          this.send(Date.now()); // 処理の後から、リトライの時間を数える
        },
        () => {
          this.queue.shift();
          this.headProcessed = false;
          annotator.recordError(original, this); // C に error を記録
          this.disposer.receive(original); // 廃棄モジュールへ
          schedule(() => this.send(Date.now()));
        },
      );
  }

  private discard(): void {
    const v = this.queue.shift()!;
    this.headProcessed = false;
    annotator.recordTimeout(v, this); // C に記録
    this.disposer.receive(v);
  }
}

// ---- 読むための形（probe と checker に見せる）----
// 入口の管のうち、状態を読む部分だけ
export interface InletView {
  canReceive(v: Vesicle): boolean;
  usage(): number;
}

// Organelle のうち、読む部分だけ。Organelle は、そのままこの形として扱える
export interface OrganelleView {
  readonly signature: Signature;
  readonly signatureChecker: SignatureChecker;
  readonly inlet: InletView;
}

// ---- 照合 ----
// 小器官ごとに持つ。親は、子の checker に「この vesicle は自分宛てか」を問う
export interface SignatureChecker {
  matches(organelle: OrganelleView, v: Vesicle): boolean;
}

// 完全一致で確かめる（既定）。シグネチャーは annotator を通して窓から見る
export class FullMatchSignatureChecker implements SignatureChecker {
  matches(organelle: OrganelleView, v: Vesicle): boolean {
    return organelle.signature === annotator.viewWindow(v).signature;
  }
}

export const fullMatchSignatureChecker = new FullMatchSignatureChecker();

// ---- 照合に合う子を選ぶ部品 ----
// 親の Cell が持つ。照合は、子それぞれの checker に任せる
// 純粋であること（副作用なし・決定的）を求める。
//   - 副作用なし：世界の状態（管、荷札、probe 自身）を書き換えない。読むだけにする。
//     観察のためのログは、世界の動きに影響しないので許す
//   - 決定的：同じ引数と、同じ世界の状態に対しては、同じ子を返す
//   - 理由：Cell は、1つの vesicle を送るあいだに、canReceive と receive で probe を2回呼ぶ。
//     2回で違う子を選ぶと、確かめた子と送る子がずれる。上流の管のリトライのたびにも呼ばれる
//   - 型：probe には読むための形（OrganelleView）だけを見せ、子の並びも書き換えられないようにする
export interface SignatureProbe {
  probe<T extends OrganelleView>(organelles: readonly T[], v: Vesicle): T | undefined;
}

// 照合に合う子のうち、受け取れる最初の子を選ぶ。
// どれも受け取れなければ、照合に合う最初の子を返す（親はその子が空くまで待つ）。
// 照合に合う子がなければ、undefined を返す（親は出口へ流す）。
export class FirstAvailableSignatureProbe implements SignatureProbe {
  probe<T extends OrganelleView>(organelles: readonly T[], v: Vesicle): T | undefined {
    const matched = organelles.filter((o) => o.signatureChecker.matches(o, v));
    return matched.find((o) => o.inlet.canReceive(v)) ?? matched[0];
  }
}

export const firstAvailableSignatureProbe = new FirstAvailableSignatureProbe();

// 照合に合い、受け取れる子のうち、入口の管の使用率がいちばん低い子を選ぶ。
// 同じ使用率なら、並びの前の子を選ぶ。
// どれも受け取れなければ、照合に合う最初の子を返す（親はその子が空くまで待つ）。
// 照合に合う子がなければ、undefined を返す（親は出口へ流す）。
export class LeastUsedSignatureProbe implements SignatureProbe {
  probe<T extends OrganelleView>(organelles: readonly T[], v: Vesicle): T | undefined {
    const matched = organelles.filter((o) => o.signatureChecker.matches(o, v));
    const available = matched.filter((o) => o.inlet.canReceive(v));
    if (available.length === 0) return matched[0];
    return available.reduce((best, o) => (o.inlet.usage() < best.inlet.usage() ? o : best));
  }
}

export const leastUsedSignatureProbe = new LeastUsedSignatureProbe();

// ---- 親が子に求める約束 ----
// 親が子に対して行うのは、次の四つだけである。
//   - inlet.canReceive と inlet.receive を呼ぶ（子の中へは、入口の管を通してだけ入る）
//   - inlet.usage で、入口の管の使用率を読む
//   - signatureChecker.matches で照合する
//   - 組み立てのときに、outlet.downstream を設定する
export interface Organelle {
  readonly signature: Signature;
  readonly signatureChecker: SignatureChecker;
  readonly inlet: Canal;
  readonly outlet: Canal;
}

// ---- セル（照合して振り分ける。子を持てる。末端は organelles が空）----
export class Cell implements Organelle {
  constructor(
    readonly signature: Signature,
    readonly inlet: Canal,
    readonly outlet: Canal,
    readonly organelles: Organelle[] = [], // 組み立て時にだけ入れる
    readonly signatureChecker: SignatureChecker = fullMatchSignatureChecker, // 自分宛てかの照合
    readonly signatureProbe: SignatureProbe = firstAvailableSignatureProbe, // 照合に合う子を選ぶ
  ) {
    this.assemble();
  }

  // ---- 組み立て ----
  private assemble(): void {
    this.inlet.downstream = this;
    for (const organelle of this.organelles) {
      organelle.outlet.downstream = this.outlet; // 子の出口の管から出たものは、親の出口の管へ
    }
  }

  // ---- 状態の確認（読むだけ）----
  canReceive(v: Vesicle): boolean {
    const organelle = this.signatureProbe.probe(this.organelles, v);
    if (organelle) {
      return this.canSendToOrganelle(organelle, v);
    } else {
      return this.canSendToOutlet(v);
    }
  }

  private canSendToOrganelle(organelle: Organelle, v: Vesicle): boolean {
    return organelle.inlet.canReceive(v);
  }

  private canSendToOutlet(v: Vesicle): boolean {
    return this.outlet.canReceive(v);
  }

  // ---- 受け取り（自分の入口の管からだけ届く）----
  receive(v: Vesicle): void {
    const organelle = this.signatureProbe.probe(this.organelles, v);
    if (!organelle) {
      this.sendToOutlet(v);
    } else if (this.canSendToOrganelle(organelle, v)) {
      this.sendToOrganelle(organelle, v);
    } else {
      this.discard(v); // 受け取れる子がない
    }
  }

  // ---- 送る ----
  private sendToOrganelle(organelle: Organelle, v: Vesicle): void {
    organelle.inlet.receive(v);
  }

  private sendToOutlet(v: Vesicle): void {
    this.outlet.receive(v);
  }

  // 受け取れる子がないときに廃棄する。C には、自分の入口の管の id で error を記録する
  private discard(v: Vesicle): void {
    annotator.recordError(v, this.inlet);
    this.inlet.disposer.receive(v);
  }
}

// ---- いちばん外 ----
export class Outside implements Receiver {
  readonly received: Vesicle[] = [];

  canReceive(_v: Vesicle): boolean {
    return true;
  }

  receive(v: Vesicle): void {
    this.received.push(v);
  }
}

