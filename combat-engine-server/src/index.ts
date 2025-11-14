import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SpatialEngine } from './spatial-engine.js';
import { 
  BaseAction, 
  ReactionAction, 
  LegendaryAction, 
  ActionResult, 
  ActionEconomy,
  EnhancedCreature,
  STANDARD_ACTIONS,
  STANDARD_REACTIONS 
} from './action-types.js';

// Enhanced combat state storage
let combatLog: string[] = [];
let spatialEngine: SpatialEngine = new SpatialEngine();
let activeReactions: Map<string, ReactionAction[]> = new Map();
let pendingReactions: any[] = [];

// Enhanced dice rolling with multiple roll types
function rollDice(notation: string): { total: number, rolls: number[], modifier: number, kept?: number[] } {
  // Check for keep highest/lowest notation (e.g., 2d20kh1, 2d20kl1)
  const keepMatch = notation.match(/(\d+)d(\d+)(k[hl]\d+)?([+-]\d+)?/);
  
  if (keepMatch) {
    const count = parseInt(keepMatch[1]);
    const sides = parseInt(keepMatch[2]);
    const keepRule = keepMatch[3]; // e.g., 'kh1' or 'kl1'
    const modifier = parseInt(keepMatch[4] || '0');
    
    // Roll all dice
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    
    let kept = rolls;
    if (keepRule) {
      const keepType = keepRule[1]; // 'h' for highest, 'l' for lowest
      const keepCount = parseInt(keepRule.substring(2));
      
      // Sort and keep the appropriate dice
      const sorted = [...rolls].sort((a, b) => b - a); // descending order
      if (keepType === 'h') {
        kept = sorted.slice(0, keepCount);
      } else if (keepType === 'l') {
        kept = sorted.slice(-keepCount);
      }
    }
    
    const total = kept.reduce((sum, roll) => sum + roll, 0) + modifier;
    
    return { total, rolls, modifier, kept: keepRule ? kept : undefined };
  }
  
  // Fallback to simple notation
  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) throw new Error('Invalid dice notation');
  
  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const modifier = parseInt(match[3] || '0');
  
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;
  
  return { total, rolls, modifier };
}

// Enhanced action execution
function executeAction(action: BaseAction, actor: any, targets: any[], context: any): ActionResult {
  const rolls: any[] = [];
  let damage: any[] = [];
  let healing = 0;
  const effectsApplied: any[] = [];
  const economyConsumed: any = {};

  // Basic action execution logic
  if (action.actionType === 'action') {
    economyConsumed.actions = 1;
  } else if (action.actionType === 'bonus_action') {
    economyConsumed.bonusActions = 1;
  } else if (action.actionType === 'reaction') {
    economyConsumed.reactions = 1;
  } else if (action.actionType === 'legendary') {
    economyConsumed.legendaryActions = (action as LegendaryAction).cost || 1;
  }

  // Log action
  const actionLog = `${actor.name} uses ${action.name}`;
  combatLog.push(actionLog);

  return {
    success: true,
    rolls,
    damage,
    healing: healing > 0 ? healing : undefined,
    effectsApplied,
    targets: targets.map(t => t.id || t.name),
    description: actionLog,
    economyConsumed
  };
}

// Trigger reaction system
function triggerReaction(triggerType: string, triggeringCreature: string, targetCreature?: string): any[] {
  const availableReactions = [];
  
  // Check for opportunity attacks
  if (triggerType === 'creature_moves' && targetCreature) {
    const distance = spatialEngine.getDistance(
      spatialEngine.getBattlefieldState().creatures.get(triggeringCreature)?.position || { x: 0, y: 0, z: 0 },
      spatialEngine.getBattlefieldState().creatures.get(targetCreature)?.position || { x: 0, y: 0, z: 0 }
    );
    
    if (distance <= 5) { // Within reach
      availableReactions.push({
        type: 'opportunity_attack',
        reactor: targetCreature,
        trigger: triggeringCreature,
        action: STANDARD_REACTIONS.opportunity_attack
      });
    }
  }
  
  return availableReactions;
}

// Create server
const server = new Server({
  name: 'rpg-combat-engine-server',
  version: '2.0.0',
}, {
  capabilities: { 
    tools: {},
  },
});

// Enhanced tool definitions
const toolDefinitions = [
  // Original dice tools
  {
    name: 'roll_dice',
    description: 'Roll dice with D&D notation. Supports advantage/disadvantage: 2d20kh1 (keep highest), 2d20kl1 (keep lowest)',
    inputSchema: {
      type: 'object',
      properties: {
        notation: { 
          type: 'string', 
          description: 'Dice notation: 1d20+5, 3d6, 2d20kh1+3 (advantage), 2d20kl1+3 (disadvantage)' 
        },
        reason: { 
          type: 'string', 
          description: 'What the roll is for' 
        }
      },
      required: ['notation']
    }
  },
  {
    name: 'roll_check',
    description: 'Roll an ability check or skill check',
    inputSchema: {
      type: 'object',
      properties: {
        character: { type: 'string' },
        ability: { type: 'string', description: 'Ability or skill name' },
        modifier: { type: 'number' },
        advantage: { type: 'boolean' },
        disadvantage: { type: 'boolean' },
        dc: { type: 'number', description: 'Difficulty Class (optional)' },
        bonus: { type: 'number', description: 'Additional bonus (e.g., from spells like Guidance)' }
      },
      required: ['character', 'ability', 'modifier']
    }
  },
  {
    name: 'attack_roll',
    description: 'Make an attack roll (pure dice calculation)',
    inputSchema: {
      type: 'object',
      properties: {
        attacker: { type: 'string' },
        target: { type: 'string' },
        modifier: { type: 'number' },
        advantage: { type: 'boolean' },
        disadvantage: { type: 'boolean' },
        bonus: { type: 'number', description: 'Additional bonus (e.g., from spells or magic items)' }
      },
      required: ['attacker', 'target', 'modifier']
    }
  },
  {
    name: 'initiative_roll',
    description: 'Roll initiative for combat',
    inputSchema: {
      type: 'object',
      properties: {
        character: { type: 'string' },
        modifier: { type: 'number' }
      },
      required: ['character', 'modifier']
    }
  },
  {
    name: 'damage_roll',
    description: 'Roll damage',
    inputSchema: {
      type: 'object',
      properties: {
        notation: { type: 'string' },
        damage_type: { type: 'string' },
        critical: { type: 'boolean' }
      },
      required: ['notation', 'damage_type']
    }
  },
  {
    name: 'saving_throw',
    description: 'Make a saving throw',
    inputSchema: {
      type: 'object',
      properties: {
        character: { type: 'string' },
        ability: { type: 'string' },
        dc: { type: 'number' },
        modifier: { type: 'number' },
        bonus: { type: 'number', description: 'Additional bonus (e.g., from spells like Guidance)' }
      },
      required: ['character', 'ability', 'dc', 'modifier']
    }
  },
  // Enhanced Action Economy Tools
  {
    name: 'use_reaction',
    description: 'Trigger and execute a reaction',
    inputSchema: {
      type: 'object',
      properties: {
        character: { type: 'string' },
        reaction_name: { type: 'string' },
        trigger_event: { type: 'string' },
        target: { type: 'string' }
      },
      required: ['character', 'reaction_name', 'trigger_event']
    }
  },
  {
    name: 'use_legendary_action',
    description: 'Execute a legendary action',
    inputSchema: {
      type: 'object',
      properties: {
        character: { type: 'string' },
        action_name: { type: 'string' },
        cost: { type: 'number', default: 1 },
        target: { type: 'string' }
      },
      required: ['character', 'action_name']
    }
  },
  {
    name: 'trigger_lair_action',
    description: 'Execute a lair action on initiative 20',
    inputSchema: {
      type: 'object',
      properties: {
        lair_name: { type: 'string' },
        action_name: { type: 'string' },
        description: { type: 'string' },
        area_effect: { type: 'object' }
      },
      required: ['lair_name', 'action_name', 'description']
    }
  },
  {
    name: 'execute_multiattack',
    description: 'Execute a creature\'s multiattack sequence',
    inputSchema: {
      type: 'object',
      properties: {
        attacker: { type: 'string' },
        targets: { type: 'array', items: { type: 'string' } },
        attack_sequence: { type: 'object' }
      },
      required: ['attacker', 'targets']
    }
  },
  // Spatial Combat Tools
  {
    name: 'initialize_battlefield',
    description: 'Set up a spatial battlefield with grid and terrain',
    inputSchema: {
      type: 'object',
      properties: {
        width: { type: 'number', description: 'Grid width in 5-foot squares' },
        height: { type: 'number', description: 'Grid height in 5-foot squares' },
        terrain: { 
          type: 'array', 
          items: { type: 'object' },
          description: 'Array of terrain features'
        }
      },
      required: ['width', 'height']
    }
  },
  {
    name: 'place_creature',
    description: 'Position a creature on the battlefield',
    inputSchema: {
      type: 'object',
      properties: {
        creature_id: { type: 'string' },
        name: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number', default: 0 },
        size: { 
          type: 'string',
          enum: ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'],
          default: 'medium'
        },
        speed: { type: 'number', default: 30 },
        reach: { type: 'number', default: 5 }
      },
      required: ['creature_id', 'name', 'x', 'y']
    }
  },
  {
    name: 'move_creature',
    description: 'Move a creature and validate movement with opportunity attacks',
    inputSchema: {
      type: 'object',
      properties: {
        creature_id: { type: 'string' },
        target_x: { type: 'number' },
        target_y: { type: 'number' },
        target_z: { type: 'number', default: 0 },
        speed: { type: 'number' }
      },
      required: ['creature_id', 'target_x', 'target_y', 'speed']
    }
  },
  {
    name: 'check_line_of_sight',
    description: 'Check line of sight and cover between two positions',
    inputSchema: {
      type: 'object',
      properties: {
        from_creature: { type: 'string' },
        to_creature: { type: 'string' }
      },
      required: ['from_creature', 'to_creature']
    }
  },
  {
    name: 'get_area_effect_targets',
    description: 'Get all creatures in an area of effect',
    inputSchema: {
      type: 'object',
      properties: {
        center_x: { type: 'number' },
        center_y: { type: 'number' },
        center_z: { type: 'number', default: 0 },
        shape: { 
          type: 'string',
          enum: ['sphere', 'cube', 'cone', 'line', 'cylinder']
        },
        size: { type: 'number' },
        direction: { type: 'number', description: 'For cones and lines (degrees)' }
      },
      required: ['center_x', 'center_y', 'shape', 'size']
    }
  },
  {
    name: 'get_tactical_summary',
    description: 'Get LLM-friendly description of the tactical situation',
    inputSchema: {
      type: 'object',
      properties: {
        creature_id: { type: 'string' }
      },
      required: ['creature_id']
    }
  },
  {
    name: 'check_flanking',
    description: 'Check if a creature is flanked for advantage',
    inputSchema: {
      type: 'object',
      properties: {
        creature_id: { type: 'string' }
      },
      required: ['creature_id']
    }
  },
  {
    name: 'check_height_advantage',
    description: 'Check if attacker has height advantage over target',
    inputSchema: {
      type: 'object',
      properties: {
        attacker_id: { type: 'string' },
        target_id: { type: 'string' }
      },
      required: ['attacker_id', 'target_id']
    }
  },
  // Combat log tools
  {
    name: 'get_combat_log',
    description: 'Get recent combat log entries',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 }
      }
    }
  },
  {
    name: 'clear_combat_log',
    description: 'Clear the combat log',
    inputSchema: { type: 'object', properties: {} }
  },
  // Human-readable battlefield description tools
  {
    name: 'describe_battlefield',
    description: 'Get a human-readable overview of the entire battlefield with terrain and creature positions',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'describe_detailed_tactical_situation',
    description: 'Get an enhanced narrative description of a creature\'s tactical situation',
    inputSchema: {
      type: 'object',
      properties: {
        creature_id: { type: 'string' }
      },
      required: ['creature_id']
    }
  },
  {
    name: 'generate_battlefield_map',
    description: 'Generate an ASCII map visualization of the battlefield',
    inputSchema: { type: 'object', properties: {} }
  },
  // Batch Operations for Efficiency
  {
    name: 'batch_place_creatures',
    description: 'Place multiple creatures on the battlefield at once',
    inputSchema: {
      type: 'object',
      properties: {
        creatures: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              creature_id: { type: 'string' },
              name: { type: 'string' },
              x: { type: 'number' },
              y: { type: 'number' },
              z: { type: 'number', default: 0 },
              size: {
                type: 'string',
                enum: ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'],
                default: 'medium'
              },
              speed: { type: 'number', default: 30 },
              reach: { type: 'number', default: 5 }
            },
            required: ['creature_id', 'name', 'x', 'y']
          }
        }
      },
      required: ['creatures']
    }
  },
  {
    name: 'batch_move_creatures',
    description: 'Move multiple creatures at once',
    inputSchema: {
      type: 'object',
      properties: {
        movements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              creature_id: { type: 'string' },
              target_x: { type: 'number' },
              target_y: { type: 'number' },
              target_z: { type: 'number', default: 0 },
              speed: { type: 'number' }
            },
            required: ['creature_id', 'target_x', 'target_y', 'speed']
          }
        }
      },
      required: ['movements']
    }
  },
  {
    name: 'batch_attack_rolls',
    description: 'Make multiple attack rolls at once',
    inputSchema: {
      type: 'object',
      properties: {
        attacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              attacker: { type: 'string' },
              target: { type: 'string' },
              modifier: { type: 'number' },
              advantage: { type: 'boolean' },
              disadvantage: { type: 'boolean' }
            },
            required: ['attacker', 'target', 'modifier']
          }
        }
      },
      required: ['attacks']
    }
  },
  {
    name: 'batch_damage_rolls',
    description: 'Roll damage for multiple attacks at once',
    inputSchema: {
      type: 'object',
      properties: {
        damage_rolls: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              notation: { type: 'string' },
              damage_type: { type: 'string' },
              critical: { type: 'boolean' },
              source: { type: 'string', description: 'What caused this damage (optional)' }
            },
            required: ['notation', 'damage_type']
          }
        }
      },
      required: ['damage_rolls']
    }
  },
  {
    name: 'batch_saving_throws',
    description: 'Make multiple saving throws at once',
    inputSchema: {
      type: 'object',
      properties: {
        saves: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              character: { type: 'string' },
              ability: { type: 'string' },
              dc: { type: 'number' },
              modifier: { type: 'number' }
            },
            required: ['character', 'ability', 'dc', 'modifier']
          }
        }
      },
      required: ['saves']
    }
  },
  {
    name: 'batch_initiative_rolls',
    description: 'Roll initiative for multiple characters at once',
    inputSchema: {
      type: 'object',
      properties: {
        characters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              character: { type: 'string' },
              modifier: { type: 'number' }
            },
            required: ['character', 'modifier']
          }
        }
      },
      required: ['characters']
    }
  }
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions
}));

// Enhanced tool request handler
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      // Original dice rolling tools (enhanced)
      case 'roll_dice': {
        const result = rollDice((args as any).notation);
        const reason = (args as any).reason || 'Dice roll';
        
        let output = `🎲 ${reason.toUpperCase()}\n\n`;
        output += `🎯 Roll: ${(args as any).notation}\n`;
        
        if (result.kept) {
          output += `🎲 Rolled: [${result.rolls.join(', ')}]\n`;
          output += `✨ Kept: [${result.kept.join(', ')}] ${result.kept.length === 1 ? (result.kept[0] === Math.max(...result.rolls) ? '(HIGHEST)' : '(LOWEST)') : ''}\n`;
        } else {
          output += `🎲 Rolled: [${result.rolls.join(', ')}]\n`;
        }
        
        if (result.modifier !== 0) {
          output += `➕ Modifier: ${result.modifier > 0 ? '+' : ''}${result.modifier}\n`;
        }
        
        output += `🏆 TOTAL: ${result.total}`;
        
        // Add special roll indicators
        if (result.rolls.includes(20)) output += ` 🎉`;
        if (result.rolls.includes(1)) output += ` 💥`;
        
        let logEntry: string;
        if (result.kept) {
          logEntry = `${reason}: ${(args as any).notation} = rolled [${result.rolls.join(', ')}], kept [${result.kept.join(', ')}]${result.modifier !== 0 ? (result.modifier > 0 ? '+' : '') + result.modifier : ''} = ${result.total}`;
        } else {
          logEntry = `${reason}: ${(args as any).notation} = ${result.rolls.join('+')}${result.modifier !== 0 ? (result.modifier > 0 ? '+' : '') + result.modifier : ''} = ${result.total}`;
        }
        
        combatLog.push(logEntry);
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      // Enhanced Action Economy Tools
      case 'use_reaction': {
        const { character, reaction_name, trigger_event, target } = args as any;
        
        // Execute the reaction
        const reactionResult = {
          character,
          reaction: reaction_name,
          trigger: trigger_event,
          target,
          success: true,
          description: `${character} uses ${reaction_name} in response to ${trigger_event}`
        };
        
        combatLog.push(reactionResult.description);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(reactionResult, null, 2) }]
        };
      }

      case 'use_legendary_action': {
        const { character, action_name, cost = 1, target } = args as any;
        
        const legendaryResult = {
          character,
          action: action_name,
          cost,
          target,
          success: true,
          description: `${character} spends ${cost} legendary action${cost > 1 ? 's' : ''} to use ${action_name}${target ? ` on ${target}` : ''}`
        };
        
        combatLog.push(legendaryResult.description);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(legendaryResult, null, 2) }]
        };
      }

      case 'trigger_lair_action': {
        const { lair_name, action_name, description, area_effect } = args as any;
        
        const lairResult = {
          lair: lair_name,
          action: action_name,
          initiative: 20,
          description,
          area_effect,
          success: true
        };
        
        combatLog.push(`Lair Action (Initiative 20): ${description}`);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(lairResult, null, 2) }]
        };
      }

      case 'execute_multiattack': {
        const { attacker, targets, attack_sequence } = args as any;
        
        const attacks = [];
        for (const target of targets) {
          const attackRoll = rollDice('1d20+5'); // Example attack
          const hit = attackRoll.total >= 15; // Example AC
          
          attacks.push({
            target,
            attackRoll: attackRoll.total,
            hit,
            damage: hit ? rollDice('1d8+3').total : 0
          });
        }
        
        const multiattackResult = {
          attacker,
          attacks,
          description: `${attacker} makes a multiattack against ${targets.length} target${targets.length > 1 ? 's' : ''}`
        };
        
        combatLog.push(multiattackResult.description);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(multiattackResult, null, 2) }]
        };
      }

      // Spatial Combat Tools
      case 'initialize_battlefield': {
        const { width, height, terrain = [] } = args as any;
        
        // Convert input terrain objects to proper TerrainFeature format
        const processedTerrain = terrain.map((t: any) => {
          const size = t.size || 1;
          return {
            type: t.type === 'debris' ? 'pillar' : t.type === 'cover' ? 'wall' : (t.type || 'wall'),
            position: { x: t.x || 0, y: t.y || 0, z: t.z || 0 },
            dimensions: {
              width: size,
              height: size,
              depth: t.depth || 5
            },
            blocksMovement: t.blocksMovement !== undefined ? t.blocksMovement : true,
            blocksLineOfSight: t.blocksLineOfSight !== undefined ? t.blocksLineOfSight : false,
            coverType: t.coverType || (t.type === 'cover' ? 'half' : 'none')
          };
        });
        
        spatialEngine.initializeBattlefield(width, height, processedTerrain);
        
        const result = {
          width,
          height,
          terrain: terrain.length,
          description: `Initialized ${width}x${height} battlefield with ${terrain.length} terrain features`
        };
        
        combatLog.push(result.description);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'place_creature': {
        const { creature_id, name, x, y, z = 0, size = 'medium', speed = 30, reach = 5 } = args as any;
        
        const creature = {
          id: creature_id,
          name,
          position: { x, y, z },
          size: { category: size as any, squares: size === 'large' ? 2 : 1 },
          speed,
          reach
        };
        
        spatialEngine.addCreature(creature);
        
        const result = {
          creature_id,
          name,
          position: { x, y, z },
          size,
          description: `Placed ${name} at position (${x}, ${y}, ${z})`
        };
        
        combatLog.push(result.description);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'move_creature': {
        const { creature_id, target_x, target_y, target_z = 0, speed } = args as any;
        
        const battlefield = spatialEngine.getBattlefieldState();
        const creature = battlefield.creatures.get(creature_id);
        
        if (!creature) {
          throw new Error(`Creature ${creature_id} not found on battlefield`);
        }
        
        const from = creature.position;
        const to = { x: target_x, y: target_y, z: target_z };
        
        const movement = spatialEngine.validateMovement(creature, from, to, speed);
        
        if (movement.isValid) {
          spatialEngine.moveCreature(creature_id, to);
        }
        
        const result = {
          creature_id,
          from,
          to,
          movement_valid: movement.isValid,
          distance: movement.pathLength,
          opportunity_attacks: movement.opportunityAttacks,
          description: movement.isValid 
            ? `${creature.name} moves from (${from.x}, ${from.y}) to (${to.x}, ${to.y})`
            : `${creature.name} cannot move to (${to.x}, ${to.y}) - ${movement.pathLength > speed ? 'insufficient speed' : 'path blocked'}`
        };
        
        combatLog.push(result.description);
        
        if (movement.opportunityAttacks.length > 0) {
          combatLog.push(`Opportunity attacks triggered by: ${movement.opportunityAttacks.join(', ')}`);
        }
        
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'check_line_of_sight': {
        const { from_creature, to_creature } = args as any;
        
        const battlefield = spatialEngine.getBattlefieldState();
        const fromCreature = battlefield.creatures.get(from_creature);
        const toCreature = battlefield.creatures.get(to_creature);
        
        if (!fromCreature || !toCreature) {
          const available = Array.from(battlefield.creatures.keys()).join(', ');
          return {
            content: [{ type: 'text', text: `❌ CREATURE NOT FOUND\n\nOne or both creatures not found on battlefield.\n🔍 Available creatures: ${available || 'none'}` }],
            isError: true
          };
        }
        
        const los = spatialEngine.calculateLineOfSight(fromCreature.position, toCreature.position);
        const distance = spatialEngine.getDistance(fromCreature.position, toCreature.position);
        const rangeCategory = spatialEngine.getRangeCategory(distance);
        
        let output = `👁️ LINE OF SIGHT CHECK\n\n`;
        output += `🎯 ${fromCreature.name} ➤ ${toCreature.name}\n\n`;
        output += `📏 Distance: ${Math.round(distance)}ft (${rangeCategory} range)\n`;
        
        if (los.hasLineOfSight) {
          output += `👁️ Line of Sight: ✅ CLEAR\n`;
        } else {
          output += `👁️ Line of Sight: ❌ BLOCKED\n`;
        }
        
        output += `🛡️ Cover: ${los.coverType === 'none' ? 'No cover' : los.coverType.replace('_', ' ') + ' cover'}\n`;
        
        if (los.blockedBy && los.blockedBy.length > 0) {
          output += `🚧 Blocked by: ${los.blockedBy.join(', ')}\n`;
        }
        
        // Add tactical advice
        output += `\n🎯 TACTICAL SUMMARY:\n`;
        if (los.hasLineOfSight) {
          if (los.coverType === 'none') {
            output += `✨ Perfect shot! No penalties to attack rolls.`;
          } else if (los.coverType === 'half') {
            output += `🛡️ Target has half cover (+2 AC and Dex saves).`;
          } else if (los.coverType === 'three_quarters') {
            output += `🛡️ Target has 3/4 cover (+5 AC and Dex saves).`;
          }
        } else {
          output += `❌ Cannot target with spells or ranged attacks.`;
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_area_effect_targets': {
        const { center_x, center_y, center_z = 0, shape, size, direction } = args as any;
        
        const areaEffect = {
          id: 'temp_effect',
          name: 'Area Effect',
          shape,
          center: { x: center_x, y: center_y, z: center_z },
          sizeParameter: size,
          direction,
          durationRounds: 1
        };
        
        const targets = spatialEngine.getTargetsInArea(areaEffect);
        const battlefield = spatialEngine.getBattlefieldState();
        
        let output = `💥 AREA EFFECT TARGETING\n\n`;
        output += `📍 Center: (${center_x}, ${center_y}, ${center_z})\n`;
        output += `🔶 Shape: ${shape.charAt(0).toUpperCase() + shape.slice(1)}\n`;
        output += `📏 Size: ${size} feet`;
        
        if (direction !== undefined) {
          output += `\n🧭 Direction: ${direction}°`;
        }
        
        output += `\n\n🎯 TARGETS CAUGHT IN EFFECT:\n`;
        
        if (targets.length === 0) {
          output += `❌ No creatures in the affected area.\n`;
        } else {
          targets.forEach((targetId, index) => {
            const creature = battlefield.creatures.get(targetId);
            if (creature) {
              const distance = spatialEngine.getDistance(creature.position, areaEffect.center);
              output += `${index + 1}. 👹 ${creature.name} at (${creature.position.x},${creature.position.y},${creature.position.z}) - ${Math.round(distance)}ft from center\n`;
            }
          });
        }
        
        output += `\n📊 SUMMARY: ${targets.length} creature${targets.length !== 1 ? 's' : ''} affected`;
        
        if (targets.length > 0) {
          output += `\n💡 *Remember to roll saving throws for each target!*`;
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_tactical_summary': {
        const { creature_id } = args as any;
        
        const battlefield = spatialEngine.getBattlefieldState();
        const creature = battlefield.creatures.get(creature_id);
        
        if (!creature) {
          const available = Array.from(battlefield.creatures.keys()).join(', ');
          return {
            content: [{ type: 'text', text: `❌ CREATURE NOT FOUND\n\nCreature "${creature_id}" not found on battlefield.\n🔍 Available creatures: ${available || 'none'}` }],
            isError: true
          };
        }
        
        const description = spatialEngine.describeTacticalSituation(creature_id);
        const flanked = spatialEngine.isCreatureFlanked(creature_id);
        
        let output = `🎯 TACTICAL SUMMARY\n\n`;
        output += `👤 Creature: ${creature.name}\n`;
        output += `📍 Position: (${creature.position.x}, ${creature.position.y}, ${creature.position.z})\n`;
        output += `📏 Size: ${creature.size.category}\n`;
        output += `🏃 Speed: ${creature.speed}ft\n`;
        output += `🤏 Reach: ${creature.reach}ft\n\n`;
        
        output += `🔍 SITUATION ANALYSIS:\n${description}\n\n`;
        
        if (flanked) {
          output += `⚠️ WARNING: This creature is FLANKED! Enemies have advantage on melee attacks.\n\n`;
        }
        
        // Add quick combat tips
        output += `💡 TACTICAL TIPS:\n`;
        if (flanked) {
          output += `• 🏃 Consider repositioning to break flanking\n`;
        }
        output += `• 🎯 Use ranged attacks for safer positioning\n`;
        output += `• 🛡️ Look for cover to improve AC/saves`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'check_flanking': {
        const { creature_id } = args as any;
        
        const battlefield = spatialEngine.getBattlefieldState();
        const creature = battlefield.creatures.get(creature_id);
        
        if (!creature) {
          const available = Array.from(battlefield.creatures.keys()).join(', ');
          return {
            content: [{ type: 'text', text: `❌ CREATURE NOT FOUND\n\nCreature "${creature_id}" not found on battlefield.\n🔍 Available creatures: ${available || 'none'}` }],
            isError: true
          };
        }
        
        const flanked = spatialEngine.isCreatureFlanked(creature_id);
        
        let output = `🎯 FLANKING CHECK\n\n`;
        output += `👤 Creature: ${creature.name}\n`;
        output += `📍 Position: (${creature.position.x}, ${creature.position.y}, ${creature.position.z})\n\n`;
        
        if (flanked) {
          output += `⚠️ FLANKED: YES!\n`;
          output += `📊 Effect: Enemies have advantage on melee attack rolls\n`;
          output += `🎲 Sneak Attack: Rogues can use sneak attack (if applicable)\n\n`;
          output += `💡 TACTICAL ADVICE:\n`;
          output += `• 🏃 Move to break flanking positioning\n`;
          output += `• 🛡️ Use Disengage action to avoid opportunity attacks\n`;
          output += `• 🎯 Consider using ranged attacks or spells`;
        } else {
          output += `✅ FLANKED: NO\n`;
          output += `🛡️ Status: Secure positioning - no flanking advantage for enemies\n\n`;
          output += `💡 TACTICAL ADVICE:\n`;
          output += `• 💪 Good positioning - maintain your stance\n`;
          output += `• ⚔️ Look for opportunities to flank enemies\n`;
          output += `• 🎯 You can attack normally without disadvantage`;
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'check_height_advantage': {
        const { attacker_id, target_id } = args as any;
        
        const battlefield = spatialEngine.getBattlefieldState();
        const attacker = battlefield.creatures.get(attacker_id);
        const target = battlefield.creatures.get(target_id);
        
        if (!attacker || !target) {
          const available = Array.from(battlefield.creatures.keys()).join(', ');
          return {
            content: [{ type: 'text', text: `❌ CREATURES NOT FOUND\n\nOne or both creatures not found on battlefield.\n🔍 Available creatures: ${available || 'none'}` }],
            isError: true
          };
        }
        
        const hasAdvantage = spatialEngine.hasHeightAdvantage(attacker_id, target_id);
        const heightDiff = attacker.position.z - target.position.z;
        
        let output = `🏔️ HEIGHT ADVANTAGE CHECK\n\n`;
        output += `⚔️ Attacker: ${attacker.name} at height ${attacker.position.z}ft\n`;
        output += `🎯 Target: ${target.name} at height ${target.position.z}ft\n`;
        output += `📏 Height Difference: ${Math.abs(heightDiff)}ft`;
        
        if (heightDiff > 0) {
          output += ` (attacker higher)\n\n`;
        } else if (heightDiff < 0) {
          output += ` (target higher)\n\n`;
        } else {
          output += ` (same level)\n\n`;
        }
        
        if (hasAdvantage) {
          output += `✅ HEIGHT ADVANTAGE: YES!\n`;
          output += `🎲 Effect: Attacker has advantage on attack rolls\n`;
          output += `💪 Bonus: +2 bonus to ranged attacks (optional rule)\n\n`;
          output += `💡 TACTICAL BENEFITS:\n`;
          output += `• 🎯 Roll twice, take higher result\n`;
          output += `• 🏹 Better angle for ranged attacks\n`;
          output += `• 👁️ Improved line of sight over obstacles`;
        } else {
          output += `❌ HEIGHT ADVANTAGE: NO\n`;
          
          if (heightDiff < 0) {
            output += `⚠️ Disadvantage: Target is higher - they might have advantage!\n\n`;
            output += `💡 SUGGESTIONS:\n`;
            output += `• 🧗 Find higher ground if possible\n`;
            output += `• 🎯 Use spells that don't require attack rolls\n`;
            output += `• 🛡️ Seek cover from elevated attacks`;
          } else {
            output += `📊 Status: Normal attack rolls (no height modifier)\n\n`;
            output += `💡 SUGGESTIONS:\n`;
            output += `• 🧗 Look for elevated positions nearby\n`;
            output += `• 🎯 Standard combat tactics apply`;
          }
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      // Original tools with enhanced logging
      case 'roll_check': {
        const { character, ability, modifier, advantage, disadvantage, dc, bonus = 0 } = args as any;
        
        let notation = advantage ? '2d20kh1' : disadvantage ? '2d20kl1' : '1d20';
        notation += modifier >= 0 ? `+${modifier}` : `${modifier}`;
        
        const result = rollDice(notation);
        const finalTotal = result.total + bonus;
        const success = dc ? finalTotal >= dc : null;
        
        let output = `🎯 ${ability.toUpperCase()} CHECK\n\n`;
        output += `👤 Character: ${character}\n`;
        output += `🎲 Roll: ${notation}`;
        
        if (advantage) output += ` ✨ ADVANTAGE`;
        if (disadvantage) output += ` 🌩️ DISADVANTAGE`;
        
        output += `\n`;
        
        if (result.kept) {
          output += `🎲 Rolled: [${result.rolls.join(', ')}]\n`;
          output += `✨ Used: ${result.kept[0]} ${result.kept[0] === Math.max(...result.rolls) ? '(HIGHEST)' : '(LOWEST)'}\n`;
        } else {
          output += `🎲 Rolled: ${result.rolls[0]}\n`;
        }
        
        output += `➕ Modifier: ${modifier >= 0 ? '+' : ''}${modifier}\n`;
        if (bonus !== 0) {
          output += `🌟 Bonus: ${bonus >= 0 ? '+' : ''}${bonus}\n`;
        }
        output += `🏆 TOTAL: ${finalTotal}`;
        
        // Add difficulty assessment for context
        if (dc) {
          const margin = finalTotal - dc;
          output += `\n🎯 DC: ${dc}\n`;
          output += `📊 RESULT: ${success ? '✅ SUCCESS!' : '❌ FAILURE!'}`;
          if (success && margin >= 10) {
            output += ` 🌟 CRITICAL SUCCESS! (beat DC by ${margin})`;
          } else if (success && margin >= 5) {
            output += ` 🎉 Solid Success! (beat DC by ${margin})`;
          } else if (!success && margin >= -5) {
            output += ` 😤 Close Call! (missed by ${Math.abs(margin)})`;
          } else if (!success) {
            output += ` 💥 Clear Failure (missed by ${Math.abs(margin)})`;
          }
        } else {
          // No DC - give context based on the roll
          if (finalTotal >= 20) output += ` 🌟 EXCEPTIONAL!`;
          else if (finalTotal >= 15) output += ` 🎉 GREAT ROLL!`;
          else if (finalTotal >= 10) output += ` 👍 DECENT`;
          else if (finalTotal >= 5) output += ` 😬 LOW`;
          else output += ` 💥 TERRIBLE`;
        }
        
        const advantageText = advantage ? ' (ADVANTAGE)' : disadvantage ? ' (DISADVANTAGE)' : '';
        const bonusText = bonus !== 0 ? ` (+${bonus} bonus)` : '';
        const dcText = dc ? ` vs DC ${dc} - ${success ? 'SUCCESS' : 'FAILURE'}` : '';
        const logEntry = `${character} ${ability} check${advantageText}${bonusText}: ${finalTotal}${dcText}`;
        combatLog.push(logEntry);
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'initiative_roll': {
        const result = rollDice(`1d20+${(args as any).modifier}`);
        const logEntry = `${(args as any).character} initiative: ${result.total}`;
        combatLog.push(logEntry);
        
        let output = `⚡ INITIATIVE ROLL\n\n`;
        output += `👤 Character: ${(args as any).character}\n`;
        output += `🎲 Rolled: ${result.rolls[0]}\n`;
        if (result.modifier !== 0) {
          output += `➕ Modifier: ${result.modifier >= 0 ? '+' : ''}${result.modifier}\n`;
        }
        output += `🏆 INITIATIVE: ${result.total}`;
        
        if (result.rolls[0] === 20) output += ` 🎉 NATURAL 20!`;
        if (result.rolls[0] === 1) output += ` 💥 NATURAL 1!`;
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'attack_roll': {
        const { attacker, target, modifier = 0, advantage: hasAdvantage, disadvantage: hasDisadvantage, bonus = 0 } = args as any;

        let roll1 = rollDice('1d20');
        let roll2 = (hasAdvantage || hasDisadvantage) ? rollDice('1d20') : null;
        
        let selectedD20 = roll1.total;
        let diceUsed = [roll1.total];
        
        if (hasAdvantage && roll2) {
          selectedD20 = Math.max(roll1.total, roll2.total);
          diceUsed = [roll1.total, roll2.total];
        } else if (hasDisadvantage && roll2) {
          selectedD20 = Math.min(roll1.total, roll2.total);
          diceUsed = [roll1.total, roll2.total];
        }
        
        const finalTotal = selectedD20 + modifier + bonus;
        const critical = selectedD20 === 20;
        const fumble = selectedD20 === 1;
        
        let output = `⚔️ ATTACK ROLL\n\n`;
        output += `👤 ${attacker} ➤ 🎯 ${target}\n\n`;
        
        if (hasAdvantage || hasDisadvantage) {
          output += `🎲 Rolled: [${diceUsed.join(', ')}]\n`;
          output += `✨ Used: ${selectedD20} ${hasAdvantage ? '(HIGHEST)' : '(LOWEST)'}\n`;
          output += `📊 Type: ${hasAdvantage ? '✨ ADVANTAGE' : '🌩️ DISADVANTAGE'}\n`;
        } else {
          output += `🎲 Rolled: ${selectedD20}\n`;
        }
        
        if (modifier !== 0) {
          output += `➕ Modifier: ${modifier >= 0 ? '+' : ''}${modifier}\n`;
        }
        
        if (bonus !== 0) {
          output += `🌟 Bonus: ${bonus >= 0 ? '+' : ''}${bonus}\n`;
        }
        
        output += `� TOTAL: ${finalTotal}`;
        
        if (critical) output += ` 🎉 CRITICAL HIT!`;
        if (fumble) output += ` 💥 CRITICAL MISS!`;
        
        const advantageText = hasAdvantage ? ' (ADVANTAGE)' : hasDisadvantage ? ' (DISADVANTAGE)' : '';
        const bonusText = bonus !== 0 ? ` (+${bonus} bonus)` : '';
        const logEntry = `${attacker} attacks ${target}: ${finalTotal}${advantageText}${bonusText} ${critical ? '(CRITICAL!)' : fumble ? '(FUMBLE!)' : ''}`;
        combatLog.push(logEntry);
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'damage_roll': {
        let result = rollDice((args as any).notation);
        if ((args as any).critical) {
          const critRoll = rollDice((args as any).notation);
          result.total += critRoll.total;
          result.rolls = [...result.rolls, ...critRoll.rolls];
        }
        
        let output = `💥 DAMAGE ROLL\n\n`;
        output += `🎲 Roll: ${(args as any).notation}\n`;
        output += `⚡ Type: ${(args as any).damage_type}`;
        if ((args as any).critical) output += ` 🎉 CRITICAL`;
        output += `\n`;
        
        if ((args as any).critical) {
          const normalRolls = result.rolls.slice(0, result.rolls.length / 2);
          const critRolls = result.rolls.slice(result.rolls.length / 2);
          output += `🎲 Normal: [${normalRolls.join(', ')}]\n`;
          output += `🎉 Critical: [${critRolls.join(', ')}]\n`;
        } else {
          output += `🎲 Rolled: [${result.rolls.join(', ')}]\n`;
        }
        
        if (result.modifier !== 0) {
          output += `➕ Modifier: ${result.modifier >= 0 ? '+' : ''}${result.modifier}\n`;
        }
        
        output += `💀 TOTAL DAMAGE: ${result.total} ${(args as any).damage_type}`;
        
        const logEntry = `Damage (${(args as any).damage_type}): ${result.total}${(args as any).critical ? ' (CRITICAL)' : ''}`;
        combatLog.push(logEntry);
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'saving_throw': {
        const { character, ability, dc, modifier, bonus = 0 } = args as any;
        const result = rollDice(`1d20+${modifier}`);
        const finalTotal = result.total + bonus;
        const success = finalTotal >= dc;
        const margin = finalTotal - dc;
        
        let output = `🛡️ ${ability.toUpperCase()} SAVING THROW\n\n`;
        output += `👤 Character: ${character}\n`;
        output += `🎲 Rolled: ${result.rolls[0]}\n`;
        if (result.modifier !== 0) {
          output += `➕ Modifier: ${result.modifier >= 0 ? '+' : ''}${result.modifier}\n`;
        }
        if (bonus !== 0) {
          output += `🌟 Bonus: ${bonus >= 0 ? '+' : ''}${bonus}\n`;
        }
        output += `🏆 TOTAL: ${finalTotal}\n`;
        output += `🎯 DC: ${dc}\n`;
        output += `📊 RESULT: ${success ? '✅ SUCCESS!' : '❌ FAILURE!'}`;
        
        // Add contextual feedback
        if (success && margin >= 10) {
          output += ` 🌟 EXCEPTIONAL! (beat DC by ${margin})`;
        } else if (success && margin >= 5) {
          output += ` 🎉 Strong Save! (beat DC by ${margin})`;
        } else if (success) {
          output += ` 😅 Barely Made It! (beat DC by ${margin})`;
        } else if (margin >= -5) {
          output += ` 😤 So Close! (missed by ${Math.abs(margin)})`;
        } else {
          output += ` 💥 Failed Badly (missed by ${Math.abs(margin)})`;
        }
        
        // Add natural 20/1 indicators
        if (result.rolls[0] === 20) output += `\n🎉 NATURAL 20! Auto-success against most effects!`;
        if (result.rolls[0] === 1) output += `\n💥 NATURAL 1! Critical failure!`;
        
        const bonusText = bonus !== 0 ? ` (+${bonus} bonus)` : '';
        const logEntry = `${character} ${ability} save${bonusText}: ${finalTotal} vs DC ${dc} - ${success ? 'SUCCESS' : 'FAILURE'}`;
        combatLog.push(logEntry);
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'get_combat_log': {
        const limit = (args as any).limit || 10;
        const recentLog = combatLog.slice(-limit);
        
        if (recentLog.length === 0) {
          return {
            content: [{ type: 'text', text: '📋 COMBAT LOG EMPTY\n\nNo combat actions recorded yet. Start making some moves! ⚔️' }]
          };
        }
        
        let output = '📋 COMBAT LOG (Last ' + Math.min(limit, recentLog.length) + ' entries)\n\n';
        recentLog.forEach((entry, index) => {
          output += `${index + 1}. ${entry}\n`;
        });
        
        if (combatLog.length > limit) {
          output += `\n💡 *Showing last ${limit} of ${combatLog.length} total entries*`;
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'clear_combat_log': {
        combatLog = [];
        return {
          content: [{ type: 'text', text: 'Combat log cleared' }]
        };
      }

      // Human-readable battlefield description tools
      case 'describe_battlefield': {
        const description = spatialEngine.describeBattlefield();
        
        return {
          content: [{ type: 'text', text: description }]
        };
      }

      case 'describe_detailed_tactical_situation': {
        const { creature_id } = args as any;
        
        const description = spatialEngine.describeDetailedTacticalSituation(creature_id);
        
        return {
          content: [{ type: 'text', text: description }]
        };
      }

      case 'generate_battlefield_map': {
        const map = spatialEngine.generateBattlefieldMap();
        
        return {
          content: [{ type: 'text', text: map }]
        };
      }

      // Batch operations
      case 'batch_place_creatures': {
        const { creatures } = args as any;
        const placedCreatures = [];
        
        for (const creatureData of creatures) {
          try {
            const { creature_id, name, x, y, z = 0, size = 'medium', speed = 30, reach = 5 } = creatureData;
            
            const creature = {
              id: creature_id,
              name,
              position: { x, y, z },
              size: { category: size as any, squares: size === 'large' ? 2 : 1 },
              speed,
              reach
            };
            
            spatialEngine.addCreature(creature);
            placedCreatures.push({ success: true, creature_id, name, position: { x, y, z } });
          } catch (error: any) {
            placedCreatures.push({ success: false, creature_id: creatureData.creature_id, error: error.message });
          }
        }
        
        let output = `📍 BATCH CREATURE PLACEMENT COMPLETE!\n\n`;
        const successful = placedCreatures.filter(p => p.success);
        const failed = placedCreatures.filter(p => !p.success);
        
        output += `📊 Results: ${successful.length} placed, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          output += `✅ SUCCESSFULLY PLACED:\n`;
          successful.forEach((result: any, index: number) => {
            output += `${index + 1}. 👹 ${result.name} at (${result.position.x}, ${result.position.y}, ${result.position.z})\n`;
          });
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED PLACEMENTS:\n`;
          failed.forEach((result: any, index: number) => {
            output += `${index + 1}. ${result.creature_id}: ${result.error}\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'batch_move_creatures': {
        const { movements } = args as any;
        const moveResults = [];
        
        for (const movement of movements) {
          try {
            const { creature_id, target_x, target_y, target_z = 0, speed } = movement;
            
            const battlefield = spatialEngine.getBattlefieldState();
            const creature = battlefield.creatures.get(creature_id);
            
            if (!creature) {
              moveResults.push({ success: false, creature_id, error: 'Creature not found' });
              continue;
            }
            
            const from = creature.position;
            const to = { x: target_x, y: target_y, z: target_z };
            
            const movementResult = spatialEngine.validateMovement(creature, from, to, speed);
            
            if (movementResult.isValid) {
              spatialEngine.moveCreature(creature_id, to);
              moveResults.push({
                success: true,
                creature_id,
                name: creature.name,
                from,
                to,
                distance: movementResult.pathLength,
                opportunity_attacks: movementResult.opportunityAttacks
              });
            } else {
              moveResults.push({
                success: false,
                creature_id,
                name: creature.name,
                error: `Cannot move - ${movementResult.pathLength > speed ? 'insufficient speed' : 'path blocked'}`
              });
            }
          } catch (error: any) {
            moveResults.push({ success: false, creature_id: movement.creature_id, error: error.message });
          }
        }
        
        let output = `🏃 BATCH CREATURE MOVEMENT COMPLETE!\n\n`;
        const successful = moveResults.filter(m => m.success);
        const failed = moveResults.filter(m => !m.success);
        
        output += `📊 Results: ${successful.length} moved, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          output += `✅ SUCCESSFUL MOVEMENTS:\n`;
          successful.forEach((result: any, index: number) => {
            output += `${index + 1}. 👹 ${result.name}: (${result.from.x},${result.from.y}) → (${result.to.x},${result.to.y}) [${Math.round(result.distance)}ft]\n`;
            if (result.opportunity_attacks.length > 0) {
              output += `   ⚠️ Triggered opportunity attacks: ${result.opportunity_attacks.join(', ')}\n`;
            }
          });
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED MOVEMENTS:\n`;
          failed.forEach((result: any, index: number) => {
            output += `${index + 1}. ${result.name || result.creature_id}: ${result.error}\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'batch_attack_rolls': {
        const { attacks } = args as any;
        const attackResults = [];
        
        for (const attack of attacks) {
          try {
            const { attacker, target, modifier = 0, advantage: hasAdvantage, disadvantage: hasDisadvantage } = attack;

            let roll1 = rollDice('1d20');
            let roll2 = (hasAdvantage || hasDisadvantage) ? rollDice('1d20') : null;
            
            let selectedD20 = roll1.total;
            let diceUsed = [roll1.total];
            
            if (hasAdvantage && roll2) {
              selectedD20 = Math.max(roll1.total, roll2.total);
              diceUsed = [roll1.total, roll2.total];
            } else if (hasDisadvantage && roll2) {
              selectedD20 = Math.min(roll1.total, roll2.total);
              diceUsed = [roll1.total, roll2.total];
            }
            
            const finalTotal = selectedD20 + modifier;
            const critical = selectedD20 === 20;
            const fumble = selectedD20 === 1;
            
            attackResults.push({
              success: true,
              attacker,
              target,
              roll: selectedD20,
              modifier,
              total: finalTotal,
              critical,
              fumble,
              advantage: hasAdvantage ? 'advantage' : hasDisadvantage ? 'disadvantage' : 'normal',
              diceUsed: diceUsed.length > 1 ? diceUsed : undefined
            });
            
            const advantageText = hasAdvantage ? ' (ADVANTAGE)' : hasDisadvantage ? ' (DISADVANTAGE)' : '';
            const logEntry = `${attacker} attacks ${target}: ${finalTotal}${advantageText} ${critical ? '(CRITICAL!)' : fumble ? '(FUMBLE!)' : ''}`;
            combatLog.push(logEntry);
            
          } catch (error: any) {
            attackResults.push({
              success: false,
              attacker: attack.attacker,
              target: attack.target,
              error: error.message
            });
          }
        }
        
        let output = `⚔️ BATCH ATTACK ROLLS COMPLETE!\n\n`;
        const successful = attackResults.filter(a => a.success);
        const failed = attackResults.filter(a => !a.success);
        
        output += `📊 Results: ${successful.length} attacks rolled, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          output += `🎲 ATTACK RESULTS:\n`;
          successful.forEach((result: any, index: number) => {
            const advantageIcon = result.advantage === 'advantage' ? ' ✨' : result.advantage === 'disadvantage' ? ' 🌩️' : '';
            const specialIcon = result.critical ? ' 🎉' : result.fumble ? ' 💥' : '';
            const rollText = result.diceUsed ? `[${result.diceUsed.join(', ')}]→${result.roll}` : result.roll;
            output += `${index + 1}. ⚔️ ${result.attacker} → ${result.target}: ${rollText}+${result.modifier} = ${result.total}${advantageIcon}${specialIcon}\n`;
          });
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED ATTACKS:\n`;
          failed.forEach((result: any, index: number) => {
            output += `${index + 1}. ${result.attacker} → ${result.target}: ${result.error}\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'batch_damage_rolls': {
        const { damage_rolls } = args as any;
        const damageResults = [];
        
        for (const damageRoll of damage_rolls) {
          try {
            const { notation, damage_type, critical, source } = damageRoll;
            
            let result = rollDice(notation);
            if (critical) {
              const critRoll = rollDice(notation);
              result.total += critRoll.total;
              result.rolls = [...result.rolls, ...critRoll.rolls];
            }
            
            damageResults.push({
              success: true,
              notation,
              damage_type,
              critical: !!critical,
              total: result.total,
              rolls: result.rolls,
              modifier: result.modifier,
              source: source || 'Unknown'
            });
            
            const logEntry = `Damage (${damage_type}): ${result.total}${critical ? ' (CRITICAL)' : ''}${source ? ` from ${source}` : ''}`;
            combatLog.push(logEntry);
            
          } catch (error: any) {
            damageResults.push({
              success: false,
              notation: damageRoll.notation,
              damage_type: damageRoll.damage_type,
              error: error.message
            });
          }
        }
        
        let output = `💥 BATCH DAMAGE ROLLS COMPLETE!\n\n`;
        const successful = damageResults.filter(d => d.success);
        const failed = damageResults.filter(d => !d.success);
        
        output += `📊 Results: ${successful.length} damage rolls, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          output += `🎲 DAMAGE RESULTS:\n`;
          successful.forEach((result: any, index: number) => {
            const critText = result.critical ? ' 🎉 CRITICAL' : '';
            const sourceText = result.source !== 'Unknown' ? ` (${result.source})` : '';
            
            if (result.critical) {
              const normalRolls = result.rolls.slice(0, result.rolls.length / 2);
              const critRolls = result.rolls.slice(result.rolls.length / 2);
              output += `${index + 1}. 💀 ${result.notation}${critText}: [${normalRolls.join(', ')}]+[${critRolls.join(', ')}] = ${result.total} ${result.damage_type}${sourceText}\n`;
            } else {
              output += `${index + 1}. 💀 ${result.notation}: [${result.rolls.join(', ')}] = ${result.total} ${result.damage_type}${sourceText}\n`;
            }
          });
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED DAMAGE ROLLS:\n`;
          failed.forEach((result: any, index: number) => {
            output += `${index + 1}. ${result.notation} (${result.damage_type}): ${result.error}\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'batch_saving_throws': {
        const { saves } = args as any;
        const saveResults = [];
        
        for (const save of saves) {
          try {
            const { character, ability, dc, modifier } = save;
            const result = rollDice(`1d20+${modifier}`);
            const success = result.total >= dc;
            const margin = result.total - dc;
            
            saveResults.push({
              success: true,
              character,
              ability,
              roll: result.rolls[0],
              modifier,
              total: result.total,
              dc,
              passed: success,
              margin,
              natural20: result.rolls[0] === 20,
              natural1: result.rolls[0] === 1
            });
            
            const logEntry = `${character} ${ability} save: ${result.total} vs DC ${dc} - ${success ? 'SUCCESS' : 'FAILURE'}`;
            combatLog.push(logEntry);
            
          } catch (error: any) {
            saveResults.push({
              success: false,
              character: save.character,
              ability: save.ability,
              error: error.message
            });
          }
        }
        
        let output = `🛡️ BATCH SAVING THROWS COMPLETE!\n\n`;
        const successful = saveResults.filter(s => s.success);
        const failed = saveResults.filter(s => !s.success);
        
        output += `📊 Results: ${successful.length} saves rolled, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          const passed = successful.filter(s => s.passed);
          const failedSaves = successful.filter(s => !s.passed);
          
          output += `🎲 SAVING THROW RESULTS:\n`;
          output += `✅ Passed: ${passed.length} | ❌ Failed: ${failedSaves.length}\n\n`;
          
          successful.forEach((result: any, index: number) => {
            const successIcon = result.passed ? '✅' : '❌';
            const specialIcon = result.natural20 ? ' 🎉' : result.natural1 ? ' 💥' : '';
            const marginText = result.passed ? `(+${result.margin})` : `(-${Math.abs(result.margin)})`;
            
            output += `${index + 1}. ${successIcon} ${result.character} ${result.ability}: ${result.roll}+${result.modifier} = ${result.total} vs DC${result.dc} ${marginText}${specialIcon}\n`;
          });
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED SAVING THROWS:\n`;
          failed.forEach((result: any, index: number) => {
            output += `${index + 1}. ${result.character} ${result.ability}: ${result.error}\n`;
          });
        }
        
        return {
          content: [{ type: 'text', text: output }]
        };
      }

      case 'batch_initiative_rolls': {
        const { characters } = args as any;
        const initiativeResults = [];
        
        for (const characterData of characters) {
          try {
            const { character, modifier } = characterData;
            const result = rollDice(`1d20+${modifier}`);
            
            initiativeResults.push({
              success: true,
              character,
              roll: result.rolls[0],
              modifier,
              total: result.total,
              natural20: result.rolls[0] === 20,
              natural1: result.rolls[0] === 1
            });
            
            const logEntry = `${character} initiative: ${result.total}`;
            combatLog.push(logEntry);
            
          } catch (error: any) {
            initiativeResults.push({
              success: false,
              character: characterData.character,
              error: error.message
            });
          }
        }
        
        let output = `⚡ BATCH INITIATIVE ROLLS COMPLETE!\n\n`;
        const successful = initiativeResults.filter(i => i.success);
        const failed = initiativeResults.filter(i => !i.success);
        
        output += `📊 Results: ${successful.length} initiatives rolled, ${failed.length} failed\n\n`;
        
        if (successful.length > 0) {
          // Sort by initiative total (highest first)
          const sorted = [...successful].sort((a: any, b: any) => b.total - a.total);
          
          output += `🎲 INITIATIVE ORDER (highest to lowest):\n`;
          sorted.forEach((result: any, index: number) => {
            const specialIcon = result.natural20 ? ' 🎉' : result.natural1 ? ' 💥' : '';
            output += `${index + 1}. ⚡ ${result.character}: ${result.roll}`;
            if (result.modifier !== 0) {
              output += `${result.modifier >= 0 ? '+' : ''}${result.modifier}`;
            }
            output += ` = ${result.total}${specialIcon}\n`;
          });
          
          output += `\n💡 TURN ORDER ESTABLISHED!\n`;
          output += `🎯 Combat begins with ${sorted[0].character} (Initiative ${sorted[0].total})`;
        }
        
        if (failed.length > 0) {
          output += `\n❌ FAILED INITIATIVE ROLLS:\n`;
          failed.forEach((result: any, index: number) => {
            output += `${index + 1}. ${result.character}: ${result.error}\n`;
          });
        }
        
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
console.error('Enhanced RPG Combat Engine MCP Server v2.0 running on stdio');
