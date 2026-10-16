import { Alert as NativeAlert } from "react-native";
import { t } from "../i18n";

/*
 * Same call as React Native's Alert.alert(title, message, buttons).
 * Titles, messages and button labels are translated into the current language.
 *
 * The box itself is drawn by <DialogHost /> (components/ThemedDialog.js) in the app's
 * theme, on Android, iOS and the browser alike. If no host is mounted yet, the call
 * falls back to the system alert so a message is never lost.
 */
let host = null;
export const registerDialogHost = (fn) => { host = fn; return () => { if (host === fn) host = null; }; };

export const Alert = {
  alert(title, message, buttons) {
    const tt = t(title);
    const mm = message ? t(message) : message;
    const bb = buttons && buttons.length ? buttons.map((b) => ({ ...b, text: t(b.text) })) : [{ text: t("OK") }];
    if (host) return host({ title: tt, message: mm, buttons: bb });
    return NativeAlert.alert(tt, mm, bb);
  },
};
