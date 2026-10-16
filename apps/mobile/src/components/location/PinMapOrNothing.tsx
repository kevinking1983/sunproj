import type { ComponentType } from "react";

import type { PinMapProps } from "./PinMap";

/**
 * MapLibre is a native module that Expo Go does not include. Load the pin map lazily and
 * render nothing there, so the confirm screen still works from the address text alone.
 */
const loadPinMap = (): ComponentType<PinMapProps> | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@maplibre/maplibre-react-native");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./PinMap") as { PinMap: ComponentType<PinMapProps> }).PinMap;
  } catch {
    return null;
  }
};

const NativePinMap = loadPinMap();

export function PinMapOrNothing(props: PinMapProps) {
  return NativePinMap ? <NativePinMap {...props} /> : null;
}

export const pinMapAvailable = NativePinMap !== null;
