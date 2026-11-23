// セルアーキテクチャの拡張：終わりの検出（X1 で三つの方式を比べる）
import type { Canal, Organelle, Outside, VesicleDisposer } from "./core.ts";
import { StockOrganelle } from "./ext_stock.ts";

// ---- 世界の中の管とストックを集める ----
// 子の並び（organelles）、包みの中（targetOrganelle）、パイプラインの管（canals）をたどる。
// どれも任意の欄として読む（木をたどる口 children() は、まだ無い）
type Branching = Organelle &
  Partial<{ organelles: Organelle[]; targetOrganelle: Organelle; canals: Canal[] }>;

export const collect = (root: Organelle): { canals: Canal[]; stocks: StockOrganelle[] } => {
  const canals = new Set<Canal>();
  const stocks = new Set<StockOrganelle>();
  const visit = (o: Branching): void => {
    canals.add(o.inlet);
    canals.add(o.outlet);
    o.canals?.forEach((c) => canals.add(c));
    if (o instanceof StockOrganelle) stocks.add(o);
    if (o.targetOrganelle) visit(o.targetOrganelle);
    o.organelles?.forEach(visit);
  };
  visit(root);
  return { canals: [...canals], stocks: [...stocks] };
};

// ---- 待つ補助：done が真になるまで、intervalMs ごとに確かめる ----
const poll = (done: () => boolean, intervalMs: number): Promise<void> =>
  new Promise((resolve) => {
    const tick = (): void => {
      if (done()) resolve();
      else setTimeout(tick, intervalMs);
    };
    setTimeout(tick, 0);
  });

// ---- (a) 数を合わせる ----
// 入れた数 ＋ 組み立てたものの数 ＝ 届いた数 ＋ 廃棄の数 ＋ 保持の数 ＋ 組み立てに使った数
export interface Tally {
  entered: () => number; // いちばん外の入口の管が受け取った数
  outside: Outside;
  disposer: VesicleDisposer;
}

export const byCount = (root: Organelle, tally: Tally, intervalMs = 5): Promise<void> => {
  const { stocks } = collect(root);
  const sum = (f: (s: StockOrganelle) => number): number => stocks.reduce((n, s) => n + f(s), 0);
  return poll(() => {
    const flowed = tally.entered() + sum((s) => s.produced());
    const ended =
      tally.outside.received.length +
      tally.disposer.retained.length +
      sum((s) => s.held().length) +
      sum((s) => s.consumed());
    return flowed === ended;
  }, intervalMs);
};

// ---- (b) 静まりを見る：すべての管とストックが止まっている ----
export const byQuiescence = (root: Organelle, intervalMs = 5): Promise<void> => {
  const { canals, stocks } = collect(root);
  return poll(() => canals.every((c) => c.isIdle()) && stocks.every((s) => s.isIdle()), intervalMs);
};

// ---- (c) Promise で知らせを集める ----
// すべてが静まるのを待ち、一拍おいて、まだすべて静まっていれば終わり。そうでなければ、もう一度待つ
export const byPromise = async (root: Organelle): Promise<void> => {
  const { canals, stocks } = collect(root);
  const items: { isIdle(): boolean; whenIdle(): Promise<void> }[] = [...canals, ...stocks];
  for (;;) {
    await Promise.all(items.map((i) => i.whenIdle()));
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (items.every((i) => i.isIdle())) return;
  }
};
