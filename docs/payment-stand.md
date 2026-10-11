# Payment stand domain and device checks

## Current integration

The existing `qr_codes` rows remain the source for merchant-facing payment details and retain their current IDs, so existing `/p/:id` links continue to resolve. The additive payment domain adds:

- `payment_destinations` for the recipient, provider, payment method, currency, status, and destination version.
- `payment_stands` for a stable public identifier, merchant/stand linkage, mode, configuration version, and active/revoked state.
- `payment_events` for requests that actually reached Ishyura.

Legacy rows are backfilled without deleting or rewriting them. The current `is_dynamic` PRO setting remains in force: PRO/dynamic stands print one online-first QR; basic stands retain their existing direct-USSD QR. The current admin and merchant portals, auth, stand tiers, and USSD strings are preserved.

## Customer flows

- **Online-first (dynamic/PRO):** scan the single QR → `/p/:publicId` resolves the current stand and destination → enter a positive whole-RWF amount when the stand is customer-amount → Ishyura launches the provider's existing USSD instruction.
- **Best-effort offline fallback:** the PWA uses a network-first cache for `/p/:publicId` pages. If the device cannot reach the network, it can use the previously cached payment page and its USSD dial action. Pages are cached for up to 24 hours. The offline page warns that its saved recipient/configuration may be out of date.
- **Basic stand offline (direct):** scan the direct-USSD QR → native phone handling of the existing `tel:` URI → continue in the provider's USSD flow. No Ishyura customer app or internet is required.
- **Fixed amount:** the offline URI includes the configured amount. The online page uses the same current amount.
- **Customer amount:** offline USSD opens the provider menu without an Ishyura-entered amount; dynamic Ishyura amount entry requires internet.

The single dynamic QR always contains an HTTPS URL. It cannot guarantee a first-ever offline scan: the device must already have registered Ishyura's service worker and cached that stand's payment page while online. Browser scanner behavior, service-worker support, and cache eviction vary by device. The network-first cache tries the live page first, then falls back to the saved page on a network failure or after a short timeout. Basic stands continue to use a direct-USSD QR for reliable offline dialing. The existing dynamic entitlement is not extended to basic stands.

## Analytics and revocation limits

Only online page requests can generate an `access` event; this is an observed request, not proof that a camera scanned a physical QR. The online dial action submits a `payment_initiation` event with the selected amount, provider, current configuration version, and a truncated user-agent string. IP addresses are not stored. A cached offline fallback or basic direct-USSD scan that never contacts Ishyura is unobserved and is not represented as a server event.

Online resolution checks stand and destination status on each network request. The service-worker fallback can show a cached page for up to 24 hours without a current revocation/version check; it may therefore display stale payment details. Public stand IDs are stable routing identifiers, not authorization secrets. Revocation/version checks cannot reach a basic stand's printed `tel:` QR or a passive NFC tag. The existing “Verified Merchant” print label represents Ishyura registration only; it is not a cryptographic signature or tamper-detection guarantee. Payload signing is not implemented.

NFC is kept behind the same payload builder, but the builder currently emits one NDEF URI choice. Multi-record tag behavior differs across phone vendors and must not be treated as a reliable automatic online/offline resolver.

## Manual device checklist

Record device model, OS version, scanner used, SIM configuration, connectivity state, and observed URI before release.

### iPhone

- [ ] Native Camera scans the direct-USSD QR and presents the expected carrier/SIM selection.
- [ ] Confirm the full encoded USSD string is preserved, including `*`, `#`, and fixed amount.
- [ ] Scan the single dynamic QR online; confirm merchant, amount entry/fixed amount, and dialer launch.
- [ ] Open the dynamic page online so it is cached, then disable Wi-Fi and cellular data; rescan and confirm the saved page opens with an offline warning and can launch the native flow.
- [ ] Confirm the first-ever scan while offline is not expected to work.
- [ ] Test both single-SIM and dual-SIM behavior where available.

### Android

- [ ] Test at least one Pixel/AOSP camera and one common OEM camera.
- [ ] Test Google Lens separately; confirm the `tel:` URI is not silently rewritten.
- [ ] Test the single dynamic QR online; confirm amount entry/fixed amount and dialer launch.
- [ ] Open the dynamic page online so it is cached, then disable internet; rescan and confirm the cached page's offline warning and dialer action.
- [ ] Confirm the first-ever scan while offline is not expected to work.
- [ ] Confirm the basic stand's direct-USSD QR works without internet.
- [ ] Verify dual-SIM selection and the complete USSD string on each device.

### NFC and configuration changes

- [ ] Test the encoded NFC URI on iPhone and Android without an Ishyura customer app.
- [ ] Confirm whether each OS opens HTTPS or `tel:` and whether it exposes multiple NDEF records; do not assume identical behavior.
- [ ] Update a dynamic destination and verify its stable online QR resolves the new configuration and increments version.
- [ ] Revoke a destination and verify the online route rejects it; separately confirm that an already printed/stored offline URI remains usable and is not remotely revoked.
- [ ] Record offline attempts only in the manual results; do not expect server analytics for them.
