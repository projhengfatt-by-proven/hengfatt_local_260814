// Trivial client-side pack half, paired with
// supabase/functions/classify-intent/packs/_empty.ts — used only to
// sanity-check that the pack-loading mechanism works independent of
// real-estate content. classify-intent never returns a matched intent
// when this pack is active server-side, so these handlers are never
// actually invoked — this file exists purely so the resolver has
// something valid to load.

import type { IntentHandlerDeps } from "./real-estate";

// deps is accepted (and ignored) rather than omitted, purely so this
// pack's createHandlers has the same signature as every other pack's —
// keeps the resolver's PACKS map simply typed, no union/overload needed.
export function createHandlers(_deps: IntentHandlerDeps): Record<string, (text: string) => Promise<void>> {
  return {};
}
