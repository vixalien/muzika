import { resolve } from "node:path";

import minimist from "minimist";
import { build } from "esbuild";

const args = minimist(process.argv.slice(2));

const USAGE =
  "Usage: build.js --out <out-dir> --cwd <cwd-dir> --src <src-dir> <entry-files...>";

if (args._.length <= 0) throw new Error("No entry files provided \n" + USAGE)
if (!(args.out || args.o)) throw new Error("No out dir specified \n" + USAGE)

const OUT_DIR = args.out || args.o;
const ENTRY_FILES = args._;
const INIT_CWD = resolve(
  process.cwd(),
  args.cwd || process.env.INIT_CWD || ".",
);
const SOURCE_DIR = resolve(INIT_CWD, args.src || ".");

console.log("src", SOURCE_DIR)

function isExternalPath(args, externalPath) {
  if (args.kind === "entry-point") return false;
  const absolutePath = resolve(args.resolveDir, args.path);
  const absoluteExternalPath = resolve(externalPath);
  return (args.path.startsWith("./") || args.path.startsWith("../")) && absolutePath.startsWith(absoluteExternalPath);
}

function externalPlugin(externalPath) {
  return {
    name: 'external',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (isExternalPath(args, externalPath)) {
          return { external: true };
        }
      });
    },
  };
}

await build({
  entryPoints: ENTRY_FILES.map((path) => resolve(INIT_CWD, path)),
  outdir: resolve(INIT_CWD, OUT_DIR),
  // only bundle external dependencies
  bundle: true,
  external: ["gi://*"],
  treeShaking: true,
  // esm
  format: "esm",
  plugins: [externalPlugin(resolve(SOURCE_DIR, "src"))],
})
  .then(() => console.log("JS Build complete"));
