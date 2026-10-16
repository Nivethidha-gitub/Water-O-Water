# Water-O-Water — shared API configuration

## Default shared API

The Expo app defaults to this API base URL:

`https://water-o-water.onrender.com`

The mobile app appends `/v1` automatically. Do not enter `/v1` into Server settings.

## Run the app

1. Install Node.js 22.5 or newer.
2. Extract this ZIP.
3. Open a terminal in `Water-O-Water-Figma-UX-APPLIED/apps/mobile`.
4. Run `npm install`.
5. Run `npx expo start`.
6. Scan the QR code in Expo Go. Ensure the phone has internet access.

All installations must point at the same deployed API to share accounts and orders. Changing the URL in Server settings overrides the default for that installation. To set the URL at build time, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.

## Local API fallback

If the shared deployment is unavailable, open a second terminal in the project root and run `npm install` then `npm run dev:api`. Set the mobile app's Server settings to `http://<computer-LAN-IP>:3001` on a real phone or `http://10.0.2.2:3001` on an Android emulator. Keep the computer and phone on the same Wi-Fi. This fallback is not a common server; it only works while the computer is running the API.

## Production requirements

The API code is included under `apps/api`. The API currently stores data in SQLite. A public deployment must have persistent database storage configured; otherwise data may be lost when the host restarts or redeploys. Real signup OTP requires configured SMS credentials. Real UPI/Razorpay payments require server-side Razorpay credentials and verified webhooks. Never add secret keys to `apps/mobile` or to a public ZIP.

## Verification performed for this ZIP

- API end-to-end test suite: 18 tests passed.
- Local API startup and `/v1/health` endpoint: returned `{"data":{"ok":true}}`.
- The hosted URL could not be independently checked from the build environment, so availability of the public deployment is not guaranteed by this ZIP.
