# Water-O-Water shared server setup (for every VS Code download)

## The key rule

A server started on a developer's laptop is a **local server**. It is not automatically available to other people. To share accounts, orders, supplier assignments, rider updates and WebSocket events, every copy of the app must point at the same API deployed to a public host.

## One-time setup by the project owner

1. Push this repository to GitHub. Do not commit `.env` files or real provider secrets.
2. In Render, choose **New → Blueprint**, connect the repository, and deploy the included `render.yaml`.
3. Add the Twilio Verify and Razorpay secrets in the Render service's environment settings. Use test payment keys until the payment flow has been validated.
4. Copy the actual HTTPS service URL issued by Render. Do not use the example `YOUR-RENDER-SERVICE` URL.
5. In `apps/mobile/.env`, set `EXPO_PUBLIC_API_URL=https://<actual-service-name>.onrender.com`.
6. In `apps/web/.env`, set `VITE_API_BASE_URL` to the same URL only if the web app needs a separately hosted API. When the web app and API are served from the same Render service, relative `/v1` URLs should be used.
7. Commit the non-secret public URL configuration and rebuild/restart Expo. Anyone downloading this configured commit will then use the same public API URL.
8. Verify `https://<actual-service-name>.onrender.com/v1/health` from a different network. It must return `{"data":{"ok":true}}` or the service's equivalent healthy response.

## For every other developer

1. Download/clone the configured repository.
2. Install dependencies using the root README.
3. Run Expo after the project owner has committed the actual URL in `apps/mobile/.env` (or provide it as `EXPO_PUBLIC_API_URL`).
4. Do **not** start another API and expect it to share data. A locally started API creates a separate backend/database.

## Important limits

- The source code cannot create a publicly reachable server by itself. The one-time Render deployment must be completed by someone with access to the hosting and GitHub accounts. This workspace has not deployed a public service and therefore does not have a real service URL to embed.
- This Render blueprint currently persists SQLite on a persistent disk. It is not a MongoDB deployment. If the team requires MongoDB, migrate the repository's database layer and provision a shared MongoDB deployment before production use.
- Public reachability is not the same as public data access. Keep authentication, authorization, provider secrets and webhook verification enabled.
- The actual URL is intentionally not guessed. Replace the placeholder after Render creates the service.
