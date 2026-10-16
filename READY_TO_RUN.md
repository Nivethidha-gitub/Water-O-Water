# Water-O-Water — run and launch checklist

This repository contains the Expo mobile app, API, web app, shared theme/contracts, and development infrastructure.

## 1. Requirements
- Node.js 22.5 or newer
- npm
- Android phone with Expo Go or an Android emulator (for mobile testing)
- MongoDB is **not** the current database implementation in this repository. The API currently uses SQLite (`node:sqlite`, with optional `better-sqlite3`). Do not point a MongoDB URL at this version.

## 2. Install and run the API (Windows PowerShell)
From the repository root:

```powershell
npm install
npm run dev:api
```

Check `http://localhost:3001/v1/health`. A phone cannot use `localhost` to reach your PC: in the mobile app's server settings, enter your PC's LAN IP, for example `http://192.168.1.10:3001/v1` (use your actual IP).

## 3. Run the mobile app
Open a second PowerShell window:

```powershell
cd apps/mobile
npm install
npx expo install --check
npx expo start
```

Scan the QR code using Expo Go on the same Wi-Fi network. If Expo reports incompatible packages, follow the exact package versions suggested by `npx expo install` for the installed Expo SDK.

## 4. Enable real SMS OTP (required for real signups)
Create a Twilio Verify Service, then set these server-side environment variables. Never put Twilio secrets in the mobile app:

```text
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...
```

The phone must use international E.164 format, e.g. `+919876543210`. Without valid Twilio credentials and a configured Verify Service, OTP sending intentionally fails closed and new signups cannot complete.

## 5. UPI payments
The UPI button opens Google Pay on Android if installed, otherwise it opens the Google Play listing. This is **not** a completed or verified payment flow. For real payments, connect a payment provider that supports UPI (for example, Razorpay or Cashfree), create orders on the API, verify signed server callbacks/webhooks, and only mark orders paid after server-side verification. Do not trust a client-side success screen.

## 6. Checks run for this package
- API test suite: 38/38 passed (`npm test --prefix apps/api`).
- API route syntax: passed (`node --check apps/api/src/modules/identity/auth.routes.js`).
- Web production build: not verified in this environment because dependencies could not be installed here (`vite: not found`).
- Expo/mobile bundle and physical-device testing: not verified in this environment.

This is a tested development project, not a production-certified deployment. Before publishing, configure SMS/payment providers, set production environment variables, run a full Expo build, test on real devices, and deploy the API over HTTPS with monitoring and backups.
