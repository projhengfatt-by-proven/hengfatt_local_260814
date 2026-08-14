// Server half of the "real-estate" Intent Pack — data only, no logic.
// Safe for a non-engineer to edit: adding a new intent here means adding
// example phrases + a threshold, nothing else. The matching client-side
// handler still has to be written by an engineer (see
// src/lib/intentPacks/real-estate.ts).

export interface IntentSpec {
  examples: string[];
  threshold: number;
}

export interface IntentPack {
  name: string;
  intents: Record<string, IntentSpec>;
}

export const pack: IntentPack = {
  name: "real-estate",
  intents: {
    create_folder: {
      // Lower threshold: a wrong guess here is low-stakes — an extra or
      // misnamed folder is trivially renamed, deleted, or ignored.
      threshold: 0.68,
      examples: [
        "create a folder",
        "make a new folder",
        "set up a new folder for this",
        "I need somewhere to put these photos",
        "start a new folder for this property",
        "I need a place to put this property's docs",
        "can you make a folder for this listing",
        "new folder please",
      ],
    },
    start_listing: {
      // Higher threshold: a wrong guess here interrupts the agent with a
      // whole confirm-listing-details flow, which is more disruptive.
      threshold: 0.80,
      examples: [
        "I want to list a property",
        "here's a property to list",
        "3 bedroom condo at 2.8 million freehold",
        "new listing 1200 sqft HDB",
        "I have a new property to add",
        "let me tell you about a unit I'm listing",
        "got a new listing to add, 99-year leasehold",
        "listing this one: freehold landed, 4 bed",
      ],
    },
  },
};
