// Resolver — picks the active client-side Intent Pack by name. Must be
// kept in sync (by name only, no shared import) with
// supabase/functions/classify-intent/index.ts's own pack map.

import * as realEstate from "./real-estate";
import * as empty from "./_empty";
import type { IntentHandlerDeps } from "./real-estate";

type PackModule = {
  createHandlers: (deps: IntentHandlerDeps) => Record<string, (text: string) => Promise<void>>;
};

const PACKS: Record<string, PackModule> = {
  "real-estate": realEstate,
  "_empty": empty,
};

export function getActivePack() {
  const name = import.meta.env.VITE_ACTIVE_INTENT_PACK || "real-estate";
  const activePack = PACKS[name];
  if (!activePack) {
    throw new Error(`Unknown intent pack: "${name}"`);
  }
  return activePack;
}

export type { IntentHandlerDeps } from "./real-estate";
