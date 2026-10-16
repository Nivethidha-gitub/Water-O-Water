/**
 * WoW product theme — source of truth.
 * Match AquaRoute prototype :root values.
 */
export const colors = {
  bg: "#F3F8FA",
  surface: "#FFFFFF",
  ink: "#0F2630",
  inkSoft: "#5C7580",
  inkFaint: "#93A8AF",
  primary: "#0B5C7A",
  primaryDark: "#073A4E",
  accent: "#00B6D6",
  can: "#E4F4F8",
  canLine: "#CFE9EF",
  good: "#2FA86B",
  goodBg: "#E7F6EE",
  warn: "#F2994A",
  warnBg: "#FDF1E4",
} as const;

export const colorUsage = {
  bg: "Screen background",
  surface: "Cards",
  ink: "Main text",
  inkSoft: "Secondary text",
  inkFaint: "Inactive tabs, hints",
  primary: "Buttons, steppers, hero card",
  primaryDark: "Headings, dark banners",
  accent: "Links, active step, chart highlight",
  can: "Icon tiles, stepper background",
  canLine: "Icon tile / stepper outline",
  good: "Delivered, success, toggle",
  goodBg: "Success surfaces",
  warn: "Out for delivery, pending",
  warnBg: "Warning surfaces",
} as const;

export type ColorToken = keyof typeof colors;

export const cssVar = (token: ColorToken) =>
  `var(--${token === "inkSoft" ? "ink-soft" : token === "inkFaint" ? "ink-faint" : token === "primaryDark" ? "primary-dark" : token === "canLine" ? "can-line" : token === "goodBg" ? "good-bg" : token === "warnBg" ? "warn-bg" : token})`;
