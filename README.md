# Quick Pay Card

Build a mobile-first, modern, single-page React web application called "Ishyura" (which means "Pay" in Kinyarwanda). It is a zero-login, fully client-side instant USSD QR Code generator for local shop owners to receive Mobile Money payments.

Tech Stack & Libraries:

- React (Vite)

- Tailwind CSS

- shadcn/ui (for clean, accessible inputs, buttons, and selects)

- Lucide React (for icons)

- qrcode.react (to generate the QR code)

- html-to-image (to capture and download the QR card div as a high-res PNG)

Design System & UX:

- Must have a flawless Dark and Light mode toggle.

- Design must be "stupid simple," ultra-clean, minimal, and mobile-first. No clutter, no placeholders.

- Colors: Slate/Gray scale for the app background and inputs, with primary Blue accents for the brand and primary action buttons.

- Responsive: Perfectly centered and padded on mobile screens, max-width constrained (e.g., max-w-md) on desktop so it feels like a native mobile app.

App Layout & Features:

1. Header:

- Left side: A clean lightning bolt icon (Lucide) and the text "Ishyura" in bold blue.

- Right side: A subtle theme toggle icon (Sun/Moon).

2. Input Form (Visible immediately):

- "Business Name" (Text input).

- "Network" (Select dropdown: "MTN MoMo" or "Airtel Money").

- "MoMo Phone Number / Code" (Tel input).

3. Reactive Logic:

- Calculate the USSD String dynamically.

  - If MTN: `*182*8*1*[PhoneNumber]#`

  - If Airtel: `*182*2*1*[PhoneNumber]#`

- The "Live Preview Card" and "Download" button MUST remain completely hidden until both the Business Name and Phone Number inputs have values.

4. Live Preview Card (The actual printable tent card):

- This is the div that will be downloaded. It must have a white background (even in dark mode) so it prints perfectly.

- Top edge: A thin, colorful gradient strip (yellow to blue) for flair.

- Content, centered:

  - Small text: "SCAN & PAY"

  - Large bold text: [Business Name]

  - The QR Code (generated using `qrcode.react`, encoding the dynamic USSD string).

  - A small gray box showing the raw USSD string underneath the QR code.

  - Small text at the bottom: "Point phone camera to pay".

- Footer of the card: Left side shows "[Network] Merchant", Right side shows "Ishyura" in bold blue.

5. Download Button:

- A large, prominent button below the preview card: "Download QR Code (PNG)".

- When clicked, use `html-to-image` to capture the "Live Preview Card" div at a high pixel ratio (e.g., pixelRatio: 3 for print quality) and trigger a browser download. The file name should be the `[BusinessName]_ishyura.png` (formatted without spaces).

Make the UI beautiful, add subtle transitions on inputs/buttons, and ensure the state updates the QR code instantly without lag.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Cloudflare Automated Deployment & GitHub Secrets Setup

The repository includes a GitHub Actions CI/CD workflow in `.github/workflows/deploy.yml` that builds the application, applies Cloudflare D1 migrations automatically, and deploys the Cloudflare Worker.

To enable automated deployment:

1. Open your repository on GitHub.
2. Go to **Settings** > **Secrets and variables** > **Actions**.
3. Under **Repository secrets**, click **New repository secret**:
   - **`CLOUDFLARE_API_TOKEN`**: Create an API Token in [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) using the **Edit Cloudflare Workers** template (or custom token with `Account: Worker Scripts: Edit` and `D1: Edit` permissions).
   - **`CLOUDFLARE_ACCOUNT_ID`**: Found in your Cloudflare dashboard URL or on the right sidebar of the Workers & Pages dashboard overview.
4. Once added, subsequent pushes to `main` will automatically build, apply database migrations, and deploy.
