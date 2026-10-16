import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

export const TEST_PHONE = "9999900001";
export const TEST_OTP = "123456";
export const MOCK_GATEWAY = process.env.E2E_MOCK_GATEWAY ?? "http://127.0.0.1:4010";

/** Deterministic geocoder: answers Photon and Nominatim with an MG Road, Bengaluru fixture inside the seeded store's radius. */
export const mockGeocoders = async (page: Page) => {
  await page.route(/photon\.komoot\.io/, (route) =>
    route.fulfill({
      json: {
        features: [
          { geometry: { coordinates: [77.6, 12.975] }, properties: { name: "MG Road", district: "Ashok Nagar", city: "Bengaluru", state: "Karnataka", postcode: "560001" } },
        ],
      },
    }),
  );
  await page.route(/nominatim\.openstreetmap\.org/, (route) =>
    route.fulfill({
      json: { lat: "12.975", lon: "77.6", display_name: "MG Road, Ashok Nagar, Bengaluru, Karnataka 560001", address: { suburb: "Ashok Nagar", city: "Bengaluru", state: "Karnataka", postcode: "560001" } },
    }),
  );
  // Map tiles are not needed for assertions; keep tests offline-safe.
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 204, body: "" }));
};

export const login = async (page: Page, phone = TEST_PHONE) => {
  await page.goto("/login");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("6-digit code").fill(TEST_OTP);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("link", { name: /account|log in/i }).first()).toBeVisible();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
};

/** Through the real modal: search, pick, confirm serviceability, save with a house number. */
export const setDeliveryAddress = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Set delivery location" }).click();
  const dialog = page.getByRole("dialog", { name: "Set delivery location" });
  await dialog.getByPlaceholder(/Search for area/).fill("MG Road");
  await dialog.getByRole("button", { name: /MG Road/ }).first().click();
  await expect(dialog.getByText("We deliver here")).toBeVisible();
  await dialog.getByRole("button", { name: "Save as address" }).click();
  await dialog.getByLabel("House / Flat / Building").fill("12, Test Apartments");
  await dialog.getByRole("button", { name: "Save and deliver here" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Delivery in \d+ min/)).toBeVisible();
};

/** Picks the address saved by setDeliveryAddress in an earlier test (fresh browser context). */
export const useSavedAddress = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Set delivery location" }).click();
  const dialog = page.getByRole("dialog", { name: "Set delivery location" });
  await dialog.getByRole("button", { name: /^Home/ }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Delivery in \d+ min/)).toBeVisible();
};

export const addToCart = async (page: Page, productName: string, quantity = 1) => {
  await page.getByRole("button", { name: `Add ${productName} to cart` }).first().click();
  for (let i = 1; i < quantity; i++) await page.getByRole("article").filter({ hasText: productName }).first().getByRole("button", { name: "Add one" }).click();
};

/** Runs the rider simulator against an order and waits for it to finish. */
export const simulateRider = (orderNumber: string) => {
  const root = path.resolve(__dirname, "../..");
  if (!fs.existsSync(path.join(root, ".oss.env"))) throw new Error(".oss.env missing: run npm run oss:start first");
  return execFileSync("node", ["infra/opensource/simulate-rider.mjs", orderNumber, "--interval", "1", "--speed", "400"], { cwd: root, encoding: "utf8", timeout: 90_000 });
};
