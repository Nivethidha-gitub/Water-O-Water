import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/*
 * Token / server-address storage. On phones this is the OS secure store
 * (Keychain / Keystore). SecureStore has no web version, so the browser
 * preview (`npx expo start --web`) falls back to localStorage.
 */
const web = Platform.OS === "web";

export const getItem = async (key) => (web ? window.localStorage.getItem(key) : SecureStore.getItemAsync(key));

export const setItem = async (key, value) => {
  if (web) window.localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
};

export const deleteItem = async (key) => {
  if (web) window.localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
};
