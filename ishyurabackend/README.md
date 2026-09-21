# Ishyura Backend Service

A high-performance asynchronous Python backend built with **FastAPI**, **SQLAlchemy 2.0 (asyncio + aiosqlite)**, and **Pydantic v2** supporting seamless **Soft Registration**, JWT authentication, and QR generation history.

## Architecture & Features

1. **Soft Registration**:
   - Merchants can start by providing just their phone number (`POST /auth/request-otp`).
   - If the user doesn't exist, a soft profile (`is_fully_registered = False`) is provisioned on the fly.
   - An OTP is generated and printed to the terminal console.

2. **Verification & JWT Issuance**:
   - `POST /auth/verify-otp` validates the 6-digit OTP code and returns an authentic JWT bearer access token (`sub: <user_id>`).

3. **Persistent QR History**:
   - Authenticated merchants can save their generated payment QR cards (`POST /qr/create`).
   - Retrieve all past payment cards anytime (`GET /qr/list`).

4. **Zero-Loss Account Upgrade**:
   - Soft users can upgrade to full accounts with email and password (`POST /auth/upgrade`).
   - Updates the existing database record in-place, keeping all historical QR codes intact.

---

## Local Development Setup

### 1. Create and activate a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the FastAPI server

```bash
uvicorn main:app --reload --port 8000
```

Interactive Swagger documentation is available at `http://127.0.0.1:8000/docs`.

## Real OTP SMS Delivery (Twilio)

The backend dispatches real SMS verification codes to Rwandan and international mobile numbers via **Twilio**:
- **Twilio SMS API**: Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` in `.env`.
- **Twilio Verify API (Optional)**: Set `TWILIO_VERIFY_SERVICE_SID` if using Twilio's managed Verify service.
- **Development Fallback**: When Twilio keys are not set, it generates a secure code, logs it directly to the server terminal, and returns it for development testing.
*(Additional regional providers like Africa's Talking will be integrated in later milestones).*

| Method | Endpoint            | Auth         | Description                                  |
| ------ | ------------------- | ------------ | -------------------------------------------- |
| `POST` | `/auth/request-otp` | Public       | Request OTP (soft registration if new phone) |
| `POST` | `/auth/verify-otp`  | Public       | Verify OTP & receive JWT access token        |
| `POST` | `/qr/create`        | Bearer Token | Save generated QR card                       |
| `GET`  | `/qr/list`          | Bearer Token | Fetch user's QR cards history                |
| `POST` | `/auth/upgrade`     | Bearer Token | Upgrade soft account to full account         |
| `GET`  | `/users/me`         | Bearer Token | Get current user profile and status          |
