// Test script for batch functionality in RPG MCP servers
// Tests both batch initiative rolls and batch add to encounter

console.log("🎲 Testing Batch Initiative Rolls");
console.log("=".repeat(50));

// Example batch initiative roll request
const batchInitiativeRequest = {
  server: "rpg-combat-engine",
  tool: "batch_initiative_rolls",
  arguments: {
    characters: [
      { character: "Aria the Rogue", modifier: 3 },
      { character: "Bjorn the Barbarian", modifier: 1 },
      { character: "Celeste the Wizard", modifier: 2 },
      { character: "Goblin Scout #1", modifier: 2 },
      { character: "Goblin Scout #2", modifier: 2 },
      { character: "Orc Warrior", modifier: 0 }
    ]
  }
};

console.log("Example request:", JSON.stringify(batchInitiativeRequest, null, 2));

console.log("\n🎯 Testing Batch Add to Encounter");
console.log("=".repeat(50));

// Example batch add to encounter request
const batchEncounterRequest = {
  server: "rpg-game-state",
  tool: "batch_add_to_encounter", 
  arguments: {
    encounter_id: 1,
    participants: [
      { type: "character", id: 1, initiative: 18, name: "Aria the Rogue" },
      { type: "character", id: 2, initiative: 15, name: "Bjorn the Barbarian" },
      { type: "character", id: 3, initiative: 12, name: "Celeste the Wizard" },
      { type: "npc", id: 1, initiative: 16, name: "Goblin Scout #1" },
      { type: "npc", id: 2, initiative: 14, name: "Goblin Scout #2" },
      { type: "npc", id: 3, initiative: 8, name: "Orc Warrior" }
    ]
  }
};

console.log("Example request:", JSON.stringify(batchEncounterRequest, null, 2));

console.log("\n💡 Benefits of Batch Operations:");
console.log("- Single request to set up entire encounter");
console.log("- Automatic initiative ordering");
console.log("- Efficient for large groups");
console.log("- Reduces round-trips between client and server");

console.log("\n🔄 Cross-Pollination Example:");
console.log("1. Use batch_initiative_rolls to roll for all participants");
console.log("2. Use those results in batch_add_to_encounter");
console.log("3. Use rpg-combat-engine spatial tools for positioning");
console.log("4. Begin combat with all systems synchronized!");