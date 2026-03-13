# Authentication and Authorization Middleware

This directory contains middleware for JWT-based authentication and role-based authorization.

## Files

- `auth.js` - Authentication middleware with JWT token generation and verification
- `auth.test.js` - Test suite for authentication middleware
- `roleCheck.js` - Role-based authorization middleware for module access control
- `roleCheck.test.js` - Test suite for role-based authorization middleware

## Usage

### Token Generation

Generate a JWT token when a user logs in:

```javascript
import { generateToken } from './middleware/auth.js';

// In your login controller
const token = generateToken({
  id: user.id,
  username: user.username,
  role: user.role
});

res.json({ token, user });
```

### Token Verification

The `authenticateToken` middleware automatically verifies tokens and attaches user info to the request:

```javascript
import { authenticateToken } from './middleware/auth.js';

// Protect a route
app.get('/api/protected', authenticateToken, (req, res) => {
  // req.user contains: { id, username, role }
  res.json({ message: 'Protected data', user: req.user });
});
```

### Role-Based Authorization

Use `requireRole` to restrict access based on user roles:

```javascript
import { authenticateToken, requireRole } from './middleware/auth.js';

// Single role
app.get('/api/admin', 
  authenticateToken, 
  requireRole('administrador'), 
  (req, res) => {
    res.json({ message: 'Admin only' });
  }
);

// Multiple roles
app.get('/api/accounting', 
  authenticateToken, 
  requireRole(['administrador', 'contabilidad']), 
  (req, res) => {
    res.json({ message: 'Accounting data' });
  }
);
```

## Available Roles

- `compras` - Purchase module access
- `contabilidad` - Accounting module access
- `tesoreria` - Treasury module access
- `administrador` - Full system access

## Token Format

Tokens should be sent in the Authorization header:

```
Authorization: Bearer <token>
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": {
    "message": "Access token is required",
    "status": 401
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "message": "Invalid or expired token",
    "status": 403
  }
}
```

or

```json
{
  "error": {
    "message": "Insufficient permissions for this operation",
    "status": 403
  }
}
```

## Environment Variables

Required environment variables:

- `JWT_SECRET` - Secret key for signing tokens (required)
- `JWT_EXPIRES_IN` - Token expiration time (default: '24h')

## Role-Based Module Access Control

The `roleCheck.js` middleware provides module-level access control based on user roles.

### Module Access Matrix

| Role | Purchase Module | Accounting Module | Treasury Module | Master Data |
|------|----------------|-------------------|-----------------|-------------|
| compras | ✓ | ✗ | ✗ | ✗ |
| contabilidad | ✗ | ✓ | ✗ | ✗ |
| tesoreria | ✗ | ✗ | ✓ | ✗ |
| administrador | ✓ | ✓ | ✓ | ✓ |

### Using checkRoleAccess

Apply module-level access control to all routes:

```javascript
import { authenticateToken } from './middleware/auth.js';
import { checkRoleAccess } from './middleware/roleCheck.js';

// Apply to all API routes
app.use('/api', authenticateToken, checkRoleAccess);
```

This automatically enforces:
- Compras users can only access `/api/budgets`, `/api/purchase-orders`, `/api/purchase-invoices`, `/api/inventory`
- Contabilidad users can only access `/api/accounts`, `/api/journal-entries`, `/api/reports`
- Tesoreria users can only access `/api/sales-invoices`, `/api/collections`, `/api/payments`
- Administrador users can access all modules including `/api/items`, `/api/customers`, `/api/suppliers`, `/api/users`, `/api/fiscal-periods`

### Using Role-Specific Middleware

For more granular control, use role-specific middleware:

```javascript
import { 
  requireCompras, 
  requireContabilidad, 
  requireTesoreria, 
  requireAdministrador,
  requireComprasOrAdmin,
  requireContabilidadOrAdmin,
  requireTesoreriaOrAdmin
} from './middleware/roleCheck.js';

// Compras only
app.post('/api/budgets', authenticateToken, requireCompras, createBudget);

// Contabilidad only
app.get('/api/reports/balance', authenticateToken, requireContabilidad, getBalance);

// Tesoreria only
app.post('/api/collections', authenticateToken, requireTesoreria, createCollection);

// Administrador only
app.post('/api/users', authenticateToken, requireAdministrador, createUser);

// Compras or Administrador
app.get('/api/inventory', authenticateToken, requireComprasOrAdmin, getInventory);
```

### Custom Role Requirements

Create custom role requirements using `requireRole`:

```javascript
import { requireRole } from './middleware/roleCheck.js';

// Allow multiple specific roles
app.get('/api/reports/custom', 
  authenticateToken, 
  requireRole(['contabilidad', 'administrador']), 
  getCustomReport
);
```

### Error Responses for Role Checks

#### 403 Forbidden - Module Access Denied
```json
{
  "error": {
    "message": "Access denied. Role 'compras' cannot access accounting module",
    "status": 403,
    "requiredModule": "accounting",
    "userRole": "compras"
  }
}
```

#### 403 Forbidden - Role Requirement Not Met
```json
{
  "error": {
    "message": "Access denied. Required role(s): administrador",
    "status": 403,
    "requiredRoles": ["administrador"],
    "userRole": "compras"
  }
}
```

## Testing

Run the test suites:

```bash
# Test authentication middleware
node src/middleware/auth.test.js

# Test role-based authorization middleware
node src/middleware/roleCheck.test.js
```

### Authentication Tests
All tests should pass, verifying:
- Token generation
- Token verification
- Invalid token handling
- Missing JWT_SECRET handling
- authenticateToken middleware
- requireRole middleware
- Multiple role authorization

### Role-Based Authorization Tests
All tests should pass, verifying:
- Module access control for all roles
- Compras role restricted to Purchase Module (Req 14.2)
- Contabilidad role restricted to Accounting Module (Req 14.3)
- Tesoreria role restricted to Treasury Module (Req 14.4)
- Administrador role has access to all modules (Req 14.5)
- Users prevented from accessing unauthorized modules (Req 14.6)
- API validates user roles before allowing access (Req 30.3)
