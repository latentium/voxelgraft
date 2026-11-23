// VoxelGraft：DSL（JSON）の型と、解析・形の検査。誤りは、DSL の中の場所（例：parts.lid[1].fill.to）で示す
export type Vec3 = [number, number, number];

export interface FillOp {
  fill: { from: Vec3; to: Vec3; material: string };
}
export interface RemoveOp {
  remove: { from: Vec3; to: Vec3 };
}
export type Op = FillOp | RemoveOp;

export interface AssetDsl {
  asset: { name: string; size: Vec3; palette: Record<string, string>; parts: string[] };
  parts: Record<string, Op[]>;
  assembly: { inspect: string[]; export: string[] };
}

export interface DslError {
  path: string;
  message: string;
}

export type ParseResult = { ok: true; dsl: AssetDsl } | { ok: false; errors: DslError[] };

export const INSPECTIONS = ["bounds", "palette"];
export const EXPORTS = ["html"];
export const MAX_SIZE = 128; // asset.size の上限
export const MAX_COORD = 127; // 操作の座標の上限

const SECTIONS = ["asset", "parts", "assembly"];

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

export const parseDsl = (text: string): ParseResult => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [{ path: "$", message: `JSON として読めない: ${(e as Error).message}` }] };
  }
  if (!isObject(raw)) return { ok: false, errors: [{ path: "$", message: "オブジェクトが要る" }] };

  const errors: DslError[] = [];
  const err = (path: string, message: string): void => {
    errors.push({ path, message });
  };

  const vec3 = (x: unknown, path: string, min: number, max: number): void => {
    if (!Array.isArray(x) || x.length !== 3 || !x.every((n) => Number.isInteger(n) && n >= min && n <= max)) {
      err(path, `${min}〜${max} の整数3つの配列が要る`);
    }
  };

  const nameList = (x: unknown, path: string, allowed?: string[]): string[] => {
    if (!Array.isArray(x) || !x.every((s) => typeof s === "string" && s !== "")) {
      err(path, "空でない文字列の配列が要る");
      return [];
    }
    if (allowed) {
      x.forEach((s, i) => {
        if (!allowed.includes(s)) err(`${path}[${i}]`, `知らない名前 ${s}（使えるのは ${allowed.join(", ")}）`);
      });
    }
    if (new Set(x).size !== x.length) err(path, "同じ名前が重なっている");
    return x as string[];
  };

  const checkOp = (op: unknown, path: string): void => {
    if (!isObject(op) || Object.keys(op).length !== 1) {
      err(path, "fill か remove のどちらか一つだけを持つオブジェクトが要る");
      return;
    }
    const [kind, body] = Object.entries(op)[0];
    if (kind !== "fill" && kind !== "remove") {
      err(path, `知らない操作 ${kind}（使えるのは fill、remove）`);
      return;
    }
    if (!isObject(body)) {
      err(`${path}.${kind}`, "オブジェクトが要る");
      return;
    }
    vec3(body.from, `${path}.${kind}.from`, 0, MAX_COORD);
    vec3(body.to, `${path}.${kind}.to`, 0, MAX_COORD);
    if (kind === "fill" && (typeof body.material !== "string" || body.material === "")) {
      err(`${path}.fill.material`, "空でない文字列が要る");
    }
  };

  for (const key of Object.keys(raw)) {
    if (!SECTIONS.includes(key)) err(key, `知らない節（使えるのは ${SECTIONS.join(", ")}）`);
  }

  // ---- asset ----
  let partNames: string[] = [];
  const asset = raw.asset;
  if (!isObject(asset)) err("asset", "オブジェクトが要る");
  else {
    if (typeof asset.name !== "string" || asset.name === "") err("asset.name", "空でない文字列が要る");
    vec3(asset.size, "asset.size", 1, MAX_SIZE);
    if (!isObject(asset.palette)) err("asset.palette", "オブジェクトが要る（材質名 → 色）");
    else {
      for (const [m, c] of Object.entries(asset.palette)) {
        if (typeof c !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c)) err(`asset.palette.${m}`, "色は #rrggbb の形");
      }
    }
    partNames = nameList(asset.parts, "asset.parts");
  }

  // ---- parts ----
  const parts = raw.parts;
  if (!isObject(parts)) err("parts", "オブジェクトが要る（Part の名 → 操作の配列）");
  else {
    for (const name of partNames) {
      if (!(name in parts)) err(`parts.${name}`, "asset.parts にある Part の操作が無い");
    }
    for (const [name, ops] of Object.entries(parts)) {
      const base = `parts.${name}`;
      if (!partNames.includes(name)) err(base, "asset.parts に無い Part");
      if (!Array.isArray(ops)) err(base, "操作の配列が要る");
      else ops.forEach((op, i) => checkOp(op, `${base}[${i}]`));
    }
  }

  // ---- assembly ----
  const assembly = raw.assembly;
  if (!isObject(assembly)) err("assembly", "オブジェクトが要る");
  else {
    nameList(assembly.inspect, "assembly.inspect", INSPECTIONS);
    nameList(assembly.export, "assembly.export", EXPORTS);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, dsl: raw as unknown as AssetDsl };
};
