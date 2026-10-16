// MapLibre 6 loads its map worker from a file next to its own module. Once Next bundles the
// library that file does not exist, so we serve it from /public and point MapLibre at it
// (see src/components/tracking/LiveMap.tsx). Runs before `next dev` and `next build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const src = require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");
const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre", "maplibre-gl-worker.mjs");
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
