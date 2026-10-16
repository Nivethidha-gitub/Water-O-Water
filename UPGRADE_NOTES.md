# Upgrade notes (round 2)

Starting point: your `Water-O-Water-Updated-Brand-Earnings.zip`. The Expo app (`apps/mobile`) is the primary client; the web app in `apps/web` is unchanged.

## Audit: what already existed and was kept
Three-role sign-in with role-based navigation, OTP gate on sign-up (Twilio Verify), Razorpay payment links with a signed webhook, supplier order desk with bulk update, rider delivery flow with ETA and GPS publishing, live tracking over WebSockets/SSE, notifications, Tamil/English, and the blue palette.

## Added or changed in this round
| Area | Change |
|---|---|
| Rider success page | Full-screen "Delivered Successfully" with a green tick (green is used only here, as a success indicator), plus a two-column detail card: order ID, customer name, delivery time, address, items, amount, payment, delivery partner. |
| Rider availability | New online/offline switch on the rider home. `GET/PUT /v1/rider/availability`. Offline riders are refused at assignment (`RIDER_OFFLINE`, single and bulk) and are greyed out in the supplier's rider pickers and shown with Online/Offline badges. |
| Rider activity | `GET /v1/rider/summary` and a "Delivery Activity" card in Delivery History: deliveries and order value for today, the last 7 days and all time. This is activity, not pay: the app has no rider-pay model, so no earnings are calculated. |
| Payments | Webhook now also records cancelled and expired payment links. Test coverage for signature check, duplicate delivery and cancellation. |
| Order history | `GET /v1/orders?limit=&before=` returns newest-first pages with a cursor (no `limit` = old behaviour). Customer "Track Your Order" loads 20 and has "Load More Orders". |
| Palette | Removed leftover orange hexes from the rider home; the warning pill is blue. |
| Language | New strings added to the Tamil dictionary. |

## Setup (unchanged)
See `README.md` and `.env.example`. Required for the real services: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (OTP), and `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_CALLBACK_URL` (payments). Point the Razorpay dashboard webhook at `https://<your-api>/v1/payments/razorpay/webhook` and enable `payment_link.paid`, `payment_link.cancelled` and `payment_link.expired`. Test with Razorpay test keys before switching to live keys.

## Not done / limitations
- **Refunds:** not implemented. Cancelling an order that was already paid online does not trigger a Razorpay refund; handle refunds in the Razorpay dashboard for now.
- **Inventory / stock counts:** products have price and availability but no stock quantity, so there is no concurrent stock protection to add yet.
- **Customer address book and delivery instructions:** the customer has one delivery address; multiple saved addresses are not built.
- **Rider proof of delivery:** delivery completion records cans delivered/collected and payment; there is no photo or signature capture.
- **Background location:** the rider's GPS is published while the app is open on an active delivery; true background tracking needs an EAS development build and extra platform permissions.
- **Figma:** not accessible to me, so layouts follow the existing screens and theme.
- **Device testing:** the Expo app has not been run; please test on a phone and an emulator before release.


---

# Round 3 (this update)

Design source: your `Water__O_Water.pdf` (palette #0B5C7A / #073A4E / #00B6D6 / #F3F8FA, Poppins + Inter, drop logo, "English / தமிழ்" pill, checkout layout).

| Request | What was done |
|---|---|
| Use the PDF instead of the Figma link | Theme tokens, drop logo and splash (gradient, "Never run dry."), app icon, language pill, 18px-card look. The earlier scooter logo is kept in `assets/alt/`. Screens were restyled, not rebuilt one-to-one: the PDF's phone-number-first OTP login, the "cans left" ring, rider "slide to accept", rider per-delivery earnings and "open orders for any supplier" toggle are not built (the app keeps its email/phone + password sign-in with OTP at sign-up, and has no rider pay model). |
| Remove colourful icons | All emoji icons replaced by one set of line icons (Feather via `@expo/vector-icons`) drawn in theme colours: tabs, buttons, cards, empty states, roles. Component: `components/Icon.js`. |
| Customer history | Profile > History: **Orders** and **Payments** tabs (cash and UPI, refunds, unfinished payments), paged, with a **Receipt** screen per order (items, totals, payment, address, delivery time, refund, rating). |
| Rider ID verification | Riders must upload one government photo ID (Aadhaar, Driving Licence, Voter ID, PAN, Passport) and its number at sign-up. Only the type, last 4 characters and the photo are stored. Until the rider's supplier approves, the rider sees only a "Waiting for Approval" screen (the API also refuses their deliveries, and they cannot be assigned orders). Suppliers see pending riders in Riders, open the ID photo, and Approve or Reject with a reason; the rider is notified and can upload again. |
| Customer notified on rejection | Rejecting an order asks the supplier for a reason; the customer immediately gets a notification (title, reason, what to do next) and the tracking screen shows a "could not accept your order" card with **Cancel Order** (online payments are refunded) and **Order From Another Supplier**. |

Also finished from the previous "not done" list: refunds, stock counts (supplier editor + customer "Only N left" / "Out of Stock"), multiple saved addresses with delivery instructions (used at checkout), delivery code + photo proof of delivery, background GPS, order rating, notification and help screens, low-stock alerts.

## Remaining limits
- Refunds: real refunds need Razorpay keys; until a refund reaches "processed" the customer sees "in progress". A failed refund can be retried by the supplier through `POST /v1/orders/:id/refund/retry` (no button for it in the app yet).
- ID photos are stored in the database as base64. For production, move them to private object storage and encrypt at rest.
- A delivery completed by the supplier themselves does not require the delivery code.
- Refund and webhook handling assume Razorpay payment links; enable the `refund.processed` and `refund.failed` webhook events too.


---

# Round 3b: header and supplier dashboard

- **Header on every screen:** a top bar with a back arrow, the screen's name and the language switch (`components/AppBar.js`, used by `Screen`). The arrow goes to the previous page; on a main tab it goes back to Home; it is hidden on Home itself. Screens that hide the bar on purpose: sign-in and the customer Home (which has its own greeting header).
- **Warnings fixed:** the "▶" and "⌖" characters were being used as icon names; they are now valid line icons. The Expo Go background-location warning is expected: background location only works in a development build.
- **Supplier dashboard order:** 1) Pending (new orders, accepted orders needing a rider, rider IDs to approve), 2) New Orders (accept or reject here), 3) Quick Review (in progress, delivered today, riders online, low stock), 4) Earnings (today, last 7 days, 7-day bars).
