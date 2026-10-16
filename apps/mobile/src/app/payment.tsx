import { Redirect } from "expo-router";

/**
 * Deep-link landing for ration://payment. The mock checkout (open-source test stack)
 * redirects here; the browser session that opened it reads the URL and closes, so this
 * screen only needs to send any stray navigation back to the tabs.
 */
export default function PaymentReturnScreen() {
  return <Redirect href="/(tabs)" />;
}
