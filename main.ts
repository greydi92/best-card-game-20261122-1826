// Ember Court — a make.fun best-card-game-20261122-1826 entry (Node 22, standard
// library only). The game is this directory's game/ folder: plain static files a
// desktop browser loads offline (game/index.html and its ES modules, no library
// and no network request), and this program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// Ember Court is a duel card battler: 40 unique cards across four elements
// (Ember, Tide, Thorn, Gale) with an element wheel, 12 combos (4 element pairs
// and 8 named pairs), a telegraphed AI rival with readable tells, a 5-round
// campaign against five named courts, synthesized WebAudio sound, and title,
// campaign map, duel, pause, how-to-play, round-win, crown-win and loss screens.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// The grader collects /output as another user: every file it reads must be
// world-readable and every folder world-executable, whatever the umask was.
// A chmod can still fail: the grader runs as user 65534 while /output may
// belong to root, and chmod on a directory you do not own dies with EPERM.
// The copied files and the dossier are what the judge reads, so a chmod
// that cannot be applied is skipped and the run still exits 0. The
// successful path is unchanged: chmod still runs whenever it can.
import { chmodSync, readdirSync, statSync } from 'node:fs';
function chmodQuiet(path, mode) {
  try {
    chmodSync(path, mode);
  } catch (err) {
    // Not ours to chmod (e.g. EPERM on a root-owned /output): warn on
    // stderr and continue — the copied files and the dossier are what
    // the judge reads, so a skipped chmod is never fatal.
    console.error(`warning: chmod ${path} skipped (${err.code ?? err.message})`);
  }
}
function chmodTree(dir, fileMode, dirMode) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      chmodQuiet(path, dirMode);
      chmodTree(path, fileMode, dirMode);
    } else {
      chmodQuiet(path, fileMode);
    }
  }
}
chmodQuiet(out, 0o755);
chmodTree(out, 0o644, 0o755);
