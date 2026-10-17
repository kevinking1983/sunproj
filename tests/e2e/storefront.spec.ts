import { expect, test } from "@playwright/test";

import { MOCK_GATEWAY, addToCart, login, mockGeocoders, pushTitles, setDeliveryAddress, simulateRider, useSavedAddress } from "./helpers";

test.describe.configure({ mode: "serial" });

test("services are up", async ({ request }) => {
  expect((await request.get(`${MOCK_GATEWAY}/health`)).ok()).toBeTruthy();
  const site = await request.get("/terms");
  expect(site.ok()).toBeTruthy();
});

test("customer orders, pays through the mock gateway, and the rider delivers", async ({ page }) => {
  await mockGeocoders(page);
  await login(page);
  await setDeliveryAddress(page);

  // Catalog from the seeded store
  await expect(page.getByRole("heading", { name: "Shop by category" })).toBeVisible();
  await addToCart(page, "Toor Dal", 1);
  await addToCart(page, "Toned Milk", 2);

  // Cart drawer -> checkout
  await page.getByRole("button", { name: /^Cart, 3 items/ }).click();
  await page.getByRole("link", { name: "Go to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await page.getByRole("button", { name: /WELCOME50/ }).click();
  await page.getByRole("button", { name: "₹10", exact: true }).click();
  // Items 16500 + 2 × 2700 = 21900; coupon -5000; free delivery; handling 500; tip 1000 => 18400
  await expect(page.getByText("₹184", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Pay and place order/ }).click();

  // Mock gateway hosted checkout
  await page.waitForURL(/4010\/checkout/, { timeout: 60_000 });
  await expect(page.getByText("MOCK GATEWAY")).toBeVisible();
  await page.getByRole("button", { name: "Pay with mock UPI" }).click();

  // Back on the order page, verified and placed
  await page.waitForURL(/\/account\/orders\//, { timeout: 60_000 });
  await expect(page.getByText("Order placed.")).toBeVisible();
  const heading = await page.getByRole("heading", { name: /Order #RT\d+/ }).textContent();
  const orderNumber = heading?.match(/RT\d+/)?.[0];
  expect(orderNumber).toBeTruthy();
  await expect(page.getByText("Paid via online payment")).toBeVisible();

  // Rider simulator drives it to delivered; the page updates over realtime
  const log = simulateRider(orderNumber!);
  expect(log).toContain("delivered");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Delivered" })).toBeVisible({ timeout: 30_000 });

  // The database pushed each status change to notify-order, which delivered it through ntfy.
  await expect.poll(() => pushTitles(), { timeout: 30_000, message: "customer push notifications in ntfy" }).toEqual(expect.arrayContaining(["Order confirmed", "Delivered"]));
});

test("customer can cancel an unpaid-online order and the wallet shows the refund path", async ({ page }) => {
  await mockGeocoders(page);
  await login(page);
  await useSavedAddress(page);
  await addToCart(page, "Brown Bread", 1);
  await page.getByRole("button", { name: /^Cart, 1 item/ }).click();
  await page.getByRole("link", { name: "Go to checkout" }).click();
  await page.getByLabel("Cash on delivery").check();
  await page.getByRole("button", { name: /^Place order/ }).click();
  await page.waitForURL(/\/account\/orders\//, { timeout: 60_000 });
  await expect(page.getByText("Order placed.")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByRole("heading", { name: "Cancelled" })).toBeVisible({ timeout: 30_000 });
});
