// Trivial pack used only to sanity-check that the pack-loading mechanism
// itself works independent of real-estate content. Not a real industry
// pack — has zero intents on purpose, so every message should fall
// through to the full AI when this pack is active.

import type { IntentPack } from "./real-estate.ts";

export const pack: IntentPack = {
  name: "_empty",
  intents: {},
};
