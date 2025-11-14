import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { MONSTER_TEMPLATES, rollHitDice, getAbilityModifier } from './monsters.js';

// Define interfaces for Monster Templates
interface MonsterAttack {
  name: string;
  bonus: number;
  damage: string;
  type: string;
  range?: number;
  special?: string;
  versatile?: string;
}

interface MonsterTemplate {
  name: string;
  creature_type: string;
  size: string;
  max_hp: number;
  armor_class: number;
  speed: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiency_bonus: number;
  initiative_modifier: number;
  attacks: string; // JSON string of MonsterAttack[]
  abilities?: string; // JSON string of Record<string, string>
  challenge_rating: number;
  experience_value: number;
  'Damage Vulnerabilities'?: string;
  'Damage Immunities'?: string;
  'Condition Immunities'?: string;
}

type MonsterTemplatesCollection = Record<string, MonsterTemplate>;

// Define EncounterParticipant locally to avoid import issues for now
// Ideally, this would be in a shared types.ts file
interface EncounterParticipant {
  id: number;
  encounter_id: number;
  participant_type: 'character' | 'npc';
  participant_id: number;
  initiative: number;
  initiative_order?: number | null;
  has_acted: boolean;
  conditions?: string | null;
  is_active: boolean;
  // Properties from JOIN
  name: string;
  current_hp: number;
  max_hp: number;
}

interface Quest {
  id: number;
  title: string;
  description: string;
  objectives: string; // JSON string
  rewards: string; // JSON string
  created_at: string;
}

interface CharacterQuest {
  id: number;
  character_id: number;
  quest_id: number;
  status: 'active' | 'completed' | 'failed';
  progress?: string | null; // JSON string for detailed objective tracking
  assigned_at: string;
  updated_at: string;
  // Properties from JOIN with quests table
  title?: string;
  description?: string;
  objectives?: string; // JSON string
  rewards?: string; // JSON string
}

// Create data directory in user's home folder
const DATA_DIR = join(homedir(), '.rpg-dungeon-data');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = join(DATA_DIR, 'game-state.db');

export class GameDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  private initializeSchema() {
    // Characters table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        class TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        experience INTEGER DEFAULT 0,
        current_hp INTEGER,
        max_hp INTEGER,
        armor_class INTEGER DEFAULT 10,
        strength INTEGER DEFAULT 10,
        dexterity INTEGER DEFAULT 10,
        constitution INTEGER DEFAULT 10,
        intelligence INTEGER DEFAULT 10,
        wisdom INTEGER DEFAULT 10,
        charisma INTEGER DEFAULT 10,
        gold INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_played DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // NPCs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS npcs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'enemy',
        creature_type TEXT,
        size TEXT DEFAULT 'medium',
        current_hp INTEGER NOT NULL,
        max_hp INTEGER NOT NULL,
        armor_class INTEGER NOT NULL,
        speed INTEGER DEFAULT 30,
        strength INTEGER DEFAULT 10,
        dexterity INTEGER DEFAULT 10,
        constitution INTEGER DEFAULT 10,
        intelligence INTEGER DEFAULT 10,
        wisdom INTEGER DEFAULT 10,
        charisma INTEGER DEFAULT 10,
        proficiency_bonus INTEGER DEFAULT 2,
        initiative_modifier INTEGER DEFAULT 0,
        attacks TEXT,
        abilities TEXT,
        conditions TEXT,
        is_alive BOOLEAN DEFAULT TRUE,
        challenge_rating REAL DEFAULT 0,
        experience_value INTEGER DEFAULT 0,
        template_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Encounters table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS encounters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        current_round INTEGER DEFAULT 0,
        current_turn INTEGER DEFAULT 0,
        environment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        FOREIGN KEY (character_id) REFERENCES characters(id)
      )
    `);

    // Encounter participants table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS encounter_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        encounter_id INTEGER NOT NULL,
        participant_type TEXT NOT NULL,
        participant_id INTEGER NOT NULL,
        initiative INTEGER NOT NULL,
        initiative_order INTEGER,
        has_acted BOOLEAN DEFAULT FALSE,
        conditions TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id)
      )
    `);

    // Inventory table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        equipped BOOLEAN DEFAULT FALSE,
        properties TEXT, -- JSON string
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    // Story progress table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS story_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        chapter TEXT NOT NULL,
        scene TEXT NOT NULL,
        description TEXT,
        flags TEXT, -- JSON string
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    // World state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS world_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        location TEXT NOT NULL,
        npcs TEXT, -- JSON string
        events TEXT, -- JSON string
        environment TEXT, -- JSON string
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    // Combat log table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS combat_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        action TEXT NOT NULL,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
            )
          `);
      
          // Quests table
          this.db.exec(`
            CREATE TABLE IF NOT EXISTS quests (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              description TEXT,
              objectives TEXT, -- JSON string, e.g., [{id: "obj1", text: "Do X", completed: false}]
              rewards TEXT,    -- JSON string, e.g., {gold: 100, exp: 50, items: ["item_id_1"]}
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
      
          // Character Quests table (join table)
          this.db.exec(`
            CREATE TABLE IF NOT EXISTS character_quests (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              character_id INTEGER NOT NULL,
              quest_id INTEGER NOT NULL,
              status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed'
              progress TEXT, -- JSON string for detailed objective tracking
              assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
              FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
              UNIQUE (character_id, quest_id)
            )
          `);
      
          // Create indexes
          this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_inventory_character ON inventory(character_id);
      CREATE INDEX IF NOT EXISTS idx_story_character ON story_progress(character_id);
      CREATE INDEX IF NOT EXISTS idx_world_character ON world_state(character_id);
      CREATE INDEX IF NOT EXISTS idx_combat_character ON combat_log(character_id);
      CREATE INDEX IF NOT EXISTS idx_npc_type ON npcs(type);
      CREATE INDEX IF NOT EXISTS idx_npc_alive ON npcs(is_alive);
      CREATE INDEX IF NOT EXISTS idx_encounter_character ON encounters(character_id);
      CREATE INDEX IF NOT EXISTS idx_encounter_status ON encounters(status);
      CREATE INDEX IF NOT EXISTS idx_participants_encounter ON encounter_participants(encounter_id);
      CREATE INDEX IF NOT EXISTS idx_participants_order ON encounter_participants(encounter_id, initiative_order);
      CREATE INDEX IF NOT EXISTS idx_quests_title ON quests(title);
      CREATE INDEX IF NOT EXISTS idx_character_quests_character_id ON character_quests(character_id);
      CREATE INDEX IF NOT EXISTS idx_character_quests_quest_id ON character_quests(quest_id);
      CREATE INDEX IF NOT EXISTS idx_character_quests_status ON character_quests(status);
    `);

    // Migrations for existing tables
    this.addColumnIfNotExists('characters', 'armor_class', 'INTEGER DEFAULT 10');
    this.addColumnIfNotExists('inventory', 'equipped', 'BOOLEAN DEFAULT FALSE');
    this.addColumnIfNotExists('encounters', 'currentState', 'TEXT DEFAULT \'TURN_ENDED\'');
    this.addColumnIfNotExists('encounters', 'currentActorActions', 'TEXT');
    // Add D&D 5E character fields
    this.addColumnIfNotExists('characters', 'race', 'TEXT DEFAULT \'Human\'');
    this.addColumnIfNotExists('characters', 'background', 'TEXT DEFAULT \'Folk Hero\'');
    this.addColumnIfNotExists('characters', 'alignment', 'TEXT DEFAULT \'Neutral\'');
    this.addColumnIfNotExists('characters', 'hit_dice_remaining', 'INTEGER DEFAULT 1');
    this.addColumnIfNotExists('characters', 'speed', 'INTEGER DEFAULT 30');
    
    // Add spellcasting fields
    this.addColumnIfNotExists('characters', 'spellcasting_ability', 'TEXT');
    this.addColumnIfNotExists('characters', 'spell_save_dc', 'INTEGER');
    this.addColumnIfNotExists('characters', 'spell_attack_bonus', 'INTEGER');
    
    // Add features field for storing feats, class features, etc.
    this.addColumnIfNotExists('characters', 'features', 'TEXT'); // JSON string

    // Character spell slots table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS character_spell_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        spell_level INTEGER NOT NULL,
        total_slots INTEGER NOT NULL,
        used_slots INTEGER DEFAULT 0,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        UNIQUE(character_id, spell_level)
      )
    `);

    // Character spells table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS character_spells (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        spell_name TEXT NOT NULL,
        spell_level INTEGER NOT NULL,
        is_prepared BOOLEAN DEFAULT TRUE,
        is_known BOOLEAN DEFAULT TRUE,
        source TEXT DEFAULT 'class',
        description TEXT,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for spell tables
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_spell_slots_character ON character_spell_slots(character_id);
      CREATE INDEX IF NOT EXISTS idx_spells_character ON character_spells(character_id);
      CREATE INDEX IF NOT EXISTS idx_spells_level ON character_spells(spell_level);
      CREATE INDEX IF NOT EXISTS idx_spells_prepared ON character_spells(is_prepared);
    `);

    // Stronghold Management Tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS strongholds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        stronghold_type TEXT DEFAULT 'Keep',
        level INTEGER DEFAULT 1,
        defense_bonus INTEGER DEFAULT 0,
        prosperity_level INTEGER DEFAULT 1,
        construction_points INTEGER DEFAULT 0,
        weekly_upkeep_cost INTEGER DEFAULT 0,
        description TEXT,
        special_features TEXT, -- JSON string
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS facilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stronghold_id INTEGER NOT NULL,
        facility_type TEXT NOT NULL,
        name TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        construction_cost INTEGER DEFAULT 0,
        upkeep_cost INTEGER DEFAULT 0,
        build_time_weeks INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active', -- active, under_construction, damaged, destroyed
        benefits TEXT, -- JSON string of mechanical benefits
        description TEXT,
        assigned_hireling_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stronghold_id) REFERENCES strongholds(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_hireling_id) REFERENCES hirelings(id) ON DELETE SET NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hirelings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        hireling_type TEXT NOT NULL, -- laborer, specialist, retainer, facility_specialist
        profession TEXT, -- smith, guard, cook, librarian, etc.
        tier TEXT DEFAULT 'laborers', -- laborers, specialists, retainers
        daily_wage_sp INTEGER DEFAULT 2,
        skill_bonus INTEGER DEFAULT 0,
        loyalty_score INTEGER DEFAULT 50,
        current_task TEXT,
        abilities TEXT, -- JSON string of special abilities
        status TEXT DEFAULT 'active', -- active, busy, injured, away, dismissed
        hire_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_paid DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stronghold_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        business_type TEXT NOT NULL, -- tavern, smithy, market, farm, mine, etc.
        investment_cost INTEGER DEFAULT 0,
        weekly_income INTEGER DEFAULT 0,
        prosperity_modifier REAL DEFAULT 1.0,
        market_conditions TEXT DEFAULT 'normal', -- poor, normal, good, excellent
        risk_level TEXT DEFAULT 'low', -- low, medium, high
        employee_count INTEGER DEFAULT 0,
        description TEXT,
        special_rules TEXT, -- JSON string
        last_income_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stronghold_id) REFERENCES strongholds(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stronghold_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stronghold_id INTEGER NOT NULL,
        event_type TEXT NOT NULL, -- random, seasonal, quest, disaster, opportunity
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        event_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolution_deadline DATETIME,
        status TEXT DEFAULT 'pending', -- pending, resolved, ignored, expired
        consequences TEXT, -- JSON string
        resolution_options TEXT, -- JSON string
        player_choice TEXT,
        outcome TEXT,
        resolved_at DATETIME,
        FOREIGN KEY (stronghold_id) REFERENCES strongholds(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS facility_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_name TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL, -- military, utility, economic, social, magical
        base_cost INTEGER NOT NULL,
        base_upkeep INTEGER DEFAULT 0,
        build_time_weeks INTEGER DEFAULT 1,
        space_required INTEGER DEFAULT 1,
        prerequisites TEXT, -- JSON string of requirements
        benefits TEXT NOT NULL, -- JSON string of mechanical benefits
        staff_requirements TEXT, -- JSON string of required staff
        upgrade_path TEXT, -- JSON string of possible upgrades
        description TEXT,
        rule_source TEXT DEFAULT 'D&D 2024 Bastion Rules'
      )
    `);

    // Weekly Processing State
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS weekly_processing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        week_number INTEGER NOT NULL,
        processing_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        wages_paid INTEGER DEFAULT 0,
        business_income INTEGER DEFAULT 0,
        upkeep_costs INTEGER DEFAULT 0,
        events_generated INTEGER DEFAULT 0,
        processing_log TEXT, -- JSON string
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        UNIQUE(character_id, week_number)
      )
    `);

    // Create indexes for stronghold system
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_strongholds_character ON strongholds(character_id);
      CREATE INDEX IF NOT EXISTS idx_facilities_stronghold ON facilities(stronghold_id);
      CREATE INDEX IF NOT EXISTS idx_facilities_type ON facilities(facility_type);
      CREATE INDEX IF NOT EXISTS idx_hirelings_character ON hirelings(character_id);
      CREATE INDEX IF NOT EXISTS idx_hirelings_type ON hirelings(hireling_type);
      CREATE INDEX IF NOT EXISTS idx_hirelings_status ON hirelings(status);
      CREATE INDEX IF NOT EXISTS idx_businesses_stronghold ON businesses(stronghold_id);
      CREATE INDEX IF NOT EXISTS idx_businesses_type ON businesses(business_type);
      CREATE INDEX IF NOT EXISTS idx_events_stronghold ON stronghold_events(stronghold_id);
      CREATE INDEX IF NOT EXISTS idx_events_status ON stronghold_events(status);
      CREATE INDEX IF NOT EXISTS idx_events_type ON stronghold_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_weekly_processing_character ON weekly_processing(character_id);
      CREATE INDEX IF NOT EXISTS idx_weekly_processing_week ON weekly_processing(week_number);
    `);

    // Initialize default facility types (D&D 2024 Bastion System)
    this.initializeFacilityTypes();
  }

  private initializeFacilityTypes() {
    // Check if facility types are already initialized
    const count = this.db.prepare('SELECT COUNT(*) as count FROM facility_types').get() as any;
    if (count.count > 0) return;

    const facilityTypes = [
      // Military Facilities
      {
        type_name: 'Armory',
        category: 'military',
        base_cost: 1000,
        base_upkeep: 10,
        build_time_weeks: 2,
        space_required: 1,
        prerequisites: JSON.stringify({}),
        benefits: JSON.stringify({
          weapon_storage: 'Store up to 100 weapons and armor sets',
          equipment_bonus: '+1 to equipment quality checks',
          security: 'Weapons are secure from theft'
        }),
        staff_requirements: JSON.stringify({ armorer: 1 }),
        upgrade_path: JSON.stringify(['Enhanced Armory', 'Magical Armory']),
        description: 'A secure storage facility for weapons, armor, and military equipment.'
      },
      {
        type_name: 'Barracks',
        category: 'military',
        base_cost: 800,
        base_upkeep: 15,
        build_time_weeks: 3,
        space_required: 2,
        prerequisites: JSON.stringify({}),
        benefits: JSON.stringify({
          housing: 'Houses up to 20 soldiers',
          training_bonus: '+1 to military training checks',
          morale: 'Improves soldier loyalty by 10'
        }),
        staff_requirements: JSON.stringify({ sergeant: 1 }),
        upgrade_path: JSON.stringify(['Elite Barracks', 'Officer Quarters']),
        description: 'Housing and training facilities for military personnel.'
      },
      {
        type_name: 'War Room',
        category: 'military',
        base_cost: 1200,
        base_upkeep: 5,
        build_time_weeks: 2,
        space_required: 1,
        prerequisites: JSON.stringify({ min_level: 3 }),
        benefits: JSON.stringify({
          tactical_planning: '+2 to strategic planning checks',
          intelligence: 'Gather information on nearby threats',
          command: 'Issue commands to distant forces'
        }),
        staff_requirements: JSON.stringify({ tactician: 1 }),
        upgrade_path: JSON.stringify(['Advanced War Room']),
        description: 'A strategic planning center with maps, communications, and tactical resources.'
      },

      // Utility Facilities
      {
        type_name: 'Library',
        category: 'utility',
        base_cost: 1000,
        base_upkeep: 8,
        build_time_weeks: 3,
        space_required: 1,
        prerequisites: JSON.stringify({}),
        benefits: JSON.stringify({
          research: '+2 to Intelligence-based skill checks',
          knowledge_storage: 'Store and organize information',
          spell_research: 'Research new spells (spellcasters only)'
        }),
        staff_requirements: JSON.stringify({ librarian: 1 }),
        upgrade_path: JSON.stringify(['Archive', 'Magical Library']),
        description: 'A collection of books, scrolls, and knowledge repositories.'
      },
      {
        type_name: 'Laboratory',
        category: 'utility',
        base_cost: 1500,
        base_upkeep: 12,
        build_time_weeks: 4,
        space_required: 1,
        prerequisites: JSON.stringify({ intelligence: 13 }),
        benefits: JSON.stringify({
          alchemy: 'Craft potions and alchemical items',
          research: '+3 to alchemical and magical research',
          experimentation: 'Develop new formulae'
        }),
        staff_requirements: JSON.stringify({ alchemist: 1 }),
        upgrade_path: JSON.stringify(['Advanced Laboratory', 'Arcane Laboratory']),
        description: 'An alchemical laboratory for potion brewing and magical research.'
      },
      {
        type_name: 'Smithy',
        category: 'utility',
        base_cost: 800,
        base_upkeep: 10,
        build_time_weeks: 2,
        space_required: 1,
        prerequisites: JSON.stringify({}),
        benefits: JSON.stringify({
          weapon_crafting: 'Craft and repair weapons and armor',
          tool_making: 'Create tools and metal goods',
          income: 'Generate 2d6 x 10 gp per week'
        }),
        staff_requirements: JSON.stringify({ blacksmith: 1 }),
        upgrade_path: JSON.stringify(['Master Smithy', 'Magical Forge']),
        description: 'A forge and workshop for metalworking and weapon crafting.'
      },

      // Economic Facilities
      {
        type_name: 'Greenhouse',
        category: 'economic',
        base_cost: 600,
        base_upkeep: 5,
        build_time_weeks: 2,
        space_required: 1,
        prerequisites: JSON.stringify({}),
        benefits: JSON.stringify({
          herb_cultivation: 'Grow herbs and medicinal plants',
          food_production: 'Supplement food supplies',
          income: 'Generate 1d6 x 10 gp per week'
        }),
        staff_requirements: JSON.stringify({ gardener: 1 }),
        upgrade_path: JSON.stringify(['Botanical Garden', 'Magical Grove']),
        description: 'A protected growing space for plants, herbs, and crops.'
      },
      {
        type_name: 'Workshop',
        category: 'economic',
        base_cost: 500,
        base_upkeep: 8,
        build_time_weeks: 2,
        space_required: 1,
        prerequisites: JSON.stringify({}),
        benefits: JSON.stringify({
          crafting: 'Craft mundane items and tools',
          repair: 'Repair equipment and items',
          income: 'Generate 1d4 x 10 gp per week'
        }),
        staff_requirements: JSON.stringify({ craftsman: 1 }),
        upgrade_path: JSON.stringify(['Artisan Workshop', 'Magical Workshop']),
        description: 'A general-purpose crafting space for various trades.'
      },

      // Social Facilities
      {
        type_name: 'Training Grounds',
        category: 'social',
        base_cost: 1000,
        base_upkeep: 15,
        build_time_weeks: 4,
        space_required: 3,
        prerequisites: JSON.stringify({}),
        benefits: JSON.stringify({
          physical_training: '+1 to Strength and Dexterity training',
          combat_practice: 'Characters can train combat skills',
          hireling_improvement: 'Improve hireling combat abilities'
        }),
        staff_requirements: JSON.stringify({ trainer: 1 }),
        upgrade_path: JSON.stringify(['Elite Training Grounds']),
        description: 'Open spaces and equipment for physical and combat training.'
      },
      {
        type_name: 'Chapel',
        category: 'social',
        base_cost: 800,
        base_upkeep: 5,
        build_time_weeks: 3,
        space_required: 1,
        prerequisites: JSON.stringify({}),
        benefits: JSON.stringify({
          healing: 'Provide healing services to residents',
          morale: 'Boost morale and loyalty of residents',
          divine_magic: 'Access to divine spellcasting services'
        }),
        staff_requirements: JSON.stringify({ cleric: 1 }),
        upgrade_path: JSON.stringify(['Temple', 'Grand Cathedral']),
        description: 'A sacred space for worship and spiritual guidance.'
      },

      // Magical Facilities
      {
        type_name: 'Teleportation Circle',
        category: 'magical',
        base_cost: 5000,
        base_upkeep: 20,
        build_time_weeks: 8,
        space_required: 1,
        prerequisites: JSON.stringify({ level: 9, caster_level: 9 }),
        benefits: JSON.stringify({
          teleportation: 'Instant travel to connected circles',
          communication: 'Send messages to other circles',
          strategic_mobility: 'Move troops and supplies rapidly'
        }),
        staff_requirements: JSON.stringify({ arcane_specialist: 1 }),
        upgrade_path: JSON.stringify(['Planar Gateway']),
        description: 'A permanent magical circle enabling teleportation and communication.'
      },
      {
        type_name: 'Arcane Study',
        category: 'magical',
        base_cost: 1200,
        base_upkeep: 15,
        build_time_weeks: 3,
        space_required: 1,
        prerequisites: JSON.stringify({ intelligence: 13 }),
        benefits: JSON.stringify({
          spell_research: '+3 to magical research checks',
          scroll_creation: 'Create spell scrolls and magical items',
          arcane_knowledge: 'Access to magical lore and secrets'
        }),
        staff_requirements: JSON.stringify({ sage: 1 }),
        upgrade_path: JSON.stringify(['Magical Academy']),
        description: 'A dedicated space for arcane study and magical research.'
      }
    ];

    const stmt = this.db.prepare(`
      INSERT INTO facility_types (
        type_name, category, base_cost, base_upkeep, build_time_weeks, space_required,
        prerequisites, benefits, staff_requirements, upgrade_path, description, rule_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const facilityType of facilityTypes) {
      stmt.run(
        facilityType.type_name,
        facilityType.category,
        facilityType.base_cost,
        facilityType.base_upkeep,
        facilityType.build_time_weeks,
        facilityType.space_required,
        facilityType.prerequisites,
        facilityType.benefits,
        facilityType.staff_requirements,
        facilityType.upgrade_path,
        facilityType.description,
        'D&D 2024 Bastion Rules'
      );
    }

    console.log('Initialized facility types database');
  }

  private addColumnIfNotExists(tableName: string, columnName: string, columnDefinition: string) {
    const stmt = this.db.prepare(`PRAGMA table_info(\`${tableName}\`)`);
    const columns = stmt.all() as { name: string }[];
    if (!columns.some(col => col.name === columnName)) {
      try {
        this.db.exec(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
        console.log(`Added column ${columnName} to ${tableName}`);
      } catch (error) {
        console.error(`Failed to add column ${columnName} to ${tableName}:`, error);
      }
    }
  }

  // Character operations
  createCharacter(data: {
    name: string;
    class: string;
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
    armor_class?: number;
    race?: string;
    background?: string;
    alignment?: string;
    level?: number;
  }) {
    const level = data.level || 1;
    const constitution = data.constitution || 10;
    const conMod = Math.floor((constitution - 10) / 2);
    
    // Calculate HP based on class and level (simplified)
    const hitDieByClass: Record<string, number> = {
      'Wizard': 6, 'Sorcerer': 6,
      'Rogue': 8, 'Bard': 8, 'Cleric': 8, 'Druid': 8, 'Monk': 8, 'Warlock': 8,
      'Fighter': 10, 'Paladin': 10, 'Ranger': 10,
      'Barbarian': 12
    };
    const hitDie = hitDieByClass[data.class] || 8;
    const maxHp = hitDie + conMod + ((level - 1) * (Math.floor(hitDie / 2) + 1 + conMod));
    
    const stmt = this.db.prepare(`
      INSERT INTO characters (
        name, class, level, max_hp, current_hp, armor_class,
        strength, dexterity, constitution, intelligence, wisdom, charisma,
        race, background, alignment, hit_dice_remaining, speed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.name,
      data.class,
      level,
      maxHp,
      maxHp,
      data.armor_class || (10 + Math.floor(((data.dexterity || 10) - 10) / 2)), // AC = 10 + Dex mod
      data.strength || 10,
      data.dexterity || 10,
      data.constitution || 10,
      data.intelligence || 10,
      data.wisdom || 10,
      data.charisma || 10,
      data.race || 'Human',
      data.background || 'Folk Hero',
      data.alignment || 'Neutral',
      level, // Hit dice remaining = level
      30 // Default speed
    );

    return this.getCharacter(result.lastInsertRowid as number);
  }

  getCharacter(id: number) {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE id = ?');
    const character = stmt.get(id) as any;
    
    if (character && character.features) {
      try {
        character.features = JSON.parse(character.features);
      } catch (e) {
        // If parsing fails, keep as string
        console.warn('Failed to parse character features JSON:', e);
      }
    }
    
    return character;
  }

  getCharacterByName(name: string) {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE name = ?');
    return stmt.get(name);
  }

  listCharacters() {
    const stmt = this.db.prepare('SELECT * FROM characters ORDER BY last_played DESC');
    return stmt.all();
  }

  updateCharacter(id: number, updates: Record<string, any>) {
    // Handle JSON fields
    const processedUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'features' && typeof value === 'object' && value !== null) {
        processedUpdates[key] = JSON.stringify(value);
      } else {
        processedUpdates[key] = value;
      }
    }
    
    const fields = Object.keys(processedUpdates);
    const values = Object.values(processedUpdates);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const stmt = this.db.prepare(`
      UPDATE characters
      SET ${setClause}, last_played = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(...values, id);
    return this.getCharacter(id);
  }

  // Inventory operations
  addItem(characterId: number, item: {
    name: string;
    type: string;
    quantity?: number;
    properties?: Record<string, any>;
    equipped?: boolean;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO inventory (character_id, item_name, item_type, quantity, properties, equipped)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      characterId,
      item.name,
      item.type,
      item.quantity || 1,
      item.properties ? JSON.stringify(item.properties) : null,
      item.equipped ? 1 : 0
    );

    return { id: result.lastInsertRowid, ...item };
  }

  getInventory(characterId: number) {
    const stmt = this.db.prepare(`
      SELECT * FROM inventory WHERE character_id = ? ORDER BY item_type, item_name
    `);
    
    const items = stmt.all(characterId);
    return items.map((item: any) => ({
      ...item,
      properties: item.properties ? JSON.parse(item.properties as string) : null
    }));
  }

  updateItem(id: number, updates: { quantity?: number; equipped?: boolean }) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const stmt = this.db.prepare(`UPDATE inventory SET ${setClause} WHERE id = ?`);
    
    stmt.run(...values, id);
  }

  getItem(id: number) {
    const stmt = this.db.prepare('SELECT * FROM inventory WHERE id = ?');
    const item = stmt.get(id) as any;
    
    if (item && item.properties) {
      item.properties = JSON.parse(item.properties);
    }
    
    return item;
  }

  removeItem(id: number) {
    const stmt = this.db.prepare('DELETE FROM inventory WHERE id = ?');
    stmt.run(id);
  }

  // Story operations
  saveStoryProgress(characterId: number, data: {
    chapter: string;
    scene: string;
    description?: string;
    flags?: Record<string, any>;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO story_progress (character_id, chapter, scene, description, flags)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      characterId,
      data.chapter,
      data.scene,
      data.description || null,
      data.flags ? JSON.stringify(data.flags) : null
    );
  }

  getLatestStoryProgress(characterId: number) {
    const stmt = this.db.prepare(`
      SELECT * FROM story_progress 
      WHERE character_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    
    const result = stmt.get(characterId) as any;
    if (result && result.flags) {
      result.flags = JSON.parse(result.flags as string);
    }
    return result;
  }

  // World state operations
  saveWorldState(characterId: number, data: {
    location: string;
    npcs?: Record<string, any>;
    events?: Record<string, any>;
    environment?: Record<string, any>;
  }) {
    // Check if world state exists
    const existing = this.db.prepare(
      'SELECT id FROM world_state WHERE character_id = ?'
    ).get(characterId);

    if (existing) {
      // Update existing
      const stmt = this.db.prepare(`
        UPDATE world_state 
        SET location = ?, npcs = ?, events = ?, environment = ?, last_updated = CURRENT_TIMESTAMP
        WHERE character_id = ?
      `);
      
      stmt.run(
        data.location,
        data.npcs ? JSON.stringify(data.npcs) : null,
        data.events ? JSON.stringify(data.events) : null,
        data.environment ? JSON.stringify(data.environment) : null,
        characterId
      );
    } else {
      // Insert new
      const stmt = this.db.prepare(`
        INSERT INTO world_state (character_id, location, npcs, events, environment)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        characterId,
        data.location,
        data.npcs ? JSON.stringify(data.npcs) : null,
        data.events ? JSON.stringify(data.events) : null,
        data.environment ? JSON.stringify(data.environment) : null
      );
    }
  }

  appendWorldState(characterId: number, data: {
    location?: string;
    npcs?: Record<string, any>;
    events?: Record<string, any>;
    environment?: Record<string, any>;
  }) {
    // Get existing world state
    const existing = this.getWorldState(characterId);
    
    // Prepare merged data
    const mergedData: any = {};
    
    // Handle location - use new location if provided, otherwise keep existing
    if (data.location !== undefined) {
      mergedData.location = data.location;
    } else if (existing) {
      mergedData.location = existing.location;
    } else {
      throw new Error('Location is required when no existing world state exists');
    }
    
    // Handle NPCs - merge with existing
    if (data.npcs || (existing && existing.npcs)) {
      mergedData.npcs = { ...(existing?.npcs || {}), ...(data.npcs || {}) };
    }
    
    // Handle events - merge with existing
    if (data.events || (existing && existing.events)) {
      mergedData.events = { ...(existing?.events || {}), ...(data.events || {}) };
    }
    
    // Handle environment - merge with existing
    if (data.environment || (existing && existing.environment)) {
      mergedData.environment = { ...(existing?.environment || {}), ...(data.environment || {}) };
    }
    
    // Save the merged data using the existing save method
    this.saveWorldState(characterId, mergedData);
    
    return mergedData;
  }

  getWorldState(characterId: number) {
    const stmt = this.db.prepare('SELECT * FROM world_state WHERE character_id = ?');
    const result = stmt.get(characterId) as any;
    
    if (result) {
      if (result.npcs) result.npcs = JSON.parse(result.npcs as string);
      if (result.events) result.events = JSON.parse(result.events as string);
      if (result.environment) result.environment = JSON.parse(result.environment as string);
    }
    
    return result;
  }

  // Combat log operations
  logCombat(characterId: number, sessionId: string, action: string, result?: string) {
    const stmt = this.db.prepare(`
      INSERT INTO combat_log (character_id, session_id, action, result)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(characterId, sessionId, action, result || null);
  }

  getCombatLog(characterId: number, sessionId?: string) {
    if (sessionId) {
      const stmt = this.db.prepare(`
        SELECT * FROM combat_log 
        WHERE character_id = ? AND session_id = ?
        ORDER BY timestamp
      `);
      return stmt.all(characterId, sessionId);
    } else {
      const stmt = this.db.prepare(`
        SELECT * FROM combat_log 
        WHERE character_id = ?
        ORDER BY timestamp DESC
        LIMIT 50
      `);
      return stmt.all(characterId);
    }
  }

  // NPC operations
  createNPC(data: {
    name: string;
    template?: string;
    type?: string;
    customStats?: Record<string, any>;
  }) {
    let npcData: any = {
      name: data.name,
      type: data.type || 'enemy'
    };

    // Apply template if specified
    if (data.template && (MONSTER_TEMPLATES as MonsterTemplatesCollection)[data.template]) {
      const template = (MONSTER_TEMPLATES as MonsterTemplatesCollection)[data.template];
      npcData = { ...template, ...npcData };
    }

    // Apply custom stats
    if (data.customStats) {
      npcData = { ...npcData, ...data.customStats };
    }

    // Ensure required fields
    if (!npcData.max_hp) npcData.max_hp = 10;
    if (!npcData.current_hp) npcData.current_hp = npcData.max_hp;
    if (!npcData.armor_class) npcData.armor_class = 10;

    // Calculate initiative modifier if not set
    if (npcData.initiative_modifier === undefined) {
      npcData.initiative_modifier = getAbilityModifier(npcData.dexterity || 10);
    }

    const stmt = this.db.prepare(`
      INSERT INTO npcs (
        name, type, creature_type, size, current_hp, max_hp, armor_class, speed,
        strength, dexterity, constitution, intelligence, wisdom, charisma,
        proficiency_bonus, initiative_modifier, attacks, abilities, conditions,
        challenge_rating, experience_value, template_id
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    // Serialize complex objects to JSON if they are not already strings
    const attacksValue = typeof npcData.attacks === 'object' && npcData.attacks !== null
                         ? JSON.stringify(npcData.attacks)
                         : npcData.attacks || null;
    const abilitiesValue = typeof npcData.abilities === 'object' && npcData.abilities !== null
                           ? JSON.stringify(npcData.abilities)
                           : npcData.abilities || null;
    const conditionsValue = typeof npcData.conditions === 'object' && npcData.conditions !== null
                            ? JSON.stringify(npcData.conditions)
                            : npcData.conditions || null;

    const result = stmt.run(
      npcData.name,
      npcData.type,
      npcData.creature_type || null,
      npcData.size || 'medium',
      npcData.current_hp,
      npcData.max_hp,
      npcData.armor_class,
      npcData.speed || 30,
      npcData.strength || 10,
      npcData.dexterity || 10,
      npcData.constitution || 10,
      npcData.intelligence || 10,
      npcData.wisdom || 10,
      npcData.charisma || 10,
      npcData.proficiency_bonus || 2,
      npcData.initiative_modifier,
      attacksValue,
      abilitiesValue,
      conditionsValue,
      npcData.challenge_rating || 0,
      npcData.experience_value || 0,
      data.template || null
    );

    return this.getNPC(result.lastInsertRowid as number);
  }

  createNPCGroup(template: string, count: number, namePrefix?: string) {
    const npcs = [];
    const prefix = namePrefix || (MONSTER_TEMPLATES as MonsterTemplatesCollection)[template]?.name || 'NPC';
    
    for (let i = 1; i <= count; i++) {
      const npc = this.createNPC({
        name: `${prefix} ${i}`,
        template: template
      });
      npcs.push(npc);
    }
    
    return npcs;
  }

  getNPC(id: number) {
    const stmt = this.db.prepare('SELECT * FROM npcs WHERE id = ?');
    const npc = stmt.get(id) as any;
    
    if (npc) {
      // Parse JSON fields
      if (npc.attacks) npc.attacks = JSON.parse(npc.attacks);
      if (npc.abilities) npc.abilities = JSON.parse(npc.abilities);
      if (npc.conditions) npc.conditions = JSON.parse(npc.conditions);
    }
    
    return npc;
  }

  listNPCs(type?: string, aliveOnly: boolean = true) {
    let query = 'SELECT * FROM npcs WHERE 1=1';
    const params: any[] = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (aliveOnly) {
      query += ' AND is_alive = TRUE';
    }
    
    query += ' ORDER BY name';
    
    const stmt = this.db.prepare(query);
    const npcs = stmt.all(...params);
    
    return npcs.map((npc: any) => {
      if (npc.attacks) npc.attacks = JSON.parse(npc.attacks);
      if (npc.abilities) npc.abilities = JSON.parse(npc.abilities);
      if (npc.conditions) npc.conditions = JSON.parse(npc.conditions);
      return npc;
    });
  }

  updateNPC(id: number, updates: Record<string, any>) {
    // Map common field names to database column names
    const fieldMapping: Record<string, string> = {
      'hit_points': 'current_hp',
      'max_hit_points': 'max_hp',
      'level': 'challenge_rating', // NPCs don't have levels, use CR instead
      'special_abilities': 'abilities',
      'damage_resistances': 'abilities', // Store in abilities JSON
      'damage_immunities': 'abilities',
      'condition_immunities': 'abilities'
    };

    // Apply field mapping
    const mappedUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key] || key;
      
      // Special handling for abilities-related fields
      if (['special_abilities', 'damage_resistances', 'damage_immunities', 'condition_immunities'].includes(key)) {
        // Get existing abilities or create new object
        const existingNPC = this.getNPC(id);
        let abilities = existingNPC?.abilities || {};
        
        // If it's an array, store it properly
        if (Array.isArray(value)) {
          abilities[key] = value;
        } else if (typeof value === 'string') {
          abilities[key] = value;
        }
        
        mappedUpdates['abilities'] = abilities;
      } else {
        mappedUpdates[dbField] = value;
      }
    }

    // Handle JSON fields
    if (mappedUpdates.attacks && typeof mappedUpdates.attacks === 'object') {
      mappedUpdates.attacks = JSON.stringify(mappedUpdates.attacks);
    }
    if (mappedUpdates.abilities && typeof mappedUpdates.abilities === 'object') {
      mappedUpdates.abilities = JSON.stringify(mappedUpdates.abilities);
    }
    if (mappedUpdates.conditions && typeof mappedUpdates.conditions === 'object') {
      mappedUpdates.conditions = JSON.stringify(mappedUpdates.conditions);
    }
    
    // Filter out any invalid fields that don't exist in the database
    const validFields = [
      'name', 'type', 'creature_type', 'size', 'current_hp', 'max_hp', 'armor_class', 'speed',
      'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
      'proficiency_bonus', 'initiative_modifier', 'attacks', 'abilities', 'conditions',
      'is_alive', 'challenge_rating', 'experience_value', 'template_id'
    ];
    
    const filteredUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(mappedUpdates)) {
      if (validFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }
    
    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid fields provided for NPC update');
    }
    
    const fields = Object.keys(filteredUpdates);
    const values = Object.values(filteredUpdates);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const stmt = this.db.prepare(`UPDATE npcs SET ${setClause} WHERE id = ?`);
    
    stmt.run(...values, id);
    return this.getNPC(id);
  }

  removeNPC(id: number) {
    const stmt = this.db.prepare('DELETE FROM npcs WHERE id = ?');
    stmt.run(id);
  }

  // Encounter operations
  createEncounter(data: {
    character_id: number;
    name: string;
    description?: string;
    environment?: string;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO encounters (character_id, name, description, environment)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.character_id,
      data.name,
      data.description || null,
      data.environment || null
    );

    return this.getEncounter(result.lastInsertRowid as number);
  }

  getEncounter(id: number) {
    // console.log(`[GameDatabase.getEncounter] Querying for encounter ID: ${id}`);
    const stmt = this.db.prepare('SELECT * FROM encounters WHERE id = ?');
    const row = stmt.get(id);
    // console.log(`[GameDatabase.getEncounter] Raw row data for ID ${id}: ${JSON.stringify(row)}`);
    return row;
  }

  getActiveEncounter(characterId: number) {
    const stmt = this.db.prepare(`
      SELECT * FROM encounters 
      WHERE character_id = ? AND status = 'active' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    return stmt.get(characterId);
  }

  addEncounterParticipant(encounterId: number, type: string, participantId: number, initiative: number) {
    const stmt = this.db.prepare(`
      INSERT INTO encounter_participants (encounter_id, participant_type, participant_id, initiative)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(encounterId, type, participantId, initiative);
    
    // Recalculate initiative order
    this.updateInitiativeOrder(encounterId);
  }

  updateInitiativeOrder(encounterId: number) {
    // Get all participants sorted by initiative (descending)
    const participants = this.db.prepare(`
      SELECT id, initiative FROM encounter_participants 
      WHERE encounter_id = ? AND is_active = TRUE
      ORDER BY initiative DESC
    `).all(encounterId) as EncounterParticipant[];
    
    // Update initiative order
    const updateStmt = this.db.prepare(`
      UPDATE encounter_participants SET initiative_order = ? WHERE id = ?
    `);
    
    participants.forEach((p: EncounterParticipant, index) => {
      updateStmt.run(index + 1, p.id);
    });
  }

  getEncounterParticipants(encounterId: number) {
    const stmt = this.db.prepare(`
      SELECT ep.*, 
        CASE 
          WHEN ep.participant_type = 'character' THEN c.name
          WHEN ep.participant_type = 'npc' THEN n.name
        END as name,
        CASE 
          WHEN ep.participant_type = 'character' THEN c.current_hp
          WHEN ep.participant_type = 'npc' THEN n.current_hp
        END as current_hp,
        CASE 
          WHEN ep.participant_type = 'character' THEN c.max_hp
          WHEN ep.participant_type = 'npc' THEN n.max_hp
        END as max_hp
      FROM encounter_participants ep
      LEFT JOIN characters c ON ep.participant_type = 'character' AND ep.participant_id = c.id
      LEFT JOIN npcs n ON ep.participant_type = 'npc' AND ep.participant_id = n.id
      WHERE ep.encounter_id = ? AND ep.is_active = TRUE
      ORDER BY ep.initiative_order
    `);
    
    return stmt.all(encounterId) as EncounterParticipant[];
  }

  nextTurn(encounterId: number): EncounterParticipant | null {
    const encounter = this.getEncounter(encounterId) as any;
    if (!encounter || encounter.status !== 'active') {
      console.log(`Encounter ${encounterId} not active or not found.`);
      return null;
    }

    let participants: EncounterParticipant[] = this.getEncounterParticipants(encounterId);
    if (participants.length === 0) {
      console.log(`No active participants in encounter ${encounterId}.`);
      return null;
    }

    // Mark current participant as having acted, if there was a current turn
    const currentTurnOrder = encounter.current_turn;
    if (currentTurnOrder > 0 && currentTurnOrder <= participants.length) {
        // Find the participant by their *current* initiative_order, which might have shifted if others became inactive
        const currentParticipantInOriginalOrder = participants.find(p => p.initiative_order === currentTurnOrder);
        if (currentParticipantInOriginalOrder && currentParticipantInOriginalOrder.is_active) {
             this.db.prepare(
                `UPDATE encounter_participants SET has_acted = TRUE WHERE id = ?`
            ).run(currentParticipantInOriginalOrder.id);
        }
    }
    
    // Determine the next turn order
    let nextTurnOrder = currentTurnOrder + 1;
    let nextParticipant: EncounterParticipant | undefined = undefined;

    // Loop to find the next *active* participant
    let attempts = 0; // Safety break for infinite loops
    while (attempts < participants.length * 2) { // Allow to loop through participants twice (for round change)
        if (nextTurnOrder > participants.length) { // End of round, start new round
            nextTurnOrder = 1;
            encounter.current_round += 1;
            
            // Reset has_acted for all *active* participants for the new round
            this.db.prepare(
                `UPDATE encounter_participants SET has_acted = FALSE WHERE encounter_id = ? AND is_active = TRUE`
            ).run(encounterId);
            // Re-fetch participants as their has_acted status changed
            participants = this.getEncounterParticipants(encounterId);
        }

        nextParticipant = participants.find(p => p.initiative_order === nextTurnOrder && p.is_active);

        if (nextParticipant) {
            break; // Found next active participant
        }
        
        nextTurnOrder++; // Try next in order
        attempts++;
    }

    if (!nextParticipant) {
      // This could happen if all participants become inactive
      console.log(`No active participant found for next turn in encounter ${encounterId}. Ending encounter.`);
      this.endEncounter(encounterId, 'stalemate'); // Or some other appropriate status
      return null;
    }

    // Initialize turn state and actor actions
    const initialActions = {
      actionAvailable: true,
      bonusActionAvailable: true,
      movementRemaining: 30
    };

    // Update encounter with new turn, round, and proper state management
    this.db.prepare(
        `UPDATE encounters
         SET current_turn = ?, current_round = ?, currentState = ?, currentActorActions = ?
         WHERE id = ?`
    ).run(nextTurnOrder, encounter.current_round, 'TURN_STARTED', JSON.stringify(initialActions), encounterId);
    
    // The nextParticipant object already contains all necessary details from getEncounterParticipants
    return nextParticipant;
  }

  endEncounter(id: number, outcome: string = 'completed') {
    const stmt = this.db.prepare(`
      UPDATE encounters 
      SET status = ?, ended_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    stmt.run(outcome, id);
  }

  applyDamage(targetType: string, targetId: number, damage: number) {
    let stmt;
    
    if (targetType === 'character') {
      stmt = this.db.prepare(`
        UPDATE characters
        SET current_hp = MAX(0, current_hp - ?)
        WHERE id = ?
      `);
      stmt.run(damage, targetId);
      const character = this.getCharacter(targetId) as any;
      if (character && character.current_hp <= 0) {
        // Character is incapacitated, mark as inactive in encounters
        const activeEncounters = this.db.prepare(`
          SELECT encounter_id FROM encounter_participants
          WHERE participant_type = 'character' AND participant_id = ? AND is_active = TRUE
        `).all(targetId) as { encounter_id: number }[];

        for (const enc of activeEncounters) {
          this.db.prepare(`
            UPDATE encounter_participants
            SET is_active = FALSE
            WHERE participant_type = 'character' AND participant_id = ? AND encounter_id = ?
          `).run(targetId, enc.encounter_id);
          this.updateInitiativeOrder(enc.encounter_id); // Recalculate initiative order
        }
      }
      return character;

    } else if (targetType === 'npc') {
      stmt = this.db.prepare(`
        UPDATE npcs
        SET current_hp = MAX(0, current_hp - ?),
            is_alive = CASE WHEN current_hp - ? <= 0 THEN FALSE ELSE TRUE END
        WHERE id = ?
      `);
      stmt.run(damage, damage, targetId);
      
      const npc = this.getNPC(targetId) as any;
      if (npc && !npc.is_alive) {
         // NPC died, mark as inactive in encounters
        const activeEncounters = this.db.prepare(`
          SELECT encounter_id FROM encounter_participants
          WHERE participant_type = 'npc' AND participant_id = ? AND is_active = TRUE
        `).all(targetId) as { encounter_id: number }[];

        for (const enc of activeEncounters) {
          this.db.prepare(`
            UPDATE encounter_participants
            SET is_active = FALSE
            WHERE participant_type = 'npc' AND participant_id = ? AND encounter_id = ?
          `).run(targetId, enc.encounter_id);
          this.updateInitiativeOrder(enc.encounter_id); // Recalculate initiative order
        }
      }
      return npc;
    }
    
    // Should not reach here if targetType is valid
    return null;
  }

  // Quest Operations
  addQuest(data: {
    title: string;
    description: string;
    objectives: Record<string, any>[] | string[]; // Array of objective strings or objects
    rewards: Record<string, any>; // e.g., { gold: 100, experience: 50, items: ["item_id_1"] }
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO quests (title, description, objectives, rewards)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.title,
      data.description,
      JSON.stringify(data.objectives),
      JSON.stringify(data.rewards)
    );
    return this.getQuestById(result.lastInsertRowid as number);
  }

  getQuestById(id: number): Quest | null {
    const stmt = this.db.prepare('SELECT * FROM quests WHERE id = ?');
    const quest = stmt.get(id) as Quest | undefined;
    if (quest) {
      // objectives and rewards are stored as JSON, parse them if needed by caller
      // For now, return as stored. Parsing can be done in handler or by caller.
    }
    return quest || null;
  }

  assignQuestToCharacter(characterId: number, questId: number, status: 'active' | 'completed' | 'failed' = 'active') {
    // Check if character and quest exist
    const character = this.getCharacter(characterId);
    if (!character) throw new Error(`Character with ID ${characterId} not found.`);
    const quest = this.getQuestById(questId);
    if (!quest) throw new Error(`Quest with ID ${questId} not found.`);

    const stmt = this.db.prepare(`
      INSERT INTO character_quests (character_id, quest_id, status, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(character_id, quest_id) DO UPDATE SET
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
      WHERE character_quests.status != 'completed' AND character_quests.status != 'failed'
            OR excluded.status = 'active' -- Allow re-activating if previously completed/failed for some reason
    `);
    const result = stmt.run(characterId, questId, status);
    if (result.changes > 0) {
        // Need to get the ID of the inserted/updated row.
        // If it was an insert, result.lastInsertRowid works.
        // If it was an update due to conflict, we need to query it.
        const cqStmt = this.db.prepare('SELECT id FROM character_quests WHERE character_id = ? AND quest_id = ?');
        const cq = cqStmt.get(characterId, questId) as { id: number } | undefined;
        return cq ? this.getCharacterQuestById(cq.id) : null;
    }
    // If no changes, it means the quest was already completed/failed and we tried to assign it as active again without override.
    // Or some other edge case. Return existing record.
    const cqStmt = this.db.prepare('SELECT id FROM character_quests WHERE character_id = ? AND quest_id = ?');
    const cq = cqStmt.get(characterId, questId) as { id: number } | undefined;
    return cq ? this.getCharacterQuestById(cq.id) : null;
  }

  getCharacterQuestById(characterQuestId: number): CharacterQuest | null {
    const stmt = this.db.prepare(`
      SELECT cq.*, q.title, q.description, q.objectives, q.rewards
      FROM character_quests cq
      JOIN quests q ON cq.quest_id = q.id
      WHERE cq.id = ?
    `);
    const cq = stmt.get(characterQuestId) as CharacterQuest | undefined;
    if (cq) {
      // Parse JSON fields
      if (cq.objectives) cq.objectives = JSON.parse(cq.objectives as string);
      if (cq.rewards) cq.rewards = JSON.parse(cq.rewards as string);
      if (cq.progress) cq.progress = JSON.parse(cq.progress as string);
    }
    return cq || null;
  }

  getCharacterActiveQuests(characterId: number): CharacterQuest[] {
    const stmt = this.db.prepare(`
      SELECT cq.*, q.title, q.description, q.objectives, q.rewards
      FROM character_quests cq
      JOIN quests q ON cq.quest_id = q.id
      WHERE cq.character_id = ? AND cq.status = 'active'
      ORDER BY cq.assigned_at DESC
    `);
    const quests = stmt.all(characterId) as CharacterQuest[];
    return quests.map(q => {
      if (q.objectives) q.objectives = JSON.parse(q.objectives as string);
      if (q.rewards) q.rewards = JSON.parse(q.rewards as string);
      if (q.progress) q.progress = JSON.parse(q.progress as string);
      return q;
    });
  }

  updateCharacterQuestStatus(characterQuestId: number, status: 'active' | 'completed' | 'failed', progress?: Record<string, any> | null) {
    const fieldsToUpdate: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [status];

    if (progress !== undefined) {
      fieldsToUpdate.push('progress = ?');
      values.push(progress ? JSON.stringify(progress) : null);
    }
    values.push(characterQuestId);

    const stmt = this.db.prepare(`
      UPDATE character_quests
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = ?
    `);
    const result = stmt.run(...values);
    if (result.changes > 0) {
      return this.getCharacterQuestById(characterQuestId);
    }
    return null; // Or throw error if not found/not updated
  }

  // Spell Slot Management
  setSpellSlots(characterId: number, spellLevel: number, totalSlots: number, usedSlots: number = 0) {
    const stmt = this.db.prepare(`
      INSERT INTO character_spell_slots (character_id, spell_level, total_slots, used_slots)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(character_id, spell_level) DO UPDATE SET
      total_slots = excluded.total_slots,
      used_slots = excluded.used_slots
    `);
    stmt.run(characterId, spellLevel, totalSlots, usedSlots);
  }

  getSpellSlots(characterId: number) {
    const stmt = this.db.prepare(`
      SELECT * FROM character_spell_slots
      WHERE character_id = ?
      ORDER BY spell_level
    `);
    return stmt.all(characterId);
  }

  useSpellSlot(characterId: number, spellLevel: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE character_spell_slots
      SET used_slots = used_slots + 1
      WHERE character_id = ? AND spell_level = ? AND used_slots < total_slots
    `);
    const result = stmt.run(characterId, spellLevel);
    return result.changes > 0;
  }

  recoverSpellSlot(characterId: number, spellLevel: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE character_spell_slots
      SET used_slots = MAX(0, used_slots - 1)
      WHERE character_id = ? AND spell_level = ?
    `);
    const result = stmt.run(characterId, spellLevel);
    return result.changes > 0;
  }

  resetSpellSlots(characterId: number, spellLevel?: number) {
    if (spellLevel !== undefined) {
      const stmt = this.db.prepare(`
        UPDATE character_spell_slots
        SET used_slots = 0
        WHERE character_id = ? AND spell_level = ?
      `);
      stmt.run(characterId, spellLevel);
    } else {
      const stmt = this.db.prepare(`
        UPDATE character_spell_slots
        SET used_slots = 0
        WHERE character_id = ?
      `);
      stmt.run(characterId);
    }
  }

  // Character Spell Management
  addSpell(characterId: number, data: {
    spell_name: string;
    spell_level: number;
    is_prepared?: boolean;
    is_known?: boolean;
    source?: string;
    description?: string;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO character_spells (
        character_id, spell_name, spell_level, is_prepared, is_known, source, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      characterId,
      data.spell_name,
      data.spell_level,
      data.is_prepared !== undefined ? (data.is_prepared ? 1 : 0) : 1,
      data.is_known !== undefined ? (data.is_known ? 1 : 0) : 1,
      data.source || 'class',
      data.description || null
    );

    return { id: result.lastInsertRowid, ...data };
  }

  removeSpell(spellId: number) {
    const stmt = this.db.prepare('DELETE FROM character_spells WHERE id = ?');
    stmt.run(spellId);
  }

  updateSpellStatus(spellId: number, updates: { is_prepared?: boolean; is_known?: boolean }) {
    const fields = [];
    const values = [];
    
    if (updates.is_prepared !== undefined) {
      fields.push('is_prepared = ?');
      values.push(updates.is_prepared ? 1 : 0);
    }
    
    if (updates.is_known !== undefined) {
      fields.push('is_known = ?');
      values.push(updates.is_known ? 1 : 0);
    }
    
    if (fields.length === 0) return;
    
    values.push(spellId);
    const stmt = this.db.prepare(`UPDATE character_spells SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  getCharacterSpells(characterId: number, filters?: {
    spell_level?: number;
    is_prepared?: boolean;
    is_known?: boolean;
    source?: string;
  }) {
    let query = 'SELECT * FROM character_spells WHERE character_id = ?';
    const params: any[] = [characterId];
    
    if (filters) {
      if (filters.spell_level !== undefined) {
        query += ' AND spell_level = ?';
        params.push(filters.spell_level);
      }
      if (filters.is_prepared !== undefined) {
        query += ' AND is_prepared = ?';
        params.push(filters.is_prepared ? 1 : 0);
      }
      if (filters.is_known !== undefined) {
        query += ' AND is_known = ?';
        params.push(filters.is_known ? 1 : 0);
      }
      if (filters.source !== undefined) {
        query += ' AND source = ?';
        params.push(filters.source);
      }
    }
    
    query += ' ORDER BY spell_level, spell_name';
    
    const stmt = this.db.prepare(query);
    const spells = stmt.all(...params);
    
    return spells.map((spell: any) => ({
      ...spell,
      is_prepared: Boolean(spell.is_prepared),
      is_known: Boolean(spell.is_known)
    }));
  }

  getSpell(spellId: number) {
    const stmt = this.db.prepare('SELECT * FROM character_spells WHERE id = ?');
    const spell = stmt.get(spellId) as any;
    
    if (spell) {
      return {
        ...spell,
        is_prepared: Boolean(spell.is_prepared),
        is_known: Boolean(spell.is_known)
      };
    }
    
    return null;
  }

  // Initialize spell slots for a character based on class and level
  initializeSpellcasting(characterId: number, characterClass: string, level: number, spellcastingAbility?: string) {
    // Spellcasting progression by class
    const spellSlotsByClass: Record<string, Record<number, number[]>> = {
      'Wizard': {
        1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1],
        10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
        15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
        19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
      },
      'Sorcerer': {
        1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1],
        10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
        15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
        19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
      },
      'Cleric': {
        1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1],
        10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
        15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
        19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
      },
      'Druid': {
        1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1],
        10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
        15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
        19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
      },
      'Bard': {
        1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1],
        10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
        15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
        19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
      },
      'Warlock': {
        1: [1], 2: [2], 3: [2], 4: [2], 5: [2], 6: [2], 7: [2], 8: [2], 9: [2], 10: [2],
        11: [3], 12: [3], 13: [3], 14: [3], 15: [3], 16: [3], 17: [4], 18: [4], 19: [4], 20: [4]
      },
      'Ranger': {
        2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3], 9: [4, 3, 2], 10: [4, 3, 2],
        11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1], 14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2],
        17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2]
      },
      'Paladin': {
        2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3], 9: [4, 3, 2], 10: [4, 3, 2],
        11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1], 14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2],
        17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2]
      }
    };

    // Default spellcasting abilities by class
    const defaultSpellcastingAbilities: Record<string, string> = {
      'Wizard': 'Intelligence',
      'Sorcerer': 'Charisma',
      'Cleric': 'Wisdom',
      'Druid': 'Wisdom',
      'Bard': 'Charisma',
      'Warlock': 'Charisma',
      'Ranger': 'Wisdom',
      'Paladin': 'Charisma'
    };

    const slots = spellSlotsByClass[characterClass]?.[level];
    if (!slots) return; // Not a spellcasting class or level

    // Update character spellcasting ability
    const ability = spellcastingAbility || defaultSpellcastingAbilities[characterClass];
    if (ability) {
      // Get character's ability score to calculate spell save DC and attack bonus
      const character = this.getCharacter(characterId) as any;
      if (character) {
        const abilityScore = character[ability.toLowerCase()] || 10;
        const abilityMod = Math.floor((abilityScore - 10) / 2);
        const profBonus = Math.ceil(level / 4) + 1;
        const spellSaveDC = 8 + profBonus + abilityMod;
        const spellAttackBonus = profBonus + abilityMod;

        this.updateCharacter(characterId, {
          spellcasting_ability: ability,
          spell_save_dc: spellSaveDC,
          spell_attack_bonus: spellAttackBonus
        });
      }
    }

    // Set spell slots for each level
    slots.forEach((slotCount, index) => {
      const spellLevel = index + 1;
      if (characterClass === 'Warlock') {
        // Warlock slots are always at highest level
        const warlockSpellLevel = Math.min(5, Math.ceil(level / 2));
        this.setSpellSlots(characterId, warlockSpellLevel, slotCount);
      } else {
        this.setSpellSlots(characterId, spellLevel, slotCount);
      }
    });
  }

  // Stronghold Management Methods
  createStronghold(characterId: number, data: {
    name: string;
    location: string;
    stronghold_type?: string;
    level?: number;
    defense_bonus?: number;
    prosperity_level?: number;
    description?: string;
    special_features?: Record<string, any>;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO strongholds (
        character_id, name, location, stronghold_type, level, defense_bonus,
        prosperity_level, description, special_features
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      characterId,
      data.name,
      data.location,
      data.stronghold_type || 'Keep',
      data.level || 1,
      data.defense_bonus || 0,
      data.prosperity_level || 1,
      data.description || null,
      data.special_features ? JSON.stringify(data.special_features) : null
    );

    return this.getStronghold(result.lastInsertRowid as number);
  }

  getStronghold(strongholdId: number) {
    const stmt = this.db.prepare('SELECT * FROM strongholds WHERE id = ?');
    const stronghold = stmt.get(strongholdId) as any;
    
    if (stronghold && stronghold.special_features) {
      stronghold.special_features = JSON.parse(stronghold.special_features);
    }
    
    return stronghold;
  }

  getCharacterStrongholds(characterId: number) {
    const stmt = this.db.prepare('SELECT * FROM strongholds WHERE character_id = ? ORDER BY created_at');
    const strongholds = stmt.all(characterId);
    
    return strongholds.map((stronghold: any) => {
      if (stronghold.special_features) {
        stronghold.special_features = JSON.parse(stronghold.special_features);
      }
      return stronghold;
    });
  }

  updateStronghold(strongholdId: number, updates: Record<string, any>) {
    // Handle JSON fields
    if (updates.special_features && typeof updates.special_features === 'object') {
      updates.special_features = JSON.stringify(updates.special_features);
    }
    
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const stmt = this.db.prepare(`
      UPDATE strongholds
      SET ${setClause}, last_updated = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(...values, strongholdId);
    return this.getStronghold(strongholdId);
  }

  // Facility Management
  addFacility(strongholdId: number, data: {
    facility_type: string;
    name: string;
    level?: number;
    construction_cost?: number;
    upkeep_cost?: number;
    build_time_weeks?: number;
    status?: string;
    benefits?: Record<string, any>;
    description?: string;
  }) {
    // Get facility type template for defaults
    const template = this.getFacilityType(data.facility_type);
    
    const stmt = this.db.prepare(`
      INSERT INTO facilities (
        stronghold_id, facility_type, name, level, construction_cost,
        upkeep_cost, build_time_weeks, status, benefits, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      strongholdId,
      data.facility_type,
      data.name,
      data.level || 1,
      data.construction_cost || template?.base_cost || 0,
      data.upkeep_cost || template?.base_upkeep || 0,
      data.build_time_weeks || template?.build_time_weeks || 1,
      data.status || 'active',
      data.benefits ? JSON.stringify(data.benefits) :
        (template?.benefits ? template.benefits : null),
      data.description || template?.description || null
    );

    return this.getFacility(result.lastInsertRowid as number);
  }

  getFacility(facilityId: number) {
    const stmt = this.db.prepare('SELECT * FROM facilities WHERE id = ?');
    const facility = stmt.get(facilityId) as any;
    
    if (facility && facility.benefits) {
      facility.benefits = JSON.parse(facility.benefits);
    }
    
    return facility;
  }

  getStrongholdFacilities(strongholdId: number) {
    const stmt = this.db.prepare('SELECT * FROM facilities WHERE stronghold_id = ? ORDER BY facility_type, name');
    const facilities = stmt.all(strongholdId);
    
    return facilities.map((facility: any) => {
      if (facility.benefits) {
        facility.benefits = JSON.parse(facility.benefits);
      }
      return facility;
    });
  }

  upgradeFacility(facilityId: number, newLevel: number, upgradeCost?: number) {
    const facility = this.getFacility(facilityId);
    if (!facility) throw new Error('Facility not found');
    
    const template = this.getFacilityType(facility.facility_type);
    const baseCost = template?.base_cost || 0;
    const levelMultiplier = Math.pow(1.5, newLevel - 1);
    const totalCost = upgradeCost || Math.floor(baseCost * levelMultiplier);
    
    const stmt = this.db.prepare(`
      UPDATE facilities
      SET level = ?, construction_cost = construction_cost + ?
      WHERE id = ?
    `);
    
    stmt.run(newLevel, totalCost, facilityId);
    return this.getFacility(facilityId);
  }

  assignHirelingToFacility(facilityId: number, hirelingId: number) {
    const stmt = this.db.prepare('UPDATE facilities SET assigned_hireling_id = ? WHERE id = ?');
    stmt.run(hirelingId, facilityId);
    
    // Update hireling status
    this.updateHireling(hirelingId, { current_task: `Assigned to facility ${facilityId}` });
  }

  getFacilityType(typeName: string) {
    const stmt = this.db.prepare('SELECT * FROM facility_types WHERE type_name = ?');
    const facilityType = stmt.get(typeName) as any;
    
    if (facilityType) {
      // Parse JSON fields
      if (facilityType.prerequisites) facilityType.prerequisites = JSON.parse(facilityType.prerequisites);
      if (facilityType.benefits) facilityType.benefits = JSON.parse(facilityType.benefits);
      if (facilityType.staff_requirements) facilityType.staff_requirements = JSON.parse(facilityType.staff_requirements);
      if (facilityType.upgrade_path) facilityType.upgrade_path = JSON.parse(facilityType.upgrade_path);
    }
    
    return facilityType;
  }

  listFacilityTypes(category?: string) {
    let query = 'SELECT * FROM facility_types';
    const params: any[] = [];
    
    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY category, type_name';
    
    const stmt = this.db.prepare(query);
    const types = stmt.all(...params);
    
    return types.map((type: any) => {
      if (type.prerequisites) type.prerequisites = JSON.parse(type.prerequisites);
      if (type.benefits) type.benefits = JSON.parse(type.benefits);
      if (type.staff_requirements) type.staff_requirements = JSON.parse(type.staff_requirements);
      if (type.upgrade_path) type.upgrade_path = JSON.parse(type.upgrade_path);
      return type;
    });
  }

  // Hireling Management
  recruitHireling(characterId: number, data: {
    name: string;
    hireling_type: string;
    profession: string;
    tier?: string;
    daily_wage_sp?: number;
    skill_bonus?: number;
    abilities?: Record<string, any>;
    notes?: string;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO hirelings (
        character_id, name, hireling_type, profession, tier,
        daily_wage_sp, skill_bonus, abilities, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      characterId,
      data.name,
      data.hireling_type,
      data.profession,
      data.tier || 'laborers',
      data.daily_wage_sp || 2,
      data.skill_bonus || 0,
      data.abilities ? JSON.stringify(data.abilities) : null,
      data.notes || null
    );

    return this.getHireling(result.lastInsertRowid as number);
  }

  getHireling(hirelingId: number) {
    const stmt = this.db.prepare('SELECT * FROM hirelings WHERE id = ?');
    const hireling = stmt.get(hirelingId) as any;
    
    if (hireling && hireling.abilities) {
      hireling.abilities = JSON.parse(hireling.abilities);
    }
    
    return hireling;
  }

  getCharacterHirelings(characterId: number, status?: string) {
    let query = 'SELECT * FROM hirelings WHERE character_id = ?';
    const params: any[] = [characterId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY tier, profession, name';
    
    const stmt = this.db.prepare(query);
    const hirelings = stmt.all(...params);
    
    return hirelings.map((hireling: any) => {
      if (hireling.abilities) {
        hireling.abilities = JSON.parse(hireling.abilities);
      }
      return hireling;
    });
  }

  updateHireling(hirelingId: number, updates: Record<string, any>) {
    if (updates.abilities && typeof updates.abilities === 'object') {
      updates.abilities = JSON.stringify(updates.abilities);
    }
    
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const stmt = this.db.prepare(`UPDATE hirelings SET ${setClause} WHERE id = ?`);
    
    stmt.run(...values, hirelingId);
    return this.getHireling(hirelingId);
  }

  assignHireling(hirelingId: number, task: string) {
    const stmt = this.db.prepare('UPDATE hirelings SET current_task = ?, status = ? WHERE id = ?');
    stmt.run(task, 'busy', hirelingId);
    return this.getHireling(hirelingId);
  }

  manageLoyalty(hirelingId: number, loyaltyChange: number, reason?: string) {
    const hireling = this.getHireling(hirelingId);
    if (!hireling) throw new Error('Hireling not found');
    
    const newLoyalty = Math.max(0, Math.min(100, hireling.loyalty_score + loyaltyChange));
    
    const stmt = this.db.prepare(`
      UPDATE hirelings
      SET loyalty_score = ?, notes = COALESCE(notes, '') || ?
      WHERE id = ?
    `);
    
    const noteUpdate = reason ? `\n[${new Date().toISOString()}] Loyalty ${loyaltyChange > 0 ? '+' : ''}${loyaltyChange}: ${reason}` : '';
    stmt.run(newLoyalty, noteUpdate, hirelingId);
    
    return this.getHireling(hirelingId);
  }

  calculateWeeklyWages(characterId: number) {
    const stmt = this.db.prepare(`
      SELECT SUM(daily_wage_sp * 7) as total_weekly_wages
      FROM hirelings
      WHERE character_id = ? AND status IN ('active', 'busy')
    `);
    
    const result = stmt.get(characterId) as any;
    return result?.total_weekly_wages || 0;
  }

  // Business Management
  establishBusiness(strongholdId: number, data: {
    name: string;
    business_type: string;
    investment_cost?: number;
    weekly_income?: number;
    risk_level?: string;
    employee_count?: number;
    description?: string;
    special_rules?: Record<string, any>;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO businesses (
        stronghold_id, name, business_type, investment_cost, weekly_income,
        risk_level, employee_count, description, special_rules
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      strongholdId,
      data.name,
      data.business_type,
      data.investment_cost || 0,
      data.weekly_income || 0,
      data.risk_level || 'low',
      data.employee_count || 0,
      data.description || null,
      data.special_rules ? JSON.stringify(data.special_rules) : null
    );

    return this.getBusiness(result.lastInsertRowid as number);
  }

  getBusiness(businessId: number) {
    const stmt = this.db.prepare('SELECT * FROM businesses WHERE id = ?');
    const business = stmt.get(businessId) as any;
    
    if (business && business.special_rules) {
      business.special_rules = JSON.parse(business.special_rules);
    }
    
    return business;
  }

  getStrongholdBusinesses(strongholdId: number) {
    const stmt = this.db.prepare('SELECT * FROM businesses WHERE stronghold_id = ? ORDER BY business_type, name');
    const businesses = stmt.all(strongholdId);
    
    return businesses.map((business: any) => {
      if (business.special_rules) {
        business.special_rules = JSON.parse(business.special_rules);
      }
      return business;
    });
  }

  processWeeklyIncome(characterId: number, weekNumber: number) {
    // Get all strongholds for character
    const strongholds = this.getCharacterStrongholds(characterId);
    let totalIncome = 0;
    let totalUpkeep = 0;
    let totalWages = 0;
    let eventsGenerated = 0;
    const processingLog: any[] = [];

    for (const stronghold of strongholds) {
      // Process businesses for this stronghold
      const businesses = this.getStrongholdBusinesses(stronghold.id);
      
      for (const business of businesses) {
        // Calculate income with market conditions
        const baseIncome = business.weekly_income;
        const marketMultiplier = this.getMarketMultiplier(business.market_conditions);
        const income = Math.floor(baseIncome * marketMultiplier * business.prosperity_modifier);
        
        totalIncome += income;
        processingLog.push({
          type: 'business_income',
          business_name: business.name,
          base_income: baseIncome,
          market_conditions: business.market_conditions,
          final_income: income
        });
      }
      
      // Calculate facility upkeep
      const facilities = this.getStrongholdFacilities(stronghold.id);
      for (const facility of facilities) {
        if (facility.status === 'active') {
          totalUpkeep += facility.upkeep_cost;
          processingLog.push({
            type: 'facility_upkeep',
            facility_name: facility.name,
            upkeep: facility.upkeep_cost
          });
        }
      }
    }

    // Calculate hireling wages
    totalWages = this.calculateWeeklyWages(characterId);
    
    // Store weekly processing record
    const stmt = this.db.prepare(`
      INSERT INTO weekly_processing (
        character_id, week_number, wages_paid, business_income, upkeep_costs,
        events_generated, processing_log
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(character_id, week_number) DO UPDATE SET
      wages_paid = excluded.wages_paid,
      business_income = excluded.business_income,
      upkeep_costs = excluded.upkeep_costs,
      events_generated = excluded.events_generated,
      processing_log = excluded.processing_log,
      processing_date = CURRENT_TIMESTAMP
    `);

    stmt.run(
      characterId,
      weekNumber,
      totalWages,
      totalIncome,
      totalUpkeep,
      eventsGenerated,
      JSON.stringify(processingLog)
    );

    // Update character's gold
    const netChange = totalIncome - totalUpkeep - totalWages;
    this.updateCharacter(characterId, {
      gold: Math.max(0, (this.getCharacter(characterId) as any).gold + netChange)
    });

    return {
      totalIncome,
      totalUpkeep,
      totalWages,
      netChange,
      processingLog
    };
  }

  private getMarketMultiplier(conditions: string): number {
    const multipliers: Record<string, number> = {
      'poor': 0.7,
      'normal': 1.0,
      'good': 1.3,
      'excellent': 1.6
    };
    return multipliers[conditions] || 1.0;
  }

  // Event System
  generateStrongholdEvent(strongholdId: number, eventType?: string) {
    const events = [
      {
        type: 'random',
        title: 'Merchant Caravan',
        description: 'A merchant caravan requests permission to rest at your stronghold.',
        resolution_options: JSON.stringify([
          { option: 'Allow them to stay', effect: 'Gain 2d6 x 10 gp, +5 prosperity' },
          { option: 'Charge a fee', effect: 'Gain 50 gp, no prosperity change' },
          { option: 'Turn them away', effect: 'No change' }
        ])
      },
      {
        type: 'opportunity',
        title: 'Rare Materials Found',
        description: 'Workers have discovered valuable materials during construction.',
        resolution_options: JSON.stringify([
          { option: 'Sell immediately', effect: 'Gain 100 gp' },
          { option: 'Use for construction', effect: '25% discount on next facility' },
          { option: 'Store for later', effect: 'Materials added to inventory' }
        ])
      },
      {
        type: 'disaster',
        title: 'Storm Damage',
        description: 'A severe storm has damaged some of your facilities.',
        resolution_options: JSON.stringify([
          { option: 'Repair immediately', effect: 'Pay 2d6 x 10 gp' },
          { option: 'Temporary repairs', effect: 'Pay 1d6 x 10 gp, -1 facility level until repaired' },
          { option: 'Leave damaged', effect: 'Facility inactive until repaired' }
        ])
      }
    ];

    const randomEvent = events[Math.floor(Math.random() * events.length)];
    
    const stmt = this.db.prepare(`
      INSERT INTO stronghold_events (
        stronghold_id, event_type, title, description, resolution_options,
        resolution_deadline
      ) VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))
    `);

    const result = stmt.run(
      strongholdId,
      eventType || randomEvent.type,
      randomEvent.title,
      randomEvent.description,
      randomEvent.resolution_options
    );

    return this.getStrongholdEvent(result.lastInsertRowid as number);
  }

  getStrongholdEvent(eventId: number) {
    const stmt = this.db.prepare('SELECT * FROM stronghold_events WHERE id = ?');
    const event = stmt.get(eventId) as any;
    
    if (event) {
      if (event.consequences) event.consequences = JSON.parse(event.consequences);
      if (event.resolution_options) event.resolution_options = JSON.parse(event.resolution_options);
    }
    
    return event;
  }

  getStrongholdEvents(strongholdId: number, status?: string) {
    let query = 'SELECT * FROM stronghold_events WHERE stronghold_id = ?';
    const params: any[] = [strongholdId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY event_date DESC';
    
    const stmt = this.db.prepare(query);
    const events = stmt.all(...params);
    
    return events.map((event: any) => {
      if (event.consequences) event.consequences = JSON.parse(event.consequences);
      if (event.resolution_options) event.resolution_options = JSON.parse(event.resolution_options);
      return event;
    });
  }

  resolveStrongholdEvent(eventId: number, playerChoice: string, outcome?: string) {
    const stmt = this.db.prepare(`
      UPDATE stronghold_events
      SET status = 'resolved', player_choice = ?, outcome = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(playerChoice, outcome || null, eventId);
    return this.getStrongholdEvent(eventId);
  }

  close() {
    this.db.close();
  }
}
