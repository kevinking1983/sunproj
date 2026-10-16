/**
 * MapLibre style for the chosen maps provider. Both are keyless-friendly:
 * - "osm": OpenStreetMap raster tiles (testing only; production needs a tile plan or self-hosting
 *   per https://operations.osmfoundation.org/policies/tiles/)
 * - "ola": Ola Maps vector style, which needs the API key appended.
 */
export type MapProvider = "osm" | "ola";

export const mapStyleFor = (provider: MapProvider, olaApiKey?: string, tileUrl?: string): string | object => {
  if (provider === "ola" && olaApiKey) {
    return `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${encodeURIComponent(olaApiKey)}`;
  }
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [tileUrl ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
        maxzoom: 19,
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
};
