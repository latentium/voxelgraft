// X9：DSL の Part の数と操作の数を数える
// 使い方：stats.ts DSL...
import { readFileSync } from "node:fs";

for (const path of process.argv.slice(2)) {
  const dsl = JSON.parse(readFileSync(path, "utf8"));
  const parts = Object.values(dsl.parts as Record<string, unknown[]>);
  console.log(JSON.stringify({
    file: path,
    parts: parts.length,
    ops: parts.reduce((n, ops) => n + ops.length, 0),
    palette: Object.keys(dsl.asset.palette).length,
  }));
}
