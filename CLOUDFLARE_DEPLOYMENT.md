# Cloudflare Deployment & Live Twilio Setup Guide

This guide covers deploying **Ishyura** on **Cloudflare** (Cloudflare Pages + DNS) and configuring live **Twilio** credentials to send real SMS OTPs to mobile devices.

---

## 1. Twilio Live Credentials Configuration

To deliver real SMS messages across telecom networks (MTN Rwanda, Airtel Rwanda, and international), you need credentials from your [Twilio Console](https://console.twilio.com):

### Step 1.1: Obtain your Twilio Credentials
1. Log into [console.twilio.com](https://console.twilio.com).
2. On your dashboard, locate:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "View" to reveal)
   - **Twilio Phone Number** (or Active Sender Number in E.164 format, e.g. `+12025550143`)
   *(Optional)* If you use Twilio Verify API instead of Messaging API, locate your **Verify Service SID** (starts with `VA...`).

### Step 1.2: Set the Credentials in `.env`
In your environment (or AI Studio Settings menu):

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Optional (only if using Twilio Verify service):
TWILIO_VERIFY_SERVICE_SID=
```

> **Note for Rwandan numbers (+250)**: Standard Twilio SMS can send to Rwanda mobile carriers (MTN `+25078/79`, Airtel `+25072/73`). Ensure international SMS / Geo Permissions are enabled in your Twilio Console under **Messaging > Settings > Geo permissions > Rwanda**.

---

## 2. Deploying the Frontend to Cloudflare Pages

### Option A: Git Integration (Recommended)
1. Push this repository to your **GitHub** or **GitLab** account.
2. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Compute (Workers & Pages)** > **Create application** > **Pages** > **Connect to Git**.
3. Select your repository and configure build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js Version**: In Environment Variables, set `NODE_VERSION` = `20`.
   - **Backend API URL**: Set `VITE_BACKEND_URL` to your live backend endpoint (e.g. `https://api.yourdomain.com`).
4. Click **Save and Deploy**. Cloudflare Pages will build and deploy your site to `https://<your-project>.pages.dev`.

### Option B: Deploy via Cloudflare Wrangler CLI
From your terminal:
```bash
# 1. Build the production bundle
npm run build

# 2. Deploy directly to Cloudflare Pages
npx wrangler pages deploy dist --project-name=ishyura
```

---

## 3. Backend Deployment & Cloudflare Reverse Proxy / DNS

The FastAPI backend (`/ishyurabackend`) handles Twilio SMS dispatch and JWT user authentication:

### Running the Backend on Cloud Run / VPS / Render
1. Deploy the backend container (or run via Docker/Uvicorn on port 8000).
2. Set environment variables on the backend host:
   ```env
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   JWT_SECRET_KEY=super-secret-key-32-chars-long
   CORS_ORIGINS=https://ishyura.pages.dev,https://yourdomain.com
   ```

### Connecting with Cloudflare DNS & SSL
1. In the **Cloudflare Dashboard**, navigate to your domain's **DNS** settings.
2. Add a `CNAME` record:
   - Name: `api` (or `@` for root)
   - Target: your deployed Cloud Run URL or server hostname
   - Proxy status: **Proxied (Orange Cloud)** to get Cloudflare DDoS protection, Edge caching, and free SSL.
3. In your Cloudflare Pages environment variables, set:
   ```env
   VITE_BACKEND_URL=https://api.yourdomain.com
   ```

---

## 4. Verification Checklist
- [ ] Twilio Account SID, Auth Token, and Sender Number added to environment.
- [ ] Cloudflare Pages build succeeds with output directory `dist`.
- [ ] Visiting the live site allows clicking **Register / Sign In**, entering a phone number, and receiving a live Twilio SMS.
