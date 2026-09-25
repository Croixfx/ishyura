// Ultra-Fast Edge Dynamic Payment Sheet Renderer (Sub-50ms TTFB)
// Serves customer scan requests (/p/:id or /pay/:id) directly from Cloudflare Edge
// Pure HTML/CSS with zero bloated client bundle overhead.

import { type AppEnv, corsHeaders } from "./api-router";

export interface PayRecord {
  id: string;
  business_name: string;
  network: string;
  payment_type: string;
  dial_code: string;
  phone_number?: string;
  amount?: number | null;
  item_name?: string | null;
  is_dynamic?: boolean | number;
}

export function formatRwf(amount: number): string {
  return `${Math.round(amount).toLocaleString()} RWF`;
}

export function computeDialString(
  network: string,
  paymentType: string,
  rawDialCode: string,
  amount?: number | null,
): { ussdString: string; telUri: string; rawCode: string } {
  const digits = rawDialCode.replace(/[^0-9]/g, "");
  const numAmount =
    typeof amount === "number" && !isNaN(amount) && amount > 0 ? Math.round(amount) : null;

  let ussdString = "";
  const cleanNet = network.toLowerCase();

  if (cleanNet.includes("equity") || cleanNet.includes("ekash")) {
    ussdString = numAmount ? `*555*2*${digits}*${numAmount}#` : `*555*2*${digits}#`;
  } else if (cleanNet.includes("airtel")) {
    if (paymentType === "momo_code") {
      ussdString = numAmount ? `*182*8*1*${digits}*${numAmount}#` : `*182*8*1*${digits}#`;
    } else {
      ussdString = numAmount ? `*182*1*1*${digits}*${numAmount}#` : `*182*1*1*${digits}#`;
    }
  } else {
    // Default to MTN MoMo
    if (paymentType === "momo_code") {
      ussdString = numAmount ? `*182*8*1*${digits}*${numAmount}#` : `*182*8*1*${digits}#`;
    } else {
      ussdString = numAmount ? `*182*1*1*${digits}*${numAmount}#` : `*182*1*1*${digits}#`;
    }
  }

  return {
    ussdString,
    telUri: `tel:${encodeURIComponent(ussdString)}`,
    rawCode: digits,
  };
}

export async function handleEdgePayPage(request: Request, rawEnv?: unknown): Promise<Response> {
  const env = (rawEnv || {}) as AppEnv;
  const url = new URL(request.url);

  // Extract ID from path: /p/:id or /pay/:id or ?id=...
  const pathParts = url.pathname.split("/").filter(Boolean);
  let id = url.searchParams.get("id") || "";
  if (!id && pathParts.length >= 2) {
    id = pathParts[1];
  } else if (!id && pathParts.length === 1 && pathParts[0] !== "p" && pathParts[0] !== "pay") {
    id = pathParts[0];
  }

  let record: PayRecord | null = null;

  if (id && env.DB) {
    try {
      record = await env.DB.prepare(
        "SELECT id, business_name, network, payment_type, dial_code, phone_number, amount, item_name, is_dynamic FROM qr_codes WHERE id = ? OR phone_number = ? LIMIT 1",
      )
        .bind(id, id)
        .first<PayRecord>();
    } catch (e) {
      console.warn("EdgePay lookup error:", e);
    }
  }

  // Fallback demo merchant if ID not found or testing
  if (!record) {
    // If query params are provided directly on URL, allow live preview without DB lookup
    const qName = url.searchParams.get("name");
    const qNet = url.searchParams.get("net");
    const qCode = url.searchParams.get("code");
    const qType = url.searchParams.get("type");
    const qAmt = url.searchParams.get("amt");
    const qItem = url.searchParams.get("item");

    if (qName || qCode) {
      record = {
        id: id || "preview",
        business_name: qName || "Demo Shop",
        network: qNet || "MTN MoMo",
        payment_type: qType || "momo_code",
        dial_code: qCode || "*182*8*1*123456#",
        amount: qAmt ? parseFloat(qAmt) : null,
        item_name: qItem || null,
        is_dynamic: 1,
      };
    } else {
      record = {
        id: id || "demo",
        business_name: "Ishyura Verified Merchant",
        network: "MTN MoMo",
        payment_type: "momo_code",
        dial_code: "*182*8*1*123456#",
        amount: 2500,
        item_name: "Quick Checkout",
        is_dynamic: 1,
      };
    }
  }

  const { ussdString, telUri, rawCode } = computeDialString(
    record.network,
    record.payment_type,
    record.dial_code,
    record.amount,
  );

  const isMtn = record.network.toLowerCase().includes("mtn");
  const isAirtel = record.network.toLowerCase().includes("airtel");
  const isEquity =
    record.network.toLowerCase().includes("equity") ||
    record.network.toLowerCase().includes("ekash");

  const brandColor = isEquity ? "#8b1e0f" : isAirtel ? "#dc2626" : "#eab308";
  const brandBg = isEquity ? "#450a0a" : isAirtel ? "#450a0a" : "#422006";
  const brandName = isEquity ? "Equity eKash" : isAirtel ? "Airtel Money" : "MTN MoMo";
  const brandIcon = isEquity ? "🏦" : isAirtel ? "🔴" : "🟡";

  const hasFixedPrice =
    typeof record.amount === "number" && !isNaN(record.amount) && record.amount > 0;
  const formattedAmount = hasFixedPrice ? formatRwf(record.amount!) : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Pay ${escapeHtml(record.business_name)} — Ishyura Instant Pay</title>
  <meta name="description" content="Instant 1-Tap Mobile Money &amp; Bank payment for ${escapeHtml(record.business_name)}" />
  <meta name="theme-color" content="${brandColor}" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #090d16;
      --card-bg: #131b2e;
      --card-border: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: ${brandColor};
      --brand-glow: ${brandColor}40;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f1f5f9;
        --card-bg: #ffffff;
        --card-border: #e2e8f0;
        --text: #0f172a;
        --muted: #64748b;
        --accent: ${brandColor};
        --brand-glow: ${brandColor}30;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      width: 100%;
      max-width: 440px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 28px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      animation: popIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .header-bar {
      height: 6px;
      background: linear-gradient(90deg, ${brandColor}, #3b82f6);
    }
    .content {
      padding: 24px 22px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: #10b981;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    .shop-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.2;
      color: var(--text);
      margin-bottom: 6px;
      word-break: break-word;
    }
    .network-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 8px;
      background: ${brandBg};
      color: ${brandColor};
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .amount-box {
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      border: 1.5px dashed var(--card-border);
      border-radius: 20px;
      padding: 18px 16px;
      margin-bottom: 22px;
    }
    .amount-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .amount-val {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: var(--accent);
      line-height: 1.1;
    }
    .item-desc {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      margin-top: 6px;
    }
    .code-box {
      width: 100%;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .code-label {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
      text-align: left;
    }
    .code-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
      text-align: left;
      margin-top: 2px;
    }
    .copy-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .copy-btn:active {
      transform: scale(0.95);
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }
    .pay-btn {
      width: 100%;
      background: var(--accent);
      color: ${isEquity || isAirtel ? "#ffffff" : "#0f172a"};
      text-decoration: none;
      font-size: 17px;
      font-weight: 800;
      padding: 18px 20px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 10px 25px -5px var(--brand-glow);
      transition: transform 0.12s ease, filter 0.12s ease;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .pay-btn:active {
      transform: scale(0.97);
      filter: brightness(0.92);
    }
    .hint-text {
      font-size: 12px;
      color: var(--muted);
      margin-top: 14px;
      line-height: 1.4;
    }
    .footer {
      margin-top: 20px;
      font-size: 11px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .footer a {
      color: var(--muted);
      text-decoration: none;
      font-weight: 600;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #10b981;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      z-index: 999;
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar"></div>
    <div class="content">
      <div class="verified-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Verified Ishyura Pay</span>
      </div>

      <h1 class="shop-title">${escapeHtml(record.business_name)}</h1>

      <div class="network-pill">
        <span>${brandIcon}</span>
        <span>${escapeHtml(brandName)}</span>
      </div>

      ${
        hasFixedPrice
          ? `<div class="amount-box">
              <div class="amount-label">Pay Fixed Amount</div>
              <div class="amount-val">${escapeHtml(formattedAmount)}</div>
              ${record.item_name ? `<div class="item-desc">${escapeHtml(record.item_name)}</div>` : ""}
            </div>`
          : ""
      }

      <div class="code-box">
        <div>
          <div class="code-label">${record.payment_type === "momo_code" ? "Merchant Pay Code" : "Recipient Phone"}</div>
          <div class="code-val">${escapeHtml(rawCode)}</div>
        </div>
        <button class="copy-btn" id="copyBtn" onclick="copyUssd('${escapeHtml(ussdString)}')">Copy Code</button>
      </div>

      <a href="${telUri}" class="pay-btn" id="dialBtn" onclick="triggerDial()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        <span>1-Tap Dial &amp; Pay ${hasFixedPrice ? escapeHtml(formattedAmount) : ""}</span>
      </a>

      <p class="hint-text">
        Tapping opens your phone's dialer with <strong>${escapeHtml(ussdString)}</strong> ready. Just tap Call &amp; enter your PIN.
      </p>
    </div>
  </div>

  <div class="footer">
    <span>Instant Edge Pay by</span>
    <a href="/" target="_blank">Ishyura.rw</a>
    <span>• Zero Extra Fee</span>
  </div>

  <div class="toast" id="toastMsg">USSD Code Copied!</div>

  <script>
    function showToast(msg) {
      var t = document.getElementById("toastMsg");
      t.innerText = msg;
      t.classList.add("show");
      if (navigator.vibrate) navigator.vibrate(40);
      setTimeout(function() { t.classList.remove("show"); }, 2000);
    }
    function copyUssd(code) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(function() {
          showToast("Copied: " + code);
        }).catch(function() {
          showToast("Code: " + code);
        });
      } else {
        showToast("Code: " + code);
      }
    }
    function triggerDial() {
      if (navigator.vibrate) navigator.vibrate([40, 50, 40]);
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      ...corsHeaders(),
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
