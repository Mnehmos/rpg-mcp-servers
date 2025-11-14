#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test the comprehensive stronghold management system
async function testStrongholdManagement() {
  console.log('🏰 Testing Complete Stronghold & Hireling Management System\n');

  // Start the game state server
  const serverPath = join(__dirname, 'game-state-server', 'src', 'index.ts');
  const server = spawn('node', ['-r', 'esbuild-register', serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let testsPassed = 0;
  let testsTotal = 0;

  // Helper function to send request
  function sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = Math.random();
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      let responseData = '';
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const dataHandler = (data) => {
        responseData += data.toString();
        try {
          const lines = responseData.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const response = JSON.parse(line);
            if (response.id === id) {
              clearTimeout(timeout);
              server.stdout.off('data', dataHandler);
              resolve(response);
              return;
            }
          }
        } catch (e) {
          // Continue accumulating data
        }
      };

      server.stdout.on('data', dataHandler);
      server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  // Test helper
  async function runTest(description, testFn) {
    testsTotal++;
    try {
      console.log(`⚡ Testing: ${description}`);
      await testFn();
      testsPassed++;
      console.log(`✅ PASSED: ${description}\n`);
    } catch (error) {
      console.log(`❌ FAILED: ${description}`);
      console.log(`   Error: ${error.message}\n`);
    }
  }

  try {
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 1: Create a character for stronghold testing
    let testCharacterId;
    await runTest('Create test character', async () => {
      const response = await sendRequest('tools/call', {
        name: 'create_character',
        arguments: {
          name: 'Baron Aldrich Stronghold',
          class: 'Fighter',
          race: 'Human',
          level: 15,
          stats: {
            strength: 18,
            dexterity: 12,
            constitution: 16,
            intelligence: 13,
            wisdom: 14,
            charisma: 16
          }
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
      
      // Extract character ID from response
      const match = response.result.content[0].text.match(/Character ID: (\d+)/);
      if (!match) {
        throw new Error('Could not extract character ID');
      }
      testCharacterId = parseInt(match[1]);
    });

    // Test 2: Create a stronghold
    let testStrongholdId;
    await runTest('Create stronghold', async () => {
      const response = await sendRequest('tools/call', {
        name: 'create_stronghold',
        arguments: {
          character_id: testCharacterId,
          name: "Dragonhold Fortress",
          location: "Sword Coast Mountains",
          stronghold_type: "Castle",
          level: 3,
          defense_bonus: 5,
          prosperity_level: 3,
          description: "A magnificent castle built on the ruins of an ancient dragon's lair, commanding strategic views of the surrounding lands."
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
      
      // Extract stronghold ID
      const match = response.result.content[0].text.match(/Stronghold ID: (\d+)/);
      if (!match) {
        throw new Error('Could not extract stronghold ID');
      }
      testStrongholdId = parseInt(match[1]);
    });

    // Test 3: Add facilities
    let facilityIds = [];
    const facilities = [
      {
        facility_type: 'Armory',
        name: 'The Dragon\'s Arsenal',
        level: 2,
        construction_cost: 1000,
        upkeep_cost: 50,
        build_time_weeks: 6,
        description: 'A master-crafted armory with enchanted weapon racks'
      },
      {
        facility_type: 'Library',
        name: 'Hall of Ancient Wisdom',
        level: 1,
        construction_cost: 750,
        upkeep_cost: 25,
        build_time_weeks: 8,
        description: 'A repository of magical knowledge and historical texts'
      },
      {
        facility_type: 'Smithy',
        name: 'Dragonfire Forge',
        level: 3,
        construction_cost: 1500,
        upkeep_cost: 75,
        build_time_weeks: 10,
        description: 'A forge powered by residual dragon magic'
      }
    ];

    for (const facility of facilities) {
      await runTest(`Add facility: ${facility.name}`, async () => {
        const response = await sendRequest('tools/call', {
          name: 'add_facility',
          arguments: {
            stronghold_id: testStrongholdId,
            ...facility
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        console.log(response.result.content[0].text);
        
        // Extract facility ID
        const match = response.result.content[0].text.match(/Facility ID: (\d+)/);
        if (match) {
          facilityIds.push(parseInt(match[1]));
        }
      });
    }

    // Test 4: List stronghold facilities
    await runTest('List stronghold facilities', async () => {
      const response = await sendRequest('tools/call', {
        name: 'get_stronghold_facilities',
        arguments: {
          stronghold_id: testStrongholdId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
      
      if (!response.result.content[0].text.includes('Dragon\'s Arsenal') ||
          !response.result.content[0].text.includes('Hall of Ancient Wisdom') ||
          !response.result.content[0].text.includes('Dragonfire Forge')) {
        throw new Error('Not all facilities found in list');
      }
    });

    // Test 5: List facility types
    await runTest('List facility types', async () => {
      const response = await sendRequest('tools/call', {
        name: 'list_facility_types',
        arguments: {}
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
    });

    // Test 6: Upgrade a facility
    if (facilityIds.length > 0) {
      await runTest('Upgrade facility', async () => {
        const response = await sendRequest('tools/call', {
          name: 'upgrade_facility',
          arguments: {
            facility_id: facilityIds[0],
            new_level: 3,
            upgrade_cost: 500
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        console.log(response.result.content[0].text);
        
        if (!response.result.content[0].text.includes('New Level: 3')) {
          throw new Error('Facility upgrade not reflected');
        }
      });
    }

    // Test 7: Recruit hirelings
    let hirelingIds = [];
    const hirelings = [
      {
        name: 'Captain Marcus Steel',
        hireling_type: 'military',
        profession: 'Guard Captain',
        tier: 'retainers',
        daily_wage_sp: 100,
        skill_bonus: 5,
        notes: 'Veteran soldier with 20 years experience'
      },
      {
        name: 'Elara Brightforge',
        hireling_type: 'artisan',
        profession: 'Master Smith',
        tier: 'specialists',
        daily_wage_sp: 30,
        skill_bonus: 8,
        notes: 'Renowned for her magical weapon crafting'
      },
      {
        name: 'Tom the Builder',
        hireling_type: 'construction',
        profession: 'Mason',
        tier: 'laborers',
        daily_wage_sp: 4,
        skill_bonus: 2,
        notes: 'Reliable stonework specialist'
      }
    ];

    for (const hireling of hirelings) {
      await runTest(`Recruit hireling: ${hireling.name}`, async () => {
        const response = await sendRequest('tools/call', {
          name: 'recruit_hireling',
          arguments: {
            character_id: testCharacterId,
            ...hireling
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        console.log(response.result.content[0].text);
        
        // Extract hireling ID
        const match = response.result.content[0].text.match(/Hireling ID: (\d+)/);
        if (match) {
          hirelingIds.push(parseInt(match[1]));
        }
      });
    }

    // Test 8: List character hirelings
    await runTest('List character hirelings', async () => {
      const response = await sendRequest('tools/call', {
        name: 'list_character_hirelings',
        arguments: {
          character_id: testCharacterId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
      
      if (!response.result.content[0].text.includes('Captain Marcus Steel') ||
          !response.result.content[0].text.includes('Elara Brightforge') ||
          !response.result.content[0].text.includes('Tom the Builder')) {
        throw new Error('Not all hirelings found in list');
      }
    });

    // Test 9: Assign hirelings to tasks
    if (hirelingIds.length > 0) {
      await runTest('Assign hireling to task', async () => {
        const response = await sendRequest('tools/call', {
          name: 'assign_hireling',
          arguments: {
            hireling_id: hirelingIds[0],
            task: 'Patrol the stronghold perimeter'
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        console.log(response.result.content[0].text);
      });
    }

    // Test 10: Manage hireling loyalty
    if (hirelingIds.length > 1) {
      await runTest('Manage hireling loyalty', async () => {
        const response = await sendRequest('tools/call', {
          name: 'manage_hireling_loyalty',
          arguments: {
            hireling_id: hirelingIds[1],
            loyalty_change: 10,
            reason: 'Received bonus for excellent craftsmanship'
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        console.log(response.result.content[0].text);
      });
    }

    // Test 11: Calculate hireling costs
    await runTest('Calculate hireling costs', async () => {
      const response = await sendRequest('tools/call', {
        name: 'calculate_hireling_costs',
        arguments: {
          character_id: testCharacterId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
    });

    // Test 12: Establish businesses
    let businessIds = [];
    const businesses = [
      {
        name: 'The Dragon\'s Rest Inn',
        business_type: 'hospitality',
        investment_cost: 2000,
        weekly_income: 150,
        risk_level: 'low',
        employee_count: 8,
        description: 'A high-end inn catering to wealthy travelers'
      },
      {
        name: 'Dragonfire Weapons',
        business_type: 'smithy',
        investment_cost: 3000,
        weekly_income: 200,
        risk_level: 'medium',
        employee_count: 6,
        description: 'Magical weapon and armor production'
      }
    ];

    for (const business of businesses) {
      await runTest(`Establish business: ${business.name}`, async () => {
        const response = await sendRequest('tools/call', {
          name: 'establish_business',
          arguments: {
            stronghold_id: testStrongholdId,
            ...business
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        console.log(response.result.content[0].text);
        
        // Extract business ID
        const match = response.result.content[0].text.match(/Business ID: (\d+)/);
        if (match) {
          businessIds.push(parseInt(match[1]));
        }
      });
    }

    // Test 13: List stronghold businesses
    await runTest('List stronghold businesses', async () => {
      const response = await sendRequest('tools/call', {
        name: 'get_stronghold_businesses',
        arguments: {
          stronghold_id: testStrongholdId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
    });

    // Test 14: Process weekly income
    await runTest('Process weekly income', async () => {
      const response = await sendRequest('tools/call', {
        name: 'process_weekly_income',
        arguments: {
          character_id: testCharacterId,
          week_number: 1
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
    });

    // Test 15: Generate stronghold event
    let eventId;
    await runTest('Generate stronghold event', async () => {
      const response = await sendRequest('tools/call', {
        name: 'generate_stronghold_event',
        arguments: {
          stronghold_id: testStrongholdId,
          event_type: 'opportunity'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
      
      // Extract event ID
      const match = response.result.content[0].text.match(/Event ID: (\d+)/);
      if (match) {
        eventId = parseInt(match[1]);
      }
    });

    // Test 16: List stronghold events
    await runTest('List stronghold events', async () => {
      const response = await sendRequest('tools/call', {
        name: 'get_stronghold_events',
        arguments: {
          stronghold_id: testStrongholdId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
    });

    // Test 17: Resolve stronghold event
    if (eventId) {
      await runTest('Resolve stronghold event', async () => {
        const response = await sendRequest('tools/call', {
          name: 'resolve_stronghold_event',
          arguments: {
            event_id: eventId,
            player_choice: 'Accept the opportunity',
            outcome: 'Gained valuable trade connections'
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        console.log(response.result.content[0].text);
      });
    }

    // Test 18: Get complete stronghold status
    await runTest('Get complete stronghold status', async () => {
      const response = await sendRequest('tools/call', {
        name: 'get_stronghold_status',
        arguments: {
          stronghold_id: testStrongholdId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
    });

    console.log('\n🏆 COMPREHENSIVE STRONGHOLD MANAGEMENT TEST RESULTS:');
    console.log(`✅ Passed: ${testsPassed}/${testsTotal} tests`);
    console.log(`📊 Success Rate: ${Math.round((testsPassed/testsTotal)*100)}%`);
    
    if (testsPassed === testsTotal) {
      console.log('\n🎉 All stronghold management tests passed! 🏰');
      console.log('🔧 Complete stronghold & hireling system is working perfectly');
      console.log('💼 Business operations are functional');
      console.log('📜 Event system is operational');
      console.log('🏗️ Facility management is complete');
      console.log('👥 Hireling management is fully implemented');
    } else {
      console.log(`\n⚠️ ${testsTotal - testsPassed} test(s) failed`);
      console.log('🔧 Some systems may need debugging');
    }

  } catch (error) {
    console.error('Test setup error:', error);
  } finally {
    server.kill();
  }
}

// Run tests
testStrongholdManagement().catch(console.error);