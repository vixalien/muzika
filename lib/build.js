import { resolve } from "node:path";
import { ok } from "node:assert/strict";

import minimist from "minimist";
import { build } from "esbuild";

const args = minimist(process.argv.slice(2));

const USAGE =
  "Usage: stylus.js --out <out-dir> --cwd <cwd-dir> <entry-files...>";

ok(args._.length >= 0, "No entry files provided \n" + USAGE);
ok(args.out || args.o, "No out dir specified \n" + USAGE);

const OUT_DIR = args.out || args.o;
const ENTRY_FILES = args._;
const INIT_CWD = resolve(
  process.cwd(),
  args.cwd || process.env.INIT_CWD || ".",
);

await build({
  entryPoints: ENTRY_FILES.map((path) => resolve(INIT_CWD, path)),
  outdir: resolve(INIT_CWD, OUT_DIR),
})
  .then(() => console.log("JS Build complete"));
