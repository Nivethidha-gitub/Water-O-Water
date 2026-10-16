import React from "react";
import { Feather } from "@expo/vector-icons";

import { colors } from "../theme/colors";

/*
 * One icon set for the whole app: Feather line icons, drawn in a theme colour.
 * (Feather ships with Expo through @expo/vector-icons; no emoji are used for UI icons.)
 * Pass a Feather name: "home", "package", "truck", "map-pin", "droplet", "bell", "phone", ...
 */
export default function Icon({ name, size = 20, color = colors.primary, style }) {
  return <Feather name={name} size={size} color={color} style={style} accessible={false} />;
}
