// セルアーキテクチャの拡張：ストック用の小器官と製造の役
import { fullMatchSignatureChecker } from "./core.ts";
import type { Canal, Organelle, Receiver, Signature, SignatureChecker, Vesicle } from "./core.ts";

// ---- 製造の役：設計図の読み方と、組み立て方 ----
export interface Recipe {
  needs(v: Vesicle): string[] | undefined; // 設計図なら、要る部品番号の一覧。そうでなければ undefined
  partNo(v: Vesicle): string | undefined; // 部品なら、部品番号。そうでなければ undefined
  assemble(blueprint: Vesicle, parts: Vesicle[]): Vesicle; // 組み立てる（純粋）
}

// ---- ストックの枠：部品番号ごとの枠と、設計図の枠（組み立てのときに決める）----
export interface StockSlots {
  parts: Record<string, number>; // 例：{ p1: 2, p2: 2, p3: 2 }
  blueprints: number;
}

// ---- ストック用の小器官 ----
// 届いたもの（設計図と部品）を保持し、設計図の部品がそろったら組み立てて出口の管へ流す。
// 入口の管 → StockOrganelle（保持と組み立て）→ 出口の管
//   - 結び付け：部品番号だけで結ぶ（取り替えがきく）
//   - 設計図より先に着いた部品も保持する
//   - 枠：部品番号ごとの枠と、設計図の枠を持つ。枠の無い部品、枠がいっぱいのものは、受け取ってそのまま出口へ流す
//   - 時間切れは設けない。設計図は一度の組み立てで使い切る
export class StockOrganelle implements Organelle, Receiver {
  readonly signatureChecker: SignatureChecker = fullMatchSignatureChecker;
  private readonly stock: Vesicle[] = [];
  private consumedCount = 0; // 組み立てに使った数（設計図と部品）
  private producedCount = 0; // 組み立てたものの数
  private retrying = false; // 出口が空くのを待っているか
  private idleWaiters: (() => void)[] = []; // 静まるのを待つ者（whenIdle）

  constructor(
    readonly signature: Signature,
    readonly inlet: Canal,
    readonly outlet: Canal,
    private readonly slots: StockSlots,
    private readonly recipe: Recipe,
    private readonly retryIntervalMs = 10, // 出口の管が受け取れないときに、確かめ直す間隔
  ) {
    this.inlet.downstream = this;
  }

  // 保持しているもの（読むだけ）
  held(): readonly Vesicle[] {
    return [...this.stock];
  }

  // 組み立てに使った数、組み立てたものの数（読むだけ）
  consumed(): number {
    return this.consumedCount;
  }

  produced(): number {
    return this.producedCount;
  }

  // 出口を待っていないか（読むだけ）
  isIdle(): boolean {
    return !this.retrying;
  }

  // 次に静まったときに解決する。今静まっていれば、すぐ解決する
  whenIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  // 枠に入るか（設計図は設計図の枠、部品は部品番号の枠。枠の無い部品は入らない）
  private fitsSlot(v: Vesicle): boolean {
    if (this.recipe.needs(v)) {
      return this.stock.filter((s) => this.recipe.needs(s)).length < this.slots.blueprints;
    }
    const no = this.recipe.partNo(v);
    const limit = no === undefined ? 0 : (this.slots.parts[no] ?? 0);
    return this.stock.filter((s) => this.recipe.partNo(s) === no).length < limit;
  }

  // ---- 状態の確認（読むだけ）----
  canReceive(v: Vesicle): boolean {
    return this.fitsSlot(v) || this.outlet.canReceive(v); // 枠に入らないものは、出口へ流す
  }

  // ---- 受け取り（自分の入口の管からだけ届く）----
  receive(v: Vesicle): void {
    if (this.fitsSlot(v)) {
      this.stock.push(v);
      this.tryAssemble();
    } else {
      this.outlet.receive(v); // 枠の無いもの、枠がいっぱいのものは、そのまま出口へ
    }
  }

  // 着いた順に設計図を見て、部品がそろったものを組み立てる
  private tryAssemble(): void {
    this.retrying = false;
    for (const blueprint of this.stock) {
      const needs = this.recipe.needs(blueprint);
      if (!needs) continue;
      const parts = this.pickParts(needs);
      if (!parts) continue;
      if (!this.outlet.canReceive(blueprint)) {
        this.retrying = true;
        setTimeout(() => this.tryAssemble(), this.retryIntervalMs); // 出口が空くまで待つ
        return;
      }
      this.remove([blueprint, ...parts]);
      this.consumedCount += 1 + parts.length;
      this.producedCount++;
      this.outlet.receive(this.recipe.assemble(blueprint, parts));
      this.tryAssemble(); // 残りにも、そろったものがあるかもしれない
      return;
    }
    this.notifyIdle();
  }

  private notifyIdle(): void {
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const w of waiters) w();
  }

  // 要る部品番号ごとに、着いた順で最初の部品を一つずつ選ぶ。一つでも足りなければ undefined
  private pickParts(needs: string[]): Vesicle[] | undefined {
    const picked: Vesicle[] = [];
    for (const no of needs) {
      const part = this.stock.find((v) => this.recipe.partNo(v) === no && !picked.includes(v));
      if (!part) return undefined;
      picked.push(part);
    }
    return picked;
  }

  private remove(vs: Vesicle[]): void {
    for (const v of vs) {
      this.stock.splice(this.stock.indexOf(v), 1);
    }
  }
}
