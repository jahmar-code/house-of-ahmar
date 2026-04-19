import { cache } from "react";
import { db } from "@/lib/db";

export const HOUSE_SETTING_DEFAULTS = {
  houseName: "House of Ahmar",
  houseTagline: "The gates are closed.\nOnly blood enters.",
  welcomeMessage: "Welcome to the House of Ahmar.",
  coverImageUrl: "",
} as const;

export type HouseSettingKey = keyof typeof HOUSE_SETTING_DEFAULTS;
export type HouseSettings = Record<HouseSettingKey, string>;

export const getHouseSettings = cache(async (): Promise<HouseSettings> => {
  const rows = await db.query.houseSettings.findMany();

  const settings: HouseSettings = { ...HOUSE_SETTING_DEFAULTS };

  for (const row of rows) {
    if (row.key in HOUSE_SETTING_DEFAULTS) {
      const key = row.key as HouseSettingKey;
      const value = row.value as unknown;
      if (typeof value === "string") {
        settings[key] = value;
      }
    }
  }

  return settings;
});
