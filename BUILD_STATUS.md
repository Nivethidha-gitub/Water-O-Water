# Build and validation status (2026-10-14)

## Verified (actually executed in this environment)
- API tests: **30/30 pass** (`cd apps/api && node --test test/*.test.js`). They cover: auth and roles; the order state machine; bulk accept/assign/start; rider availability and activity; order and payment-history paging; stock (no overselling, stock returned on cancel, supplier restock, low-stock alert); saved addresses (ownership, default, snapshot kept on past orders); proof of delivery (code, photo, lock-out after 5 wrong codes, who may view it); ratings; rider ID verification (required upload, supplier-only access to the ID photo, pending riders blocked from deliveries and assignment, approve/reject with reason, resubmission); a supplier's rejection notifying the customer with the reason, and the customer then cancelling; refunds against a **stubbed Razorpay** (refund on cancel, no double refund, failure then retry, refund when a paid order cannot be created); and the signed Razorpay webhook (bad signature, duplicate delivery, cancelled links).
- Every file in `apps/mobile` parses as JSX (esbuild), all imports and exports resolve in a bundle, and a TypeScript scan finds no undeclared names.
- The Tamil/English lookup, including strings with data, was run in a Node harness.

## Not verified here
- Expo / Metro bundling and every on-device screen. Dependencies could not be installed (no network), so the app was never launched. New packages to install: run `npx expo install expo-image-picker expo-image-manipulator @expo/vector-icons` (versions in package.json are a best guess for SDK 57).
- Your design PDF was read, but screens were not compared pixel by pixel; the colours (#0B5C7A, #073A4E, #00B6D6, #F3F8FA), logo, splash, line icons and key screens follow it.
- Real Razorpay payments and refunds (the refund code calls Razorpay's refund API, but only a stub was exercised), real Twilio OTP, push notifications.
- Background location (needs a development/production build and "allow all the time"; not testable in Expo Go on Android) and the camera / gallery pickers.

## Facts about the architecture
- The database is SQLite, not MongoDB.
- Real-time updates use WebSockets / server-sent events.
