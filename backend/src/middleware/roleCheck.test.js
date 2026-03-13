import {
  checkRoleAccess,
  requireRole,
  requireCompras,
  requireContabilidad,
  requireTesoreria,
  requireAdministrador,
  requireComprasOrAdmin,
  requireContabilidadOrAdmin,
  requireTesoreriaOrAdmin
} from './roleCheck.js';

/**
 * Test suite for role-based authorization middleware
 * Tests module access control and role validation
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 30.3
 */

console.log('Running role-based authorization middleware tests...\n');

// Helper function to create mock request
const createMockRequest = (path, role) => ({
  path,
  user: role ? { id: 1, username: 'testuser', role } : null
});

// Helper function to create mock response
const createMockResponse = () => {
  const res = {
    statusCode: null,
    jsonData: null
  };
  res.status = (code) => {
    res.statusCode = code;
    return {
      json: (data) => {
        res.jsonData = data;
        return res;
      }
    };
  };
  return res;
};

// Helper function to create mock next
const createMockNext = () => {
  let called = false;
  const next = () => { called = true; };
  next.wasCalled = () => called;
  return next;
};

// Test 1: checkRoleAccess - compras role accessing purchase module
console.log('Test 1: checkRoleAccess - compras role accessing purchase module');
try {
  const req = createMockRequest('/api/budgets', 'compras');
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ Compras user can access purchase module');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 2: checkRoleAccess - compras role blocked from accounting module
console.log('\nTest 2: checkRoleAccess - compras role blocked from accounting module');
try {
  const req = createMockRequest('/api/accounts', 'compras');
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (res.statusCode === 403 && !next.wasCalled()) {
    console.log('✓ Compras user blocked from accounting module');
    console.log(`  Error message: ${res.jsonData.error.message}`);
  } else {
    throw new Error('Expected 403 response');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 3: checkRoleAccess - contabilidad role accessing accounting module
console.log('\nTest 3: checkRoleAccess - contabilidad role accessing accounting module');
try {
  const req = createMockRequest('/api/journal-entries', 'contabilidad');
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ Contabilidad user can access accounting module');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 4: checkRoleAccess - contabilidad role blocked from purchase module
console.log('\nTest 4: checkRoleAccess - contabilidad role blocked from purchase module');
try {
  const req = createMockRequest('/api/purchase-orders', 'contabilidad');
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (res.statusCode === 403 && !next.wasCalled()) {
    console.log('✓ Contabilidad user blocked from purchase module');
  } else {
    throw new Error('Expected 403 response');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 5: checkRoleAccess - tesoreria role accessing treasury module
console.log('\nTest 5: checkRoleAccess - tesoreria role accessing treasury module');
try {
  const req = createMockRequest('/api/sales-invoices', 'tesoreria');
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ Tesoreria user can access treasury module');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 6: checkRoleAccess - tesoreria role blocked from accounting module
console.log('\nTest 6: checkRoleAccess - tesoreria role blocked from accounting module');
try {
  const req = createMockRequest('/api/reports/balance', 'tesoreria');
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (res.statusCode === 403 && !next.wasCalled()) {
    console.log('✓ Tesoreria user blocked from accounting module');
  } else {
    throw new Error('Expected 403 response');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 6b: checkRoleAccess - tesoreria role accessing purchase invoices route
console.log('\nTest 6b: checkRoleAccess - tesoreria role accessing purchase invoices route');
try {
  const req = createMockRequest('/api/purchase-invoices', 'tesoreria');
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ Tesoreria user can access purchase invoices');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 7: checkRoleAccess - administrador role accessing all modules
console.log('\nTest 7: checkRoleAccess - administrador role accessing all modules');
try {
  const modules = [
    '/api/budgets',
    '/api/accounts',
    '/api/sales-invoices',
    '/api/items'
  ];

  for (const path of modules) {
    const req = createMockRequest(path, 'administrador');
    const res = createMockResponse();
    const next = createMockNext();

    checkRoleAccess(req, res, next);

    if (!next.wasCalled()) {
      throw new Error(`Administrador blocked from ${path}`);
    }
  }

  console.log('✓ Administrador user can access all modules');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 8: checkRoleAccess - compras role blocked from master data
console.log('\nTest 8: checkRoleAccess - compras role blocked from master data');
try {
  const req = createMockRequest('/api/users', 'compras');
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (res.statusCode === 403 && !next.wasCalled()) {
    console.log('✓ Compras user blocked from master data module');
  } else {
    throw new Error('Expected 403 response');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 9: checkRoleAccess - unauthenticated request
console.log('\nTest 9: checkRoleAccess - unauthenticated request');
try {
  const req = createMockRequest('/api/budgets', null);
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (res.statusCode === 401 && !next.wasCalled()) {
    console.log('✓ Unauthenticated request rejected');
    console.log(`  Error message: ${res.jsonData.error.message}`);
  } else {
    throw new Error('Expected 401 response');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 10: checkRoleAccess - non-module route allowed
console.log('\nTest 10: checkRoleAccess - non-module route allowed');
try {
  const req = createMockRequest('/api/auth/login', 'compras');
  const res = createMockResponse();
  const next = createMockNext();

  checkRoleAccess(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ Non-module routes allowed for all authenticated users');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 11: requireCompras - authorized
console.log('\nTest 11: requireCompras - authorized');
try {
  const req = { user: { id: 1, username: 'test', role: 'compras' } };
  const res = createMockResponse();
  const next = createMockNext();

  requireCompras(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ requireCompras allows compras role');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 12: requireCompras - unauthorized
console.log('\nTest 12: requireCompras - unauthorized');
try {
  const req = { user: { id: 1, username: 'test', role: 'contabilidad' } };
  const res = createMockResponse();
  const next = createMockNext();

  requireCompras(req, res, next);

  if (res.statusCode === 403 && !next.wasCalled()) {
    console.log('✓ requireCompras blocks non-compras role');
  } else {
    throw new Error('Expected 403 response');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 13: requireContabilidad - authorized
console.log('\nTest 13: requireContabilidad - authorized');
try {
  const req = { user: { id: 1, username: 'test', role: 'contabilidad' } };
  const res = createMockResponse();
  const next = createMockNext();

  requireContabilidad(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ requireContabilidad allows contabilidad role');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 14: requireTesoreria - authorized
console.log('\nTest 14: requireTesoreria - authorized');
try {
  const req = { user: { id: 1, username: 'test', role: 'tesoreria' } };
  const res = createMockResponse();
  const next = createMockNext();

  requireTesoreria(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ requireTesoreria allows tesoreria role');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 15: requireAdministrador - authorized
console.log('\nTest 15: requireAdministrador - authorized');
try {
  const req = { user: { id: 1, username: 'test', role: 'administrador' } };
  const res = createMockResponse();
  const next = createMockNext();

  requireAdministrador(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ requireAdministrador allows administrador role');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 16: requireComprasOrAdmin - compras authorized
console.log('\nTest 16: requireComprasOrAdmin - compras authorized');
try {
  const req = { user: { id: 1, username: 'test', role: 'compras' } };
  const res = createMockResponse();
  const next = createMockNext();

  requireComprasOrAdmin(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ requireComprasOrAdmin allows compras role');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 17: requireComprasOrAdmin - administrador authorized
console.log('\nTest 17: requireComprasOrAdmin - administrador authorized');
try {
  const req = { user: { id: 1, username: 'test', role: 'administrador' } };
  const res = createMockResponse();
  const next = createMockNext();

  requireComprasOrAdmin(req, res, next);

  if (next.wasCalled()) {
    console.log('✓ requireComprasOrAdmin allows administrador role');
  } else {
    throw new Error('Expected next() to be called');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 18: requireComprasOrAdmin - unauthorized
console.log('\nTest 18: requireComprasOrAdmin - unauthorized');
try {
  const req = { user: { id: 1, username: 'test', role: 'contabilidad' } };
  const res = createMockResponse();
  const next = createMockNext();

  requireComprasOrAdmin(req, res, next);

  if (res.statusCode === 403 && !next.wasCalled()) {
    console.log('✓ requireComprasOrAdmin blocks unauthorized role');
  } else {
    throw new Error('Expected 403 response');
  }
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 19: requireContabilidadOrAdmin - multiple roles
console.log('\nTest 19: requireContabilidadOrAdmin - multiple roles');
try {
  const roles = ['contabilidad', 'administrador'];
  
  for (const role of roles) {
    const req = { user: { id: 1, username: 'test', role } };
    const res = createMockResponse();
    const next = createMockNext();

    requireContabilidadOrAdmin(req, res, next);

    if (!next.wasCalled()) {
      throw new Error(`Expected ${role} to be authorized`);
    }
  }

  console.log('✓ requireContabilidadOrAdmin allows both contabilidad and administrador');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 20: requireTesoreriaOrAdmin - multiple roles
console.log('\nTest 20: requireTesoreriaOrAdmin - multiple roles');
try {
  const roles = ['tesoreria', 'administrador'];
  
  for (const role of roles) {
    const req = { user: { id: 1, username: 'test', role } };
    const res = createMockResponse();
    const next = createMockNext();

    requireTesoreriaOrAdmin(req, res, next);

    if (!next.wasCalled()) {
      throw new Error(`Expected ${role} to be authorized`);
    }
  }

  console.log('✓ requireTesoreriaOrAdmin allows both tesoreria and administrador');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 21: requireRole with custom roles array
console.log('\nTest 21: requireRole with custom roles array');
try {
  const customMiddleware = requireRole(['compras', 'contabilidad']);
  
  // Test authorized role
  const req1 = { user: { id: 1, username: 'test', role: 'compras' } };
  const res1 = createMockResponse();
  const next1 = createMockNext();
  customMiddleware(req1, res1, next1);
  
  if (!next1.wasCalled()) {
    throw new Error('Expected compras to be authorized');
  }
  
  // Test unauthorized role
  const req2 = { user: { id: 1, username: 'test', role: 'tesoreria' } };
  const res2 = createMockResponse();
  const next2 = createMockNext();
  customMiddleware(req2, res2, next2);
  
  if (res2.statusCode !== 403 || next2.wasCalled()) {
    throw new Error('Expected tesoreria to be blocked');
  }

  console.log('✓ requireRole works with custom roles array');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 22: All purchase module routes blocked for non-compras/admin
console.log('\nTest 22: All purchase module routes blocked for non-compras/admin');
try {
  const purchaseRoutes = [
    '/api/budgets',
    '/api/budgets/123',
    '/api/purchase-orders',
    '/api/purchase-invoices',
    '/api/inventory'
  ];

  for (const path of purchaseRoutes) {
    const req = createMockRequest(path, 'contabilidad');
    const res = createMockResponse();
    const next = createMockNext();

    checkRoleAccess(req, res, next);

    if (res.statusCode !== 403 || next.wasCalled()) {
      throw new Error(`Expected ${path} to be blocked for contabilidad`);
    }
  }

  console.log('✓ All purchase module routes properly protected');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 23: All accounting module routes blocked for non-contabilidad/admin
console.log('\nTest 23: All accounting module routes blocked for non-contabilidad/admin');
try {
  const accountingRoutes = [
    '/api/accounts',
    '/api/journal-entries',
    '/api/reports/balance',
    '/api/reports/pnl'
  ];

  for (const path of accountingRoutes) {
    const req = createMockRequest(path, 'compras');
    const res = createMockResponse();
    const next = createMockNext();

    checkRoleAccess(req, res, next);

    if (res.statusCode !== 403 || next.wasCalled()) {
      throw new Error(`Expected ${path} to be blocked for compras`);
    }
  }

  console.log('✓ All accounting module routes properly protected');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 24: All treasury module routes blocked for non-tesoreria/admin
console.log('\nTest 24: All treasury module routes blocked for non-tesoreria/admin');
try {
  const treasuryRoutes = [
    '/api/sales-invoices',
    '/api/collections',
    '/api/payments'
  ];

  for (const path of treasuryRoutes) {
    const req = createMockRequest(path, 'compras');
    const res = createMockResponse();
    const next = createMockNext();

    checkRoleAccess(req, res, next);

    if (res.statusCode !== 403 || next.wasCalled()) {
      throw new Error(`Expected ${path} to be blocked for compras`);
    }
  }

  console.log('✓ All treasury module routes properly protected');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 25: Master data routes only accessible to administrador
console.log('\nTest 25: Master data routes only accessible to administrador');
try {
  const masterRoutes = [
    '/api/items',
    '/api/customers',
    '/api/suppliers',
    '/api/users'
  ];

  const nonAdminRoles = ['compras', 'contabilidad', 'tesoreria'];

  for (const role of nonAdminRoles) {
    for (const path of masterRoutes) {
      const req = createMockRequest(path, role);
      const res = createMockResponse();
      const next = createMockNext();

      checkRoleAccess(req, res, next);

      if (res.statusCode !== 403 || next.wasCalled()) {
        throw new Error(`Expected ${path} to be blocked for ${role}`);
      }
    }
  }

  console.log('✓ Master data routes properly restricted to administrador');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 26: Tesoreria role can access purchase invoices but not other purchase routes
console.log('\nTest 26: Tesoreria role limited access inside purchase module');
try {
  const allowedReq = createMockRequest('/api/purchase-invoices/123', 'tesoreria');
  const allowedRes = createMockResponse();
  const allowedNext = createMockNext();
  checkRoleAccess(allowedReq, allowedRes, allowedNext);

  if (!allowedNext.wasCalled()) {
    throw new Error('Expected /api/purchase-invoices/:id to be allowed for tesoreria');
  }

  const blockedRoutes = [
    '/api/budgets',
    '/api/purchase-orders',
    '/api/inventory'
  ];

  for (const path of blockedRoutes) {
    const req = createMockRequest(path, 'tesoreria');
    const res = createMockResponse();
    const next = createMockNext();
    checkRoleAccess(req, res, next);

    if (res.statusCode !== 403 || next.wasCalled()) {
      throw new Error(`Expected ${path} to be blocked for tesoreria`);
    }
  }

  console.log('✓ Tesoreria access is limited to purchase invoices within purchase module');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

console.log('\n✓ All role-based authorization middleware tests passed!');
console.log('\nValidated Requirements:');
console.log('  - 14.1: Role-based authorization system');
console.log('  - 14.2: Compras role restricted to Purchase Module');
console.log('  - 14.3: Contabilidad role restricted to Accounting Module');
console.log('  - 14.4: Tesoreria role restricted to Treasury Module + purchase invoices');
console.log('  - 14.5: Administrador role has access to all modules');
console.log('  - 14.6: Users prevented from accessing unauthorized modules');
console.log('  - 30.3: API validates user roles before allowing access');
