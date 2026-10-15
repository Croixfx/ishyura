// Ultra-Fast Edge Dynamic Payment Sheet Renderer (Sub-50ms TTFB)
// Serves customer scan requests (/p/:id or /pay/:id) directly from Cloudflare Edge
// Pure HTML/CSS with zero bloated client bundle overhead.
// Fully automated carrier detection — NEVER asks the user to choose between SIM cards!

import { ensureD1Tables, type AppEnv, corsHeaders } from "./api-router";
import { buildRwandaUssdString, extractMerchantOrAccountCode } from "./momo-formatters";
import { mapNetworkToProvider } from "./payment/ussd";

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
  owner_id?: string | null;
  public_id?: string | null;
  config_version?: number | null;
  status?: string | null;
  destination_status?: string | null;
}

export function formatRwf(amount: number): string {
  return `${Math.round(amount).toLocaleString()} RWF`;
}

export async function handleEdgePayPage(request: Request, rawEnv?: unknown): Promise<Response> {
  const env = (rawEnv || {}) as AppEnv;
  const url = new URL(request.url);

  // Extract ID from path: /p/:id or /pay/:id or ?id=...
  const pathParts = url.pathname.split("/").filter(Boolean);
  let id = url.searchParams.get("id") || "";
  if (!id && pathParts.length >= 2) {
    id = pathParts[1] || "";
  } else if (!id && pathParts.length === 1 && pathParts[0] !== "p" && pathParts[0] !== "pay") {
    id = pathParts[0] || "";
  }

  let record: PayRecord | null = null;

  if (id && env.DB) {
    await ensureD1Tables(env.DB);
    record = await env.DB.prepare(
      "SELECT q.id, q.owner_id, s.public_id, s.config_version, s.status, q.business_name, q.network, q.payment_type, q.dial_code, q.phone_number, q.amount, q.item_name, q.is_dynamic, d.status AS destination_status " +
        "FROM qr_codes q JOIN payment_stands s ON s.id = q.id " +
        "LEFT JOIN payment_destinations d ON d.id = s.payment_destination_id " +
        "WHERE q.id = ? OR s.public_id = ? LIMIT 1",
    )
      .bind(id, id)
      .first<PayRecord>();
  }

  // Explicit query-parameter preview used by the merchant UI.
  if (!record) {
    const qName = url.searchParams.get("name");
    const qNet = url.searchParams.get("net");
    const qCode = url.searchParams.get("code");
    const qType = url.searchParams.get("type");
    const qAmt = url.searchParams.get("amt");
    const qItem = url.searchParams.get("item");

    if (qName || qCode) {
      record = {
        id: "preview",
        business_name: qName || "Demo Shop",
        network: qNet || "MTN MoMo",
        payment_type: qType || "momo_code",
        dial_code: qCode || "*182*8*1*123456#",
        amount: qAmt ? parseFloat(qAmt) : null,
        item_name: qItem || null,
        is_dynamic: 1,
      };
    }
  }

  if (!record) {
    return new Response("Payment stand not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() },
    });
  }
  if (record.status === "revoked" || record.destination_status === "revoked") {
    return new Response("This payment destination is no longer active.", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() },
    });
  }
  if (record.id !== "preview" && !record.is_dynamic) {
    return new Response("Online payment is not enabled for this stand.", {
      status: 409,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() },
    });
  }

  if (request.method === "GET" && env.DB && record.id !== "preview") {
    try {
      await env.DB.prepare(
        "INSERT INTO payment_events (id, stand_id, merchant_id, public_id, event_type, path, provider, user_agent, config_version) " +
          "VALUES (?, ?, ?, ?, 'access', 'online', ?, ?, ?)",
      )
        .bind(
          crypto.randomUUID(),
          record.id,
          record.owner_id || null,
          record.public_id || null,
          mapNetworkToProvider(record.network),
          (request.headers.get("user-agent") || "").slice(0, 512),
          record.config_version || 1,
        )
        .run();
    } catch (error) {
      console.warn("Payment access analytics could not be recorded:", error);
    }
  }

  // 1. Determine merchant's registered network directly
  const net = (record.network || "").toLowerCase();
  const isAirtel = net.includes("airtel");
  const isEquity = net.includes("equity") || net.includes("ekash");
  const isMtn = !isAirtel && !isEquity;

  const brandName = isEquity ? "Equity eKash" : isAirtel ? "Airtel Money" : "MTN MoMo";
  const brandColor = isEquity ? "#8b1e0f" : isAirtel ? "#dc2626" : "#eab308";
  const brandIcon = isEquity ? "🏦" : isAirtel ? "🔴" : "🟡";
  const cleanCode = extractMerchantOrAccountCode(record.dial_code);
  const paymentType = record.payment_type || "momo_code";

  const baseUssd = buildRwandaUssdString(record.network, paymentType, cleanCode).replace(/#$/, "");

  const hasFixedPrice =
    typeof record.amount === "number" && !isNaN(record.amount) && record.amount > 0;
  const initialAmount = hasFixedPrice ? Math.round(record.amount!) : null;
  const initialUssd = buildRwandaUssdString(record.network, paymentType, cleanCode, initialAmount);
  const initialTelUri = `tel:${encodeURIComponent(initialUssd)}`;
  const formattedAmount = hasFixedPrice ? formatRwf(record.amount!) : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Pay ${escapeHtml(record.business_name)} — Ishyura Instant Pay</title>
  <meta name="description" content="Instant 1-Tap Mobile Money payment for ${escapeHtml(record.business_name)} via ${escapeHtml(brandName)}." />
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
      justify-content: flex-start;
      min-height: 100dvh;
      padding: 12px 14px 24px;
      -webkit-font-smoothing: antialiased;
      overflow-y: auto;
      overscroll-behavior-y: contain;
    }
    .container {
      width: 100%;
      max-width: 440px;
      margin: auto 0;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      animation: popIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .header-bar {
      height: 5px;
      background: linear-gradient(90deg, #eab308, #dc2626, #8b1e0f);
    }
    .content {
      padding: 20px 18px 22px;
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
      margin-bottom: 12px;
    }
    .shop-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.2;
      color: var(--text);
      margin-bottom: 8px;
      word-break: break-word;
    }

    /* Merchant Network Badge */
    .merchant-network-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      font-size: 12px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 18px;
    }
    .merchant-network-icon {
      font-size: 15px;
      line-height: 1;
    }
    .badge-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--muted);
      opacity: 0.6;
    }

    /* Interactive Amount Input Box */
    .amount-input-box {
      width: 100%;
      background: rgba(255, 255, 255, 0.03);
      border: 1.5px solid var(--card-border);
      border-radius: 20px;
      padding: 16px;
      margin-bottom: 18px;
      text-align: left;
    }
    .amount-input-label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .amount-field-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(0, 0, 0, 0.25);
      border: 1.5px solid var(--card-border);
      border-radius: 14px;
      padding: 8px 14px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .amount-field-wrap:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 16px -4px var(--brand-glow);
    }
    .currency-prefix {
      font-size: 13px;
      font-weight: 800;
      color: var(--muted);
    }
    .amount-input {
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      font-size: 26px;
      font-weight: 900;
      color: var(--text);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .amount-input::placeholder {
      color: rgba(255, 255, 255, 0.18);
    }
    .dismiss-kbd-btn {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid var(--card-border);
      color: var(--text);
      font-size: 11px;
      font-weight: 700;
      padding: 6px 11px;
      border-radius: 9px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.12s ease;
      user-select: none;
    }
    .dismiss-kbd-btn:hover {
      background: var(--accent);
      color: #0f172a;
    }
    .dismiss-kbd-btn:active {
      transform: scale(0.94);
    }
    .quick-amounts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }
    .quick-chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 6px 11px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.12s ease;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .quick-chip:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .quick-chip:active {
      transform: scale(0.95);
      background: var(--accent);
      color: #0f172a;
    }

    .amount-box {
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      border: 1.5px dashed var(--card-border);
      border-radius: 20px;
      padding: 16px;
      margin-bottom: 18px;
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
      font-size: 34px;
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
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .code-label {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
      text-align: left;
    }
    .code-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 18px;
      font-weight: 900;
      color: var(--text);
      text-align: left;
      margin-top: 2px;
      letter-spacing: 0.03em;
    }
    .code-ussd {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      text-align: left;
      margin-top: 3px;
    }
    .copy-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .copy-btn:active {
      transform: scale(0.95);
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }

    /* Massive Direct 1-Tap Pay Button */
    .pay-btn {
      width: 100%;
      background: var(--accent);
      color: ${isMtn ? "#0f172a" : "#ffffff"};
      text-decoration: none;
      font-size: 16px;
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
      cursor: pointer;
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
    .offline-warning {
      display: none;
      margin: 0 0 16px;
      padding: 10px 12px;
      border: 1px solid #f59e0b;
      border-radius: 10px;
      background: rgba(245, 158, 11, 0.12);
      color: var(--text);
      font-size: 12px;
      line-height: 1.45;
    }
    .merchant-top-banner {
      width: 100%;
      max-width: 440px;
      margin-bottom: 12px;
      padding: 10px 16px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: var(--muted);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .merchant-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 800;
      white-space: nowrap;
    }
    .merchant-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body data-payment-stand-id="${escapeHtml(record.public_id || record.id)}" data-trackable="${record.id !== "preview" && env.DB ? "true" : "false"}" data-fixed-amount="${hasFixedPrice ? initialAmount : ""}">
  <div class="merchant-top-banner">
    <span>🏪 Merchant of this shop?</span>
    <a href="/" class="merchant-link">Open Ishyura Studio →</a>
  </div>
  <div class="container">
    <div class="header-bar"></div>
    <div class="content">
      <div class="offline-warning" id="offlineWarning" role="status">
        You are offline and using saved payment details. Confirm the recipient and amount before dialing; saved details may be out of date.
      </div>
      <div class="verified-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${record.is_dynamic ? "Verified PRO Smart Stand" : "Verified Ishyura Pay"}</span>
      </div>

      <h1 class="shop-title">${escapeHtml(record.business_name)}</h1>

      <!-- Merchant Terminal Badge (Dedicated Merchant Network) -->
      <div class="merchant-network-badge">
        <span class="merchant-network-icon">${brandIcon}</span>
        <span>${escapeHtml(brandName)}</span>
        <span class="badge-dot"></span>
        <span>${record.payment_type === "phone" ? "Phone" : "Code"}: <strong>${escapeHtml(cleanCode)}</strong></span>
      </div>

      ${
        hasFixedPrice
          ? `<div class="amount-box">
              <div class="amount-label">Pre-set Bill / Amount to Pay</div>
              <div class="amount-val">${escapeHtml(formattedAmount)}</div>
              ${record.item_name ? `<div class="item-desc">${escapeHtml(record.item_name)}</div>` : ""}
            </div>`
          : `<div class="amount-input-box">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <label for="amountInput" class="amount-input-label" style="margin-bottom: 0;">Enter Amount to Pay (RWF)</label>
                <button type="button" class="dismiss-kbd-btn" onclick="dismissKeyboard()">Done ✓</button>
              </div>
              <div class="amount-field-wrap">
                <span class="currency-prefix">RWF</span>
                <input
                  type="text"
                  id="amountInput"
                  class="amount-input"
                  placeholder="0"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  oninput="updateAmount(this.value)"
                  autocomplete="off"
                />
              </div>
              <div class="quick-amounts">
                <button type="button" class="quick-chip" onclick="setQuickAmount(500)">+500</button>
                <button type="button" class="quick-chip" onclick="setQuickAmount(1000)">+1,000</button>
                <button type="button" class="quick-chip" onclick="setQuickAmount(2000)">+2,000</button>
                <button type="button" class="quick-chip" onclick="setQuickAmount(5000)">+5,000</button>
                <button type="button" class="quick-chip" onclick="setQuickAmount(10000)">+10,000</button>
              </div>
            </div>`
      }

      <!-- Direct Dial Action (Placed directly below amount for immediate thumb reach) -->
      <a href="${initialTelUri}" class="pay-btn" id="dialBtn" onclick="return triggerDial(event)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        <span id="btnLabel">${hasFixedPrice ? `Dial &amp; Pay ${escapeHtml(formattedAmount)}` : `Dial &amp; Pay via ${escapeHtml(brandName)}`}</span>
      </a>

      <!-- Merchant Details & USSD Code Box (Below Primary CTA) -->
      <div class="code-box">
        <div>
          <div class="code-label">${record.payment_type === "phone" ? "Recipient Phone" : "Merchant Code (Code y'Umucuruzi)"}</div>
          <div class="code-val">${escapeHtml(cleanCode)}</div>
          <div class="code-ussd" id="ussdPreview">${escapeHtml(initialUssd)}</div>
        </div>
        <button type="button" class="copy-btn" id="copyBtn" onclick="copyCurrentUssd()">Copy Code</button>
      </div>

      <p class="hint-text" id="hintText">
        Tapping opens your phone dialer with <strong>${escapeHtml(initialUssd)}</strong> ready. If your phone is Dual-SIM, choose your <strong>${escapeHtml(brandName)}</strong> SIM to dial.
      </p>
    </div>
  </div>

  <div class="footer">
    <span>Need to generate payment stands?</span>
    <a href="/">Create with Ishyura</a>
    <span>• Zero Fee</span>
  </div>

  <div class="toast" id="toastMsg">USSD Code Copied!</div>

  <script>
    var baseUssd = "${baseUssd}";
    var brandName = "${escapeHtml(brandName)}";
    var currentUssd = "${escapeHtml(initialUssd)}";

    function formatRwf(val) {
      return Number(val).toLocaleString() + " RWF";
    }

    function updateOfflineWarning() {
      document.body.classList.toggle(
        "is-offline",
        document.body.dataset.cachedFallback === "true" || !navigator.onLine,
      );
    }

    updateOfflineWarning();
    window.addEventListener("online", updateOfflineWarning);
    window.addEventListener("offline", updateOfflineWarning);

    function dismissKeyboard() {
      var input = document.getElementById("amountInput");
      if (input) {
        input.blur();
      }
      var dialBtn = document.getElementById("dialBtn");
      if (dialBtn) {
        dialBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    function updateAmount(val) {
      var raw = String(val || "").replace(/[^0-9]/g, "");
      var num = raw ? Number(raw) : 0;
      var dialBtn = document.getElementById("dialBtn");
      var ussdPreview = document.getElementById("ussdPreview");
      var btnLabel = document.getElementById("btnLabel");
      var hintText = document.getElementById("hintText");

      if (Number.isSafeInteger(num) && num > 0) {
        currentUssd = baseUssd + "*" + num + "#";
        btnLabel.innerText = "Dial & Pay " + formatRwf(num);
      } else {
        currentUssd = baseUssd + "#";
        btnLabel.innerText = "Dial & Pay via " + brandName;
      }

      dialBtn.href = "tel:" + encodeURIComponent(currentUssd);
      ussdPreview.innerText = currentUssd;
      hintText.innerHTML = "Tapping opens your phone dialer with <strong>" + currentUssd + "</strong> ready. If your phone is Dual-SIM, choose your <strong>" + brandName + "</strong> SIM to dial.";
    }

    function setQuickAmount(amt) {
      var input = document.getElementById("amountInput");
      if (input) {
        var current = parseInt(String(input.value || "0").replace(/[^0-9]/g, ""), 10) || 0;
        var next = current + amt;
        input.value = next;
        updateAmount(next);
        input.blur(); // Dismiss software keyboard so payment button is clearly visible!
      }
    }

    var amtInput = document.getElementById("amountInput");
    if (amtInput) {
      amtInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter" || e.keyCode === 13) {
          e.preventDefault();
          dismissKeyboard();
        }
      });
    }

    function showToast(msg) {
      var t = document.getElementById("toastMsg");
      t.innerText = msg;
      t.classList.add("show");
      if (navigator.vibrate) navigator.vibrate(30);
      setTimeout(function() { t.classList.remove("show"); }, 2200);
    }

    function copyCurrentUssd() {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(currentUssd).then(function() {
          showToast("Copied: " + currentUssd);
        }).catch(function() {
          showToast("Code: " + currentUssd);
        });
      } else {
        showToast("Code: " + currentUssd);
      }
    }

    function triggerDial(event) {
      var fixedAmount = Number(document.body.dataset.fixedAmount || 0);
      var input = document.getElementById("amountInput");
      var enteredAmount = input ? Number(String(input.value || "").replace(/[^0-9]/g, "")) : 0;
      var amount = fixedAmount || enteredAmount;
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        event.preventDefault();
        showToast("Enter a valid amount first.");
        return false;
      }

      if (document.body.dataset.trackable === "true") {
        var body = JSON.stringify({
          stand_id: document.body.dataset.paymentStandId,
          amount: amount
        });
        var payload = new Blob(
          [body],
          { type: "application/json" }
        );
        if (!navigator.sendBeacon || !navigator.sendBeacon("/api/payment-events", payload)) {
          fetch("/api/payment-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body,
            keepalive: true
          }).catch(function(error) {
            console.warn("Payment initiation analytics could not be sent.", error);
          });
        }
      }
      if (navigator.vibrate) navigator.vibrate([40, 50, 40]);
      return true;
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
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
