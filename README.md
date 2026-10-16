# Water'O'Water – How to Run the Mobile App

This guide is for the Expo mobile app in `apps/mobile` (Customer, Supplier and Rider in one app).

---

## Step 1 – Install the tools (one time only)

| Tool | Version | Check with |
|------|---------|------------|
| Node.js | **22.5 or newer** | `node -v` |
| npm | comes with Node | `npm -v` |
| Expo Go app on your phone | latest (Play Store / App Store) | – |

Download Node.js from https://nodejs.org (choose LTS / 22+).

---

## Step 2 – Open the mobile folder in the terminal

```bash
cd Water-O-Water-Figma-UX-APPLIED/apps/mobile
```

---

## Step 3 – Install the app packages

```bash
npm install
```

---

## Step 4 – Install the Expo packages (icons, notifications, etc.)

Always use `npx expo install` (not `npm install`) for these, so Expo picks the version that matches your SDK.

**Icons (all the line icons: bell, tick, truck, etc.)**
```bash
npx expo install @expo/vector-icons
```

**Notifications (pop-up banner + phone notifications)**
```bash
npx expo install expo-notifications
```

**Everything else the app uses (run once if anything is missing)**
```bash
npx expo install expo-font expo-linear-gradient expo-location expo-task-manager expo-secure-store expo-splash-screen expo-status-bar expo-image-picker expo-image-manipulator react-native-maps react-native-safe-area-context react-native-screens @expo-google-fonts/inter @expo-google-fonts/poppins
```

Then fix any version mismatch automatically:
```bash
npx expo install --fix
```

---

## Step 5 – Set the server address

Create a file named `.env` inside `apps/mobile` (copy from `.env.example`):

```
EXPO_PUBLIC_API_URL=https://water-o-water.onrender.com
```

- This is the shared server. Everyone must use the **same URL** to see the same accounts and orders.
- No `/v1` at the end.
- You can also change the server later from the gear icon inside the app.

---

## Step 6 – Start the app

```bash
npx expo start
```

If the app shows old screens or errors after changes, clear the cache:
```bash
npx expo start -c
```

**Open on your phone:** scan the QR code with
- Android: the **Expo Go** app
- iPhone: the **Camera** app, then tap the Expo Go link

(Phone and computer must be on the same Wi-Fi. If the QR code does not connect, run `npx expo start --tunnel`.)

**Android emulator:** press `a` in the terminal.

---

## Notifications – what works where

| Situation | Expo Go | Real build (development / APK) |
|-----------|---------|-------------------------------|
| App is open: pop-up banner with Water'O'Water logo | Works | Works |
| Bell with unread number, read/unread list | Works | Works |
| Phone notification while app is in background (live connection still on) | Works | Works |
| Notification when the app is fully closed (remote push) | Not supported | Needs push setup – see `NOTIFICATIONS_SETUP.md` |

- When asked **"Allow notifications?"**, tap **Allow**. On Android 13+ it is required.
- In the app: open the bell, tap **Send Test Notification** to see the pop-up banner.
- In Expo Go the phone's own notification shows the Expo icon. Your drop logo shows in a real build.

---

## Build a real app (APK / development build)

Needed for the app logo in system notifications, background location and push notifications.

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

---

## Run the server locally (optional)

Only if you do not want to use the shared server. From the **project root** (`Water-O-Water-Figma-UX-APPLIED`):

```bash
npm install
npm run dev:api
```

The server runs on port 3001. Then set `EXPO_PUBLIC_API_URL`:
- Real phone: `http://<your-computer-Wi-Fi-IP>:3001`
- Android emulator: `http://10.0.2.2:3001`

---

## Quick troubleshooting

| Problem | Fix |
|---------|-----|
| Icons show as boxes / "?" | `npx expo install @expo/vector-icons` then `npx expo start -c` |
| No notification pop-up | Allow notifications in phone settings; check the "Live" dot at top is on |
| "Unable to resolve module ..." | Run `npx expo install <that-module>` then `npx expo start -c` |
| Version mismatch warning | `npx expo install --fix` |
| Cannot sign in / no data | Check `.env` URL, and that the server is online (Render free servers sleep; wait ~1 min) |
| QR code will not connect | Same Wi-Fi, or use `npx expo start --tunnel` |