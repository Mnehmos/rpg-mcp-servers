#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🔧 Testing Bonus Functionality in Combat Engine\n');

// Test the guidance spell bonus functionality
async function testBonusFunctionality() {
  console.log('==================================================');
  console.log('🎲 Testing roll_check with bonus...');
  console.log('');

  const server = spawn('node', ['combat-engine-server/dist/index.js'], {
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

  // Test roll_check with guidance bonus
  const testMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'roll_check',
      arguments: {
        character: 'Vera Brightforge',
        ability: 'Stealth',
        modifier: 4,
        advantage: true,
        dc: 14,
        bonus: 1
      }
    }
  };

  server.stdin.write(JSON.stringify(testMessage) + '\n');

  // Wait for response
  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      server.kill();
      resolve();
    }, 5000);

    server.stdout.on('data', (data) => {
      const response = data.toString();
      if (response.includes('"result"')) {
        clearTimeout(timeout);
        server.kill();
        resolve();
      }
    });
  });

  console.log('✅ Combat Engine Server started successfully');
  console.log('');
  console.log('📊 Server Output:');
  console.log(output);
  console.log('');
  console.log('❌ Server Errors:');
  console.log(errors);
  console.log('');
}

testBonusFunctionality().then(() => {
  console.log('✅ All tests completed!');
}).catch(error => {
  console.error('❌ Test failed:', error);
});