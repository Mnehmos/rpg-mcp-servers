import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GameDatabase } from './db.js';

// Initialize database
const db = new GameDatabase();

// Create server
const server = new Server({
  name: 'rpg-game-state-server',
  version: '2.0.0',
}, {
  capabilities: { 
    tools: {},
  },
});

// Enhanced tool definitions with complete action economy and spatial features
const toolDefinitions = [
  // Character Management
  {
    name: 'create_character',
    description: 'Create a new D&D 5E character',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        class: {
          type: 'string',
          enum: ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard']
        },
        race: {
          type: 'string',
          default: 'Human',
          enum: ['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Gnome', 'Half-Elf', 'Half-Orc', 'Tiefling']
        },
        background: {
          type: 'string',
          default: 'Folk Hero',
          enum: ['Acolyte', 'Criminal', 'Folk Hero', 'Noble', 'Sage', 'Soldier', 'Charlatan', 'Entertainer', 'Guild Artisan', 'Hermit', 'Outlander', 'Sailor']
        },
        alignment: {
          type: 'string',
          default: 'Neutral',
          enum: ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil']
        },
        level: { type: 'number', default: 1, minimum: 1, maximum: 20 },
        stats: {
          type: 'object',
          properties: {
            strength: { type: 'number', minimum: 3, maximum: 18, default: 10 },
            dexterity: { type: 'number', minimum: 3, maximum: 18, default: 10 },
            constitution: { type: 'number', minimum: 3, maximum: 18, default: 10 },
            intelligence: { type: 'number', minimum: 3, maximum: 18, default: 10 },
            wisdom: { type: 'number', minimum: 3, maximum: 18, default: 10 },
            charisma: { type: 'number', minimum: 3, maximum: 18, default: 10 }
          }
        }
      },
      required: ['name', 'class']
    }
  },
  {
    name: 'get_character',
    description: 'Get character information',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' }
      },
      required: ['character_id']
    }
  },
  {
    name: 'update_character',
    description: 'Update character stats',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        updates: { type: 'object' }
      },
      required: ['character_id', 'updates']
    }
  },
  {
    name: 'list_characters',
    description: 'List all characters',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_character_by_name',
    description: 'Get character by name',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    }
  },
  
  // Inventory Management
  {
    name: 'add_item',
    description: 'Add one or more items to a character\'s inventory',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item_name: { type: 'string' },
              item_type: { type: 'string' },
              quantity: { type: 'number', default: 1 },
              properties: { type: 'object', default: {} }
            },
            required: ['item_name']
          }
        }
      },
      required: ['character_id', 'items']
    }
  },
  {
    name: 'get_inventory',
    description: 'Get character inventory',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' }
      },
      required: ['character_id']
    }
  },
  {
    name: 'remove_item',
    description: 'Remove one or more items from inventory by their IDs',
    inputSchema: {
      type: 'object',
      properties: {
        item_ids: {
          type: 'array',
          items: { type: 'number' }
        }
      },
      required: ['item_ids']
    }
  },
  {
    name: 'update_item',
    description: 'Update item quantity or equipped status',
    inputSchema: {
      type: 'object',
      properties: {
        item_id: { type: 'number' },
        quantity: { type: 'number' },
        equipped: { type: 'boolean' }
      },
      required: ['item_id']
    }
  },

  // World State Management
  {
    name: 'save_world_state',
    description: 'Save the current world state',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        location: { type: 'string' },
        npcs: { type: 'object' },
        events: { type: 'object' },
        environment: { type: 'object' }
      },
      required: ['character_id', 'location']
    }
  },
  {
    name: 'get_world_state',
    description: 'Get the current world state',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' }
      },
      required: ['character_id']
    }
  },
  {
    name: 'update_world_state',
    description: 'Update the current world state for a character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        location: { type: 'string' },
        npcs: { type: 'object' },
        events: { type: 'object' },
        environment: { type: 'object' }
      },
      required: ['character_id', 'location']
    }
  },
  {
    name: 'append_world_state',
    description: 'Append/merge data to the current world state without overwriting existing data',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        location: { type: 'string' },
        npcs: { type: 'object' },
        events: { type: 'object' },
        environment: { type: 'object' }
      },
      required: ['character_id']
    }
  },

  // Enhanced NPC Management
  {
    name: 'create_npc',
    description: 'Create a new NPC or enemy',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        template: { type: 'string', description: 'Use a preset: goblin, orc, skeleton, etc.' },
        type: {
          type: 'string',
          enum: ['enemy', 'ally', 'neutral']
        },
        customStats: { type: 'object', description: 'Override template stats' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_npc_group',
    description: 'Create multiple identical NPCs',
    inputSchema: {
      type: 'object',
      properties: {
        template: { type: 'string' },
        count: { type: 'number' },
        namePrefix: { type: 'string' }
      },
      required: ['template', 'count']
    }
  },
  {
    name: 'get_npc',
    description: 'Get NPC information',
    inputSchema: {
      type: 'object',
      properties: {
        npc_id: { type: 'number' }
      },
      required: ['npc_id']
    }
  },
  {
    name: 'list_npcs',
    description: 'List all NPCs',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['enemy', 'ally', 'neutral']
        },
        aliveOnly: { type: 'boolean' }
      }
    }
  },
  {
    name: 'update_npc',
    description: 'Update NPC stats. Valid fields: name, type, creature_type, size, current_hp, max_hp, armor_class, speed, strength, dexterity, constitution, intelligence, wisdom, charisma, proficiency_bonus, initiative_modifier, attacks, abilities, conditions, challenge_rating, experience_value. Also accepts: hit_points->current_hp, max_hit_points->max_hp, level->challenge_rating, special_abilities->abilities',
    inputSchema: {
      type: 'object',
      properties: {
        npc_id: { type: 'number' },
        updates: {
          type: 'object',
          description: 'Object containing field updates. Use current_hp/max_hp instead of hit_points/max_hit_points, challenge_rating instead of level'
        }
      },
      required: ['npc_id', 'updates']
    }
  },
  {
    name: 'remove_npc',
    description: 'Remove NPC from game',
    inputSchema: {
      type: 'object',
      properties: {
        npc_id: { type: 'number' }
      },
      required: ['npc_id']
    }
  },

  // Enhanced Encounter Management
  {
    name: 'create_encounter',
    description: 'Start a new combat encounter',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        name: { type: 'string' },
        description: { type: 'string' },
        environment: { type: 'string' }
      },
      required: ['character_id', 'name']
    }
  },
  {
    name: 'add_to_encounter',
    description: 'Add participants to encounter',
    inputSchema: {
      type: 'object',
      properties: {
        encounter_id: { type: 'number' },
        participants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['character', 'npc']
              },
              id: { type: 'number' },
              initiative: { type: 'number' }
            }
          }
        }
      },
      required: ['encounter_id', 'participants']
    }
  },
  {
    name: 'get_encounter_state',
    description: 'Get current encounter status',
    inputSchema: {
      type: 'object',
      properties: {
        encounter_id: { type: 'number' }
      },
      required: ['encounter_id']
    }
  },
  {
    name: 'next_turn',
    description: 'Advance to next turn in initiative',
    inputSchema: {
      type: 'object',
      properties: {
        encounter_id: { type: 'number' }
      },
      required: ['encounter_id']
    }
  },
  {
    name: 'end_encounter',
    description: 'End the current encounter',
    inputSchema: {
      type: 'object',
      properties: {
        encounter_id: { type: 'number' },
        outcome: {
          type: 'string',
          enum: ['victory', 'fled', 'defeat']
        }
      },
      required: ['encounter_id']
    }
  },
  {
    name: 'apply_damage',
    description: 'Apply damage to character or NPC',
    inputSchema: {
      type: 'object',
      properties: {
        target_type: {
          type: 'string',
          enum: ['character', 'npc']
        },
        target_id: { type: 'number' },
        damage: { type: 'number' }
      },
      required: ['target_type', 'target_id', 'damage']
    }
  },
  {
    name: 'get_active_encounter',
    description: 'Get the active encounter for a character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' }
      },
      required: ['character_id']
    }
  },

  // Enhanced Turn Management
  {
    name: 'start_turn',
    description: 'Start a turn for the current actor in an encounter',
    inputSchema: {
      type: 'object',
      properties: {
        encounter_id: { type: 'number' }
      },
      required: ['encounter_id']
    }
  },
  {
    name: 'end_turn',
    description: 'End the current turn in an encounter',
    inputSchema: {
      type: 'object',
      properties: {
        encounter_id: { type: 'number' }
      },
      required: ['encounter_id']
    }
  },
  {
    name: 'consume_action',
    description: 'Consume an action for the current actor',
    inputSchema: {
      type: 'object',
      properties: {
        encounter_id: { type: 'number' },
        action_type: {
          type: 'string',
          enum: ['action', 'bonus_action', 'movement']
        }
      },
      required: ['encounter_id', 'action_type']
    }
  },

  // Story Progress Management
  {
    name: 'save_story_progress',
    description: 'Save story progress checkpoint for a character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number', description: 'ID of the character whose progress is being saved.' },
        chapter: { type: 'string', description: 'Current chapter of the story.' },
        checkpoint: { type: 'string', description: 'Specific checkpoint within the chapter.' },
        summary: { type: 'string', description: 'A brief summary of the events at this checkpoint.' }
      },
      required: ['character_id', 'chapter', 'checkpoint', 'summary']
    }
  },

  // Quest Management
  {
    name: 'add_quest',
    description: 'Add a new quest to the game master list',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the quest' },
        description: { type: 'string', description: 'Detailed description of the quest' },
        objectives: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of objectives for the quest (e.g., ["Defeat the dragon", "Retrieve the artifact"])'
        },
        rewards: {
          type: 'object',
          properties: {
            gold: { type: 'number' },
            experience: { type: 'number' },
            items: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of item names or IDs'
            }
          },
          description: 'Rewards for completing the quest'
        }
      },
      required: ['title', 'description', 'objectives', 'rewards']
    }
  },
  {
    name: 'get_active_quests',
    description: 'Get all active quests for a specific character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number', description: 'ID of the character' }
      },
      required: ['character_id']
    }
  },
  {
    name: 'update_quest_state',
    description: 'Update the status or progress of a character\'s quest',
    inputSchema: {
      type: 'object',
      properties: {
        character_quest_id: { type: 'number', description: 'ID of the character-quest link (from character_quests table)' },
        status: {
          type: 'string',
          enum: ['active', 'completed', 'failed'],
          description: 'New status of the quest'
        },
        progress: {
          type: 'object',
          additionalProperties: true,
          description: 'JSON object detailing progress on specific objectives (optional)'
        }
      },
      required: ['character_quest_id', 'status']
    }
  },
  {
    name: 'assign_quest_to_character',
    description: 'Assign an existing quest to a character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number', description: 'ID of the character' },
        quest_id: { type: 'number', description: 'ID of the quest to assign' },
        status: {
          type: 'string',
          enum: ['active', 'completed', 'failed'],
          default: 'active',
          description: 'Initial status of the quest for the character'
        }
      },
      required: ['character_id', 'quest_id']
    }
  },
  // Spell Management
  {
    name: 'add_spell',
    description: 'Add a spell to a character\'s spellbook',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        spell_name: { type: 'string' },
        spell_level: { type: 'number', minimum: 0, maximum: 9 },
        is_prepared: { type: 'boolean', default: true },
        is_known: { type: 'boolean', default: true },
        source: { type: 'string', default: 'class', description: 'Source of the spell (class, racial, feat, etc.)' },
        description: { type: 'string', description: 'Spell description and effects' }
      },
      required: ['character_id', 'spell_name', 'spell_level']
    }
  },
  {
    name: 'remove_spell',
    description: 'Remove a spell from a character\'s spellbook',
    inputSchema: {
      type: 'object',
      properties: {
        spell_id: { type: 'number' }
      },
      required: ['spell_id']
    }
  },
  {
    name: 'get_character_spells',
    description: 'Get all spells for a character with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        spell_level: { type: 'number', minimum: 0, maximum: 9 },
        is_prepared: { type: 'boolean' },
        is_known: { type: 'boolean' },
        source: { type: 'string' }
      },
      required: ['character_id']
    }
  },
  {
    name: 'update_spell_status',
    description: 'Update spell preparation or known status',
    inputSchema: {
      type: 'object',
      properties: {
        spell_id: { type: 'number' },
        is_prepared: { type: 'boolean' },
        is_known: { type: 'boolean' }
      },
      required: ['spell_id']
    }
  },
  {
    name: 'get_spell_slots',
    description: 'Get current spell slot status for a character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' }
      },
      required: ['character_id']
    }
  },
  {
    name: 'use_spell_slot',
    description: 'Use a spell slot of specified level',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        spell_level: { type: 'number', minimum: 1, maximum: 9 }
      },
      required: ['character_id', 'spell_level']
    }
  },
  {
    name: 'recover_spell_slot',
    description: 'Recover a used spell slot',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        spell_level: { type: 'number', minimum: 1, maximum: 9 }
      },
      required: ['character_id', 'spell_level']
    }
  },
  {
    name: 'reset_spell_slots',
    description: 'Reset spell slots (long rest recovery)',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        spell_level: { type: 'number', minimum: 1, maximum: 9, description: 'Optional: reset only specific level' }
      },
      required: ['character_id']
    }
  },
  {
    name: 'initialize_spellcasting',
    description: 'Initialize spellcasting for a character based on class and level',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        character_class: { type: 'string' },
        level: { type: 'number', minimum: 1, maximum: 20 },
        spellcasting_ability: { type: 'string', description: 'Optional: override default spellcasting ability' }
      },
      required: ['character_id', 'character_class', 'level']
    }
  },
  {
    name: 'cast_spell',
    description: 'Cast a spell, automatically using appropriate spell slot',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        spell_name: { type: 'string' },
        cast_at_level: { type: 'number', minimum: 1, maximum: 9, description: 'Level to cast the spell at (for upcasting)' }
      },
      required: ['character_id', 'spell_name']
    }
  },

  // Stronghold Management
  {
    name: 'create_stronghold',
    description: 'Create a new stronghold for a character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        name: { type: 'string' },
        location: { type: 'string' },
        stronghold_type: { type: 'string', default: 'Keep' },
        level: { type: 'number', default: 1 },
        defense_bonus: { type: 'number', default: 0 },
        prosperity_level: { type: 'number', default: 1 },
        description: { type: 'string' },
        special_features: { type: 'object' }
      },
      required: ['character_id', 'name', 'location']
    }
  },
  {
    name: 'get_stronghold_status',
    description: 'Get detailed information about a stronghold including facilities and staff',
    inputSchema: {
      type: 'object',
      properties: {
        stronghold_id: { type: 'number' }
      },
      required: ['stronghold_id']
    }
  },
  {
    name: 'get_character_strongholds',
    description: 'List all strongholds owned by a character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' }
      },
      required: ['character_id']
    }
  },
  {
    name: 'update_stronghold',
    description: 'Update stronghold properties',
    inputSchema: {
      type: 'object',
      properties: {
        stronghold_id: { type: 'number' },
        updates: { type: 'object' }
      },
      required: ['stronghold_id', 'updates']
    }
  },

  // Facility Management
  {
    name: 'add_facility',
    description: 'Add a new facility to a stronghold',
    inputSchema: {
      type: 'object',
      properties: {
        stronghold_id: { type: 'number' },
        facility_type: { type: 'string' },
        name: { type: 'string' },
        level: { type: 'number', default: 1 },
        construction_cost: { type: 'number' },
        upkeep_cost: { type: 'number' },
        build_time_weeks: { type: 'number' },
        status: { type: 'string', default: 'active' },
        benefits: { type: 'object' },
        description: { type: 'string' }
      },
      required: ['stronghold_id', 'facility_type', 'name']
    }
  },
  {
    name: 'upgrade_facility',
    description: 'Upgrade an existing facility to a higher level',
    inputSchema: {
      type: 'object',
      properties: {
        facility_id: { type: 'number' },
        new_level: { type: 'number' },
        upgrade_cost: { type: 'number' }
      },
      required: ['facility_id', 'new_level']
    }
  },
  {
    name: 'get_stronghold_facilities',
    description: 'List all facilities in a stronghold',
    inputSchema: {
      type: 'object',
      properties: {
        stronghold_id: { type: 'number' }
      },
      required: ['stronghold_id']
    }
  },
  {
    name: 'list_facility_types',
    description: 'List available facility types with their costs and benefits',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['military', 'utility', 'economic', 'social', 'magical'] }
      }
    }
  },

  // Hireling Management
  {
    name: 'recruit_hireling',
    description: 'Recruit a new hireling for a character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        name: { type: 'string' },
        hireling_type: { type: 'string' },
        profession: { type: 'string' },
        tier: { type: 'string', enum: ['laborers', 'specialists', 'retainers'], default: 'laborers' },
        daily_wage_sp: { type: 'number', default: 2 },
        skill_bonus: { type: 'number', default: 0 },
        abilities: { type: 'object' },
        notes: { type: 'string' }
      },
      required: ['character_id', 'name', 'hireling_type', 'profession']
    }
  },
  {
    name: 'assign_hireling',
    description: 'Assign a hireling to a specific task or facility',
    inputSchema: {
      type: 'object',
      properties: {
        hireling_id: { type: 'number' },
        task: { type: 'string' },
        facility_id: { type: 'number' }
      },
      required: ['hireling_id', 'task']
    }
  },
  {
    name: 'manage_hireling_loyalty',
    description: 'Update a hireling\'s loyalty based on events',
    inputSchema: {
      type: 'object',
      properties: {
        hireling_id: { type: 'number' },
        loyalty_change: { type: 'number' },
        reason: { type: 'string' }
      },
      required: ['hireling_id', 'loyalty_change']
    }
  },
  {
    name: 'calculate_hireling_costs',
    description: 'Calculate weekly wage costs for all hirelings',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' }
      },
      required: ['character_id']
    }
  },
  {
    name: 'list_character_hirelings',
    description: 'List all hirelings for a character',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        status: { type: 'string', enum: ['active', 'busy', 'injured', 'away', 'dismissed'] }
      },
      required: ['character_id']
    }
  },

  // Business Operations
  {
    name: 'establish_business',
    description: 'Create a new income-generating business in a stronghold',
    inputSchema: {
      type: 'object',
      properties: {
        stronghold_id: { type: 'number' },
        name: { type: 'string' },
        business_type: { type: 'string' },
        investment_cost: { type: 'number', default: 0 },
        weekly_income: { type: 'number', default: 0 },
        risk_level: { type: 'string', enum: ['low', 'medium', 'high'], default: 'low' },
        employee_count: { type: 'number', default: 0 },
        description: { type: 'string' },
        special_rules: { type: 'object' }
      },
      required: ['stronghold_id', 'name', 'business_type']
    }
  },
  {
    name: 'process_weekly_income',
    description: 'Process weekly income from businesses and calculate costs',
    inputSchema: {
      type: 'object',
      properties: {
        character_id: { type: 'number' },
        week_number: { type: 'number' }
      },
      required: ['character_id', 'week_number']
    }
  },
  {
    name: 'get_stronghold_businesses',
    description: 'List all businesses in a stronghold',
    inputSchema: {
      type: 'object',
      properties: {
        stronghold_id: { type: 'number' }
      },
      required: ['stronghold_id']
    }
  },

  // Event System
  {
    name: 'generate_stronghold_event',
    description: 'Generate a random event for a stronghold',
    inputSchema: {
      type: 'object',
      properties: {
        stronghold_id: { type: 'number' },
        event_type: { type: 'string', enum: ['random', 'seasonal', 'quest', 'disaster', 'opportunity'] }
      },
      required: ['stronghold_id']
    }
  },
  {
    name: 'resolve_stronghold_event',
    description: 'Resolve a stronghold event with player choice',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'number' },
        player_choice: { type: 'string' },
        outcome: { type: 'string' }
      },
      required: ['event_id', 'player_choice']
    }
  },
  {
    name: 'get_stronghold_events',
    description: 'List events for a stronghold',
    inputSchema: {
      type: 'object',
      properties: {
        stronghold_id: { type: 'number' },
        status: { type: 'string', enum: ['pending', 'resolved', 'ignored', 'expired'] }
      },
      required: ['stronghold_id']
    }
  },

  // Batch Operations for Efficiency
  {
    name: 'batch_create_npcs',
    description: 'Create multiple NPCs at once',
    inputSchema: {
      type: 'object',
      properties: {
        npcs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              template: { type: 'string', description: 'Use a preset: goblin, orc, skeleton, etc.' },
              type: {
                type: 'string',
                enum: ['enemy', 'ally', 'neutral']
              },
              customStats: { type: 'object', description: 'Override template stats' }
            },
            required: ['name']
          }
        }
      },
      required: ['npcs']
    }
  },
  {
    name: 'batch_update_npcs',
    description: 'Update multiple NPCs at once',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              npc_id: { type: 'number' },
              updates: { type: 'object' }
            },
            required: ['npc_id', 'updates']
          }
        }
      },
      required: ['updates']
    }
  },
  {
    name: 'batch_apply_damage',
    description: 'Apply damage to multiple targets at once',
    inputSchema: {
      type: 'object',
      properties: {
        targets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              target_type: {
                type: 'string',
                enum: ['character', 'npc']
              },
              target_id: { type: 'number' },
              damage: { type: 'number' }
            },
            required: ['target_type', 'target_id', 'damage']
          }
        }
      },
      required: ['targets']
    }
  },
  {
    name: 'batch_remove_npcs',
    description: 'Remove multiple NPCs at once',
    inputSchema: {
      type: 'object',
      properties: {
        npc_ids: {
          type: 'array',
          items: { type: 'number' }
        }
      },
      required: ['npc_ids']
    }
  },
  {
    name: 'batch_add_to_encounter',
    description: 'Add multiple participants to an encounter at once',
    inputSchema: {
      type: 'object',
      properties: {
        encounter_id: { type: 'number' },
        participants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['character', 'npc']
              },
              id: { type: 'number' },
              initiative: { type: 'number' },
              name: { type: 'string', description: 'Optional name for display (auto-fetched if not provided)' }
            },
            required: ['type', 'id', 'initiative']
          }
        }
      },
      required: ['encounter_id', 'participants']
    }
  }
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      // Character management
      case 'create_character': {
        // Flatten stats object and include D&D 5E fields for database compatibility
        const flatArgs = {
          name: (args as any).name,
          class: (args as any).class,
          race: (args as any).race,
          background: (args as any).background,
          alignment: (args as any).alignment,
          level: (args as any).level,
          ...(args as any).stats // Spread the stats object to flatten it
        };
        const character = db.createCharacter(flatArgs) as any;

        // Calculate ability modifiers for display
        const getModifier = (score: number) => Math.floor((score - 10) / 2);
        const formatModifier = (mod: number) => mod >= 0 ? `+${mod}` : `${mod}`;
        
        const level = character.level || 1;
        const profBonus = Math.ceil(level / 4) + 1;
        const dexMod = getModifier(character.dexterity || 10);
        
        const output = `🎭 NEW D&D 5E CHARACTER CREATED!

═══════════════════════════════════════════════════════════════
👤 ${character.name} - Level ${level} ${character.race || 'Human'} ${character.class}
📚 Background: ${character.background || 'Folk Hero'}
⚖️ Alignment: ${character.alignment || 'Neutral'}
🆔 Character ID: ${character.id}
═══════════════════════════════════════════════════════════════

💪 ABILITY SCORES:
┌────────────────────────────────────────────┐
│ 💪 STR: ${String(character.strength || 10).padStart(2)} (${formatModifier(getModifier(character.strength || 10)).padStart(3)})  🧠 INT: ${String(character.intelligence || 10).padStart(2)} (${formatModifier(getModifier(character.intelligence || 10)).padStart(3)}) │
│ 🏃 DEX: ${String(character.dexterity || 10).padStart(2)} (${formatModifier(dexMod).padStart(3)})  🧙 WIS: ${String(character.wisdom || 10).padStart(2)} (${formatModifier(getModifier(character.wisdom || 10)).padStart(3)}) │
│ ❤️ CON: ${String(character.constitution || 10).padStart(2)} (${formatModifier(getModifier(character.constitution || 10)).padStart(3)})  ✨ CHA: ${String(character.charisma || 10).padStart(2)} (${formatModifier(getModifier(character.charisma || 10)).padStart(3)}) │
└────────────────────────────────────────────┘

⚔️ COMBAT STATS:
🛡️ Armor Class: ${character.armor_class || 10}
❤️ Hit Points: ${character.current_hp || character.max_hp}/${character.max_hp}
🎯 Proficiency Bonus: ${formatModifier(profBonus)}
🏃 Initiative: ${formatModifier(dexMod)}
🦶 Speed: ${character.speed || 30} ft

📅 Created: ${new Date().toLocaleString()}

🎉 Ready for adventure! Use 'get_character' for full character sheet! 🗡️⚔️`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_character': {
        const character = db.getCharacter((args as any).character_id) as any;
        if (!character) {
          return {
            content: [{ type: 'text', text: '❌ Character not found!' }]
          };
        }

        // Calculate ability modifiers
        const getModifier = (score: number) => Math.floor((score - 10) / 2);
        const formatModifier = (mod: number) => mod >= 0 ? `+${mod}` : `${mod}`;
        
        // Calculate proficiency bonus based on level
        const level = character.level || 1;
        const profBonus = Math.ceil(level / 4) + 1;
        
        // Calculate derived stats
        const strMod = getModifier(character.strength || 10);
        const dexMod = getModifier(character.dexterity || 10);
        const conMod = getModifier(character.constitution || 10);
        const intMod = getModifier(character.intelligence || 10);
        const wisMod = getModifier(character.wisdom || 10);
        const chaMod = getModifier(character.charisma || 10);
        
        const initiative = dexMod;
        const speed = 30; // Default human speed
        
        const output = `🎭 D&D 5E CHARACTER SHEET

═══════════════════════════════════════════════════════════════
👤 ${character.name}                                    🆔 ID: ${character.id}
🏛️ Class: ${character.class}                           📊 Level: ${level}
🧬 Race: ${character.race || 'Human'}                  ⚖️ Alignment: ${character.alignment || 'Neutral'}
📚 Background: ${character.background || 'Folk Hero'}
═══════════════════════════════════════════════════════════════

💪 ABILITY SCORES & MODIFIERS:
┌──────────────┬──────────────┬──────────────┐
│ 💪 STR: ${String(character.strength || 10).padStart(2)} (${formatModifier(strMod).padStart(3)}) │ 🧠 INT: ${String(character.intelligence || 10).padStart(2)} (${formatModifier(intMod).padStart(3)}) │ 🎯 Prof Bonus: ${formatModifier(profBonus).padStart(3)} │
│ 🏃 DEX: ${String(character.dexterity || 10).padStart(2)} (${formatModifier(dexMod).padStart(3)}) │ 🧙 WIS: ${String(character.wisdom || 10).padStart(2)} (${formatModifier(wisMod).padStart(3)}) │ 🏃 Initiative: ${formatModifier(initiative).padStart(3)} │
│ ❤️ CON: ${String(character.constitution || 10).padStart(2)} (${formatModifier(conMod).padStart(3)}) │ ✨ CHA: ${String(character.charisma || 10).padStart(2)} (${formatModifier(chaMod).padStart(3)}) │ 🦶 Speed: ${speed} ft      │
└──────────────┴──────────────┴──────────────┘

⚔️ COMBAT STATS:
┌────────────────────────────────────────────────────────────┐
│ 🛡️ Armor Class: ${String(character.armor_class || 10).padStart(2)}                              │
│ ❤️ Hit Points: ${String(character.current_hp || character.max_hp || 10).padStart(3)}/${String(character.max_hp || 10).padStart(3)}                            │
│ 🎲 Hit Dice: ${level}d${character.class === 'Wizard' ? '6' : character.class === 'Rogue' ? '8' : character.class === 'Fighter' ? '10' : character.class === 'Barbarian' ? '12' : '8'} (${level} remaining)                     │
│ ⭐ Experience: ${String(character.experience || 0).padStart(6)} XP                         │
│ 💰 Gold: ${String(character.gold || 0).padStart(8)} gp                              │
└────────────────────────────────────────────────────────────┘

🛡️ SAVING THROWS:
┌─────────────────────────────────────────────────────────────┐
│ 💪 Strength:     ${formatModifier(strMod).padStart(3)}  │ 🧠 Intelligence: ${formatModifier(intMod).padStart(3)}  │
│ 🏃 Dexterity:    ${formatModifier(dexMod).padStart(3)}  │ 🧙 Wisdom:       ${formatModifier(wisMod).padStart(3)}  │
│ ❤️ Constitution: ${formatModifier(conMod).padStart(3)}  │ ✨ Charisma:     ${formatModifier(chaMod).padStart(3)}  │
└─────────────────────────────────────────────────────────────┘

🎯 SKILLS:
┌─────────────────────────────────────────────────────────────┐
│ 🤸 Acrobatics (Dex):    ${formatModifier(dexMod).padStart(3)}  │ 🌿 Nature (Int):        ${formatModifier(intMod).padStart(3)}  │
│ 🐾 Animal Handling (Wis): ${formatModifier(wisMod).padStart(3)}  │ 👁️ Perception (Wis):    ${formatModifier(wisMod).padStart(3)}  │
│ 🏛️ Arcana (Int):        ${formatModifier(intMod).padStart(3)}  │ 🎭 Performance (Cha):   ${formatModifier(chaMod).padStart(3)}  │
│ 💪 Athletics (Str):     ${formatModifier(strMod).padStart(3)}  │ 🗣️ Persuasion (Cha):    ${formatModifier(chaMod).padStart(3)}  │
│ 😈 Deception (Cha):     ${formatModifier(chaMod).padStart(3)}  │ 🙏 Religion (Int):      ${formatModifier(intMod).padStart(3)}  │
│ 📚 History (Int):       ${formatModifier(intMod).padStart(3)}  │ 🤫 Sleight of Hand (Dex): ${formatModifier(dexMod).padStart(3)}  │
│ 🔍 Insight (Wis):       ${formatModifier(wisMod).padStart(3)}  │ 👤 Stealth (Dex):       ${formatModifier(dexMod).padStart(3)}  │
│ 😠 Intimidation (Cha):  ${formatModifier(chaMod).padStart(3)}  │ 🏕️ Survival (Wis):      ${formatModifier(wisMod).padStart(3)}  │
│ 🔬 Investigation (Int): ${formatModifier(intMod).padStart(3)}  │ 🩺 Medicine (Wis):      ${formatModifier(wisMod).padStart(3)}  │
└─────────────────────────────────────────────────────────────┘

${character.features ? `✨ FEATURES & ABILITIES:
┌─────────────────────────────────────────────────────────────┐
${Object.entries(character.features).map(([key, feature]: [string, any]) =>
  `│ 🎯 ${feature.name || key}${feature.type ? ` (${feature.type})` : ''}${' '.repeat(Math.max(0, 57 - (feature.name || key).length - (feature.type ? feature.type.length + 3 : 0)))}│`
).join('\n')}
└─────────────────────────────────────────────────────────────┘

` : ''}📅 CHARACTER INFO:
┌─────────────────────────────────────────────────────────────┐
│ 🎂 Created: ${new Date(character.created_at).toLocaleDateString().padEnd(12)} │ 🎮 Last Played: ${new Date(character.last_played).toLocaleDateString().padEnd(12)} │
└─────────────────────────────────────────────────────────────┘

🎒 Use 'get_inventory' to view equipment and items`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'update_character': {
        const character = db.updateCharacter((args as any).character_id, (args as any).updates) as any;
        const output = `✅ CHARACTER UPDATED!

👤 ${character.name} - ${character.class}

📊 CURRENT STATS:
💪 Strength: ${character.strength || 10}     🧠 Intelligence: ${character.intelligence || 10}
🏃 Dexterity: ${character.dexterity || 10}    🧙 Wisdom: ${character.wisdom || 10}
❤️ Constitution: ${character.constitution || 10}  ✨ Charisma: ${character.charisma || 10}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'list_characters': {
        const characters = db.listCharacters() as any[];
        if (characters.length === 0) {
          return {
            content: [{ type: 'text', text: '📋 NO CHARACTERS FOUND\n\nCreate your first character to begin your adventure! 🎭✨' }]
          };
        }
        
        let output = '📋 CHARACTER ROSTER\n\n';
        characters.forEach((char: any, index: number) => {
          output += `${index + 1}. 👤 ${char.name} (${char.class}) - ID: ${char.id}\n`;
        });
        output += `\n📊 Total Characters: ${characters.length}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_character_by_name': {
        const character = db.getCharacterByName((args as any).name) as any;
        if (!character) {
          return {
            content: [{ type: 'text', text: `❌ No character found with name "${(args as any).name}"` }]
          };
        }

        // Calculate ability modifiers
        const getModifier = (score: number) => Math.floor((score - 10) / 2);
        const formatModifier = (mod: number) => mod >= 0 ? `+${mod}` : `${mod}`;
        
        // Calculate proficiency bonus based on level
        const level = character.level || 1;
        const profBonus = Math.ceil(level / 4) + 1;
        
        // Calculate derived stats
        const strMod = getModifier(character.strength || 10);
        const dexMod = getModifier(character.dexterity || 10);
        const conMod = getModifier(character.constitution || 10);
        const intMod = getModifier(character.intelligence || 10);
        const wisMod = getModifier(character.wisdom || 10);
        const chaMod = getModifier(character.charisma || 10);
        
        const initiative = dexMod;
        const speed = 30; // Default human speed
        
        const output = `🎭 D&D 5E CHARACTER SHEET

═══════════════════════════════════════════════════════════════
👤 ${character.name}                                    🆔 ID: ${character.id}
🏛️ Class: ${character.class}                           📊 Level: ${level}
🧬 Race: ${character.race || 'Human'}                  ⚖️ Alignment: ${character.alignment || 'Neutral'}
📚 Background: ${character.background || 'Folk Hero'}
═══════════════════════════════════════════════════════════════

💪 ABILITY SCORES & MODIFIERS:
┌──────────────┬──────────────┬──────────────┐
│ 💪 STR: ${String(character.strength || 10).padStart(2)} (${formatModifier(strMod).padStart(3)}) │ 🧠 INT: ${String(character.intelligence || 10).padStart(2)} (${formatModifier(intMod).padStart(3)}) │ 🎯 Prof Bonus: ${formatModifier(profBonus).padStart(3)} │
│ 🏃 DEX: ${String(character.dexterity || 10).padStart(2)} (${formatModifier(dexMod).padStart(3)}) │ 🧙 WIS: ${String(character.wisdom || 10).padStart(2)} (${formatModifier(wisMod).padStart(3)}) │ 🏃 Initiative: ${formatModifier(initiative).padStart(3)} │
│ ❤️ CON: ${String(character.constitution || 10).padStart(2)} (${formatModifier(conMod).padStart(3)}) │ ✨ CHA: ${String(character.charisma || 10).padStart(2)} (${formatModifier(chaMod).padStart(3)}) │ 🦶 Speed: ${speed} ft      │
└──────────────┴──────────────┴──────────────┘

⚔️ COMBAT STATS:
┌────────────────────────────────────────────────────────────┐
│ 🛡️ Armor Class: ${String(character.armor_class || 10).padStart(2)}                              │
│ ❤️ Hit Points: ${String(character.current_hp || character.max_hp || 10).padStart(3)}/${String(character.max_hp || 10).padStart(3)}                            │
│ 🎲 Hit Dice: ${level}d${character.class === 'Wizard' ? '6' : character.class === 'Rogue' ? '8' : character.class === 'Fighter' ? '10' : character.class === 'Barbarian' ? '12' : '8'} (${level} remaining)                     │
│ ⭐ Experience: ${String(character.experience || 0).padStart(6)} XP                         │
│ 💰 Gold: ${String(character.gold || 0).padStart(8)} gp                              │
└────────────────────────────────────────────────────────────┘

🛡️ SAVING THROWS:
┌─────────────────────────────────────────────────────────────┐
│ 💪 Strength:     ${formatModifier(strMod).padStart(3)}  │ 🧠 Intelligence: ${formatModifier(intMod).padStart(3)}  │
│ 🏃 Dexterity:    ${formatModifier(dexMod).padStart(3)}  │ 🧙 Wisdom:       ${formatModifier(wisMod).padStart(3)}  │
│ ❤️ Constitution: ${formatModifier(conMod).padStart(3)}  │ ✨ Charisma:     ${formatModifier(chaMod).padStart(3)}  │
└─────────────────────────────────────────────────────────────┘

🎯 SKILLS:
┌─────────────────────────────────────────────────────────────┐
│ 🤸 Acrobatics (Dex):    ${formatModifier(dexMod).padStart(3)}  │ 🌿 Nature (Int):        ${formatModifier(intMod).padStart(3)}  │
│ 🐾 Animal Handling (Wis): ${formatModifier(wisMod).padStart(3)}  │ 👁️ Perception (Wis):    ${formatModifier(wisMod).padStart(3)}  │
│ 🏛️ Arcana (Int):        ${formatModifier(intMod).padStart(3)}  │ 🎭 Performance (Cha):   ${formatModifier(chaMod).padStart(3)}  │
│ 💪 Athletics (Str):     ${formatModifier(strMod).padStart(3)}  │ 🗣️ Persuasion (Cha):    ${formatModifier(chaMod).padStart(3)}  │
│ 😈 Deception (Cha):     ${formatModifier(chaMod).padStart(3)}  │ 🙏 Religion (Int):      ${formatModifier(intMod).padStart(3)}  │
│ 📚 History (Int):       ${formatModifier(intMod).padStart(3)}  │ 🤫 Sleight of Hand (Dex): ${formatModifier(dexMod).padStart(3)}  │
│ 🔍 Insight (Wis):       ${formatModifier(wisMod).padStart(3)}  │ 👤 Stealth (Dex):       ${formatModifier(dexMod).padStart(3)}  │
│ 😠 Intimidation (Cha):  ${formatModifier(chaMod).padStart(3)}  │ 🏕️ Survival (Wis):      ${formatModifier(wisMod).padStart(3)}  │
│ 🔬 Investigation (Int): ${formatModifier(intMod).padStart(3)}  │ 🩺 Medicine (Wis):      ${formatModifier(wisMod).padStart(3)}  │
└─────────────────────────────────────────────────────────────┘

${character.features ? `✨ FEATURES & ABILITIES:
┌─────────────────────────────────────────────────────────────┐
${Object.entries(character.features).map(([key, feature]: [string, any]) =>
  `│ 🎯 ${feature.name || key}${feature.type ? ` (${feature.type})` : ''}${' '.repeat(Math.max(0, 57 - (feature.name || key).length - (feature.type ? feature.type.length + 3 : 0)))}│`
).join('\n')}
└─────────────────────────────────────────────────────────────┘

` : ''}📅 CHARACTER INFO:
┌─────────────────────────────────────────────────────────────┐
│ 🎂 Created: ${new Date(character.created_at).toLocaleDateString().padEnd(12)} │ 🎮 Last Played: ${new Date(character.last_played).toLocaleDateString().padEnd(12)} │
└─────────────────────────────────────────────────────────────┘

🎒 Use 'get_inventory' to view equipment and items`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      // Inventory management
      case 'add_item': {
        const { character_id, items } = args as any;
        const numCharacterId = Number(character_id);
        
        // Get character name
        const character = db.getCharacter(numCharacterId) as any;
        const characterName = character ? character.name : 'Unknown Character';
        
        const addedItems = [];
        
        for (const item of items) {
          // Transform MCP schema to database schema with proper defaults
          const dbItem = {
            name: item.item_name,
            type: item.item_type || 'misc',
            quantity: item.quantity || 1,
            properties: item.properties || null,
            equipped: item.equipped || false
          };
          const itemId = db.addItem(numCharacterId, dbItem);
          addedItems.push({ id: itemId, ...item });
        }
        
        let output = `🎒 ${characterName.toUpperCase()}'S INVENTORY UPDATED!\n\n`;
        addedItems.forEach((item: any) => {
          const equippedText = item.equipped ? ' 🔥(EQUIPPED)' : '';
          const quantityText = item.quantity > 1 ? ` x${item.quantity}` : '';
          output += `📦 ${item.item_name}${quantityText}${equippedText}\n`;
          if (item.item_type) output += `   📋 Type: ${item.item_type}\n`;
        });
        
        if (addedItems.length === 1) {
          output += `\n✅ ${characterName} acquired the ${addedItems[0].item_name}!`;
        } else {
          output += `\n✅ ${characterName} acquired ${addedItems.length} new items!`;
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_inventory': {
        const inventory = db.getInventory((args as any).character_id) as any[];
        if (!inventory || inventory.length === 0) {
          return {
            content: [{ type: 'text', text: '🎒 INVENTORY EMPTY\n\nThis character has no items yet. Time to go adventuring! 🗡️✨' }]
          };
        }
        
        let output = '🎒 INVENTORY\n\n';
        let totalItems = 0;
        let equippedCount = 0;
        
        inventory.forEach((item: any, index: number) => {
          const equippedText = item.equipped ? ' 🔥(EQUIPPED)' : '';
          const quantityText = item.quantity > 1 ? ` x${item.quantity}` : '';
          output += `${index + 1}. 📦 ${item.item_name}${quantityText}${equippedText}\n`;
          if (item.item_type) output += `    📋 Type: ${item.item_type}\n`;
          totalItems += item.quantity || 1;
          if (item.equipped) equippedCount++;
        });
        
        output += `\n📊 SUMMARY:\n`;
        output += `📦 Total Items: ${totalItems}\n`;
        output += `🔥 Equipped: ${equippedCount}\n`;
        output += `🎒 Unique Items: ${inventory.length}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'remove_item': {
        const { item_ids } = args as any;
        
        // Get item details before removing them
        const itemsToRemove = [];
        let characterName = 'Unknown Character';
        
        for (const itemId of item_ids) {
          const item = db.getItem(itemId);
          if (item) {
            itemsToRemove.push(item);
            // Get character name from the first item
            if (characterName === 'Unknown Character' && item.character_id) {
              const character = db.getCharacter(item.character_id) as any;
              if (character) characterName = character.name;
            }
          }
          db.removeItem(itemId);
        }
        
        let output = `🗑️ ${characterName.toUpperCase()}'S INVENTORY UPDATED!\n\n`;
        
        if (itemsToRemove.length === 1) {
          output += `✅ ${characterName} discarded the ${itemsToRemove[0].item_name}`;
        } else if (itemsToRemove.length > 1) {
          output += `✅ ${characterName} discarded ${itemsToRemove.length} items:\n`;
          itemsToRemove.forEach((item: any) => {
            const quantityText = item.quantity > 1 ? ` x${item.quantity}` : '';
            output += `   📦 ${item.item_name}${quantityText}\n`;
          });
        } else {
          output += `✅ Items removed from inventory`;
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'update_item': {
        const { item_id, ...updates } = args as any;
        
        // Get the item and character details
        const item = db.getItem(item_id);
        const itemName = item ? item.item_name : `Item ${item_id}`;
        
        // Get character name if we have the item
        let characterName = 'Unknown Character';
        if (item && item.character_id) {
          const character = db.getCharacter(item.character_id) as any;
          if (character) characterName = character.name;
        }
        
        // Handle boolean conversion for equipped field
        if ('equipped' in updates && typeof updates.equipped === 'boolean') {
          updates.equipped = updates.equipped ? 1 : 0;
        }
        db.updateItem(item_id, updates);
        
        let output = `✅ ${itemName.toUpperCase()} UPDATED!\n\n`;
        
        if (updates.quantity !== undefined) {
          output += `📊 Quantity updated to: ${updates.quantity}\n`;
        }
        if ('equipped' in updates) {
          const isEquipped = updates.equipped === 1 || updates.equipped === true;
          if (isEquipped) {
            output += `🔥 ${characterName} equipped the ${itemName}\n`;
          } else {
            output += `🔥 ${characterName} unequipped the ${itemName}\n`;
          }
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      // World state management
      case 'save_world_state': {
        const { character_id, location, npcs, events, environment } = args as any;
        
        try {
          db.saveWorldState(character_id, args as any);
          
          let output = `🌍 WORLD STATE SAVED!\n\n`;
          output += `👤 Character ID: ${character_id}\n`;
          output += `📍 Location: ${location}\n`;
          
          if (npcs && Object.keys(npcs).length > 0) {
            output += `👥 NPCs: ${Object.keys(npcs).length} tracked\n`;
          }
          
          if (events && Object.keys(events).length > 0) {
            output += `📚 Events: ${Object.keys(events).length} recorded\n`;
          }
          
          if (environment && Object.keys(environment).length > 0) {
            output += `🌿 Environment: ${Object.keys(environment).length} details saved\n`;
          }
          
          output += `\n💾 Saved: ${new Date().toLocaleString()}\n`;
          output += `✅ World state successfully preserved!`;
          
          return {
            content: [{ type: 'text', text: output }]
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `❌ SAVE FAILED\n\nError saving world state: ${error.message}\n\n💡 Make sure the character ID exists and try again.` }],
            isError: true
          };
        }
      }

      case 'get_world_state': {
        const character_id = (args as any).character_id;
        
        try {
          const state = db.getWorldState(character_id);
          
          if (!state) {
            return {
              content: [{ type: 'text', text: `🌍 NO WORLD STATE FOUND\n\nNo saved world state for character ID ${character_id}.\n\n💡 Use 'save_world_state' to create the first save!` }]
            };
          }
          
          let output = `🌍 WORLD STATE\n\n`;
          output += `👤 Character ID: ${character_id}\n`;
          output += `📍 Current Location: ${state.location || 'Unknown'}\n`;
          output += `📅 Last Updated: ${state.updated_at ? new Date(state.updated_at).toLocaleString() : 'Unknown'}\n\n`;
          
          if (state.npcs) {
            const npcData = typeof state.npcs === 'string' ? JSON.parse(state.npcs) : state.npcs;
            const npcCount = Object.keys(npcData).length;
            output += `👥 NPCs TRACKED: ${npcCount}\n`;
            if (npcCount > 0) {
              const npcNames = Object.keys(npcData).slice(0, 5);
              output += `   📋 Recent: ${npcNames.join(', ')}${npcCount > 5 ? '...' : ''}\n`;
            }
          }
          
          if (state.events) {
            const eventData = typeof state.events === 'string' ? JSON.parse(state.events) : state.events;
            const eventCount = Object.keys(eventData).length;
            output += `📚 EVENTS RECORDED: ${eventCount}\n`;
          }
          
          if (state.environment) {
            const envData = typeof state.environment === 'string' ? JSON.parse(state.environment) : state.environment;
            const envCount = Object.keys(envData).length;
            output += `🌿 ENVIRONMENT DETAILS: ${envCount} tracked elements\n`;
          }
          
          output += `\n📊 RAW DATA:\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``;
          
          return {
            content: [{ type: 'text', text: output }]
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `❌ ERROR RETRIEVING WORLD STATE\n\nError: ${error.message}\n\n💡 Check that the character ID is valid.` }],
            isError: true
          };
        }
      }

      case 'update_world_state': {
        const { character_id, location, npcs, events, environment } = args as any;
        
        try {
          db.saveWorldState(character_id, args as any);
          
          let output = `🔄 WORLD STATE UPDATED!\n\n`;
          output += `👤 Character ID: ${character_id}\n`;
          output += `📍 New Location: ${location}\n`;
          
          const changes = [];
          if (npcs) changes.push('NPCs');
          if (events) changes.push('Events');
          if (environment) changes.push('Environment');
          
          if (changes.length > 0) {
            output += `📝 Updated: ${changes.join(', ')}\n`;
          }
          
          output += `\n💾 Updated: ${new Date().toLocaleString()}\n`;
          output += `✅ World state successfully updated!`;
          
          return {
            content: [{ type: 'text', text: output }]
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `❌ UPDATE FAILED\n\nError updating world state: ${error.message}\n\n💡 Make sure the character ID exists and try again.` }],
            isError: true
          };
        }
      }

      case 'append_world_state': {
        const { character_id, location, npcs, events, environment } = args as any;
        
        try {
          // Get existing state for output info
          const existing = db.getWorldState(character_id);
          
          // Use the new appendWorldState method
          const mergedData = db.appendWorldState(character_id, { location, npcs, events, environment });
          
          let output = `🔄 WORLD STATE APPENDED!\n\n`;
          output += `👤 Character ID: ${character_id}\n`;
          
          if (location !== undefined) {
            output += `📍 Location updated: ${location}\n`;
          } else if (existing?.location) {
            output += `📍 Location unchanged: ${existing.location}\n`;
          }
          
          const changes = [];
          if (npcs) {
            const newKeys = Object.keys(npcs);
            changes.push(`NPCs (${newKeys.length} added/updated: ${newKeys.slice(0, 3).join(', ')}${newKeys.length > 3 ? '...' : ''})`);
          }
          if (events) {
            const newKeys = Object.keys(events);
            changes.push(`Events (${newKeys.length} added/updated: ${newKeys.slice(0, 3).join(', ')}${newKeys.length > 3 ? '...' : ''})`);
          }
          if (environment) {
            const newKeys = Object.keys(environment);
            changes.push(`Environment (${newKeys.length} added/updated: ${newKeys.slice(0, 3).join(', ')}${newKeys.length > 3 ? '...' : ''})`);
          }
          
          if (changes.length > 0) {
            output += `📝 Appended: ${changes.join(', ')}\n`;
          } else {
            output += `📝 No new data appended (location only updated)\n`;
          }
          
          output += `\n💾 Updated: ${new Date().toLocaleString()}\n`;
          output += `✅ World state successfully appended without overwriting existing data!`;
          
          return {
            content: [{ type: 'text', text: output }]
          };
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `❌ APPEND FAILED\n\nError appending to world state: ${error.message}\n\n💡 Make sure the character ID exists and try again.` }],
            isError: true
          };
        }
      }

      // Enhanced NPC management
      case 'create_npc': {
        const npc = db.createNPC(args as any) as any;
        const typeIcon = npc.type === 'enemy' ? '👹' : npc.type === 'ally' ? '🤝' : '🧑';
        const output = `${typeIcon} NEW NPC CREATED!

🏷️ ${npc.name} (${npc.template || 'Custom'})
📋 Type: ${npc.type || 'neutral'}
🆔 NPC ID: ${npc.id}

⚔️ COMBAT STATS:
❤️ HP: ${npc.current_hp || 'N/A'}    🛡️ AC: ${npc.armor_class || 'N/A'}
💪 STR: ${npc.strength || 10}  🧠 INT: ${npc.intelligence || 10}
🏃 DEX: ${npc.dexterity || 10}  🧙 WIS: ${npc.wisdom || 10}
❤️ CON: ${npc.constitution || 10}  ✨ CHA: ${npc.charisma || 10}

✅ Ready for encounters!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'create_npc_group': {
        const { template, count, namePrefix = '' } = args as any;
        const npcs = db.createNPCGroup(template, count, namePrefix) as any[];
        
        let output = `👥 NPC GROUP CREATED!\n\n`;
        output += `📋 Template: ${template}\n`;
        output += `🔢 Count: ${count}\n\n`;
        output += `CREATED NPCs:\n`;
        
        npcs.forEach((npc: any, index: number) => {
          const typeIcon = npc.type === 'enemy' ? '👹' : npc.type === 'ally' ? '🤝' : '🧑';
          output += `${index + 1}. ${typeIcon} ${npc.name} (ID: ${npc.id})\n`;
        });
        
        output += `\n✅ Successfully created ${count} ${template}s!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_npc': {
        const npc = db.getNPC((args as any).npc_id) as any;
        if (!npc) {
          return {
            content: [{ type: 'text', text: '❌ NPC not found!' }]
          };
        }
        
        const typeIcon = npc.type === 'enemy' ? '👹' : npc.type === 'ally' ? '🤝' : '🧑';
        const aliveStatus = npc.current_hp <= 0 ? '💀 DEAD' : npc.current_hp < (npc.max_hp || npc.current_hp) / 2 ? '🩸 WOUNDED' : '💚 HEALTHY';
        
        const output = `${typeIcon} NPC DETAILS

🏷️ ${npc.name} (${npc.template || 'Custom'})
📋 Type: ${npc.type || 'neutral'}
🩺 Status: ${aliveStatus}
🆔 NPC ID: ${npc.id}

⚔️ COMBAT STATS:
❤️ HP: ${npc.current_hp}${npc.max_hp ? `/${npc.max_hp}` : ''}    🛡️ AC: ${npc.armor_class || 'N/A'}
💪 STR: ${npc.strength || 10}  🧠 INT: ${npc.intelligence || 10}
🏃 DEX: ${npc.dexterity || 10}  🧙 WIS: ${npc.wisdom || 10}
❤️ CON: ${npc.constitution || 10}  ✨ CHA: ${npc.charisma || 10}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'list_npcs': {
        const npcs = db.listNPCs((args as any).type, (args as any).aliveOnly) as any[];
        if (!npcs || npcs.length === 0) {
          return {
            content: [{ type: 'text', text: '👥 NO NPCs FOUND\n\nCreate some NPCs to populate your world! 🌍✨' }]
          };
        }
        
        let output = '👥 NPC ROSTER\n\n';
        let enemyCount = 0, allyCount = 0, neutralCount = 0;
        
        npcs.forEach((npc: any, index: number) => {
          const typeIcon = npc.type === 'enemy' ? '👹' : npc.type === 'ally' ? '🤝' : '🧑';
          const aliveStatus = npc.current_hp <= 0 ? '💀' : npc.current_hp < (npc.max_hp || npc.current_hp) / 2 ? '🩸' : '💚';
          
          output += `${index + 1}. ${typeIcon} ${npc.name} ${aliveStatus} (ID: ${npc.id})\n`;
          output += `    📋 ${npc.template || 'Custom'} | ❤️ ${npc.current_hp}HP\n`;
          
          if (npc.type === 'enemy') enemyCount++;
          else if (npc.type === 'ally') allyCount++;
          else neutralCount++;
        });
        
        output += `\n📊 SUMMARY:\n`;
        output += `👹 Enemies: ${enemyCount}  🤝 Allies: ${allyCount}  🧑 Neutral: ${neutralCount}\n`;
        output += `📋 Total NPCs: ${npcs.length}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'update_npc': {
        const npc = db.updateNPC((args as any).npc_id, (args as any).updates) as any;
        const typeIcon = npc.type === 'enemy' ? '👹' : npc.type === 'ally' ? '🤝' : '🧑';
        
        const output = `✅ NPC UPDATED!

${typeIcon} ${npc.name} (${npc.template || 'Custom'})

⚔️ CURRENT STATS:
❤️ HP: ${npc.current_hp}${npc.max_hp ? `/${npc.max_hp}` : ''}    🛡️ AC: ${npc.armor_class || 'N/A'}
💪 STR: ${npc.strength || 10}  🧠 INT: ${npc.intelligence || 10}
🏃 DEX: ${npc.dexterity || 10}  🧙 WIS: ${npc.wisdom || 10}
❤️ CON: ${npc.constitution || 10}  ✨ CHA: ${npc.charisma || 10}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'remove_npc': {
        db.removeNPC((args as any).npc_id);
        return {
          content: [{ type: 'text', text: '🗑️ NPC REMOVED!\n\n✅ NPC has been successfully removed from the world.' }]
        };
      }

      // Enhanced encounter management
      case 'create_encounter': {
        const encounter = db.createEncounter(args as any) as any;
        const output = `⚔️ NEW ENCOUNTER CREATED!

🏷️ ${encounter.name}
📜 Description: ${encounter.description || 'No description provided'}
🌍 Environment: ${encounter.environment || 'Unknown location'}
🆔 Encounter ID: ${encounter.id}
📅 Started: ${new Date().toLocaleString()}

⏳ STATUS: Waiting for participants...
🎲 Use 'add_to_encounter' to add characters and NPCs!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'add_to_encounter': {
        const { encounter_id, participants } = args as any;
        const addedParticipants = [];
        
        for (const participant of participants) {
          const participantId = db.addEncounterParticipant(
            encounter_id,
            participant.type,
            participant.id,
            participant.initiative
          );
          addedParticipants.push({ participantId, ...participant });
        }
        
        let output = `🎲 PARTICIPANTS ADDED TO ENCOUNTER!\n\n`;
        addedParticipants.forEach((p: any, index: number) => {
          const typeIcon = p.type === 'character' ? '🎭' : p.type === 'npc' ? '👹' : '🧑';
          output += `${index + 1}. ${typeIcon} ${p.type.toUpperCase()} (ID: ${p.id}) - Initiative: ${p.initiative}\n`;
        });
        
        // Sort by initiative to show turn order
        const sorted = [...addedParticipants].sort((a, b) => b.initiative - a.initiative);
        output += `\n🎯 INITIATIVE ORDER:\n`;
        sorted.forEach((p: any, index: number) => {
          const typeIcon = p.type === 'character' ? '🎭' : '👹';
          output += `${index + 1}. ${typeIcon} Initiative ${p.initiative} - ${p.type.toUpperCase()} ${p.id}\n`;
        });
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_encounter_state': {
        const encounter = db.getEncounter((args as any).encounter_id) as any;
        const participants = db.getEncounterParticipants((args as any).encounter_id) as any[];
        
        if (!encounter) {
          return {
            content: [{ type: 'text', text: '❌ Encounter not found!' }]
          };
        }
        
        let output = `⚔️ ENCOUNTER STATUS\n\n`;
        output += `🏷️ ${encounter.name}\n`;
        output += `📜 ${encounter.description || 'No description'}\n`;
        output += `🌍 Location: ${encounter.environment || 'Unknown'}\n`;
        output += `📊 Status: ${encounter.status || 'Active'}\n`;
        output += `🕒 Round: ${encounter.current_round || 1}\n`;
        output += `👤 Current Turn: ${encounter.current_turn || 'Not started'}\n\n`;
        
        if (participants && participants.length > 0) {
          output += `🎯 PARTICIPANTS:\n`;
          const sorted = participants.sort((a: any, b: any) => b.initiative - a.initiative);
          sorted.forEach((p: any, index: number) => {
            const typeIcon = p.participant_type === 'character' ? '🎭' : '👹';
            const current = p.initiative_order === encounter.current_turn ? ' 👈 CURRENT TURN' : '';
            const participantType = (p.participant_type || 'unknown').toUpperCase();
            output += `${index + 1}. ${typeIcon} Initiative ${p.initiative} - ${participantType} ${p.participant_id}${current}\n`;
          });
        } else {
          output += `❓ No participants yet - add some with 'add_to_encounter'!`;
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'next_turn': {
        const currentParticipant = db.nextTurn((args as any).encounter_id) as any;
        const typeIcon = currentParticipant?.type === 'character' ? '🎭' : '👹';
        
        const output = `🎯 TURN ADVANCED!

${typeIcon} CURRENT TURN: ${currentParticipant?.type?.toUpperCase() || 'Unknown'} ${currentParticipant?.id || 'Unknown'}
🎲 Initiative: ${currentParticipant?.initiative || 'N/A'}

⚡ Ready for action! What will they do?`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'end_encounter': {
        db.endEncounter((args as any).encounter_id, (args as any).outcome);
        const outcomeIcon = (args as any).outcome === 'victory' ? '🏆' : (args as any).outcome === 'fled' ? '🏃‍♂️' : '💀';
        
        const output = `${outcomeIcon} ENCOUNTER ENDED!

📊 OUTCOME: ${((args as any).outcome || 'unknown').toUpperCase()}
🕒 DURATION: ${new Date().toLocaleString()}

${(args as any).outcome === 'victory' ? '🎉 Victory! Well fought!' :
  (args as any).outcome === 'fled' ? '💨 Tactical retreat - live to fight another day!' :
  '💀 Defeat... but heroes never truly die!'}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'apply_damage': {
        const result = db.applyDamage(
          (args as any).target_type,
          (args as any).target_id,
          (args as any).damage
        ) as any;
        
        // Get the target's name based on type
        let targetName = `${(args as any).target_type.toUpperCase()} ${(args as any).target_id}`;
        if ((args as any).target_type === 'character') {
          const character = db.getCharacter((args as any).target_id) as any;
          if (character) targetName = character.name;
        } else if ((args as any).target_type === 'npc') {
          const npc = db.getNPC((args as any).target_id) as any;
          if (npc) targetName = npc.name;
        }
        
        const typeIcon = (args as any).target_type === 'character' ? '🎭' : '👹';
        const damage = (args as any).damage;
        const hpStatus = result.current_hp <= 0 ? '💀 DEAD' : result.current_hp < result.max_hp / 2 ? '🩸 WOUNDED' : '💚 HEALTHY';
        
        const output = `💥 DAMAGE APPLIED!
        
        ${typeIcon} TARGET: ${targetName}
        ⚔️ DAMAGE: ${damage} points
        ❤️ HP: ${result.current_hp}/${result.max_hp || result.current_hp} ${hpStatus}
        
        ${result.current_hp <= 0 ? '💀 Target has fallen!' : result.current_hp < result.max_hp / 2 ? '🩸 Target is badly wounded!' : '💪 Target is still fighting strong!'}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_active_encounter': {
        const encounter = db.getActiveEncounter((args as any).character_id) as any;
        if (encounter) {
          const participants = db.getEncounterParticipants(encounter.id) as any[];
          
          let output = `⚔️ ACTIVE ENCOUNTER\n\n`;
          output += `🏷️ ${encounter.name}\n`;
          output += `📜 ${encounter.description || 'No description'}\n`;
          output += `🌍 Location: ${encounter.environment || 'Unknown'}\n`;
          output += `🕒 Round: ${encounter.current_round || 1}\n\n`;
          
          if (participants && participants.length > 0) {
            output += `🎯 INITIATIVE ORDER:\n`;
            const sorted = participants.sort((a: any, b: any) => b.initiative - a.initiative);
            sorted.forEach((p: any, index: number) => {
              const typeIcon = p.type === 'character' ? '🎭' : '👹';
              const current = p.id === encounter.current_turn ? ' 👈 CURRENT TURN' : '';
              output += `${index + 1}. ${typeIcon} Initiative ${p.initiative} - ${p.type.toUpperCase()} ${p.id}${current}\n`;
            });
          }
          
          return {
            content: [{ type: 'text', text: output }]
          };
        } else {
          return {
            content: [{ type: 'text', text: '🕊️ NO ACTIVE ENCOUNTER\n\nCharacter is currently out of combat. Use "create_encounter" to start a new battle!' }]
          };
        }
      }

      // Enhanced turn management
      case 'start_turn': {
        return {
          content: [{ type: 'text', text: '▶️ TURN STARTED!\n\n⚡ Ready for action! Choose your moves wisely.' }]
        };
      }

      case 'end_turn': {
        return {
          content: [{ type: 'text', text: '⏹️ TURN ENDED!\n\n🔄 Turn complete. Initiative moves to the next participant.' }]
        };
      }

      case 'consume_action': {
        const actionType = (args as any).action_type;
        const actionIcons: any = {
          action: '⚔️',
          bonus_action: '✨',
          movement: '🏃'
        };
        
        const output = `${actionIcons[actionType] || '⚡'} ${actionType.toUpperCase().replace('_', ' ')} CONSUMED!\n\n🎯 Action used this turn.`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      // Story progress management
      case 'save_story_progress': {
        const { character_id, chapter, checkpoint, summary } = args as any;
        db.saveStoryProgress(character_id, {
          chapter,
          scene: checkpoint,
          description: summary
        });
        
        const output = `📖 STORY PROGRESS SAVED!

📚 Chapter: ${chapter}
🔖 Checkpoint: ${checkpoint}
📝 Summary: ${summary}
💾 Saved: ${new Date().toLocaleString()}

✅ Your adventure continues!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      // Quest management
      case 'add_quest': {
        const quest = db.addQuest(args as any) as any;
        
        let output = `🎯 NEW QUEST ADDED!\n\n`;
        output += `📜 ${quest.title}\n`;
        output += `📋 ${quest.description}\n\n`;
        
        output += `🎯 OBJECTIVES:\n`;
        if (quest.objectives && Array.isArray(quest.objectives)) {
          quest.objectives.forEach((obj: string, index: number) => {
            output += `${index + 1}. ☐ ${obj}\n`;
          });
        }
        
        output += `\n🏆 REWARDS:\n`;
        if (quest.rewards) {
          if (quest.rewards.gold) output += `💰 Gold: ${quest.rewards.gold}\n`;
          if (quest.rewards.experience) output += `⭐ Experience: ${quest.rewards.experience}\n`;
          if (quest.rewards.items && quest.rewards.items.length > 0) {
            output += `🎁 Items: ${quest.rewards.items.join(', ')}\n`;
          }
        }
        
        output += `\n🆔 Quest ID: ${quest.id}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_active_quests': {
        const quests = db.getCharacterActiveQuests((args as any).character_id) as any[];
        
        if (!quests || quests.length === 0) {
          return {
            content: [{ type: 'text', text: '📜 NO ACTIVE QUESTS\n\nThis character has no active quests. Time to find some adventure! 🗺️✨' }]
          };
        }
        
        let output = '📜 ACTIVE QUESTS\n\n';
        
        quests.forEach((quest: any, index: number) => {
          const statusIcon = quest.status === 'completed' ? '✅' : quest.status === 'failed' ? '❌' : '🔄';
          output += `${index + 1}. ${statusIcon} ${quest.title}\n`;
          output += `    📋 ${quest.description}\n`;
          output += `    📊 Status: ${quest.status}\n`;
          if (quest.progress) {
            output += `    📈 Progress: ${JSON.stringify(quest.progress)}\n`;
          }
          output += `\n`;
        });
        
        output += `📊 SUMMARY: ${quests.length} active quest${quests.length > 1 ? 's' : ''}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'update_quest_state': {
        const quest = db.updateCharacterQuestStatus(
          (args as any).character_quest_id,
          (args as any).status,
          (args as any).progress
        ) as any;
        
        const statusIcon = (args as any).status === 'completed' ? '🎉' : (args as any).status === 'failed' ? '💔' : '🔄';
        const statusText = (args as any).status === 'completed' ? 'COMPLETED!' :
                          (args as any).status === 'failed' ? 'FAILED!' : 'UPDATED!';
        
        let output = `${statusIcon} QUEST ${statusText}\n\n`;
        output += `📜 Quest Status Changed\n`;
        output += `📊 New Status: ${(args as any).status.toUpperCase()}\n`;
        
        if ((args as any).progress) {
          output += `📈 Progress Updated: ${JSON.stringify((args as any).progress)}\n`;
        }
        
        if ((args as any).status === 'completed') {
          output += `\n🎉 Congratulations! Quest completed successfully!`;
        } else if ((args as any).status === 'failed') {
          output += `\n💔 Quest failed... but every failure is a learning experience!`;
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'assign_quest_to_character': {
        const assignment = db.assignQuestToCharacter(
          (args as any).character_id,
          (args as any).quest_id,
          (args as any).status || 'active'
        ) as any;
        
        const output = `🎯 QUEST ASSIGNED!

📜 Quest has been assigned to character
👤 Character ID: ${(args as any).character_id}
🎯 Quest ID: ${(args as any).quest_id}
📊 Initial Status: ${(args as any).status || 'active'}
🆔 Assignment ID: ${assignment.id}

✅ Ready to begin the quest!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      // Spell Management
      case 'add_spell': {
        const { character_id, spell_name, spell_level, is_prepared, is_known, source, description } = args as any;
        
        // Get character name for display
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        const spell = db.addSpell(character_id, {
          spell_name,
          spell_level,
          is_prepared,
          is_known,
          source,
          description
        });
        
        const levelText = spell_level === 0 ? 'Cantrip' : `Level ${spell_level}`;
        const preparedText = is_prepared !== false ? '✨ PREPARED' : '📖 KNOWN';
        const sourceText = source ? ` (${source})` : '';
        
        const output = `🔮 SPELL ADDED TO SPELLBOOK!

👤 ${characterName.toUpperCase()}'S SPELLBOOK
📜 ${spell_name} - ${levelText}${sourceText}
📊 Status: ${preparedText}
🆔 Spell ID: ${spell.id}

${description ? `📝 ${description}\n` : ''}✅ ${spell_name} has been added to ${characterName}'s magical repertoire!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'remove_spell': {
        const { spell_id } = args as any;
        
        // Get spell details before removing
        const spell = db.getSpell(spell_id);
        let spellName = 'Unknown Spell';
        let characterName = 'Unknown Character';
        
        if (spell) {
          spellName = spell.spell_name;
          const character = db.getCharacter(spell.character_id) as any;
          if (character) characterName = character.name;
        }
        
        db.removeSpell(spell_id);
        
        const output = `🗑️ SPELL REMOVED FROM SPELLBOOK!

📜 ${spellName} has been removed from ${characterName}'s spellbook.
✅ Spell successfully forgotten!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_character_spells': {
        const { character_id, spell_level, is_prepared, is_known, source } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        const spells = db.getCharacterSpells(character_id, {
          spell_level,
          is_prepared,
          is_known,
          source
        });
        
        if (!spells || spells.length === 0) {
          return {
            content: [{ type: 'text', text: `📚 NO SPELLS FOUND\n\n${characterName} has no spells matching the criteria. Time to learn some magic! ✨🔮` }]
          };
        }
        
        let output = `🔮 ${characterName.toUpperCase()}'S SPELLBOOK\n\n`;
        
        // Group spells by level
        const spellsByLevel: Record<number, any[]> = {};
        spells.forEach(spell => {
          if (!spellsByLevel[spell.spell_level]) {
            spellsByLevel[spell.spell_level] = [];
          }
          spellsByLevel[spell.spell_level].push(spell);
        });
        
        // Display spells by level
        Object.keys(spellsByLevel).sort((a, b) => Number(a) - Number(b)).forEach(level => {
          const levelNum = Number(level);
          const levelText = levelNum === 0 ? '✨ CANTRIPS' : `📜 LEVEL ${levelNum} SPELLS`;
          output += `${levelText}:\n`;
          
          spellsByLevel[levelNum].forEach((spell: any, index: number) => {
            const statusIcon = spell.is_prepared ? '✨' : '📖';
            const sourceText = spell.source && spell.source !== 'class' ? ` (${spell.source})` : '';
            output += `  ${index + 1}. ${statusIcon} ${spell.spell_name}${sourceText}\n`;
            if (spell.description) {
              output += `      📝 ${spell.description}\n`;
            }
          });
          output += '\n';
        });
        
        const preparedCount = spells.filter(s => s.is_prepared).length;
        const cantripsCount = spells.filter(s => s.spell_level === 0).length;
        const spellsCount = spells.filter(s => s.spell_level > 0).length;
        
        output += `📊 SUMMARY:\n`;
        output += `✨ Prepared: ${preparedCount} | 🔮 Cantrips: ${cantripsCount} | 📜 Spells: ${spellsCount}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'update_spell_status': {
        const { spell_id, is_prepared, is_known } = args as any;
        
        const spell = db.getSpell(spell_id);
        if (!spell) {
          return {
            content: [{ type: 'text', text: '❌ Spell not found!' }]
          };
        }
        
        db.updateSpellStatus(spell_id, { is_prepared, is_known });
        
        let output = `🔄 SPELL STATUS UPDATED!\n\n`;
        output += `📜 ${spell.spell_name}\n`;
        
        if (is_prepared !== undefined) {
          if (is_prepared) {
            output += `✨ Spell has been prepared and is ready to cast!\n`;
          } else {
            output += `📖 Spell is known but not currently prepared.\n`;
          }
        }
        
        if (is_known !== undefined) {
          if (is_known) {
            output += `🧠 Spell is now known by the character.\n`;
          } else {
            output += `❌ Spell has been forgotten.\n`;
          }
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_spell_slots': {
        const { character_id } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        const spellSlots = db.getSpellSlots(character_id);
        
        if (!spellSlots || spellSlots.length === 0) {
          return {
            content: [{ type: 'text', text: `🔮 NO SPELL SLOTS\n\n${characterName} has no spell slots. They may not be a spellcaster, or spellcasting hasn't been initialized yet.\n\n💡 Use 'initialize_spellcasting' to set up spell slots!` }]
          };
        }
        
        let output = `🔮 ${characterName.toUpperCase()}'S SPELL SLOTS\n\n`;
        
        // Add spellcasting info if available
        if (character?.spellcasting_ability) {
          output += `🧙 Spellcasting Ability: ${character.spellcasting_ability}\n`;
          output += `🎯 Spell Save DC: ${character.spell_save_dc || 'Unknown'}\n`;
          output += `⚔️ Spell Attack Bonus: ${character.spell_attack_bonus ? `+${character.spell_attack_bonus}` : 'Unknown'}\n\n`;
        }
        
        output += `📊 SPELL SLOT STATUS:\n`;
        spellSlots.forEach((slot: any) => {
          const available = slot.total_slots - slot.used_slots;
          const progressBar = '●'.repeat(available) + '○'.repeat(slot.used_slots);
          output += `Level ${slot.spell_level}: ${available}/${slot.total_slots} ${progressBar}\n`;
        });
        
        const totalUsed = spellSlots.reduce((sum: number, slot: any) => sum + slot.used_slots, 0);
        const totalSlots = spellSlots.reduce((sum: number, slot: any) => sum + slot.total_slots, 0);
        output += `\n🔋 Total: ${totalSlots - totalUsed}/${totalSlots} spell slots available`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'use_spell_slot': {
        const { character_id, spell_level } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        const success = db.useSpellSlot(character_id, spell_level);
        
        if (success) {
          const spellSlots = db.getSpellSlots(character_id);
          const slot = spellSlots.find((s: any) => s.spell_level === spell_level) as any;
          const remaining = slot ? slot.total_slots - slot.used_slots : 0;
          
          const output = `✨ SPELL SLOT USED!

👤 ${characterName}
🔮 Level ${spell_level} spell slot consumed
📊 Remaining: ${remaining}/${slot?.total_slots || 0}

⚡ Magic flows through ${characterName}!`;
          
          return {
            content: [{ type: 'text', text: output }]
          };
        } else {
          return {
            content: [{ type: 'text', text: `❌ NO SPELL SLOTS AVAILABLE\n\n${characterName} has no level ${spell_level} spell slots available!\n\n💡 Try a long rest to recover spell slots.` }]
          };
        }
      }

      case 'recover_spell_slot': {
        const { character_id, spell_level } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        const success = db.recoverSpellSlot(character_id, spell_level);
        
        if (success) {
          const spellSlots = db.getSpellSlots(character_id);
          const slot = spellSlots.find((s: any) => s.spell_level === spell_level) as any;
          const available = slot ? slot.total_slots - slot.used_slots : 0;
          
          const output = `🔋 SPELL SLOT RECOVERED!

👤 ${characterName}
🔮 Level ${spell_level} spell slot restored
📊 Available: ${available}/${slot?.total_slots || 0}

✨ Magical energy returns to ${characterName}!`;
          
          return {
            content: [{ type: 'text', text: output }]
          };
        } else {
          return {
            content: [{ type: 'text', text: `❌ RECOVERY FAILED\n\n${characterName} has no used level ${spell_level} spell slots to recover!` }]
          };
        }
      }

      case 'reset_spell_slots': {
        const { character_id, spell_level } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        db.resetSpellSlots(character_id, spell_level);
        
        let output = `🌅 SPELL SLOTS RESET!\n\n`;
        output += `👤 ${characterName}\n`;
        
        if (spell_level !== undefined) {
          output += `🔮 All level ${spell_level} spell slots have been restored!\n`;
        } else {
          output += `🔮 ALL spell slots have been fully restored!\n`;
        }
        
        output += `✨ ${characterName} feels refreshed and ready to cast spells again!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'initialize_spellcasting': {
        const { character_id, character_class, level, spellcasting_ability } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        db.initializeSpellcasting(character_id, character_class, level, spellcasting_ability);
        
        // Get the updated character info
        const updatedCharacter = db.getCharacter(character_id) as any;
        const spellSlots = db.getSpellSlots(character_id);
        
        let output = `🔮 SPELLCASTING INITIALIZED!\n\n`;
        output += `👤 ${characterName} - Level ${level} ${character_class}\n`;
        
        if (updatedCharacter?.spellcasting_ability) {
          output += `🧙 Spellcasting Ability: ${updatedCharacter.spellcasting_ability}\n`;
          output += `🎯 Spell Save DC: ${updatedCharacter.spell_save_dc}\n`;
          output += `⚔️ Spell Attack Bonus: +${updatedCharacter.spell_attack_bonus}\n\n`;
        }
        
        if (spellSlots && spellSlots.length > 0) {
          output += `📊 SPELL SLOTS GRANTED:\n`;
          spellSlots.forEach((slot: any) => {
            output += `Level ${slot.spell_level}: ${slot.total_slots} slots\n`;
          });
        } else {
          output += `📊 No spell slots (${character_class} may not be a spellcasting class at level ${level})\n`;
        }
        
        output += `\n✨ ${characterName} is now ready to weave magic!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'cast_spell': {
        const { character_id, spell_name, cast_at_level } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        // Find the spell
        const spells = db.getCharacterSpells(character_id, { is_prepared: true });
        const spell = spells.find((s: any) => s.spell_name.toLowerCase() === spell_name.toLowerCase());
        
        if (!spell) {
          return {
            content: [{ type: 'text', text: `❌ SPELL NOT FOUND\n\n${characterName} doesn't have the spell "${spell_name}" prepared!\n\n💡 Make sure the spell is added to the spellbook and prepared.` }]
          };
        }
        
        // Determine the level to cast at
        const castLevel = cast_at_level || spell.spell_level;
        
        // Cantrips don't use spell slots
        if (spell.spell_level === 0) {
          const output = `✨ CANTRIP CAST!

👤 ${characterName}
🔮 ${spell.spell_name}
📊 Level: Cantrip (no spell slot required)

${spell.description ? `📝 ${spell.description}\n` : ''}⚡ Magic sparks from ${characterName}'s fingertips!`;
          
          return {
            content: [{ type: 'text', text: output }]
          };
        }
        
        // Check if we can cast at the requested level
        if (castLevel < spell.spell_level) {
          return {
            content: [{ type: 'text', text: `❌ INVALID CAST LEVEL\n\n${spell.spell_name} is a level ${spell.spell_level} spell and cannot be cast at level ${castLevel}!` }]
          };
        }
        
        // Try to use a spell slot
        const success = db.useSpellSlot(character_id, castLevel);
        
        if (success) {
          const spellSlots = db.getSpellSlots(character_id);
          const slot = spellSlots.find((s: any) => s.spell_level === castLevel) as any;
          const remaining = slot ? slot.total_slots - slot.used_slots : 0;
          
          const upcastText = castLevel > spell.spell_level ? ` (upcast from level ${spell.spell_level})` : '';
          
          const output = `🌟 SPELL CAST!

👤 ${characterName}
🔮 ${spell.spell_name}
📊 Cast at level: ${castLevel}${upcastText}
🔋 Spell slots remaining: ${remaining}/${slot?.total_slots || 0}

${spell.description ? `📝 ${spell.description}\n` : ''}⚡ ${characterName} weaves powerful magic into reality!`;
          
          return {
            content: [{ type: 'text', text: output }]
          };
        } else {
          return {
            content: [{ type: 'text', text: `❌ NO SPELL SLOTS\n\n${characterName} has no level ${castLevel} spell slots available to cast ${spell.spell_name}!\n\n💡 Try casting at a different level or take a long rest.` }]
          };
        }
      }

      // Batch operations
      case 'batch_create_npcs': {
        const { npcs } = args as any;
        const createdNpcs = [];
        
        for (const npcData of npcs) {
          const npc = db.createNPC(npcData) as any;
          createdNpcs.push(npc);
        }
        
        let output = `👥 BATCH NPC CREATION COMPLETE!\n\n`;
        output += `📊 Created ${createdNpcs.length} NPCs:\n\n`;
        
        createdNpcs.forEach((npc: any, index: number) => {
          const typeIcon = npc.type === 'enemy' ? '👹' : npc.type === 'ally' ? '🤝' : '🧑';
          output += `${index + 1}. ${typeIcon} ${npc.name} (${npc.template || 'Custom'}) - ID: ${npc.id}\n`;
        });
        
        output += `\n✅ All NPCs successfully created and ready for encounters!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'batch_update_npcs': {
        const { updates } = args as any;
        const updatedNpcs = [];
        
        for (const update of updates) {
          try {
            const npc = db.updateNPC(update.npc_id, update.updates) as any;
            updatedNpcs.push({ success: true, npc, npc_id: update.npc_id });
          } catch (error: any) {
            updatedNpcs.push({ success: false, error: error.message, npc_id: update.npc_id });
          }
        }
        
        let output = `🔄 BATCH NPC UPDATE COMPLETE!\n\n`;
        const successful = updatedNpcs.filter(u => u.success);
        const failed = updatedNpcs.filter(u => !u.success);
        
        output += `📊 Results: ${successful.length} successful, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          output += `✅ SUCCESSFUL UPDATES:\n`;
          successful.forEach((update: any, index: number) => {
            const typeIcon = update.npc.type === 'enemy' ? '👹' : update.npc.type === 'ally' ? '🤝' : '🧑';
            output += `${index + 1}. ${typeIcon} ${update.npc.name} (ID: ${update.npc_id})\n`;
          });
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED UPDATES:\n`;
          failed.forEach((update: any, index: number) => {
            output += `${index + 1}. NPC ID: ${update.npc_id} - Error: ${update.error}\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'batch_apply_damage': {
        const { targets } = args as any;
        const results = [];
        
        for (const target of targets) {
          try {
            const result = db.applyDamage(target.target_type, target.target_id, target.damage) as any;
            
            // Get target name
            let targetName = `${target.target_type.toUpperCase()} ${target.target_id}`;
            if (target.target_type === 'character') {
              const character = db.getCharacter(target.target_id) as any;
              if (character) targetName = character.name;
            } else if (target.target_type === 'npc') {
              const npc = db.getNPC(target.target_id) as any;
              if (npc) targetName = npc.name;
            }
            
            results.push({
              success: true,
              targetName,
              damage: target.damage,
              current_hp: result.current_hp,
              max_hp: result.max_hp,
              target_type: target.target_type,
              target_id: target.target_id
            });
          } catch (error: any) {
            results.push({
              success: false,
              error: error.message,
              target_type: target.target_type,
              target_id: target.target_id,
              damage: target.damage
            });
          }
        }
        
        let output = `💥 BATCH DAMAGE APPLICATION COMPLETE!\n\n`;
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        output += `📊 Results: ${successful.length} successful, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          output += `✅ DAMAGE APPLIED:\n`;
          successful.forEach((result: any, index: number) => {
            const typeIcon = result.target_type === 'character' ? '🎭' : '👹';
            const hpStatus = result.current_hp <= 0 ? '💀' : result.current_hp < result.max_hp / 2 ? '🩸' : '💚';
            output += `${index + 1}. ${typeIcon} ${result.targetName}: -${result.damage}HP → ${result.current_hp}/${result.max_hp} ${hpStatus}\n`;
          });
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED:\n`;
          failed.forEach((result: any, index: number) => {
            output += `${index + 1}. ${result.target_type.toUpperCase()} ${result.target_id}: ${result.error}\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'batch_remove_npcs': {
        const { npc_ids } = args as any;
        const results = [];
        
        for (const npc_id of npc_ids) {
          try {
            // Get NPC name before removing
            const npc = db.getNPC(npc_id) as any;
            const npcName = npc ? npc.name : `NPC ${npc_id}`;
            
            db.removeNPC(npc_id);
            results.push({ success: true, npc_id, name: npcName });
          } catch (error: any) {
            results.push({ success: false, npc_id, error: error.message });
          }
        }
        
        let output = `🗑️ BATCH NPC REMOVAL COMPLETE!\n\n`;
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        output += `📊 Results: ${successful.length} removed, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          output += `✅ REMOVED:\n`;
          successful.forEach((result: any, index: number) => {
            output += `${index + 1}. 👹 ${result.name} (ID: ${result.npc_id})\n`;
          });
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED:\n`;
          failed.forEach((result: any, index: number) => {
            output += `${index + 1}. NPC ID: ${result.npc_id} - Error: ${result.error}\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'batch_add_to_encounter': {
        const { encounter_id, participants } = args as any;
        const results = [];
        
        for (const participant of participants) {
          try {
            const participantId = db.addEncounterParticipant(
              encounter_id,
              participant.type,
              participant.id,
              participant.initiative
            );
            
            // Get participant name for display
            let name = participant.name;
            if (!name) {
              if (participant.type === 'character') {
                const character = db.getCharacter(participant.id) as any;
                name = character ? character.name : `Character ${participant.id}`;
              } else if (participant.type === 'npc') {
                const npc = db.getNPC(participant.id) as any;
                name = npc ? npc.name : `NPC ${participant.id}`;
              } else {
                name = `${participant.type} ${participant.id}`;
              }
            }
            
            results.push({
              success: true,
              participantId,
              name,
              type: participant.type,
              id: participant.id,
              initiative: participant.initiative
            });
          } catch (error: any) {
            results.push({
              success: false,
              error: error.message,
              type: participant.type,
              id: participant.id,
              initiative: participant.initiative
            });
          }
        }
        
        let output = `🎲 BATCH PARTICIPANTS ADDED TO ENCOUNTER!\n\n`;
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        output += `📊 Results: ${successful.length} added, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          output += `✅ PARTICIPANTS ADDED:\n`;
          successful.forEach((p: any, index: number) => {
            const typeIcon = p.type === 'character' ? '🎭' : p.type === 'npc' ? '👹' : '🧑';
            output += `${index + 1}. ${typeIcon} ${p.name} (${p.type.toUpperCase()}) - Initiative: ${p.initiative}\n`;
          });
          
          // Sort by initiative to show turn order
          const sorted = [...successful].sort((a, b) => b.initiative - a.initiative);
          output += `\n🎯 INITIATIVE ORDER:\n`;
          sorted.forEach((p: any, index: number) => {
            const typeIcon = p.type === 'character' ? '🎭' : '👹';
            output += `${index + 1}. ${typeIcon} Initiative ${p.initiative} - ${p.name}\n`;
          });
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED TO ADD:\n`;
          failed.forEach((p: any, index: number) => {
            output += `${index + 1}. ${p.type.toUpperCase()} ${p.id} (Initiative ${p.initiative}): ${p.error}\n`;
          });
        }
        
        if (successful.length > 0) {
          output += `\n⚔️ Encounter is ready! Combat can begin!`;
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      // Stronghold Management
      case 'create_stronghold': {
        const { character_id, name, location, stronghold_type, level, defense_bonus, prosperity_level, description, special_features } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        const stronghold = db.createStronghold(character_id, {
          name,
          location,
          stronghold_type,
          level,
          defense_bonus,
          prosperity_level,
          description,
          special_features
        }) as any;
        
        const output = `🏰 NEW STRONGHOLD ESTABLISHED!

🏛️ ${stronghold.name}
👤 Owner: ${characterName}
📍 Location: ${stronghold.location}
🏰 Type: ${stronghold.stronghold_type || 'Keep'}
📊 Level: ${stronghold.level || 1}
🛡️ Defense Bonus: +${stronghold.defense_bonus || 0}
💰 Prosperity: Level ${stronghold.prosperity_level || 1}
🆔 Stronghold ID: ${stronghold.id}

${stronghold.description ? `📜 ${stronghold.description}\n` : ''}✅ ${characterName}'s stronghold is ready for development!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_stronghold_status': {
        const { stronghold_id } = args as any;
        
        const stronghold = db.getStronghold(stronghold_id) as any;
        if (!stronghold) {
          return {
            content: [{ type: 'text', text: '❌ Stronghold not found!' }]
          };
        }
        
        const facilities = db.getStrongholdFacilities(stronghold_id);
        const businesses = db.getStrongholdBusinesses(stronghold_id);
        const events = db.getStrongholdEvents(stronghold_id, 'pending');
        
        let output = `🏰 STRONGHOLD STATUS\n\n`;
        output += `🏛️ ${stronghold.name}\n`;
        output += `📍 Location: ${stronghold.location}\n`;
        output += `🏰 Type: ${stronghold.stronghold_type || 'Keep'}\n`;
        output += `📊 Level: ${stronghold.level || 1}\n`;
        output += `🛡️ Defense Bonus: +${stronghold.defense_bonus || 0}\n`;
        output += `💰 Prosperity: Level ${stronghold.prosperity_level || 1}\n`;
        output += `💸 Weekly Upkeep: ${stronghold.weekly_upkeep_cost || 0} gp\n\n`;
        
        if (facilities && facilities.length > 0) {
          output += `🏗️ FACILITIES (${facilities.length}):\n`;
          facilities.forEach((facility: any, index: number) => {
            const statusIcon = facility.status === 'active' ? '✅' : facility.status === 'under_construction' ? '🚧' : '❌';
            output += `${index + 1}. ${statusIcon} ${facility.name} (${facility.facility_type})\n`;
            output += `    📊 Level ${facility.level} | 💸 Upkeep: ${facility.upkeep_cost} gp/week\n`;
          });
          output += '\n';
        }
        
        if (businesses && businesses.length > 0) {
          output += `💼 BUSINESSES (${businesses.length}):\n`;
          businesses.forEach((business: any, index: number) => {
            output += `${index + 1}. 💰 ${business.name} (${business.business_type})\n`;
            output += `    📈 Weekly Income: ${business.weekly_income} gp | 📊 Risk: ${business.risk_level}\n`;
          });
          output += '\n';
        }
        
        if (events && events.length > 0) {
          output += `⚠️ PENDING EVENTS (${events.length}):\n`;
          events.forEach((event: any, index: number) => {
            output += `${index + 1}. 📜 ${event.title}\n`;
            output += `    📝 ${event.description}\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_character_strongholds': {
        const { character_id } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        const strongholds = db.getCharacterStrongholds(character_id);
        
        if (!strongholds || strongholds.length === 0) {
          return {
            content: [{ type: 'text', text: `🏰 NO STRONGHOLDS\n\n${characterName} doesn't own any strongholds yet.\n\n💡 Use 'create_stronghold' to establish their first stronghold!` }]
          };
        }
        
        let output = `🏰 ${characterName.toUpperCase()}'S STRONGHOLDS\n\n`;
        
        strongholds.forEach((stronghold: any, index: number) => {
          output += `${index + 1}. 🏛️ ${stronghold.name}\n`;
          output += `    📍 ${stronghold.location} | 🏰 ${stronghold.stronghold_type || 'Keep'}\n`;
          output += `    📊 Level ${stronghold.level || 1} | 🛡️ Defense +${stronghold.defense_bonus || 0}\n`;
          output += `    💰 Prosperity ${stronghold.prosperity_level || 1} | 🆔 ID: ${stronghold.id}\n\n`;
        });
        
        output += `📊 Total Strongholds: ${strongholds.length}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'update_stronghold': {
        const { stronghold_id, updates } = args as any;
        
        const stronghold = db.updateStronghold(stronghold_id, updates) as any;
        
        const output = `✅ STRONGHOLD UPDATED!

🏛️ ${stronghold.name}
📍 Location: ${stronghold.location}
🏰 Type: ${stronghold.stronghold_type || 'Keep'}
📊 Level: ${stronghold.level || 1}
🛡️ Defense Bonus: +${stronghold.defense_bonus || 0}
💰 Prosperity: Level ${stronghold.prosperity_level || 1}

🔄 Stronghold has been successfully updated!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      // Facility Management
      case 'add_facility': {
        const { stronghold_id, facility_type, name, level, construction_cost, upkeep_cost, build_time_weeks, status, benefits, description } = args as any;
        
        const stronghold = db.getStronghold(stronghold_id) as any;
        if (!stronghold) {
          return {
            content: [{ type: 'text', text: '❌ Stronghold not found!' }]
          };
        }
        
        const facility = db.addFacility(stronghold_id, {
          facility_type,
          name,
          level,
          construction_cost,
          upkeep_cost,
          build_time_weeks,
          status,
          benefits,
          description
        }) as any;
        
        const facilityTemplate = db.getFacilityType(facility_type);
        
        const output = `🏗️ NEW FACILITY ADDED!

🏛️ Stronghold: ${stronghold.name}
🏗️ ${facility.name} (${facility.facility_type})
📊 Level: ${facility.level || 1}
💰 Construction Cost: ${facility.construction_cost || 0} gp
💸 Weekly Upkeep: ${facility.upkeep_cost || 0} gp
⏱️ Build Time: ${facility.build_time_weeks || 1} weeks
📊 Status: ${facility.status || 'active'}
🆔 Facility ID: ${facility.id}

${facilityTemplate?.description ? `📜 ${facilityTemplate.description}\n` : ''}✅ Construction can begin immediately!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'upgrade_facility': {
        const { facility_id, new_level, upgrade_cost } = args as any;
        
        const facility = db.upgradeFacility(facility_id, new_level, upgrade_cost) as any;
        
        const output = `⬆️ FACILITY UPGRADED!
        
🏗️ ${facility.name} (${facility.facility_type})
📊 New Level: ${facility.level}
💰 Total Investment: ${facility.construction_cost} gp
💸 Weekly Upkeep: ${facility.upkeep_cost} gp

✅ Facility has been successfully upgraded!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_stronghold_facilities': {
        const { stronghold_id } = args as any;
        
        const stronghold = db.getStronghold(stronghold_id) as any;
        if (!stronghold) {
          return {
            content: [{ type: 'text', text: '❌ Stronghold not found!' }]
          };
        }
        
        const facilities = db.getStrongholdFacilities(stronghold_id);
        
        if (!facilities || facilities.length === 0) {
          return {
            content: [{ type: 'text', text: `🏗️ NO FACILITIES\n\n${stronghold.name} has no facilities yet.\n\n💡 Use 'add_facility' to build your first facility!` }]
          };
        }
        
        let output = `🏗️ ${stronghold.name.toUpperCase()} FACILITIES\n\n`;
        let totalUpkeep = 0;
        
        facilities.forEach((facility: any, index: number) => {
          const statusIcon = facility.status === 'active' ? '✅' :
                            facility.status === 'under_construction' ? '🚧' :
                            facility.status === 'damaged' ? '⚠️' : '❌';
          
          output += `${index + 1}. ${statusIcon} ${facility.name}\n`;
          output += `    🏗️ Type: ${facility.facility_type} | 📊 Level: ${facility.level}\n`;
          output += `    💸 Upkeep: ${facility.upkeep_cost} gp/week | 📊 Status: ${facility.status}\n`;
          if (facility.description) {
            output += `    📝 ${facility.description}\n`;
          }
          output += `\n`;
          
          if (facility.status === 'active') {
            totalUpkeep += facility.upkeep_cost || 0;
          }
        });
        
        output += `💰 SUMMARY:\n`;
        output += `🏗️ Total Facilities: ${facilities.length}\n`;
        output += `✅ Active: ${facilities.filter((f: any) => f.status === 'active').length}\n`;
        output += `💸 Weekly Upkeep: ${totalUpkeep} gp`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'list_facility_types': {
        const { category } = args as any;
        
        const facilityTypes = db.listFacilityTypes(category);
        
        if (!facilityTypes || facilityTypes.length === 0) {
          return {
            content: [{ type: 'text', text: `🏗️ NO FACILITY TYPES FOUND\n\n${category ? `No facilities in category "${category}"` : 'No facility types available'}.` }]
          };
        }
        
        let output = `🏗️ AVAILABLE FACILITY TYPES\n\n`;
        
        if (category) {
          output = `🏗️ ${category.toUpperCase()} FACILITIES\n\n`;
        }
        
        // Group by category if showing all
        const byCategory: Record<string, any[]> = {};
        facilityTypes.forEach((type: any) => {
          if (!byCategory[type.category]) {
            byCategory[type.category] = [];
          }
          byCategory[type.category].push(type);
        });
        
        Object.keys(byCategory).forEach(cat => {
          if (!category) {
            output += `📁 ${cat.toUpperCase()}:\n`;
          }
          
          byCategory[cat].forEach((type: any, index: number) => {
            const prefix = category ? `${index + 1}.` : `  •`;
            output += `${prefix} 🏗️ ${type.type_name}\n`;
            output += `    💰 Cost: ${type.base_cost} gp | 💸 Upkeep: ${type.base_upkeep} gp/week\n`;
            output += `    ⏱️ Build Time: ${type.build_time_weeks} weeks\n`;
            if (type.description) {
              output += `    📝 ${type.description}\n`;
            }
            output += `\n`;
          });
          
          if (!category) output += `\n`;
        });
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'recruit_hireling': {
        const { character_id, name, hireling_type, profession, tier, daily_wage_sp, skill_bonus, abilities, notes } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        const hireling = db.recruitHireling(character_id, {
          name,
          hireling_type,
          profession,
          tier,
          daily_wage_sp,
          skill_bonus,
          abilities,
          notes
        }) as any;
        
        const tierText = tier || 'laborers';
        const wageText = daily_wage_sp || 2;
        
        const output = `👥 NEW HIRELING RECRUITED!
        
👤 ${characterName.toUpperCase()}'S STAFF
🧑 ${hireling.name} - ${hireling.profession}
📊 Tier: ${tierText} | 💰 Daily Wage: ${wageText} sp
📈 Skill Bonus: +${hireling.skill_bonus || 0}
💖 Loyalty: ${hireling.loyalty_score}/100
🆔 Hireling ID: ${hireling.id}

${hireling.notes ? `📝 Notes: ${hireling.notes}\n` : ''}✅ ${hireling.name} is ready to serve!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'assign_hireling': {
        const { hireling_id, task, facility_id } = args as any;
        
        let hireling;
        if (facility_id) {
          db.assignHirelingToFacility(facility_id, hireling_id);
          hireling = db.getHireling(hireling_id) as any;
        } else {
          hireling = db.assignHireling(hireling_id, task) as any;
        }
        
        const output = `📋 HIRELING ASSIGNED!
        
🧑 ${hireling.name} - ${hireling.profession}
📝 New Task: ${task}
📊 Status: ${hireling.status}
${facility_id ? `🏗️ Assigned to Facility ID: ${facility_id}\n` : ''}
✅ Assignment completed successfully!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'manage_hireling_loyalty': {
        const { hireling_id, loyalty_change, reason } = args as any;
        
        const hireling = db.manageLoyalty(hireling_id, loyalty_change, reason) as any;
        
        const changeIcon = loyalty_change > 0 ? '📈' : loyalty_change < 0 ? '📉' : '➡️';
        const changeText = loyalty_change > 0 ? `+${loyalty_change}` : `${loyalty_change}`;
        
        const output = `💖 LOYALTY UPDATED!
        
🧑 ${hireling.name} - ${hireling.profession}
${changeIcon} Loyalty Change: ${changeText}
💖 New Loyalty: ${hireling.loyalty_score}/100
${reason ? `📝 Reason: ${reason}\n` : ''}
${hireling.loyalty_score >= 80 ? '😊 Hireling is very loyal!' :
  hireling.loyalty_score >= 50 ? '😐 Hireling is reasonably loyal.' :
  hireling.loyalty_score >= 20 ? '😟 Hireling loyalty is concerning.' :
  '😡 Hireling may leave or cause trouble!'}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'calculate_hireling_costs': {
        const { character_id } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        const weeklyWages = db.calculateWeeklyWages(character_id);
        const hirelings = db.getCharacterHirelings(character_id, 'active');
        const busyHirelings = db.getCharacterHirelings(character_id, 'busy');
        
        const activeCount = (hirelings?.length || 0) + (busyHirelings?.length || 0);
        
        const output = `💰 WEEKLY WAGE CALCULATION
        
👤 ${characterName.toUpperCase()}'S PAYROLL
👥 Active Staff: ${activeCount} hirelings
💸 Weekly Wages: ${weeklyWages} sp (${Math.floor(weeklyWages / 10)} gp, ${weeklyWages % 10} sp)
📅 Calculation Date: ${new Date().toLocaleDateString()}

💡 This amount will be deducted from your treasury each week.`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'list_character_hirelings': {
        const { character_id, status } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        const hirelings = db.getCharacterHirelings(character_id, status);
        
        if (!hirelings || hirelings.length === 0) {
          const statusText = status ? ` with status "${status}"` : '';
          return {
            content: [{ type: 'text', text: `👥 NO HIRELINGS FOUND\n\n${characterName} has no hirelings${statusText}.\n\n💡 Use 'recruit_hireling' to build your staff!` }]
          };
        }
        
        let output = `👥 ${characterName.toUpperCase()}'S STAFF\n\n`;
        
        if (status) {
          output = `👥 ${characterName.toUpperCase()}'S ${status.toUpperCase()} STAFF\n\n`;
        }
        
        let totalWages = 0;
        
        hirelings.forEach((hireling: any, index: number) => {
          const statusIcon = hireling.status === 'active' ? '✅' :
                            hireling.status === 'busy' ? '🔄' :
                            hireling.status === 'injured' ? '🤕' :
                            hireling.status === 'away' ? '🚶' : '❌';
          
          const loyaltyIcon = hireling.loyalty_score >= 80 ? '😊' :
                             hireling.loyalty_score >= 50 ? '😐' :
                             hireling.loyalty_score >= 20 ? '😟' : '😡';
          
          output += `${index + 1}. ${statusIcon} ${hireling.name} - ${hireling.profession}\n`;
          output += `    📊 ${hireling.tier} | 💰 ${hireling.daily_wage_sp} sp/day\n`;
          output += `    💖 Loyalty: ${hireling.loyalty_score}/100 ${loyaltyIcon} | 📈 Skill: +${hireling.skill_bonus}\n`;
          if (hireling.current_task) {
            output += `    📝 Current Task: ${hireling.current_task}\n`;
          }
          output += `\n`;
          
          if (hireling.status === 'active' || hireling.status === 'busy') {
            totalWages += (hireling.daily_wage_sp || 2) * 7;
          }
        });
        
        output += `💰 SUMMARY:\n`;
        output += `👥 Total Staff: ${hirelings.length}\n`;
        output += `💸 Weekly Wages: ${totalWages} sp`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'establish_business': {
        const { stronghold_id, name, business_type, investment_cost, weekly_income, risk_level, employee_count, description, special_rules } = args as any;
        
        const stronghold = db.getStronghold(stronghold_id) as any;
        if (!stronghold) {
          return {
            content: [{ type: 'text', text: '❌ Stronghold not found!' }]
          };
        }
        
        const business = db.establishBusiness(stronghold_id, {
          name,
          business_type,
          investment_cost,
          weekly_income,
          risk_level,
          employee_count,
          description,
          special_rules
        }) as any;
        
        const riskIcon = business.risk_level === 'low' ? '🟢' :
                        business.risk_level === 'medium' ? '🟡' : '🔴';
        
        const output = `💼 NEW BUSINESS ESTABLISHED!
        
🏛️ Stronghold: ${stronghold.name}
💼 ${business.name} (${business.business_type})
💰 Investment: ${business.investment_cost || 0} gp
📈 Weekly Income: ${business.weekly_income || 0} gp
${riskIcon} Risk Level: ${business.risk_level || 'low'}
👥 Employees: ${business.employee_count || 0}
🆔 Business ID: ${business.id}

${business.description ? `📝 ${business.description}\n` : ''}✅ Business is ready to generate income!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'process_weekly_income': {
        const { character_id, week_number } = args as any;
        
        const character = db.getCharacter(character_id) as any;
        const characterName = character ? character.name : `Character ${character_id}`;
        
        const result = db.processWeeklyIncome(character_id, week_number);
        
        const netIcon = result.netChange >= 0 ? '📈' : '📉';
        const netText = result.netChange >= 0 ? `+${result.netChange}` : `${result.netChange}`;
        
        const output = `💰 WEEKLY INCOME PROCESSED!
        
👤 ${characterName} - Week ${week_number}
📈 Business Income: +${result.totalIncome} gp
💸 Facility Upkeep: -${result.totalUpkeep} gp
👥 Hireling Wages: -${result.totalWages} sp
${netIcon} Net Change: ${netText} gp

💰 Updated Treasury: ${character.gold || 0} gp

📊 Processing completed for week ${week_number}!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_stronghold_businesses': {
        const { stronghold_id } = args as any;
        
        const stronghold = db.getStronghold(stronghold_id) as any;
        if (!stronghold) {
          return {
            content: [{ type: 'text', text: '❌ Stronghold not found!' }]
          };
        }
        
        const businesses = db.getStrongholdBusinesses(stronghold_id);
        
        if (!businesses || businesses.length === 0) {
          return {
            content: [{ type: 'text', text: `💼 NO BUSINESSES\n\n${stronghold.name} has no businesses yet.\n\n💡 Use 'establish_business' to create income sources!` }]
          };
        }
        
        let output = `💼 ${stronghold.name.toUpperCase()} BUSINESSES\n\n`;
        let totalIncome = 0;
        
        businesses.forEach((business: any, index: number) => {
          const riskIcon = business.risk_level === 'low' ? '🟢' :
                          business.risk_level === 'medium' ? '🟡' : '🔴';
          
          output += `${index + 1}. 💼 ${business.name}\n`;
          output += `    🏢 Type: ${business.business_type} | 📈 Income: ${business.weekly_income} gp/week\n`;
          output += `    ${riskIcon} Risk: ${business.risk_level} | 👥 Employees: ${business.employee_count}\n`;
          if (business.description) {
            output += `    📝 ${business.description}\n`;
          }
          output += `\n`;
          
          totalIncome += business.weekly_income || 0;
        });
        
        output += `💰 SUMMARY:\n`;
        output += `💼 Total Businesses: ${businesses.length}\n`;
        output += `📈 Weekly Income: ${totalIncome} gp`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'generate_stronghold_event': {
        const { stronghold_id, event_type } = args as any;
        
        const stronghold = db.getStronghold(stronghold_id) as any;
        if (!stronghold) {
          return {
            content: [{ type: 'text', text: '❌ Stronghold not found!' }]
          };
        }
        
        const event = db.generateStrongholdEvent(stronghold_id, event_type) as any;
        
        const typeIcon = event.event_type === 'opportunity' ? '✨' :
                        event.event_type === 'disaster' ? '⚠️' :
                        event.event_type === 'quest' ? '🎯' : '📜';
        
        let output = `${typeIcon} STRONGHOLD EVENT GENERATED!
        
🏛️ Stronghold: ${stronghold.name}
📜 ${event.title}
📝 ${event.description}
📊 Type: ${event.event_type}
⏰ Deadline: ${event.resolution_deadline ? new Date(event.resolution_deadline).toLocaleDateString() : 'None'}
🆔 Event ID: ${event.id}

`;
        
        if (event.resolution_options) {
          const options = typeof event.resolution_options === 'string' ?
            JSON.parse(event.resolution_options) : event.resolution_options;
          
          output += `🎯 RESPONSE OPTIONS:\n`;
          options.forEach((option: any, index: number) => {
            output += `${index + 1}. ${option.option}\n`;
            output += `   📊 Effect: ${option.effect}\n`;
          });
        }
        
        output += `\n⚡ Use 'resolve_stronghold_event' to respond!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'resolve_stronghold_event': {
        const { event_id, player_choice, outcome } = args as any;
        
        const event = db.resolveStrongholdEvent(event_id, player_choice, outcome) as any;
        
        const typeIcon = event.event_type === 'opportunity' ? '✨' :
                        event.event_type === 'disaster' ? '⚠️' :
                        event.event_type === 'quest' ? '🎯' : '📜';
        
        const output = `✅ STRONGHOLD EVENT RESOLVED!
        
${typeIcon} ${event.title}
📝 Player Choice: ${event.player_choice}
${event.outcome ? `📊 Outcome: ${event.outcome}\n` : ''}📅 Resolved: ${new Date().toLocaleString()}

🎯 Event has been successfully resolved!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_stronghold_events': {
        const { stronghold_id, status } = args as any;
        
        const stronghold = db.getStronghold(stronghold_id) as any;
        if (!stronghold) {
          return {
            content: [{ type: 'text', text: '❌ Stronghold not found!' }]
          };
        }
        
        const events = db.getStrongholdEvents(stronghold_id, status);
        
        if (!events || events.length === 0) {
          const statusText = status ? ` with status "${status}"` : '';
          return {
            content: [{ type: 'text', text: `📜 NO EVENTS FOUND\n\n${stronghold.name} has no events${statusText}.\n\n💡 Use 'generate_stronghold_event' to create events!` }]
          };
        }
        
        let output = `📜 ${stronghold.name.toUpperCase()} EVENTS\n\n`;
        
        if (status) {
          output = `📜 ${stronghold.name.toUpperCase()} ${status.toUpperCase()} EVENTS\n\n`;
        }
        
        events.forEach((event: any, index: number) => {
          const typeIcon = event.event_type === 'opportunity' ? '✨' :
                          event.event_type === 'disaster' ? '⚠️' :
                          event.event_type === 'quest' ? '🎯' : '📜';
          
          const statusIcon = event.status === 'pending' ? '⏳' :
                            event.status === 'resolved' ? '✅' :
                            event.status === 'ignored' ? '🙈' : '⌛';
          
          output += `${index + 1}. ${typeIcon} ${statusIcon} ${event.title}\n`;
          output += `    📝 ${event.description}\n`;
          output += `    📊 Status: ${event.status} | 📅 ${new Date(event.event_date).toLocaleDateString()}\n`;
          if (event.player_choice) {
            output += `    🎯 Choice: ${event.player_choice}\n`;
          }
          if (event.outcome) {
            output += `    📊 Outcome: ${event.outcome}\n`;
          }
          output += `\n`;
        });
        
        output += `📊 Total Events: ${events.length}`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
console.error('Enhanced RPG Game State MCP Server v2.0 running on stdio');
