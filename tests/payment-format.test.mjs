import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

const [
  { buildRwandaUssdString },
  { buildStandPayloads },
  identity,
  { PaymentQrCode },
  { PLATFORM_MOMO_CODE, PLATFORM_PAYEE_NAME },
  { MONETIZATION_PRICES },
] = await Promise.all([
  vite.ssrLoadModule("/src/lib/momo-formatters.ts"),
  vite.ssrLoadModule("/src/lib/payment/payload.ts"),
  vite.ssrLoadModule("/src/lib/payment/identity.ts"),
  vite.ssrLoadModule("/src/components/PaymentQrCode.tsx"),
  vite.ssrLoadModule("/src/lib/payment/platform-payee.ts"),
  vite.ssrLoadModule("/src/lib/payment/types.ts"),
]);

test("MTN fixed-amount merchant instruction keeps existing USSD syntax", () => {
  assert.equal(
    buildRwandaUssdString("MTN MoMo", "momo_code", "123456", 1000),
    "*182*8*1*123456*1000#",
  );
});

test("Airtel fixed-amount merchant instruction keeps existing USSD syntax", () => {
  assert.equal(
    buildRwandaUssdString("Airtel Money", "momo_code", "567890", 2500),
    "*182*8*1*567890*2500#",
  );
});

test("eKash fixed-amount instruction keeps existing USSD syntax", () => {
  assert.equal(
    buildRwandaUssdString("Equity Bank (eKash)", "phone", "0788123456", 5000),
    "*555*2*0788123456*5000#",
  );
});

test("customer-amount offline instruction leaves amount collection to the provider menu", () => {
  assert.equal(buildRwandaUssdString("MTN MoMo", "momo_code", "123456"), "*182*8*1*123456#");
});

test("phone payment uses the existing Rwanda P2P USSD syntax", () => {
  assert.equal(
    buildRwandaUssdString("Airtel Money", "phone", "0788123456", 1000),
    "*182*1*1*0788123456*1000#",
  );
});

test("stand public identifier is stable and does not expose the full internal identifier", () => {
  assert.equal(
    identity.publicIdFromInternalId("12345678-1234-1234-1234-123456789abc"),
    "ish_1234567812341234",
  );
  assert.equal(
    identity.publicIdFromInternalId("12345678-1234-1234-1234-123456789abc"),
    "ish_1234567812341234",
  );
});

test("payment mode distinguishes fixed from customer-entered amounts", () => {
  assert.equal(identity.inferPaymentMode(1000), "FIXED_AMOUNT");
  assert.equal(identity.inferPaymentMode(null), "CUSTOMER_AMOUNT");
  assert.equal(identity.inferPaymentMode(0), "CUSTOMER_AMOUNT");
});

test("revoked stand is not payable", () => {
  assert.equal(identity.isStandPayable("active"), true);
  assert.equal(identity.isStandPayable("revoked"), false);
});

test("dynamic stand encodes one online URL QR while retaining its USSD fallback", () => {
  const payloads = buildStandPayloads({
    standId: "internal-stand-id",
    publicId: "ish_publicstand42",
    configVersion: 7,
    isDynamic: true,
    network: "MTN MoMo",
    paymentType: "momo_code",
    destination: "*182*8*1*123456#",
    amount: 1000,
    origin: "https://pay.example",
  });

  assert.equal(payloads.onlineUrl, "https://pay.example/p/ish_publicstand42");
  assert.equal(payloads.ussd, "*182*8*1*123456*1000#");
  assert.equal(payloads.offlineTelUri, `tel:${encodeURIComponent(payloads.ussd)}`);
  assert.equal(payloads.qrValue, payloads.onlineUrl);
  assert.equal(payloads.configVersion, 7);
  assert.equal(payloads.paymentMode, "FIXED_AMOUNT");
});

test("dynamic stand markup renders one online-first QR with a cached offline fallback notice", () => {
  const markup = renderToStaticMarkup(
    createElement(PaymentQrCode, {
      standId: "stand-qr-test",
      publicId: "ish_standqrtest",
      network: "MTN MoMo",
      paymentType: "momo_code",
      destination: "*182*8*1*123456#",
      isDynamic: true,
      size: 180,
    }),
  );

  assert.equal((markup.match(/<svg\b/g) || []).length, 1);
  assert.match(markup, /Scan once · online first, USSD fallback/);
  assert.match(markup, /opened online on this device before/);
  assert.doesNotMatch(markup, /Direct USSD · no internet/);
});

test("static stand markup retains a single offline QR", () => {
  const markup = renderToStaticMarkup(
    createElement(PaymentQrCode, {
      standId: "stand-static-test",
      network: "Equity Bank (eKash)",
      paymentType: "phone",
      destination: "0788123456",
      amount: 5000,
      isDynamic: false,
    }),
  );

  assert.equal((markup.match(/<svg\b/g) || []).length, 1);
  assert.match(markup, /Direct USSD · no internet/);
  assert.doesNotMatch(markup, /Scan once · online first/);
});

test.after(async () => {
  await vite.close();
});

test("Ishyura's own fees are paid to MoMo code 729710, registered under Jean De La Croix", () => {
  assert.equal(PLATFORM_MOMO_CODE, "729710");
  assert.equal(PLATFORM_PAYEE_NAME, "Jean De La Croix");
});

test("the fee QR carries the exact amount already filled in for every fee", () => {
  for (const price of Object.values(MONETIZATION_PRICES)) {
    const payloads = buildStandPayloads({
      standId: "ishyura-fee",
      publicId: null,
      configVersion: 1,
      isDynamic: false,
      network: "MTN MoMo",
      paymentType: "momo_code",
      destination: PLATFORM_MOMO_CODE,
      amount: price,
    });
    const expected = `*182*8*1*729710*${price}#`;
    assert.equal(
      buildRwandaUssdString("MTN MoMo", "momo_code", PLATFORM_MOMO_CODE, price),
      expected,
    );
    assert.ok(
      decodeURIComponent(payloads.qrValue).includes(expected),
      `QR for ${price} RWF should dial ${expected}, got ${payloads.qrValue}`,
    );
  }
});
