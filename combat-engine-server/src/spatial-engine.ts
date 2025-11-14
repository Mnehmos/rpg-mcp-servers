// Complete D&D 5e Spatial Combat Engine
// Hybrid LLM + Algorithmic Approach for Tactical Combat

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface SizeInfo {
  category: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  squares: number; // Number of 5-foot squares the creature occupies
}

export interface Creature {
  id: string;
  name: string;
  position: Position;
  size: SizeInfo;
  speed: number;
  reach: number;
}

export interface TerrainFeature {
  type: 'wall' | 'pillar' | 'pit' | 'stairs' | 'door' | 'window';
  position: Position;
  dimensions: { width: number; height: number; depth: number };
  blocksMovement: boolean;
  blocksLineOfSight: boolean;
  coverType: 'none' | 'half' | 'three_quarters' | 'total';
}

export interface AreaEffect {
  id: string;
  name: string;
  shape: 'sphere' | 'cube' | 'cone' | 'line' | 'cylinder';
  center: Position;
  sizeParameter: number; // radius, side length, etc.
  direction?: number; // for cones and lines
  durationRounds: number;
}

export interface Battlefield {
  width: number;
  height: number;
  creatures: Map<string, Creature>;
  terrain: TerrainFeature[];
  areaEffects: AreaEffect[];
}

export class SpatialEngine {
  private battlefield: Battlefield;

  constructor(width: number = 20, height: number = 20) {
    this.battlefield = {
      width,
      height,
      creatures: new Map(),
      terrain: [],
      areaEffects: []
    };
  }

  // Distance calculation with proper 5-foot grid rules
  getDistance(pos1: Position, pos2: Position): number {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    const dz = Math.abs(pos1.z - pos2.z);
    
    // D&D 5e uses the "5-4-5" rule for diagonals in 3D
    const horizontal = Math.max(dx, dy) + Math.min(dx, dy) * 0.5;
    return Math.max(horizontal, dz) * 5; // Convert to feet
  }

  // Range categories for LLM processing
  getRangeCategory(distance: number): string {
    if (distance <= 5) return 'melee';
    if (distance <= 30) return 'close';
    if (distance <= 120) return 'medium';
    if (distance <= 600) return 'long';
    return 'extreme';
  }

  // Line of Sight calculation with cover assessment
  calculateLineOfSight(from: Position, to: Position): {
    hasLineOfSight: boolean;
    coverType: 'none' | 'half' | 'three_quarters' | 'total';
    blockedBy?: string[];
  } {
    const result: {
      hasLineOfSight: boolean;
      coverType: 'none' | 'half' | 'three_quarters' | 'total';
      blockedBy: string[];
    } = {
      hasLineOfSight: true,
      coverType: 'none',
      blockedBy: []
    };

    // Simple ray casting through terrain
    const steps = Math.max(
      Math.abs(to.x - from.x),
      Math.abs(to.y - from.y),
      Math.abs(to.z - from.z)
    );

    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const testPos = {
        x: Math.round(from.x + (to.x - from.x) * progress),
        y: Math.round(from.y + (to.y - from.y) * progress),
        z: Math.round(from.z + (to.z - from.z) * progress)
      };

      // Check terrain blocking
      for (const terrain of this.battlefield.terrain) {
        if (this.positionIntersectsTerrain(testPos, terrain)) {
          if (terrain.blocksLineOfSight) {
            if (terrain.coverType === 'total') {
              result.hasLineOfSight = false;
              result.coverType = 'total';
              result.blockedBy.push(terrain.type);
              return result;
            } else {
              result.coverType = this.getCombinedCover(result.coverType, terrain.coverType);
              result.blockedBy.push(terrain.type);
            }
          }
        }
      }
    }

    return result;
  }

  // A* pathfinding for movement validation
  findPath(from: Position, to: Position, creature: Creature): Position[] | null {
    // Simplified pathfinding - in production would use full A*
    const path: Position[] = [];
    let current = { ...from };

    while (this.getDistance(current, to) > 5) {
      const dx = to.x > current.x ? 1 : to.x < current.x ? -1 : 0;
      const dy = to.y > current.y ? 1 : to.y < current.y ? -1 : 0;
      
      const next = { x: current.x + dx, y: current.y + dy, z: current.z };
      
      if (this.isPositionValid(next, creature)) {
        current = next;
        path.push({ ...current });
      } else {
        return null; // Path blocked
      }
    }

    return path;
  }

  // Movement validation with opportunity attack detection
  validateMovement(creature: Creature, from: Position, to: Position, speed: number): {
    isValid: boolean;
    pathLength: number;
    opportunityAttacks: string[];
    path?: Position[];
  } {
    const path = this.findPath(from, to, creature);
    if (!path) {
      return { isValid: false, pathLength: 0, opportunityAttacks: [] };
    }

    const pathLength = this.calculatePathLength(path);
    if (pathLength > speed) {
      return { isValid: false, pathLength, opportunityAttacks: [] };
    }

    const opportunityAttacks = this.detectOpportunityAttacks(creature, path);
    
    return {
      isValid: true,
      pathLength,
      opportunityAttacks,
      path
    };
  }

  // Area of Effect targeting
  getTargetsInArea(effect: AreaEffect): string[] {
    const targets: string[] = [];

    for (const [id, creature] of this.battlefield.creatures) {
      if (this.isCreatureInAreaEffect(creature, effect)) {
        targets.push(id);
      }
    }

    return targets;
  }

  // LLM-friendly tactical situation description
  describeTacticalSituation(creatureId: string): string {
    // More robust creature lookup - try exact match first, then partial match
    let creature = this.battlefield.creatures.get(creatureId);
    
    if (!creature) {
      // Try to find by partial name match if exact ID fails
      for (const [id, c] of this.battlefield.creatures) {
        if (id.includes(creatureId) || c.name.toLowerCase().includes(creatureId.toLowerCase())) {
          creature = c;
          break;
        }
      }
    }
    
    if (!creature) {
      // Last resort: return detailed info about what's actually on the battlefield
      const availableCreatures = Array.from(this.battlefield.creatures.entries())
        .map(([id, c]) => `${id}:"${c.name}"`)
        .join(', ');
      return `Creature "${creatureId}" not found. Available creatures: ${availableCreatures || 'none'}`;
    }

    const descriptions: string[] = [];
    descriptions.push(`${creature.name} (${creature.size.category})`);

    // Describe position relative to others
    for (const [otherId, other] of this.battlefield.creatures) {
      if (otherId === creatureId) continue;

      const distance = this.getDistance(creature.position, other.position);
      const rangeCategory = this.getRangeCategory(distance);
      const los = this.calculateLineOfSight(creature.position, other.position);
      
      let positionDesc = `${rangeCategory} range to ${other.name} (${Math.round(distance)}ft)`;
      
      if (!los.hasLineOfSight) {
        positionDesc += ', no line of sight';
      } else if (los.coverType !== 'none') {
        positionDesc += `, ${los.coverType} cover`;
      } else {
        positionDesc += ', clear shot';
      }

      descriptions.push(positionDesc);
    }

    // Describe immediate threats
    const threateningCreatures = this.getThreateningCreatures(creatureId);
    if (threateningCreatures.length > 0) {
      descriptions.push(`Threatened by: ${threateningCreatures.join(', ')}`);
    }

    // Describe tactical features
    const nearbyTerrain = this.getNearbyTerrain(creature.position, 10);
    if (nearbyTerrain.length > 0) {
      descriptions.push(`Nearby: ${nearbyTerrain.map(t => t.type).join(', ')}`);
    }

    return descriptions.join('. ') + '.';
  }

  // Human-readable battlefield overview
  describeBattlefield(): string {
    const description: string[] = [];
    
    // Battlefield dimensions
    description.push(`⚔️ **BATTLEFIELD**: ${this.battlefield.width}×${this.battlefield.height} squares (${this.battlefield.width * 5}×${this.battlefield.height * 5} feet)`);
    
    // Terrain features
    if (this.battlefield.terrain.length > 0) {
      description.push('\n🏗️ **TERRAIN**:');
      for (const terrain of this.battlefield.terrain) {
        const pos = `(${terrain.position.x},${terrain.position.y})`;
        const size = `${terrain.dimensions.width}×${terrain.dimensions.height}×${terrain.dimensions.depth}ft`;
        const cover = terrain.coverType !== 'none' ? ` [${terrain.coverType} cover]` : '';
        const blocks = terrain.blocksMovement ? ' [blocks movement]' : '';
        description.push(`  • ${this.capitalizeFirst(terrain.type)} at ${pos} - ${size}${cover}${blocks}`);
      }
    }
    
    // Creature positions
    if (this.battlefield.creatures.size > 0) {
      description.push('\n👥 **COMBATANTS**:');
      const sortedCreatures = Array.from(this.battlefield.creatures.entries())
        .sort(([,a], [,b]) => b.position.z - a.position.z); // Sort by height (highest first)
      
      for (const [id, creature] of sortedCreatures) {
        const pos = `(${creature.position.x},${creature.position.y},${creature.position.z})`;
        const elevation = this.getElevationDescription(creature.position.z);
        const nearby = this.getTerrainAtPosition(creature.position);
        const location = nearby ? ` on ${nearby.type}` : elevation;
        description.push(`  • ${creature.name} at ${pos}${location} - ${creature.size.category} creature`);
      }
    }
    
    return description.join('\n');
  }

  // Enhanced tactical situation with narrative description
  describeDetailedTacticalSituation(creatureId: string): string {
    const creature = this.battlefield.creatures.get(creatureId);
    if (!creature) {
      return `❌ Creature "${creatureId}" not found on battlefield.`;
    }

    const sections: string[] = [];
    
    // Current position
    const elevation = this.getElevationDescription(creature.position.z);
    const terrain = this.getTerrainAtPosition(creature.position);
    const position = terrain ? `standing on a ${terrain.type}` : `positioned ${elevation}`;
    sections.push(`🎯 **${creature.name}** is ${position} at coordinates (${creature.position.x},${creature.position.y},${creature.position.z}).`);
    
    // Combat positioning
    const enemies: string[] = [];
    const allies: string[] = [];
    
    for (const [otherId, other] of this.battlefield.creatures) {
      if (otherId === creatureId) continue;
      
      const distance = this.getDistance(creature.position, other.position);
      const rangeCategory = this.getRangeCategory(distance);
      const los = this.calculateLineOfSight(creature.position, other.position);
      const heightDiff = other.position.z - creature.position.z;
      
      let positionDesc = `${other.name} (${Math.round(distance)}ft ${rangeCategory})`;
      
      // Height relationship
      if (heightDiff > 5) {
        positionDesc += ` above`;
      } else if (heightDiff < -5) {
        positionDesc += ` below`;
      }
      
      // Line of sight and cover
      if (!los.hasLineOfSight) {
        positionDesc += ` - NO LINE OF SIGHT`;
      } else if (los.coverType !== 'none') {
        positionDesc += ` - ${los.coverType} cover`;
      } else {
        positionDesc += ` - clear shot`;
      }
      
      // Assume others are enemies for now (could be enhanced with faction data)
      enemies.push(positionDesc);
    }
    
    if (enemies.length > 0) {
      sections.push(`⚔️ **ENEMIES IN SIGHT**: ${enemies.join(', ')}`);
    }
    
    // Tactical advantages/disadvantages
    const tactical: string[] = [];
    
    if (this.isCreatureFlanked(creatureId)) {
      tactical.push("⚠️ **FLANKED** - vulnerable to sneak attacks");
    }
    
    const threatening = this.getThreateningCreatures(creatureId);
    if (threatening.length > 0) {
      tactical.push(`⚠️ **THREATENED** by ${threatening.join(', ')} - movement provokes opportunity attacks`);
    }
    
    // Height advantages
    for (const [otherId, other] of this.battlefield.creatures) {
      if (otherId === creatureId) continue;
      if (this.hasHeightAdvantage(creatureId, otherId)) {
        tactical.push(`🏔️ **HEIGHT ADVANTAGE** over ${other.name}`);
      }
    }
    
    if (tactical.length > 0) {
      sections.push(tactical.join('\n'));
    }
    
    // Movement options
    const nearbyTerrain = this.getNearbyTerrain(creature.position, 15);
    if (nearbyTerrain.length > 0) {
      const options = nearbyTerrain.map(t => {
        const dist = Math.round(this.getDistance(creature.position, t.position));
        return `${t.type} (${dist}ft away)`;
      });
      sections.push(`🏃 **MOVEMENT OPTIONS**: ${options.join(', ')}`);
    }
    
    return sections.join('\n\n');
  }

  // ASCII battlefield visualization (simplified)
  generateBattlefieldMap(): string {
    const map: string[] = [];
    const width = Math.min(this.battlefield.width, 20); // Limit for readability
    const height = Math.min(this.battlefield.height, 15);
    
    map.push('📍 **BATTLEFIELD MAP** (X→, Y↓):');
    map.push('');
    
    // Create grid
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        let cell = '·'; // Empty space
        
        // Check for terrain
        const terrain = this.battlefield.terrain.find(t =>
          x >= t.position.x && x < t.position.x + t.dimensions.width &&
          y >= t.position.y && y < t.position.y + t.dimensions.height
        );
        
        if (terrain) {
          switch (terrain.type) {
            case 'wall': cell = '█'; break;
            case 'pillar': cell = '■'; break;
            case 'stairs': cell = '≡'; break;
            case 'door': cell = '▫'; break;
            default: cell = '▓';
          }
        }
        
        // Check for creatures (they override terrain)
        for (const [id, creature] of this.battlefield.creatures) {
          if (creature.position && creature.position.x === x && creature.position.y === y) {
            cell = creature.name.charAt(0).toUpperCase(); // First letter of name
            break;
          }
        }
        
        row += cell + ' ';
      }
      map.push(`${y.toString().padStart(2)}│${row}`);
    }
    
    // Add coordinate labels
    let xLabels = '  └';
    for (let x = 0; x < width; x++) {
      xLabels += (x % 10).toString() + ' ';
    }
    map.push(xLabels);
    
    // Add legend
    map.push('');
    map.push('**LEGEND**: █=wall, ■=pillar, ≡=stairs, Letters=creatures');
    
    return map.join('\n');
  }

  // Helper methods for descriptive text
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  private getElevationDescription(z: number): string {
    if (z === 0) return 'at ground level';
    if (z <= 5) return 'slightly elevated';
    if (z <= 10) return 'at moderate height';
    return 'at significant height';
  }
  
  private getTerrainAtPosition(pos: Position): TerrainFeature | null {
    return this.battlefield.terrain.find(terrain =>
      pos.x >= terrain.position.x &&
      pos.x < terrain.position.x + terrain.dimensions.width &&
      pos.y >= terrain.position.y &&
      pos.y < terrain.position.y + terrain.dimensions.height &&
      pos.z >= terrain.position.z &&
      pos.z <= terrain.position.z + terrain.dimensions.depth
    ) || null;
  }

  // Flanking calculation
  isCreatureFlanked(creatureId: string): boolean {
    const creature = this.battlefield.creatures.get(creatureId);
    if (!creature) return false;

    const enemies = Array.from(this.battlefield.creatures.values())
      .filter(c => c.id !== creatureId && this.getDistance(c.position, creature.position) <= 5);

    if (enemies.length < 2) return false;

    // Check if enemies are on opposite sides
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {
        if (this.areOpposite(enemies[i].position, enemies[j].position, creature.position)) {
          return true;
        }
      }
    }

    return false;
  }

  // Height advantage calculation
  hasHeightAdvantage(attackerId: string, targetId: string): boolean {
    const attacker = this.battlefield.creatures.get(attackerId);
    const target = this.battlefield.creatures.get(targetId);
    
    if (!attacker || !target) return false;
    
    return attacker.position.z > target.position.z + 5; // 5+ feet higher
  }

  // Private helper methods
  private positionIntersectsTerrain(pos: Position, terrain: TerrainFeature): boolean {
    return pos.x >= terrain.position.x && 
           pos.x < terrain.position.x + terrain.dimensions.width &&
           pos.y >= terrain.position.y && 
           pos.y < terrain.position.y + terrain.dimensions.height &&
           pos.z >= terrain.position.z && 
           pos.z < terrain.position.z + terrain.dimensions.depth;
  }

  private getCombinedCover(
    current: 'none' | 'half' | 'three_quarters' | 'total',
    additional: 'none' | 'half' | 'three_quarters' | 'total'
  ): 'none' | 'half' | 'three_quarters' | 'total' {
    const coverValues: Record<string, number> = { 'none': 0, 'half': 1, 'three_quarters': 2, 'total': 3 };
    const coverNames: ('none' | 'half' | 'three_quarters' | 'total')[] = ['none', 'half', 'three_quarters', 'total'];
    const maxValue = Math.max(coverValues[current], coverValues[additional]);
    return coverNames[maxValue];
  }

  private isPositionValid(pos: Position, creature: Creature): boolean {
    // Check bounds
    if (pos.x < 0 || pos.x >= this.battlefield.width || 
        pos.y < 0 || pos.y >= this.battlefield.height) {
      return false;
    }

    // Check terrain blocking
    for (const terrain of this.battlefield.terrain) {
      if (terrain.blocksMovement && this.positionIntersectsTerrain(pos, terrain)) {
        return false;
      }
    }

    // Check creature collision
    for (const [id, other] of this.battlefield.creatures) {
      if (other.id === creature.id) continue;
      if (this.getDistance(pos, other.position) < 5) {
        return false; // Occupied space
      }
    }

    return true;
  }

  private calculatePathLength(path: Position[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += this.getDistance(path[i-1], path[i]);
    }
    return total;
  }

  private detectOpportunityAttacks(creature: Creature, path: Position[]): string[] {
    const attacks: string[] = [];
    
    for (const pos of path) {
      for (const [id, other] of this.battlefield.creatures) {
        if (other.id === creature.id) continue;
        
        const distance = this.getDistance(pos, other.position);
        if (distance <= other.reach) {
          if (!attacks.includes(other.name)) {
            attacks.push(other.name);
          }
        }
      }
    }
    
    return attacks;
  }

  private isCreatureInAreaEffect(creature: Creature, effect: AreaEffect): boolean {
    const distance = this.getDistance(creature.position, effect.center);
    
    switch (effect.shape) {
      case 'sphere':
        return distance <= effect.sizeParameter;
      case 'cube':
        const halfSize = effect.sizeParameter / 2;
        return Math.abs(creature.position.x - effect.center.x) <= halfSize &&
               Math.abs(creature.position.y - effect.center.y) <= halfSize &&
               Math.abs(creature.position.z - effect.center.z) <= halfSize;
      // Add other shapes as needed
      default:
        return false;
    }
  }

  private getThreateningCreatures(creatureId: string): string[] {
    const creature = this.battlefield.creatures.get(creatureId);
    if (!creature) return [];

    const threatening: string[] = [];
    for (const [id, other] of this.battlefield.creatures) {
      if (id === creatureId) continue;
      
      const distance = this.getDistance(creature.position, other.position);
      if (distance <= other.reach) {
        threatening.push(other.name);
      }
    }

    return threatening;
  }

  private getNearbyTerrain(pos: Position, radius: number): TerrainFeature[] {
    return this.battlefield.terrain.filter(terrain => {
      const distance = this.getDistance(pos, terrain.position);
      return distance <= radius;
    });
  }

  private areOpposite(pos1: Position, pos2: Position, center: Position): boolean {
    // Simplified check - in production would use proper vector math
    const dx1 = pos1.x - center.x;
    const dy1 = pos1.y - center.y;
    const dx2 = pos2.x - center.x;
    const dy2 = pos2.y - center.y;
    
    // Check if roughly opposite (dot product negative)
    return (dx1 * dx2 + dy1 * dy2) < 0;
  }

  // Public API methods for MCP tools
  addCreature(creature: Creature): void {
    this.battlefield.creatures.set(creature.id, creature);
  }

  removeCreature(id: string): void {
    this.battlefield.creatures.delete(id);
  }

  moveCreature(id: string, newPosition: Position): boolean {
    const creature = this.battlefield.creatures.get(id);
    if (!creature) return false;
    
    if (this.isPositionValid(newPosition, creature)) {
      creature.position = newPosition;
      return true;
    }
    return false;
  }

  addTerrain(terrain: TerrainFeature): void {
    this.battlefield.terrain.push(terrain);
  }

  initializeBattlefield(width: number, height: number, terrain: TerrainFeature[] = []): void {
    // Preserve existing creatures if any
    const existingCreatures = this.battlefield?.creatures || new Map();
    
    this.battlefield = {
      width,
      height,
      creatures: existingCreatures,
      terrain: [...terrain],
      areaEffects: []
    };
  }

  getBattlefieldState(): Battlefield {
    return this.battlefield;
  }
}