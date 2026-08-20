#!/usr/bin/env node
/**
 * Lint 회귀 게이트.
 *
 * 이 레포에는 ESLint 를 한 번도 돌리지 않고 쌓인 기존 위반이 남아 있다.
 * 전부 고칠 때까지 `eslint .` 를 CI 게이트로 쓰면 아무것도 통과하지 못하고,
 * 그렇다고 방치하면 새 위반이 조용히 섞여 든다. 그래서 **파일별 위반 수를
 * 베이스라인으로 고정하고, 늘어난 파일만 실패**시킨다.
 *
 * 사용법
 *   node scripts/lint-gate.js            # 검사 (신규 위반 있으면 exit 1)
 *   node scripts/lint-gate.js --update   # 정리 후 베이스라인 갱신
 *
 * 파일을 정리해 위반이 줄면 실패시키지 않되 갱신하라고 안내한다 —
 * 베이스라인은 한 방향(내려가는 쪽)으로만 조여진다.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = join(ROOT, "scripts", "lint-baseline.json");

/** eslint 를 JSON 리포터로 돌려 파일별 위반 수를 센다 */
function collectCounts() {
  let raw;
  try {
    raw = execFileSync(
      "npx",
      ["eslint", ".", "--format", "json"],
      { cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (err) {
    // eslint 는 위반이 있으면 exit 1 — stdout 에 리포트가 들어 있다
    raw = err.stdout;
    if (!raw) {
      console.error("[lint-gate] eslint 실행 실패:", err.message);
      process.exit(2);
    }
  }

  const counts = {};
  for (const file of JSON.parse(raw)) {
    if (!file.messages.length) continue;
    counts[relative(ROOT, file.filePath)] = file.messages.length;
  }
  return counts;
}

function total(counts) {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

const current = collectCounts();

if (process.argv.includes("--update")) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ files: current, total: total(current) }, null, 2) + "\n",
  );
  console.log(
    `[lint-gate] 베이스라인 갱신: ${Object.keys(current).length}개 파일, 위반 ${total(current)}건`,
  );
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error(
    "[lint-gate] 베이스라인이 없습니다. `node scripts/lint-gate.js --update` 로 먼저 생성하세요.",
  );
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")).files ?? {};

const regressions = [];
const improvements = [];
for (const [file, count] of Object.entries(current)) {
  const allowed = baseline[file] ?? 0;
  if (count > allowed) regressions.push({ file, allowed, count });
}
for (const [file, allowed] of Object.entries(baseline)) {
  const count = current[file] ?? 0;
  if (count < allowed) improvements.push({ file, allowed, count });
}

if (regressions.length > 0) {
  console.error("[lint-gate] 신규 lint 위반이 있습니다:\n");
  for (const r of regressions) {
    console.error(`  ${r.file}: ${r.allowed} → ${r.count} (+${r.count - r.allowed})`);
  }
  console.error(
    "\n해당 파일에서 `npx eslint <파일>` 로 확인하고 새로 추가된 위반을 고치세요.",
  );
  console.error(
    "기존 위반을 정리했다면 `node scripts/lint-gate.js --update` 로 베이스라인을 낮추세요.",
  );
  process.exit(1);
}

if (improvements.length > 0) {
  const saved = improvements.reduce((s, i) => s + (i.allowed - i.count), 0);
  console.log(
    `[lint-gate] 통과. 위반 ${saved}건이 줄었습니다 (${improvements.length}개 파일) —`,
  );
  console.log(
    "  `node scripts/lint-gate.js --update` 로 베이스라인을 낮춰 고정하세요.",
  );
} else {
  console.log(
    `[lint-gate] 통과. 기존 위반 ${total(current)}건 유지, 신규 0건.`,
  );
}
