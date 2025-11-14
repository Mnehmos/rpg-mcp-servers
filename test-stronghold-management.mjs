#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test the stronghold management system
async function testStrongholdManagement() {
  console.log('🏰 Testing Stronghold & Hireling Management System\n');

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
      }, 5000);

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
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 1: Create a character for stronghold testing
    let testCharacterId;
    await runTest('Create test character', async () => {
      const response = await sendRequest('tools/call', {
        name: 'create_character',
        arguments: {
          name: 'Lord Aldrich Stronghold',
          class: 'Fighter',
          race: 'Human',
          level: 10,
          stats: {
            strength: 16,
            dexterity: 12,
            constitution: 14,
            intelligence: 13,
            wisdom: 12,
            charisma: 15
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
          name: "Ironheart Keep",
          location: "Northern Mountains",
          stronghold_type: "Fortress",
          level: 2,
          defense_bonus: 3,
          prosperity_level: 2,
          description: "A mighty fortress carved into the mountainside, overlooking the trade routes below."
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

    // Test 3: Get character's strongholds
    await runTest('List character strongholds', async () => {
      const response = await sendRequest('tools/call', {
        name: 'get_character_strongholds',
        arguments: {
          character_id: testCharacterId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
      
      if (!response.result.content[0].text.includes('Ironheart Keep')) {
        throw new Error('Stronghold not found in character\'s list');
      }
    });

    // Test 4: Get stronghold status
    await runTest('Get stronghold status', async () => {
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
      
      if (!response.result.content[0].text.includes('Ironheart Keep')) {
        throw new Error('Stronghold status not returned correctly');
      }
    });

    // Test 5: Update stronghold
    await runTest('Update stronghold', async () => {
      const response = await sendRequest('tools/call', {
        name: 'update_stronghold',
        arguments: {
          stronghold_id: testStrongholdId,
          updates: {
            level: 3,
            defense_bonus: 5,
            prosperity_level: 3
          }
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
      
      if (!response.result.content[0].text.includes('Level: 3')) {
        throw new Error('Stronghold not updated correctly');
      }
    });

    // Test 6: Add facility (basic test)
    await runTest('Add facility to stronghold', async () => {
      const response = await sendRequest('tools/call', {
        name: 'add_facility',
        arguments: {
          stronghold_id: testStrongholdId,
          facility_type: 'Armory',
          name: 'The Iron Arsenal',
          level: 1,
          construction_cost: 500,
          upkeep_cost: 25,
          build_time_weeks: 4,
          description: 'A well-stocked armory for the stronghold garrison'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(response.result.content[0].text);
      
      if (!response.result.content[0].text.includes('The Iron Arsenal')) {
        throw new Error('Facility not added correctly');
      }
    });

    // Test 7-12: Test placeholder tools (should return development message)
    const placeholderTools = [
      'upgrade_facility',
      'recruit_hireling', 
      'establish_business',
      'generate_stronghold_event'
    ];

    for (const toolName of placeholderTools) {
      await runTest(`Test ${toolName} placeholder`, async () => {
        const response = await sendRequest('tools/call', {
          name: toolName,
          arguments: {}
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        console.log(response.result.content[0].text);
        
        if (!response.result.content[0].text.includes('FEATURE IN DEVELOPMENT')) {
          throw new Error('Placeholder response not returned');
        }
      });
    }

    console.log('\n🏆 STRONGHOLD MANAGEMENT TEST RESULTS:');
    console.log(`✅ Passed: ${testsPassed}/${testsTotal} tests`);
    console.log(`📊 Success Rate: ${Math.round((testsPassed/testsTotal)*100)}%`);
    
    if (testsPassed === testsTotal) {
      console.log('\n🎉 All stronghold management tests passed! 🏰');
      console.log('🔧 Basic stronghold system is working correctly');
      console.log('🚧 Advanced features marked as in development');
    } else {
      console.log(`\n⚠️ ${testsTotal - testsPassed} test(s) failed`);
    }

  } catch (error) {
    console.error('Test setup error:', error);
  } finally {
    server.kill();
  }
}

// Run tests
testStrongholdManagement().catch(console.error);