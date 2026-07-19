#!/usr/bin/env node
/* global process, console */
/**
 * vibedrift-init — Agent Skill runner for `vibedrift init`.
 *
 * Wraps @vibedrift/cli via npx. On macOS, prefers native arm64 to avoid
 * Rosetta/xcrun failures.
 *
 * Usage:
 *   vibedrift-init apply   --root <dir> [--yes] [--fail-on-score N] [--format html] [--extra "a/**,b/**"]
 *   vibedrift-init ignore  --root <dir> <glob...>
 *   vibedrift-init rescan  --root <dir>
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = { root: process.cwd(), yes: false, extra: [] };
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--yes" || a === "-y") flags.yes = true;
    else if (a === "--root") flags.root = resolve(rest[++i]);
    else if (a === "--fail-on-score") flags.failOnScore = Number(rest[++i]);
    else if (a === "--format") flags.format = rest[++i];
    else if (a === "--extra") {
      flags.extra = rest[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a.startsWith("-")) fail(`unknown flag ${a}`);
    else positional.push(a);
  }
  return { command, flags, positional };
}

function fail(msg) {
  console.error(`vibedrift-init: ${msg}`);
  process.exit(2);
}

function vdSpawn(subcommand, args = []) {
  const npxArgs = ["-y", "@vibedrift/cli"];
  if (subcommand) npxArgs.push(subcommand);
  npxArgs.push(...args);
  if (process.platform === "darwin") {
    return { bin: "arch", args: ["-arm64", "npx", ...npxArgs] };
  }
  return { bin: "npx", args: npxArgs };
}

function runVd(cwd, subcommand, args = [], { inherit = false } = {}) {
  const { bin, args: cmd } = vdSpawn(subcommand, args);
  const result = spawnSync(bin, cmd, {
    cwd,
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    fail(err || `@vibedrift/cli ${subcommand || "scan"} exited ${result.status}`);
  }
  return result.stdout ?? "";
}

/** R+ repo: generated bundles and tooling artifacts (mirrors .cursorignore). */
const RPLUS_EXTRA = [
  "public/js/app.bundle.mjs",
  "public/js/app.bundle.meta.json",
  "public/js/chunks/**",
  "**/*.map",
  ".understand-anything/**",
];

function cmdApply(flags) {
  const initArgs = [flags.root];
  if (flags.yes) initArgs.push("--yes");
  runVd(flags.root, "init", initArgs, { inherit: true });

  const extras = [...new Set([...flags.extra, ...RPLUS_EXTRA])];
  if (extras.length > 0) {
    runVd(flags.root, "ignore", extras, { inherit: true });
  }

  console.log("");
  console.log("  Rescanning to rebuild baseline…");
  const out = runVd(flags.root, "", [flags.root, "--local-only", "--format", "json"]);
  try {
    const j = JSON.parse(out);
    console.log(
      `  Composite: ${j.compositeScore}/${j.maxCompositeScore} · Hygiene: ${j.hygieneScore}/${j.maxHygieneScore} · ${j.fileCount} files`,
    );
  } catch {
    process.stdout.write(out);
  }
}

function cmdIgnore(flags, patterns) {
  if (patterns.length === 0) fail("ignore needs at least one glob pattern");
  runVd(flags.root, "ignore", patterns, { inherit: true });
  runVd(flags.root, "", [flags.root, "--local-only", "--format", "json"]);
}

function cmdRescan(flags) {
  const out = runVd(flags.root, "", [flags.root, "--local-only", "--format", "json"]);
  process.stdout.write(out);
}

function main() {
  const { command, flags, positional } = parseArgs(process.argv.slice(2));
  if (!command) fail("missing command (apply | ignore | rescan)");

  switch (command) {
    case "apply":
      cmdApply(flags);
      break;
    case "ignore":
      cmdIgnore(flags, positional);
      break;
    case "rescan":
      cmdRescan(flags);
      break;
    default:
      fail(`unknown command "${command}" (detect: use MCP init with detectOnly:true)`);
  }
}

main();
