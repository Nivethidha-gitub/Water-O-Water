# Make Water-O-Water's server public (Render)

This repository now contains a Render Blueprint (`render.yaml`). It configures a public HTTPS web service, binds to the host-provided `PORT` on `0.0.0.0`, serves the built web app and `/v1` API from one public URL, exposes `/v1/health` as the health check, and stores SQLite data on a persistent disk. WebSocket live updates are served by the same server.

## Deploy it

1. Push this entire project folder to a GitHub repository. Do not commit `.env` files, API keys, or provider secrets.
2. Sign in to Render and choose **New + → Blueprint**. Connect the repository and select the branch containing `render.yaml`.
3. Review the Blueprint and create the service. The configured persistent disk requires a paid Render service plan.
4. In the service's **Environment** page, add the Twilio and Razorpay secrets. Use Twilio Verify credentials for real SMS OTP. Use Razorpay test credentials first; configure the Razorpay webhook URL to `https://YOUR-SERVICE.onrender.com/v1/payments/razorpay/webhook` and subscribe to `payment_link.paid`. Use the same webhook secret in Render and Razorpay.
5. Wait for deployment to finish. Visit `https://YOUR-SERVICE.onrender.com/v1/health`. It should return JSON containing `ok: true`. Visit the root URL to check the web app.
6. Set `EXPO_PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com` in `apps/mobile/.env` (copy from `.env.example`) and rebuild/restart Expo. For a distributable mobile binary, build a new app after setting the URL. The app's in-app Server settings can also point to the public URL for development builds.
7. Share that same HTTPS URL with your lead. Their device must use the public URL, not a LAN address such as `192.168.x.x` or `localhost`.

## Notes and limitations

- Adding this file does not deploy the service by itself. You must connect a Git repository and create the Render service in your account; no hosting account was available to deploy it from this workspace.
- This deployment configuration uses the project's current SQLite database with a persistent disk. It does **not** migrate the app to MongoDB.
- `CORS_ORIGIN=*` permits browser requests from any origin; it does not bypass login/authentication. If you later host the web app separately, restrict CORS to its origin.
- Keep provider secrets only in the Render Environment page. Never place Twilio or Razorpay secrets in the mobile app.
- A free/ephemeral host may sleep or lose local files; this Blueprint uses a paid service plan and persistent disk for SQLite durability.
- Before real customers use the service, validate account registration/login, customer order placement, supplier acceptance/assignment, rider updates, SMS delivery, Razorpay test payment + webhook, and app connectivity from a separate network.
