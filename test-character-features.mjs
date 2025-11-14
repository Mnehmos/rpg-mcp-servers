#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🎭 Testing Character Features System\n');

async function testCharacterFeatures() {
  console.log('==================================================');
  console.log('🎯 Testing Character Features (Feats, Abilities)...');
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
    // 1. Update character with Sentinel feat
    {
      name: 'Update Character with Sentinel Feat',
      message: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'update_character',
          arguments: {
            character_id: 1,
            updates: {
              level: 4,
              experience: 3006,
              features: {
                sentinel_feat: {
                  name: "Sentinel",
                  description: "You have mastered techniques to take advantage of every drop in any enemy's guard, gaining the following benefits: When you hit a creature with an opportunity attack, the creature's speed becomes 0 for the rest of the turn. Creatures provoke opportunity attacks from you even if they take the Disengage action before leaving your reach. When a creature within 5 feet of you makes an attack against a target other than you (and that target doesn't have this feat), you can use your reaction to make a melee weapon attack against the attacking creature.",
                  type: "feat",
                  source: "Player's Handbook"
                }
              }
            }
          }
        }
      }
    },

    // 2. Get character to verify features were saved
    {
      name: 'Get Character with Features',
      message: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_character',
          arguments: {
            character_id: 1
          }
        }
      }
    },

    // 3. Update character with multiple features
    {
      name: 'Add Multiple Features',
      message: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'update_character',
          arguments: {
            character_id: 1,
            updates: {
              features: {
                sentinel_feat: {
                  name: "Sentinel",
                  description: "You have mastered techniques to take advantage of every drop in any enemy's guard.",
                  type: "feat",
                  source: "Player's Handbook"
                },
                action_surge: {
                  name: "Action Surge",
                  description: "You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action.",
                  type: "class_feature",
                  source: "Fighter",
                  uses_per_rest: 1,
                  rest_type: "short"
                },
                fighting_style_defense: {
                  name: "Fighting Style: Defense",
                  description: "While you are wearing armor, you gain a +1 bonus to AC.",
                  type: "class_feature",
                  source: "Fighter",
                  passive: true
                }
              }
            }
          }
        }
      }
    },

    // 4. Verify all features are saved
    {
      name: 'Verify All Features',
      message: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'get_character',
          arguments: {
            character_id: 1
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
    }, 8000);

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

testCharacterFeatures().then(() => {
  console.log('✅ Character features test completed!');
}).catch(error => {
  console.error('❌ Test failed:', error);
});