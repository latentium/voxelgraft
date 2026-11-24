// VoxelGraft：CLI の入口。check / build / help
import { readFileSync } from "node:fs";
import { byQuiescence } from "./cell/ext_completion.ts";
import { parseDsl } from "./dsl.ts";
import { buildWorld } from "./world.ts";
import { buildResult, checkResult, exitCodeOf, usageResult } from "./result.ts";
import type { Result } from "./result.ts";
import { HELP } from "./help.ts";

const LIMIT_MS = 30_000; // 世界が静まるのを待つ上限

const print = (r: Result): void => {
  process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  process.exitCode = exitCodeOf(r.status);
};

const parseArgs = (rest: string[]) => {
  let file: string | undefined;
  let out: string | undefined;
  let help = false;
  const problems: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--out") {
      out = rest[++i];
      if (out === undefined) problems.push("--out には DIR が要る");
    } else if (a === "--help" || a === "-h") help = true;
    else if (a.startsWith("-")) problems.push(`無効なオプション ${a}`);
    else if (file === undefined) file = a;
    else problems.push(`余分な引数 ${a}`);
  }
  return { file, out, help, problems };
};

const main = async (argv: string[]): Promise<void> => {
  const [command, ...rest] = argv;
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }
  if (command !== "check" && command !== "build") {
    print(usageResult(command, null, `無効なコマンド ${command}（「voxelgraft help」を参照）`));
    return;
  }
  const { file, out, help, problems } = parseArgs(rest);
  if (help) {
    process.stdout.write(HELP);
    return;
  }
  if (command === "check" && out !== undefined) problems.push("--out は build だけで使える");
  if (problems.length > 0) {
    print(usageResult(command, file ?? null, problems.join(" / ")));
    return;
  }
  if (file === undefined) {
    print(usageResult(command, null, "FILE が要る"));
    return;
  }

  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    print(usageResult(command, file, `FILE を読めない: ${(e as Error).message}`));
    return;
  }

  const parsed = parseDsl(text);
  if (command === "check" || !parsed.ok) {
    print(checkResult(command, file, parsed));
    return;
  }

  const w = buildWorld(parsed.dsl, out ?? "out");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), LIMIT_MS);
  });
  const finished = await Promise.race([byQuiescence(w.root).then(() => true), limit]);
  clearTimeout(timer);
  print(buildResult(file, parsed.dsl, w, finished));
  if (!finished) process.exit(); // 止まらない世界を残さない
};

main(process.argv.slice(2));
