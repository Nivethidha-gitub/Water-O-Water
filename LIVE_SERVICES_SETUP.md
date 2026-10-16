# Water-O-Water live services setup

## Signup SMS OTP (Twilio Verify)
Set these on the API server; never place them in the mobile app or commit real values:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

Use a Twilio Verify service configured for SMS. Signup is blocked until the phone OTP is approved. Phone numbers must be E.164, for example `+919876543210`. OTP verification currently stores the short-lived verified-phone grant in API process memory, so use a single API instance or replace this with a shared store before horizontal scaling.

## UPI payments (Razorpay Payment Links)
Set:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- optionally `RAZORPAY_CALLBACK_URL`

In the Razorpay dashboard, create a webhook pointed to `https://YOUR_API_HOST/v1/payments/razorpay/webhook`, subscribe to `payment_link.paid`, and configure the same webhook secret. Use Razorpay test-mode credentials first. The API calculates the amount from its product database, creates a hosted payment link, verifies the webhook HMAC signature, and only then creates the order with `paymentStatus=PAID`. Keep the API publicly reachable over HTTPS for Razorpay webhooks. The client must never mark a payment as paid based only on a redirect or app return.

## Database status
This source version still uses SQLite as its operational database. MongoDB has **not** been switched on: the API's existing services use synchronous SQLite SQL queries and SQLite transactions throughout authentication, catalog, order, rider, and notification flows. Merely adding a MongoDB connection would not migrate persistence and could lose data or break order consistency. A proper MongoDB migration requires replacing these repositories/transactions, writing migration/backfill tooling, and running the complete test suite against MongoDB before switching production traffic.

## Build verification
Run from the project root:
```sh
npm install
npm test
npm run build
cd apps/mobile && npm install && npx expo start
```
For a release build, follow Expo EAS build setup and test on a physical Android device. A development server start is not the same as a signed release build.
