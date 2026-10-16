# Water'O'Water notifications

Real, event-driven notifications for Customer, Supplier and Rider. There are **no test or dummy notifications**:
the old "Send Test Notification" button was removed, and every notification is created by a real order or
delivery change on the server.

## How it works

| Piece | Where | What it does |
|---|---|---|
| Order events | `apps/api/src/modules/orders/order.service.js` | Emits an event **only after** the database change has committed. A failed change never produces a notification. |
| Event to notification | `apps/api/src/modules/orders/order.notifier.js` | Decides who is told what. Recipients come from the order itself (its customer, supplier, assigned rider), never from the request. |
| Storage | `notifications` table in SQLite (`apps/api/src/db/schema.js`) | One row per notification per recipient, with read/unread state. |
| No duplicates | `dedupe_key` + unique index | Each notification carries a key built from the order id and version. The same change processed twice is stored and sent once. |
| Live delivery | `apps/api/src/realtime/websocket.js` (`/v1/ws`) and `hub.js` | Authenticated WebSocket. The session token is sent as the first message; the server decides the recipient from the session, so a user can only ever receive their own notifications. |
| Phone | `apps/mobile/src/realtime/RealtimeContext.js`, `notifications/localNotify.js` | Shows an in-app banner when the app is open and a **local** system notification (status bar) when the app is in the background but still running. |
| Notification centre | `apps/mobile/src/screens/common/NotificationsScreen.js` | List with timestamps, unread/read state, bell badge, empty state. Tapping opens the order or delivery. |

### Who is notified

**Customer:** order placed (confirmation) / supplier accepted / supplier rejected (with reason) / being prepared /
ready for pickup / rider assigned / rider picked up / out for delivery / delivered / cancelled / delayed or not
completed / delivery time changed.

**Supplier (only the order's own supplier):** new order / order cancelled by the customer / rider accepted the
delivery / rider picked up, out for delivery, delivered / delivery delayed or failed ("needs your attention") /
delivery time changed / low stock.

**Rider (only the rider assigned to that order):** new delivery assigned / order ready for pickup / delivery
cancelled or called off / delivery flagged as needing attention / delivery reassigned to another rider.

### What happens when the connection drops
The phone reconnects automatically (with back-off) and, on every reconnect and whenever the app returns to the
foreground, fetches its unread list and announces anything it had not shown yet. Each notification is announced
once, by id. On the very first sign-in on a phone, old history is not replayed.

## What works in Expo Go on Android, honestly

Expo Go on Android (SDK 53 and later) does **not** support remote push notifications. This project therefore does
**not** use remote push. It uses real server events over an authenticated WebSocket and shows them as local
notifications.

| Situation | Works in Expo Go? |
|---|---|
| App open and in front | Yes. In-app banner, bell badge and list update at once. |
| App in the background, still running | Yes, while Android keeps the app's connection alive: a real status-bar notification appears. Tapping it opens the order. |
| App in the background for a long time | **Not reliably.** Android pauses or kills the app's network connection to save battery. Nothing can arrive then. When you return, the app catches up and shows what was missed (banner + list), but no status-bar notification is shown at the time it happened. |
| App fully closed / swiped away | **No.** Needs remote push. |

Reliable notifications for a closed app require remote push (FCM through Expo's push service) and a
**development build or production build**; Expo Go cannot do this on Android. The server already has a push
channel hook (`apps/api/src/modules/notifications/channels/push.channel.js`, currently a logging stub). To enable
it later: build a development build with `eas build --profile development --platform android`, add Firebase (FCM)
credentials, store each device's Expo push token on the server against the authenticated user, and have the push
channel send to that user's tokens using the same dedupe key. No order or UI code needs to change.

## Run it on Windows

Requirements: Node.js 22.5 or newer, Expo Go on your Android phone, phone and PC on the same Wi-Fi.

```powershell
# Window 1: API (from the project folder)
npm install
npm run dev:api

# Window 2: mobile app
cd apps\mobile
npm install
npm run go
```

`npm run go` is `expo start --go`: it opens the project in **Expo Go**. (This project has `expo-dev-client`
installed, so plain `npx expo start` may default to a development build; if it does, press `s` in the terminal
to switch to Expo Go.) Scan the QR code with Expo Go. In the app's server settings enter your PC's address, for
example `http://192.168.1.10:3001` (use your own IP, not `localhost`). Allow notifications when Android asks.

Run the tests:

```powershell
npm test
```

## Database note
The API uses **SQLite**, not MongoDB (see `READY_TO_RUN.md`). Notifications are stored in SQLite alongside orders.
The existing database is upgraded automatically on start (one new column and index); nothing needs migrating by hand.

## Verified and not verified
- Verified by automated tests (`npm test`, 38 passing): placing an order notifies the customer and only the chosen
  supplier; accept, prepare, assign, rider-accept, ready, pickup, out for delivery and delivered each notify the
  right people exactly once; reject carries the reason; cancel and reassign notify the rider; replayed events do not
  duplicate; other users, other suppliers and other suppliers' riders receive nothing; anonymous access, reading
  someone else's notification and marking it read are refused.
- Not verified here: the Expo app on a real phone or Expo Go (no device available), including the status-bar
  notification, the permission prompt, tapping a notification, and the reconnect catch-up. The mobile code was
  syntax-checked only. Please run the checklist below on your phone.

### Phone checklist (Expo Go, Android)
1. Sign in as a customer, supplier and rider (three phones/emulators, or one at a time) and allow notifications.
2. Customer places an order. Customer sees "Order ... placed"; supplier gets "New order".
3. Supplier accepts, prepares, assigns the rider. Customer and rider are notified at each step.
4. Press Home on the customer phone (do not close the app), then move the order along: a status-bar notification
   should appear; tap it to open the order.
5. Turn Wi-Fi off and on during an update: after reconnecting, the missed update should appear as a banner.
6. Turn notifications off in Android settings: the Notifications screen shows a notice with "Turn On in Settings".
