import { generateToken, verifyToken, authenticateToken, requireRole } from './auth.js';

/**
 * Test suite for authentication middleware
 * Tests token generation, verification, and middleware functions
 */

// Mock environment variables
process.env.JWT_SECRET = 'test_secret_key_for_testing';
process.env.JWT_EXPIRES_IN = '1h';

// Test data
const testUser = {
  id: 1,
  username: 'testuser',
  role: 'administrador'
};

console.log('Running authentication middleware tests...\n');

// Test 1: Token generation
console.log('Test 1: Generate JWT token');
try {
  const token = generateToken(testUser);
  console.log('✓ Token generated successfully');
  console.log(`  Token: ${token.substring(0, 50)}...`);
} catch (error) {
  console.error('✗ Token generation failed:', error.message);
  process.exit(1);
}

// Test 2: Token verification
console.log('\nTest 2: Verify valid token');
try {
  const token = generateToken(testUser);
  const decoded = verifyToken(token);
  
  if (decoded.id === testUser.id && 
      decoded.username === testUser.username && 
      decoded.role === testUser.role) {
    console.log('✓ Token verified successfully');
    console.log(`  Decoded: id=${decoded.id}, username=${decoded.username}, role=${decoded.role}`);
  } else {
    throw new Error('Decoded token does not match original user data');
  }
} catch (error) {
  console.error('✗ Token verification failed:', error.message);
  process.exit(1);
}

// Test 3: Invalid token verification
console.log('\nTest 3: Verify invalid token');
try {
  verifyToken('invalid.token.here');
  console.error('✗ Should have thrown error for invalid token');
  process.exit(1);
} catch (error) {
  console.log('✓ Invalid token rejected correctly');
  console.log(`  Error: ${error.message}`);
}

// Test 4: Missing JWT_SECRET
console.log('\nTest 4: Handle missing JWT_SECRET');
try {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  
  try {
    generateToken(testUser);
    console.error('✗ Should have thrown error for missing JWT_SECRET');
    process.exit(1);
  } catch (error) {
    console.log('✓ Missing JWT_SECRET detected correctly');
    console.log(`  Error: ${error.message}`);
  }
  
  process.env.JWT_SECRET = originalSecret;
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 5: authenticateToken middleware with valid token
console.log('\nTest 5: authenticateToken middleware with valid token');
try {
  const token = generateToken(testUser);
  
  const req = {
    headers: {
      authorization: `Bearer ${token}`
    }
  };
  
  const res = {
    status: (code) => ({
      json: (data) => {
        throw new Error(`Unexpected response: ${code} - ${JSON.stringify(data)}`);
      }
    })
  };
  
  const next = () => {
    if (req.user && 
        req.user.id === testUser.id && 
        req.user.username === testUser.username && 
        req.user.role === testUser.role) {
      console.log('✓ authenticateToken middleware passed');
      console.log(`  User attached: id=${req.user.id}, username=${req.user.username}, role=${req.user.role}`);
    } else {
      throw new Error('User not properly attached to request');
    }
  };
  
  authenticateToken(req, res, next);
} catch (error) {
  console.error('✗ authenticateToken middleware failed:', error.message);
  process.exit(1);
}

// Test 6: authenticateToken middleware without token
console.log('\nTest 6: authenticateToken middleware without token');
try {
  const req = {
    headers: {}
  };
  
  let responseSent = false;
  const res = {
    status: (code) => ({
      json: (data) => {
        if (code === 401 && data.error.message === 'Access token is required') {
          responseSent = true;
        }
        return res;
      }
    })
  };
  
  const next = () => {
    throw new Error('next() should not be called without token');
  };
  
  authenticateToken(req, res, next);
  
  if (responseSent) {
    console.log('✓ Missing token rejected correctly');
  } else {
    throw new Error('Expected 401 response for missing token');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 7: requireRole middleware with authorized role
console.log('\nTest 7: requireRole middleware with authorized role');
try {
  const req = {
    user: {
      id: 1,
      username: 'testuser',
      role: 'administrador'
    }
  };
  
  const res = {
    status: (code) => ({
      json: (data) => {
        throw new Error(`Unexpected response: ${code} - ${JSON.stringify(data)}`);
      }
    })
  };
  
  const next = () => {
    console.log('✓ requireRole middleware passed for authorized role');
  };
  
  const middleware = requireRole('administrador');
  middleware(req, res, next);
} catch (error) {
  console.error('✗ requireRole middleware failed:', error.message);
  process.exit(1);
}

// Test 8: requireRole middleware with unauthorized role
console.log('\nTest 8: requireRole middleware with unauthorized role');
try {
  const req = {
    user: {
      id: 1,
      username: 'testuser',
      role: 'compras'
    }
  };
  
  let responseSent = false;
  const res = {
    status: (code) => ({
      json: (data) => {
        if (code === 403 && data.error.message === 'Insufficient permissions for this operation') {
          responseSent = true;
        }
        return res;
      }
    })
  };
  
  const next = () => {
    throw new Error('next() should not be called for unauthorized role');
  };
  
  const middleware = requireRole('administrador');
  middleware(req, res, next);
  
  if (responseSent) {
    console.log('✓ Unauthorized role rejected correctly');
  } else {
    throw new Error('Expected 403 response for unauthorized role');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 9: requireRole middleware with multiple allowed roles
console.log('\nTest 9: requireRole middleware with multiple allowed roles');
try {
  const req = {
    user: {
      id: 1,
      username: 'testuser',
      role: 'contabilidad'
    }
  };
  
  const res = {
    status: (code) => ({
      json: (data) => {
        throw new Error(`Unexpected response: ${code} - ${JSON.stringify(data)}`);
      }
    })
  };
  
  const next = () => {
    console.log('✓ requireRole middleware passed for one of multiple allowed roles');
  };
  
  const middleware = requireRole(['administrador', 'contabilidad', 'tesoreria']);
  middleware(req, res, next);
} catch (error) {
  console.error('✗ requireRole middleware failed:', error.message);
  process.exit(1);
}

console.log('\n✓ All authentication middleware tests passed!');
