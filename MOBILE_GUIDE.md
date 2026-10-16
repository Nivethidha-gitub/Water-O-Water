# Water-O-Water mobile app (Expo / React Native) - customer, supplier, rider

## Run it
```bash
# 1. API (same Wi-Fi as your phone)
cd apps/api && npm install && npm start          # http://0.0.0.0:3001

# 2. Mobile app
cd apps/mobile && npm install && npx expo start  # scan the QR with Expo Go
```
On the sign-in screen open **Server settings**, enter `http://<your-computer-ip>:3001`
and press **Test connection** (or set `EXPO_PUBLIC_API_URL`, see `.env.example`).
Existing databases upgrade themselves on start (the `users` table is rebuilt to allow riders).

## Demo accounts (password `Water@123`)
| Role | Login | Notes |
|---|---|---|
| Customer | customer@wow.test | Ayesha R. |
| Supplier | murugan@wow.test | Murugan Water (riders: Karthik, Suresh) |
| Supplier | balaji@wow.test | Sri Balaji Water (rider: Dinesh) |
| Rider | rider@wow.test | Karthik, delivers for Murugan Water |

New riders sign up in the app (choose **Rider**, pick the supplier, optional vehicle number).

## Flow (as in the design image)
- **Sign in / Sign up** (one screen, look from the prototype video): pick Customer / Supplier / Rider.
  The role the server returns for the account decides which app opens; sign-out returns to Welcome.
- **Customer**: Home -> Products -> Cart -> Order placed -> My Orders -> Track order (timeline + rider card).
- **Supplier**: Dashboard -> Live Orders (New / Accepted / All, Accept / Reject) -> Assign Rider ->
  Rider assigned -> Start delivery -> Mark delivered. Also Delivery partners, Products, Service areas, Settings.
- **Rider**: assigned deliveries -> call / navigate -> Start delivery -> Mark delivered
  (cans out, empties in, cash/UPI). Riders only ever see orders assigned to them.

## Real-time
`ws://<server>/v1/ws` (WebSocket, no extra dependency). The app authenticates with its session token
as the first message, reconnects automatically, and every screen reloads the moment the server pushes
an event; a banner shows the notification. The header shows a **Live / Offline** dot. If the socket is
down the app falls back to polling every few seconds. The web app keeps using SSE (`/v1/events`).

## New API endpoints
`GET /v1/auth/suppliers` (public) - `GET /v1/riders` - `POST /v1/orders/:id/assign-rider` -
`GET /v1/rider/orders` - `POST /v1/rider/orders/:id/start` - `POST /v1/rider/orders/:id/deliver` -
`WS /v1/ws`. Tests: `cd apps/api && npm test` (17 tests incl. role fencing and live-event isolation).
