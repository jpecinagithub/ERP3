/**
 * Role-Based Authorization Middleware
 * Enforces module access control based on user roles
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 30.3
 * 
 * Role Access Matrix:
 * - compras: Purchase Module only
 * - ventas: Sales Module + sales invoicing and collections
 * - contabilidad: Accounting Module only
 * - tesoreria: Treasury Module + purchase invoices
 * - administrador: All modules + master data management
 */

/**
 * Module definitions mapping routes to modules
 */
const MODULE_ROUTES = {
  purchase: [
    '/api/budgets',
    '/api/purchase-orders',
    '/api/purchase-invoices',
    '/api/inventory'
  ],
  sales: [
    '/api/sales-catalog',
    '/api/sales-budgets',
    '/api/sales-orders'
  ],
  accounting: [
    '/api/accounts',
    '/api/journal-entries',
    '/api/reports',
    '/api/fiscal-periods'
  ],
  treasury: [
    '/api/sales-invoices',
    '/api/collections',
    '/api/payments'
  ],
  master: [
    '/api/items',
    '/api/customers',
    '/api/suppliers',
    '/api/users'
  ]
};

/**
 * Role to module access mapping
 */
const ROLE_ACCESS = {
  compras: ['purchase'],
  ventas: ['sales'],
  contabilidad: ['accounting'],
  tesoreria: ['treasury'],
  administrador: ['purchase', 'sales', 'accounting', 'treasury', 'master']
};

/**
 * Route-level exceptions for cross-module access
 */
const ROLE_ROUTE_EXCEPTIONS = {
  tesoreria: ['/api/purchase-invoices'],
  ventas: ['/api/sales-invoices', '/api/collections']
};

/**
 * Determines which module a route belongs to
 * @param {string} path - Request path
 * @returns {string|null} Module name or null if not found
 */
const getModuleFromPath = (path) => {
  for (const [module, routes] of Object.entries(MODULE_ROUTES)) {
    for (const route of routes) {
      if (path.startsWith(route)) {
        return module;
      }
    }
  }
  return null;
};

/**
 * Checks if a user role has access to a specific module
 * @param {string} role - User role
 * @param {string} module - Module name
 * @returns {boolean} True if role has access to module
 */
const hasModuleAccess = (role, module) => {
  const allowedModules = ROLE_ACCESS[role];
  if (!allowedModules) {
    return false;
  }
  return allowedModules.includes(module);
};

/**
 * Checks if a role has access to a specific route as an exception
 * @param {string} role - User role
 * @param {string} path - Request path
 * @returns {boolean} True if role has route-level exception access
 */
const hasRouteExceptionAccess = (role, path) => {
  const allowedRoutes = ROLE_ROUTE_EXCEPTIONS[role];
  if (!allowedRoutes) {
    return false;
  }
  return allowedRoutes.some((route) => path.startsWith(route));
};

/**
 * Express middleware to check role-based module access
 * Must be used after authenticateToken middleware
 * 
 * Validates: Requirements 14.2, 14.3, 14.4, 14.5, 14.6
 */
export const checkRoleAccess = (req, res, next) => {
  // Ensure user is authenticated
  if (!req.user) {
    return res.status(401).json({
      error: {
        message: 'Authentication required',
        status: 401
      }
    });
  }

  const { role } = req.user;
  const requestPath = req.path;

  // Determine which module the request is trying to access
  const module = getModuleFromPath(requestPath);

  // If route doesn't match any module, allow (e.g., /api/auth routes)
  if (!module) {
    return next();
  }

  // Check if user's role has access to the module
  if (!hasModuleAccess(role, module) && !hasRouteExceptionAccess(role, requestPath)) {
    return res.status(403).json({
      error: {
        message: `Access denied. Role '${role}' cannot access ${module} module`,
        status: 403,
        requiredModule: module,
        userRole: role
      }
    });
  }

  // User has access, proceed
  next();
};

/**
 * Middleware factory to require specific role(s) for a route
 * More granular than module-based access control
 * 
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles
 * @returns {Function} Express middleware function
 * 
 * Validates: Requirements 14.1, 14.6
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          status: 401
        }
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          message: `Access denied. Required role(s): ${roles.join(', ')}`,
          status: 403,
          requiredRoles: roles,
          userRole: req.user.role
        }
      });
    }

    next();
  };
};

/**
 * Middleware to require 'compras' role
 * Validates: Requirement 14.2
 */
export const requireCompras = requireRole('compras');

/**
 * Middleware to require 'ventas' role
 */
export const requireVentas = requireRole('ventas');

/**
 * Middleware to require 'contabilidad' role
 * Validates: Requirement 14.3
 */
export const requireContabilidad = requireRole('contabilidad');

/**
 * Middleware to require 'tesoreria' role
 * Validates: Requirement 14.4
 */
export const requireTesoreria = requireRole('tesoreria');

/**
 * Middleware to require 'administrador' role
 * Validates: Requirement 14.5
 */
export const requireAdministrador = requireRole('administrador');

/**
 * Middleware to allow compras or administrador roles
 * Common pattern for purchase module endpoints
 */
export const requireComprasOrAdmin = requireRole(['compras', 'administrador']);

/**
 * Middleware to allow ventas or administrador roles
 * Common pattern for sales module endpoints
 */
export const requireVentasOrAdmin = requireRole(['ventas', 'administrador']);

/**
 * Middleware to allow contabilidad or administrador roles
 * Common pattern for accounting module endpoints
 */
export const requireContabilidadOrAdmin = requireRole(['contabilidad', 'administrador']);

/**
 * Middleware to allow tesoreria or administrador roles
 * Common pattern for treasury module endpoints
 */
export const requireTesoreriaOrAdmin = requireRole(['tesoreria', 'administrador']);

export default {
  checkRoleAccess,
  requireRole,
  requireCompras,
  requireVentas,
  requireContabilidad,
  requireTesoreria,
  requireAdministrador,
  requireComprasOrAdmin,
  requireVentasOrAdmin,
  requireContabilidadOrAdmin,
  requireTesoreriaOrAdmin
};
