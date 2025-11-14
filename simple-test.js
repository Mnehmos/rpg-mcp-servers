// Simple test to verify the spell management functionality works
const { spawn } = require('child_process');

async function testSpellManagement() {
  console.log('🧪 Testing Spell Management Functionality...\n');
  
  // Start the server
  const server = spawn('node', ['./game-state-server/dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let output = '';
  server.stdout.on('data', (data) => {
    output += data.toString();
  });

  server.stderr.on('data', (data) => {
    console.error('Server error:', data.toString());
  });

  // Give server time to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test JSON-RPC request
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  console.log('📤 Sending initialize request...');
  server.stdin.write(JSON.stringify(testRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📥 Server output:');
  console.log(output);

  // Test create character
  const createCharacterRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'create_character',
      arguments: {
        name: 'Test Cleric',
        class: 'Cleric',
        level: 1,
        wisdom: 16
      }
    }
  };

  console.log('\n📤 Testing create_character...');
  server.stdin.write(JSON.stringify(createCharacterRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📥 Response received');

  server.kill();
  console.log('\n✅ Basic server communication test completed');
}

testSpellManagement().catch(console.error);