import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware
 * Verifies JWT tokens and extracts user information for authorization checks
 * 
 * Requirements: 13.2, 30.2
 */

/**
 * Generates a JWT token for a user
 * @param {Object} user - User object with id, username, and role
 * @returns {string} JWT token
 */
export const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verifies a JWT token and returns the decoded payload
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Express middleware to authenticate requests using JWT
 * Extracts token from Authorization header and verifies it
 * Attaches user information to req.user for downstream use
 */
export const authenticateToken = (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Access token is required',
          status: 401
        }
      });
    }

    // Verify token and extract user information
    const decoded = verifyToken(token);

    // Attach user information to request object
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(403).json({
      error: {
        message: error.message || 'Invalid or expired token',
        status: 403
      }
    });
  }
};

/**
 * Middleware factory to check if user has required role(s)
 * Must be used after authenticateToken middleware
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles
 * @returns {Function} Express middleware function
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
          message: 'Insufficient permissions for this operation',
          status: 403
        }
      });
    }

    next();
  };
};
