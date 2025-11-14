#!/usr/bin/env node

/**
 * Test script for batch encounter operations
 * Tests the cross-pollination between rpg-game-state and rpg-combat-engine
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

// Test the batch_add_to_encounter tool specifically
async function testBatchAddToEncounter() {
  console.log('🎲 Testing batch_add_to_encounter tool...\n');

  // Create test request for the tool
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'batch_add_to_encounter',
      arguments: {
        encounter_id: 1,
        participants: [
          {
            type: 'character',
            id: 1,
            initiative: 20,
            name: 'Test Character'
          },
          {
            type: 'npc', 
            id: 1,
            initiative: 15,
            name: 'Test NPC'
          }
        ]
      }
    }
  };

  return new Promise((resolve, reject) => {
    // Test the game-state-server
    const server = spawn('node', ['dist/index.js'], { 
      cwd: './game-state-server',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
      if (errorOutput.includes('running on stdio')) {
        console.log('✅ Game State Server started successfully');
        
        // Send the test request
        server.stdin.write(JSON.stringify(testRequest) + '\n');
      }
    });

    server.on('close', (code) => {
      console.log(`\n📊 Server Output:\n${output}`);
      if (errorOutput) {
        console.log(`\n❌ Server Errors:\n${errorOutput}`);
      }
      resolve(code);
    });

    // Kill server after 3 seconds
    setTimeout(() => {
      server.kill();
    }, 3000);
  });
}

// Test listing tools to verify batch_add_to_encounter exists
async function testListTools() {
  console.log('📋 Testing tools list...\n');

  const listRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  return new Promise((resolve, reject) => {
    const server = spawn('node', ['dist/index.js'], { 
      cwd: './game-state-server',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    server.stdout.on('data', (data) => {
      const response = data.toString();
      output += response;
      
      // Check if response contains our tool
      if (response.includes('batch_add_to_encounter')) {
        console.log('✅ batch_add_to_encounter tool found in tools list!');
      } else if (response.includes('tools')) {
        console.log('📋 Tools list received, checking...');
        console.log(response);
      }
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
      if (errorOutput.includes('running on stdio')) {
        console.log('✅ Game State Server started successfully');
        
        // Send the list tools request
        server.stdin.write(JSON.stringify(listRequest) + '\n');
      }
    });

    server.on('close', (code) => {
      resolve(code);
    });

    // Kill server after 3 seconds
    setTimeout(() => {
      server.kill();
    }, 3000);
  });
}

// Run tests
async function runTests() {
  console.log('🔧 Testing Batch Encounter Cross-Pollination\n');
  console.log('=' .repeat(50));
  
  try {
    await testListTools();
    console.log('\n' + '=' .repeat(50));
    await testBatchAddToEncounter();
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTests();