# Live OTP and Razorpay setup (Water-O-Water)

The app is pointed at the deployed API: **https://water-o-water.onrender.com**. Health check: https://water-o-water.onrender.com/v1/health.

## SMS OTP (Twilio Verify)

Signup requires an SMS OTP for every role. The app sends the phone number in E.164 format, e.g. `+919876543210`, then verifies the code before account creation. Add these as **Render Environment Variables** (Dashboard → water-o-water service → Environment):

- `TWILIO_ACCOUNT_SID` — Twilio Account SID (`AC...`)
- `TWILIO_AUTH_TOKEN` — Twilio Auth Token (secret; never place in the mobile app)
- `TWILIO_VERIFY_SERVICE_SID` — Verify Service SID (`VA...`)

Create a Twilio Verify Service and enable SMS. Trial accounts may only message verified recipient numbers; to allow any customer to sign up, complete Twilio's required account/business verification and upgrade as needed. There is no safe way for an app to send real SMS OTP without a provider account and valid credentials. If these values are missing, signup intentionally fails closed rather than accepting an unverified phone.

## Razorpay UPI checkout

Add these **Render Environment Variables**:

- `RAZORPAY_KEY_ID` — Razorpay API key ID (`rzp_test_...` for testing, `rzp_live_...` for production)
- `RAZORPAY_KEY_SECRET` — secret paired with the key ID (server only)
- `RAZORPAY_WEBHOOK_SECRET` — a strong webhook secret you choose in Razorpay's webhook setup

In the Razorpay dashboard, add a webhook URL:

`https://water-o-water.onrender.com/v1/payments/razorpay/webhook`

Subscribe to the `payment_link.paid` event and use exactly the same webhook secret in Render. The backend verifies the webhook HMAC signature before it creates an order marked paid. Use test keys first; live collections require a Razorpay merchant account and applicable KYC/bank settlement activation. Never add key secret or webhook secret to the Expo app or commit them to Git.

UPI checkout creates a hosted Razorpay payment link. The order is created after the signed `payment_link.paid` webhook arrives. Cash on delivery creates an order immediately with payment due at delivery. Payment history is available in the customer's profile.

## Render and Expo

- API: `https://water-o-water.onrender.com`
- Health: `https://water-o-water.onrender.com/v1/health`
- Mobile default API URL is set to the API above in `apps/mobile/src/config/server.js`.
- If rebuilding a mobile app, Expo reads the public API URL at build time. Do not put any secret in `EXPO_PUBLIC_*` variables.

## Before real public launch

This version stores application data in SQLite. Render's default local filesystem can be ephemeral, so configure a persistent disk or migrate the database to a managed database before accepting real customer orders. Set secrets on the server, test webhooks with Razorpay test mode, verify Twilio OTP from a non-trial account, and test order/payment reconciliation before switching to live keys.
