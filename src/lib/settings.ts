import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Shipped defaults for the House's identity. These are what a fresh deploy
 * shows until an Elder overwrites them at /elder-council/settings — so the
 * tagline is the literal first sentence a new relative reads. It welcomes
 * rather than tests: this family includes spouses, in-laws, partners and
 * adopted children, and the front door must never say otherwise.
 */
export const HOUSE_SETTING_DEFAULTS = {
  houseName: "House of Ahmar",
  houseTagline: "Our people, in one place.\nIf you're ours, you're already in.",
  welcomeMessage: "Good to have you home.",
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
