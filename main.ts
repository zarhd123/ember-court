// Ember Court — entry driver for the make.fun "best card game" bounty.
// Node 22, standard library only. The game itself lives in game/ (plain static
// files: game/index.html plus its ES modules, no libraries, no network requests),
// and this script stages a submission: it mirrors game/ and screenshots/ into
// the output directory and writes dossier.json there, the summary the judge
// reads, using the vendored make.fun library.
//
// Run it with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader's container MAKEFUN_OUTPUT_DIR stands in for /output.
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where the staged entry goes: the grader's /output, or the directory named
// by MAKEFUN_OUTPUT_DIR when running locally.
const DEFAULT_OUTPUT_DIR = '/output';

// The scorer's own caps (reference/gate.json). Only text_max_bytes shapes the
// bytes; the rest refuse an entry the scorer would refuse: more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes. game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// The folder this file lives in.
function repoRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function outputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR;
}

// Copy a whole directory tree, creating the destination first.
function mirrorTree(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

// Stage the playable game and the screenshots the judge sees. The first
// screenshot by name is the cover, so screenshots/ is copied as-is.
function stageEntry(root: string, out: string): void {
  mirrorTree(join(root, 'game'), join(out, 'game'));

  const stagedShots = join(out, 'screenshots');
  mkdirSync(stagedShots, { recursive: true });
  const shotSource = join(root, 'screenshots');
  if (existsSync(shotSource)) {
    cpSync(shotSource, stagedShots, { recursive: true });
  }
}

// Build the judge's summary from the staged files and write it out.
function emitDossier(out: string): number {
  const bytes = buildDossier(out, DOSSIER_CAPS);
  writeFileSync(join(out, 'dossier.json'), bytes);
  return bytes.length;
}

function main(): void {
  const root = repoRoot();
  const out = outputDir();

  mkdirSync(out, { recursive: true });
  stageEntry(root, out);
  const dossierBytes = emitDossier(out);

  console.log(`staged Ember Court into ${out} (dossier.json: ${dossierBytes} bytes)`);
}

try {
  main();
} catch (error) {
  console.error('main.ts failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
