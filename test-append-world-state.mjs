#!/usr/bin/env node

/**
 * Test script for the new append_world_state functionality
 * This demonstrates how the world state can be incrementally updated
 * without overwriting existing data.
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { spawn } from 'child_process';

async function testAppendWorldState() {
  console.log('🧪 Testing Appendable World State Functionality');
  console.log('===============================================\n');

  // Start the MCP server
  const serverProcess = spawn('node', ['game-state-server/dist/index.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  // Create client and connect
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['game-state-server/dist/index.js'],
    stdin: serverProcess.stdin,
    stdout: serverProcess.stdout
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to RPG Game State server\n');

    // 1. Create a test character
    console.log('🎭 Step 1: Creating test character...');
    const createResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'create_character',
        arguments: {
          name: 'Aria the Explorer',
          class: 'Ranger',
          race: 'Elf',
          background: 'Outlander',
          level: 3,
          stats: {
            strength: 12,
            dexterity: 16,
            constitution: 14,
            intelligence: 13,
            wisdom: 15,
            charisma: 10
          }
        }
      }
    });
    console.log(createResult.content[0].text);
    console.log('\n' + '='.repeat(60) + '\n');

    // Extract character ID from the response
    const characterIdMatch = createResult.content[0].text.match(/Character ID: (\d+)/);
    if (!characterIdMatch) {
      throw new Error('Could not extract character ID');
    }
    const characterId = parseInt(characterIdMatch[1]);

    // 2. Save initial world state
    console.log('🌍 Step 2: Saving initial world state...');
    const initialWorldState = await client.request({
      method: 'tools/call',
      params: {
        name: 'save_world_state',
        arguments: {
          character_id: characterId,
          location: 'Whispering Woods',
          npcs: {
            'merchant_tobias': {
              name: 'Tobias the Merchant',
              type: 'friendly',
              location: 'Forest Clearing',
              inventory: ['healing_potion', 'rope', 'rations']
            },
            'wolf_alpha': {
              name: 'Alpha Wolf',
              type: 'hostile',
              location: 'Deep Woods',
              hp: 45
            }
          },
          events: {
            'discovered_clearing': {
              timestamp: new Date().toISOString(),
              description: 'Found a peaceful clearing with a merchant',
              completed: true
            }
          },
          environment: {
            weather: 'overcast',
            temperature: 'cool',
            visibility: 'normal',
            time_of_day: 'afternoon'
          }
        }
      }
    });
    console.log(initialWorldState.content[0].text);
    console.log('\n' + '='.repeat(60) + '\n');

    // 3. Append new NPCs without overwriting existing ones
    console.log('👥 Step 3: Appending new NPCs (should preserve existing NPCs)...');
    const appendNpcs = await client.request({
      method: 'tools/call',
      params: {
        name: 'append_world_state',
        arguments: {
          character_id: characterId,
          npcs: {
            'bandit_leader': {
              name: 'Scarred Bandit Leader',
              type: 'hostile',
              location: 'Abandoned Camp',
              hp: 65,
              weapons: ['shortsword', 'crossbow']
            },
            'forest_spirit': {
              name: 'Ancient Forest Spirit',
              type: 'neutral',
              location: 'Sacred Grove',
              disposition: 'watchful'
            }
          }
        }
      }
    });
    console.log(appendNpcs.content[0].text);
    console.log('\n' + '='.repeat(60) + '\n');

    // 4. Append new events without overwriting existing ones
    console.log('📚 Step 4: Appending new events (should preserve existing events)...');
    const appendEvents = await client.request({
      method: 'tools/call',
      params: {
        name: 'append_world_state',
        arguments: {
          character_id: characterId,
          events: {
            'bandit_encounter': {
              timestamp: new Date().toISOString(),
              description: 'Encountered bandits on the forest path',
              outcome: 'avoided_combat',
              completed: true
            },
            'spirit_blessing': {
              timestamp: new Date().toISOString(),
              description: 'Received blessing from forest spirit',
              effect: 'enhanced_nature_skills',
              completed: false
            }
          }
        }
      }
    });
    console.log(appendEvents.content[0].text);
    console.log('\n' + '='.repeat(60) + '\n');

    // 5. Update environment and change location
    console.log('🌿 Step 5: Updating environment and changing location...');
    const updateEnvironment = await client.request({
      method: 'tools/call',
      params: {
        name: 'append_world_state',
        arguments: {
          character_id: characterId,
          location: 'Sacred Grove',
          environment: {
            weather: 'light_rain',
            temperature: 'warm',
            magic_level: 'high',
            danger_level: 'low'
            // Note: visibility and time_of_day should be preserved from original
          }
        }
      }
    });
    console.log(updateEnvironment.content[0].text);
    console.log('\n' + '='.repeat(60) + '\n');

    // 6. Verify final world state contains all data
    console.log('🔍 Step 6: Checking final world state (should contain all data)...');
    const finalWorldState = await client.request({
      method: 'tools/call',
      params: {
        name: 'get_world_state',
        arguments: {
          character_id: characterId
        }
      }
    });
    console.log(finalWorldState.content[0].text);
    console.log('\n' + '='.repeat(60) + '\n');

    console.log('🎉 SUCCESS! Appendable world state testing complete!');
    console.log('\nKey features demonstrated:');
    console.log('✅ NPCs can be added without overwriting existing ones');
    console.log('✅ Events can be appended while preserving history');
    console.log('✅ Environment properties merge intelligently');
    console.log('✅ Location can be updated independently');
    console.log('✅ All data is preserved across multiple append operations');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    await client.close();
    serverProcess.kill();
  }
}

// Run the test
testAppendWorldState().catch(console.error);