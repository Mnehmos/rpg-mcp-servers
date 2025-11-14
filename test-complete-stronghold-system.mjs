#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🏰 Testing Complete Stronghold & Hireling Management System\n');

async function testCompleteStrongholdSystem() {
  console.log('==================================================');
  console.log('🏗️ Testing Complete Stronghold Management...');
  console.log('');

  const server = spawn('node', ['game-state-server/dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let output = '';
  let errors = '';

  server.stdout.on('data', (data) => {
    output += data.toString();
  });

  server.stderr.on('data', (data) => {
    errors += data.toString();
  });

  const tests = [
    // 1. Create stronghold
    {
      name: 'Create Stronghold',
      message: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'create_stronghold',
          arguments: {
            character_id: 1,
            name: 'Castle Brightforge',
            location: 'Northern Hills',
            stronghold_type: 'Keep',
            level: 1,
            defense_bonus: 5,
            prosperity_level: 2,
            description: 'A mighty fortress overlooking the trade routes'
          }
        }
      }
    },

    // 2. Add facilities
    {
      name: 'Add Armory Facility',
      message: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'add_facility',
          arguments: {
            stronghold_id: 1,
            facility_type: 'military',
            name: 'Main Armory',
            level: 1,
            construction_cost: 2000,
            upkeep_cost: 50,
            build_time_weeks: 8,
            description: 'Houses weapons and armor for the garrison'
          }
        }
      }
    },

    // 3. Recruit hirelings
    {
      name: 'Recruit Specialist Hireling',
      message: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'recruit_hireling',
          arguments: {
            character_id: 1,
            name: 'Master Gareth',
            hireling_type: 'Weaponsmith',
            profession: 'Armorer',
            tier: 'specialists',
            daily_wage_sp: 30,
            skill_bonus: 5,
            abilities: {
              'weapon_crafting': 'expert',
              'armor_repair': 'skilled'
            },
            notes: 'Former military armorer with 20 years experience'
          }
        }
      }
    },

    // 4. Establish business
    {
      name: 'Establish Business',
      message: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'establish_business',
          arguments: {
            stronghold_id: 1,
            name: 'Brightforge Smithy',
            business_type: 'Weapon & Armor Crafting',
            investment_cost: 1500,
            weekly_income: 200,
            risk_level: 'medium',
            employee_count: 3,
            description: 'High-quality weapons and armor for adventurers'
          }
        }
      }
    },

    // 5. Process weekly income
    {
      name: 'Process Weekly Income',
      message: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'process_weekly_income',
          arguments: {
            character_id: 1,
            week_number: 1
          }
        }
      }
    },

    // 6. Generate stronghold event
    {
      name: 'Generate Stronghold Event',
      message: {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'generate_stronghold_event',
          arguments: {
            stronghold_id: 1,
            event_type: 'opportunity'
          }
        }
      }
    },

    // 7. Get complete stronghold status
    {
      name: 'Get Stronghold Status',
      message: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'get_stronghold_status',
          arguments: {
            stronghold_id: 1
          }
        }
      }
    }
  ];

  for (let i = 0; i < tests.length; i++) {
    console.log(`📋 Test ${i + 1}: ${tests[i].name}`);
    server.stdin.write(JSON.stringify(tests[i].message) + '\n');
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Wait for all responses
  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      server.kill();
      resolve();
    }, 10000);

    let responseCount = 0;
    server.stdout.on('data', (data) => {
      const response = data.toString();
      if (response.includes('"result"')) {
        responseCount++;
        if (responseCount >= tests.length) {
          clearTimeout(timeout);
          server.kill();
          resolve();
        }
      }
    });
  });

  console.log('✅ Game State Server started successfully');
  console.log('');
  console.log('📊 Server Output:');
  console.log(output);
  console.log('');
  console.log('❌ Server Errors:');
  console.log(errors);
  console.log('');
}

testCompleteStrongholdSystem().then(() => {
  console.log('✅ Complete stronghold system test completed!');
}).catch(error => {
  console.error('❌ Test failed:', error);
});