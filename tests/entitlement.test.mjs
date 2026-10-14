import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createServer } from "vite";

const rootDir = process.cwd();
const srcDir = path.resolve(rootDir, "src");

const vite = await createServer({
  configFile: false,
  root: rootDir,
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  server: { middlewareMode: true },
  appType: "custom",
});

const {
  canDownloadPdf,
  canGenerateOffline,
  generateRequestReference,
  isProActive,
  MONETIZATION_PRICES,
} = await vite.ssrLoadModule("/src/lib/payment/index.ts");

test("First offline generation is allowed when granted is 1 and consumed is 0", () => {
  assert.equal(canGenerateOffline(1, 0), true);
});

test("Second offline generation is locked when granted is 1 and consumed is 1", () => {
  assert.equal(canGenerateOffline(1, 1), false);
});

test("Extra offline generation is allowed after admin approval grants additional count", () => {
  assert.equal(canGenerateOffline(2, 1), true);
  assert.equal(canGenerateOffline(2, 2), false);
});

test("Offline generation is blocked if granted count is 0 or negative", () => {
  assert.equal(canGenerateOffline(0, 0), false);
  assert.equal(canGenerateOffline(-1, 0), false);
});

test("Initial PDF download is allowed when granted is 1 and consumed is 0", () => {
  assert.equal(canDownloadPdf(1, 0), true);
});

test("Subsequent PDF download is locked after first is consumed without extra entitlement", () => {
  assert.equal(canDownloadPdf(1, 1), false);
  assert.equal(canDownloadPdf(2, 1), true);
});

test("PRO status verification recognizes active vs expired entitlements", () => {
  assert.equal(isProActive(null), false);
  assert.equal(isProActive({ status: "inactive" }), false);
  assert.equal(isProActive({ status: "expired" }), false);
  assert.equal(isProActive({ status: "active" }), true);

  const past = new Date(Date.now() - 3600000).toISOString();
  assert.equal(isProActive({ status: "active", expires_at: past }), false);

  const future = new Date(Date.now() + 86400000 * 30).toISOString();
  assert.equal(isProActive({ status: "active", expires_at: future }), true);
});

test("Payment request reference generator produces standard PAY-XXXXXX format", () => {
  const ref1 = generateRequestReference();
  const ref2 = generateRequestReference();
  assert.match(ref1, /^PAY-\d{6}$/);
  assert.match(ref2, /^PAY-\d{6}$/);
  assert.notEqual(ref1, ref2);
});

test("Monetization pricing constants match Rwanda merchant requirements", () => {
  assert.equal(MONETIZATION_PRICES.extra_offline_generation, 2000);
  assert.equal(MONETIZATION_PRICES.pdf_download, 1000);
  assert.equal(MONETIZATION_PRICES.pro_monthly, 5000);
});

test("Product type label formatting returns human-readable titles", async () => {
  const { formatProductTypeLabel } = await vite.ssrLoadModule("/src/lib/payment/index.ts");
  assert.equal(formatProductTypeLabel("offline_generation"), "Additional Offline QR Stand");
  assert.equal(formatProductTypeLabel("pdf_download"), "High-Resolution Card Download");
  assert.equal(formatProductTypeLabel("pro_subscription"), "Ishyura PRO Monthly Subscription");
});

test("Simulated approval of offline generation entitlement restores merchant access", () => {
  // Merchant exhausted initial generation
  let granted = 1;
  let consumed = 1;
  assert.equal(canGenerateOffline(granted, consumed), false);

  // Admin approves payment request -> grants +1
  granted += 1;
  assert.equal(canGenerateOffline(granted, consumed), true);

  // Merchant consumes extra generation
  consumed += 1;
  assert.equal(canGenerateOffline(granted, consumed), false);
});

test("Simulated approval of PDF export entitlement restores download access", () => {
  let granted = 1;
  let consumed = 1;
  assert.equal(canDownloadPdf(granted, consumed), false);

  // Admin approves payment request -> grants +1
  granted += 1;
  assert.equal(canDownloadPdf(granted, consumed), true);
});

test.after(async () => {
  await vite.close();
});
