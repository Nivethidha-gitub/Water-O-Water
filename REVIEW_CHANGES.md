# Lead Review Changes (mobile app: apps/mobile)

| Review item | What changed |
|---|---|
| Language: Tamil or English | New `src/i18n` (Tamil dictionary + translating `Text`). Toggle on sign-in, every branded header, customer home; full selector in each Profile/Settings screen. Choice is saved on the device. Strings without a Tamil entry show in English. |
| Logo | New mark: electric scooter carrying two water cans (`assets/brand-mark*.png`, icon, adaptive icon, splash, favicon). Header and sign-in logo resized for the wider mark. |
| No full capitals, camel/title case | Removed every `textTransform: uppercase` and all-caps label; labels, buttons, headings and alert titles use Title Case. Sentences stay sentence case. |
| Continue to Checkout | Button now reads "Checkout · ₹amount"; the next screen is titled "Checkout". |
| How would you like to pay? | Now a radio-button group (Cash on Delivery / UPI Payment) via new `RadioGroup` in `components/ui.js`. |
| Order Summary | Lists each item with quantity and line amount, subtotal, delivery fee, delivery type (with chosen days), payment method and total. (Before: "Items" showed a bare count and payment said "UPI selected".) |
| Supplier home too long | Rebuilt compact: greeting, one attention banner, 3 stats, 2x2 quick actions. Removed the tall hero and the menu list that duplicated the tabs. |
| Bulk update accepted orders | Live Orders: "Select Orders" on New and Accepted tabs, Select All, bottom action bar. New: Accept Selected. Accepted: Assign one rider to many (rider sheet) and Start Delivery for many. Per-order results; failures are listed and stay selected for retry. API: `POST /v1/orders/bulk` ({action: accept | assign-rider | start, orderIds, riderId}), max 50, supplier-only, partial success. Test added (19/19 API tests pass). |

Not verified here: the Expo app was not built or run on a device (no dependencies/network in this environment). Files were syntax-checked, imports resolved, and the Tamil lookup tested. Please have a Tamil speaker review `src/i18n/ta.js`.
