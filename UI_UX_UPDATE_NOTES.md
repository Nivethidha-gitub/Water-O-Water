# Water-O-Water UI/UX update notes

Updated from the supplied screen recording while preserving the existing Expo/React Native app structure and API-driven order flows.

## Changes
- Removed the separate branded water-droplet splash page from the app navigation.
- Replaced the native launch artwork with a transparent image so startup goes straight into the authentication screen.
- Applied a consistent blue/cyan palette to customer, supplier, and rider screens; red is reserved for destructive/error states.
- Reworked the customer home screen around the recorded flow: greeting, delivery location, active refill status, quick-order product cards, and recurring-refill entry point.
- Updated the customer Order tab to start with supplier selection and then show products.
- Updated customer bottom navigation to Home / Order / Track / Profile while keeping Cart accessible during checkout.
- Refined tracking copy and rider delivery-completed screen styling.
- Preserved the existing API calls, cart, checkout, ETA, rider assignment, and live tracking integrations.

## Verification
- JavaScript/JSX parser check: 0 syntax errors.
- Local import/asset check: 0 missing local imports or assets.
- `apps/mobile/app.json`: valid JSON.
- Full Expo bundle/build was not run in this environment because dependency installation did not complete. Run the Expo app locally to confirm platform-specific bundling.
- The current API does not include an OTP delivery/verification endpoint. The signup flow was not changed to fake OTP verification; implementing the OTP screen end-to-end requires a real OTP backend/provider.
