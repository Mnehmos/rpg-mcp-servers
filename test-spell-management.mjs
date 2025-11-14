import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testSpellManagement() {
  console.log('🧪 Starting Spell Management Tests...\n');

  // Create client and connect to the game-state-server
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./game-state-server/dist/index.js']
  });

  const client = new Client({
    name: 'spell-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to game-state-server\n');

    // Test 1: Create a Level 1 Cleric character
    console.log('🧙 Test 1: Creating Level 1 Cleric character...');
    const createResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'create_character',
        arguments: {
          name: 'Vera the Cleric',
          class: 'Cleric',
          level: 1,
          wisdom: 16,
          stats: {
            strength: 12,
            dexterity: 10,
            constitution: 14,
            intelligence: 11,
            wisdom: 16,
            charisma: 13
          }
        }
      }
    });
    console.log('✅ Character created:', createResult.content[0].text.split('\n')[0]);

    // Extract character ID from the response
    const characterIdMatch = createResult.content[0].text.match(/🆔 Character ID: (\d+)/);
    const characterId = parseInt(characterIdMatch[1]);
    console.log(`📊 Character ID: ${characterId}\n`);

    // Test 2: Initialize spellcasting
    console.log('🔮 Test 2: Initializing spellcasting...');
    const initResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'initialize_spellcasting',
        arguments: {
          character_id: characterId,
          character_class: 'Cleric',
          level: 1,
          spellcasting_ability: 'Wisdom'
        }
      }
    });
    console.log('✅ Spellcasting initialized');
    console.log(initResult.content[0].text + '\n');

    // Test 3: Add some spells
    console.log('📜 Test 3: Adding spells to spellbook...');
    
    // Add cantrips
    await client.request({
      method: 'tools/call',
      params: {
        name: 'add_spell',
        arguments: {
          character_id: characterId,
          spell_name: 'Sacred Flame',
          spell_level: 0,
          description: 'A cantrip that creates divine fire'
        }
      }
    });

    await client.request({
      method: 'tools/call',
      params: {
        name: 'add_spell',
        arguments: {
          character_id: characterId,
          spell_name: 'Light',
          spell_level: 0,
          description: 'A cantrip that creates magical light'
        }
      }
    });

    // Add 1st level spells
    await client.request({
      method: 'tools/call',
      params: {
        name: 'add_spell',
        arguments: {
          character_id: characterId,
          spell_name: 'Cure Wounds',
          spell_level: 1,
          description: 'Heals 1d8 + spellcasting modifier hit points'
        }
      }
    });

    await client.request({
      method: 'tools/call',
      params: {
        name: 'add_spell',
        arguments: {
          character_id: characterId,
          spell_name: 'Healing Word',
          spell_level: 1,
          description: 'Bonus action healing spell'
        }
      }
    });

    console.log('✅ Added Sacred Flame, Light, Cure Wounds, and Healing Word\n');

    // Test 4: Check spell slots
    console.log('🔋 Test 4: Checking spell slots...');
    const slotsResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'get_spell_slots',
        arguments: {
          character_id: characterId
        }
      }
    });
    console.log(slotsResult.content[0].text + '\n');

    // Test 5: View spellbook
    console.log('📚 Test 5: Viewing complete spellbook...');
    const spellsResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'get_character_spells',
        arguments: {
          character_id: characterId
        }
      }
    });
    console.log(spellsResult.content[0].text + '\n');

    // Test 6: Cast a cantrip (no spell slot required)
    console.log('✨ Test 6: Casting Sacred Flame (cantrip)...');
    const cantripResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'cast_spell',
        arguments: {
          character_id: characterId,
          spell_name: 'Sacred Flame'
        }
      }
    });
    console.log(cantripResult.content[0].text + '\n');

    // Test 7: Cast a 1st level spell (uses spell slot)
    console.log('🌟 Test 7: Casting Cure Wounds (1st level)...');
    const spellResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'cast_spell',
        arguments: {
          character_id: characterId,
          spell_name: 'Cure Wounds'
        }
      }
    });
    console.log(spellResult.content[0].text + '\n');

    // Test 8: Check remaining spell slots
    console.log('🔋 Test 8: Checking remaining spell slots...');
    const remainingSlotsResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'get_spell_slots',
        arguments: {
          character_id: characterId
        }
      }
    });
    console.log(remainingSlotsResult.content[0].text + '\n');

    // Test 9: Try to cast another 1st level spell (should use second slot)
    console.log('🌟 Test 9: Casting Healing Word (1st level)...');
    const secondSpellResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'cast_spell',
        arguments: {
          character_id: characterId,
          spell_name: 'Healing Word'
        }
      }
    });
    console.log(secondSpellResult.content[0].text + '\n');

    // Test 10: Try to cast when out of spell slots
    console.log('❌ Test 10: Trying to cast when out of spell slots...');
    const noSlotsResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'cast_spell',
        arguments: {
          character_id: characterId,
          spell_name: 'Cure Wounds'
        }
      }
    });
    console.log(noSlotsResult.content[0].text + '\n');

    // Test 11: Reset spell slots (like a long rest)
    console.log('🌅 Test 11: Taking a long rest (reset spell slots)...');
    const resetResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'reset_spell_slots',
        arguments: {
          character_id: characterId
        }
      }
    });
    console.log(resetResult.content[0].text + '\n');

    // Test 12: Verify slots are restored
    console.log('🔋 Test 12: Checking restored spell slots...');
    const restoredSlotsResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'get_spell_slots',
        arguments: {
          character_id: characterId
        }
      }
    });
    console.log(restoredSlotsResult.content[0].text + '\n');

    console.log('🎉 All spell management tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

testSpellManagement().catch(console.error);