# RPG MCP Servers - Agent Integration Guide

## Quick Start
Both `rpg-combat-engine` and `rpg-game-state` servers are fully operational with comprehensive D&D 5E mechanics. No setup required - start calling tools immediately.

## Server Capabilities

### rpg-combat-engine
- **Purpose**: Real-time tactical combat, spatial mechanics, dice rolling
- **Stack**: TypeScript + MCP SDK
- **Build**: `npm run build` → `tsc` compilation
- **Entry**: `dist/index.js`
- **Dev**: `npm run dev` → `tsx src/index.ts`

**Key Features**:
- Grid-based battlefield with 3D positioning
- Advanced dice mechanics (advantage/disadvantage, keep high/low)
- Real-time tactical analysis and positioning
- Batch operations for efficiency
- Opportunity attacks and line-of-sight calculations

### rpg-game-state  
- **Purpose**: Character management, campaign progression, stronghold management
- **Stack**: TypeScript + SQLite + MCP SDK
- **Build**: `npm run build` → `tsc` compilation  
- **Entry**: `dist/index.js`
- **Dev**: `npm run dev` → `tsx src/index.ts`

**Key Features**:
- Complete character lifecycle management
- Encounter and initiative tracking
- Quest and story progression
- Stronghold, facility, and business management
- Spell slot and spell management
- Hireling recruitment and loyalty tracking

## Tool Discovery
Both servers expose all tools via `ListToolsRequestSchema`. Tool names are self-documenting and follow consistent naming patterns.

## Critical Integration Notes

### Output Formats
- **combat-engine**: Rich, emoji-enhanced tactical descriptions with ASCII battlefield maps
- **game-state**: Structured data returns with formatted character sheets and status updates
- **Error handling**: Clear, actionable error messages with available options

### Database Operations
- **game-state server**: Uses SQLite with automatic initialization
- **Session persistence**: Character and world state persist between calls
- **Transaction safety**: Batch operations are atomic where applicable

### Spatial Combat Context
- **Battlefield state**: Maintained in-memory, reset on server restart
- **Coordinate system**: 5-foot grid squares, 3D positioning support
- **Range categories**: Automatic calculation (short/medium/long/extreme)

### Batch Operations
Both servers support batch operations for efficiency:
- `batch_*_rolls` (attacks, damage, saves, initiative)
- `batch_*_creatures` (placement, movement)  
- `batch_*_npcs` (creation, updates, damage)
- `batch_add_to_encounter` (multiple participants)

## Quality of Life Features

### Built-in Helper Methods
- **tactical analysis**: `get_tactical_summary`, `describe_detailed_tactical_situation`
- **visualization**: `generate_battlefield_map`, `describe_battlefield`
- **validation**: `check_line_of_sight`, `check_flanking`, `check_height_advantage`
- **combat flow**: `next_turn`, `start_turn`, `end_turn`, `consume_action`

### Comprehensive Logging
- **combat log**: `get_combat_log` with configurable limits
- **structured output**: All major actions logged with context
- **battlefield state**: Real-time position and status tracking

## Development Workflow

### Adding New Features
1. **Edit source files** in `src/` directory
2. **Build**: `npm run build` in server directory
3. **Test**: Use MCP tools to validate new functionality
4. **Deploy**: Restart MCP server to load changes

### Testing Approach
- **Unit testing**: Test individual tool handlers with specific inputs
- **Integration testing**: Verify cross-tool functionality (combat + spatial)
- **End-to-end testing**: Complete character creation → combat → campaign progression

## Agent Patterns

### Combat Management Flow
```
initialize_battlefield → place_creature(s) → get_tactical_summary → 
execute_actions → manage_turn_order → resolve_combat
```

### Character Campaign Flow  
```
create_character → add_quest → create_encounter → manage_turns → 
update_character_progression → establish_stronghold
```

### Spatial Analysis Flow
```
place_creature → check_line_of_sight → get_area_effect_targets → 
execute_tactical_actions
```

## Advanced Features

### Stronghold Management
- **facility types**: Predefined templates with upgrade paths
- **hireling system**: Recruitment, assignment, and loyalty management
- **business simulation**: Weekly income processing with market conditions
- **event system**: Random events with player choice consequences

### Spell Management
- **class-based progression**: Automatic spell slot allocation by class/level
- **spell preparation**: Prepared vs. known spell distinction
- **slot tracking**: Automatic usage and recovery tracking

### Encounter System
- **initiative order**: Automatic turn progression and round management
- **participant tracking**: Characters and NPCs with health monitoring
- **turn state**: Action economy management (action, bonus action, movement)

## Error Handling & Edge Cases

### Common Error Patterns
- **Invalid coordinates**: Out-of-bounds battlefield positions
- **Missing references**: Non-existent character/NPC IDs
- **Insufficient resources**: Zero spell slots, deceased participants
- **State conflicts**: Attempting actions in wrong turn order

### Recovery Strategies
- **graceful degradation**: Provide alternatives when primary action fails
- **state validation**: Check preconditions before executing actions
- **clear feedback**: Explain why actions failed and how to proceed

## Performance Considerations

### Optimization Patterns
- **batch operations**: Use batch tools for multiple similar actions
- **state caching**: Battlefield state cached in-memory for fast access
- **database indexing**: Character and NPC lookups optimized
- **lazy loading**: Complex queries executed only when needed

### Resource Management
- **SQLite connections**: Managed by GameDatabase class
- **memory usage**: Battlefield state cleared on server restart
- **file I/O**: Minimal, only for persistence and logging

## Integration Tips

### For AI Agents
- **Use tactical summaries** for strategic decision-making
- **Leverage batch operations** for efficiency
- **Monitor combat logs** for state tracking
- **Validate inputs** before calling spatial tools

### For Game Masters
- **Use battlefield visualization** for player communication
- **Leverage encounter system** for turn order management
- **Use stronghold tools** for downtime activities
- **Monitor quest progress** through structured updates

### For Players
- **Character creation** is fully automated with D&D 5E compliance
- **Spell management** handles all mechanical details automatically
- **Stronghold building** provides strategic campaign depth
- **Combat mechanics** follow official D&D 5E rules precisely