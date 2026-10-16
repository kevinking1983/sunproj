"use client";

import { mapStyleFor } from "@ration/api";
import { getVersion, setWorkerUrl } from "maplibre-gl";

import { env } from "./env";

import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre 6 resolves its worker next to its own module, which does not exist once Next
// bundles the library. scripts/copy-maplibre-worker.mjs copies it into /public; the version
// query stops a browser reusing a worker cached from an older release.
setWorkerUrl(`/maplibre/maplibre-gl-worker.mjs?v=${getVersion()}`);

/** Style for the configured maps provider (Ola Maps vector tiles, or OpenStreetMap for testing). */
export const mapStyle = () => mapStyleFor(env.mapsProvider, env.olaMapsApiKey) as never;
