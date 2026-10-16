/*
 * Take or choose a photo and shrink it for upload (ID proofs and proof-of-delivery photos).
 * Returns { uri, base64 } (a JPEG), or null if the person cancels.
 * Throws an Error with a plain message when permission is refused.
 */
export async function pickPhoto({ camera = false, maxWidth = 1280, quality = 0.5 } = {}) {
  let ImagePicker;
  let Manipulator;
  try {
    ImagePicker = require("expo-image-picker");
    Manipulator = require("expo-image-manipulator");
  } catch (_) {
    throw new Error("Photo upload needs expo-image-picker and expo-image-manipulator. Run: npx expo install expo-image-picker expo-image-manipulator");
  }
  const permission = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(camera ? "Allow camera access to take the photo." : "Allow photo access to choose the photo.");
  }
  const picked = camera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (picked.canceled || !picked.assets || !picked.assets.length) return null;
  const asset = picked.assets[0];
  const shrunk = await Manipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: Math.min(maxWidth, asset.width || maxWidth) } }],
    { compress: quality, format: Manipulator.SaveFormat.JPEG, base64: true }
  );
  return { uri: shrunk.uri, base64: shrunk.base64 };
}
