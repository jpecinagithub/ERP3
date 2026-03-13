/**
 * Manual test file for database connection module
 * Run with: node src/config/database.test.js
 */

import { testConnection, query, closePool, handleDatabaseError } from './database.js';

async function runTests() {
  console.log('=== Database Connection Module Tests ===\n');

  try {
    // Test 1: Connection with retry logic
    console.log('Test 1: Testing database connection with retry logic...');
    await testConnection(3, 2000);
    console.log('✓ Connection test passed\n');

    // Test 2: Simple query
    console.log('Test 2: Testing simple query...');
    const result = await query('SELECT 1 + 1 AS result');
    console.log('Query result:', result);
    console.log('✓ Query test passed\n');

    // Test 3: Error handling
    console.log('Test 3: Testing error handling...');
    const mockError = { code: 'ER_DUP_ENTRY', message: 'Duplicate entry' };
    const errorResponse = handleDatabaseError(mockError);
    console.log('Error response:', errorResponse);
    console.log('✓ Error handling test passed\n');

    console.log('=== All tests passed! ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  } finally {
    // Clean up
    await closePool();
    console.log('\nConnection pool closed. Tests complete.');
  }
}

// Run tests
runTests();
