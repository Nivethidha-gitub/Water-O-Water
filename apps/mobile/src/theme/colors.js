/* Water'O'Water visual system — blue-only UI palette based on the supplied recording. */
export const colors = {
  bg: "#F3F8FA",
  surface: "#FFFFFF",
  ink: "#073A4E",
  inkSoft: "#627C8C",
  inkFaint: "#8EA7B5",
  primary: "#0B5C7A",
  primaryDark: "#073A4E",
  accent: "#00B6D6",
  customer: "#0B5C7A",
  customerBg: "#E4F5FA",
  supplier: "#0B5C7A",
  supplierDark: "#073A4E",
  supplierBg: "#E4F5FA",
  rider: "#0B5C7A",
  riderDark: "#073A4E",
  riderBg: "#E4F5FA",
  can: "#E4F5FA",
  canLine: "#D8E8EF",
  tabs: "#F0F7FA",
  // Pop-up boxes (dialogs and sheets): a light shade of the brand blue, with dark-blue text.
  popup: "#E8F5F9",
  popupLine: "#CFE6EE",
  popupScrim: "rgba(7,58,78,0.5)",
  // Green is reserved for "it worked" moments (e.g. Delivered Successfully); the app stays blue and white.
  success: "#1F9D55",
  successBg: "#E7F6EE",
  good: "#0B5C7A",
  goodBg: "#E4F5FA",
  warn: "#0B5C7A",
  warnBg: "#E4F5FA",
  danger: "#B42332",
  dangerBg: "#FCEDEF",
  onDark: "#FFFFFF",
  onDarkSoft: "#D7EEF5",
  onDarkFaint: "#A9CCD8",
};
export const fonts = {
  display: "Poppins_600SemiBold",
  displayBold: "Poppins_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
};
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const shadow = {
  card: { shadowColor: "#073A4E", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  lift: { shadowColor: "#073A4E", shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
};
