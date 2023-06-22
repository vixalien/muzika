import { resolve } from "node:path";

import minimist from "minimist";
import { build } from "esbuild";

const args = minimist(process.argv.slice(2));

const USAGE =
  "Usage: build.js --out <out-dir> --cwd <cwd-dir> <entry-files...>";

if (args._.length <= 0) throw new Error("No entry files provided \n" + USAGE);
if (!(args.out || args.o)) throw new Error("No out dir specified \n" + USAGE);

const OUT_DIR = args.out || args.o;
const ENTRY_FILES = args._;
const INIT_CWD = resolve(
  process.cwd(),
  args.cwd || process.env.INIT_CWD || ".",
);

await build({
  entryPoints: ENTRY_FILES.map((path) => resolve(INIT_CWD, path)),
  outdir: resolve(INIT_CWD, OUT_DIR),
  bundle: true,
  external: ["gi://*", "format", "gettext"],
  treeShaking: true,
  // esm
  format: "esm",
})
  .then(() => console.log("JS Build complete"));
