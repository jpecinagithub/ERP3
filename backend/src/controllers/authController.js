import { query } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';

/**
 * Authentication Controller
 * Handles user authentication operations: login, logout, and current user info
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.6
 */

/**
 * POST /api/auth/login
 * Authenticates user with username and password, generates JWT token
 * 
 * @param {Object} req.body.username - Username
 * @param {Object} req.body.password - Password (plain text, no encryption per requirement 13.4)
 * @returns {Object} User info and JWT token
 * 
 * Validates: Requirement 13.1, 13.2, 13.3
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        error: {
          message: 'Username and password are required',
          status: 400
        }
      });
    }

    // Query user from database
    const sql = `
      SELECT id, username, password, full_name, role, is_active
      FROM users
      WHERE username = ?
    `;
    
    const users = await query(sql, [username]);

    // Check if user exists
    if (users.length === 0) {
      return res.status(401).json({
        error: {
          message: 'Invalid username or password',
          status: 401
        }
      });
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        error: {
          message: 'User account is deactivated',
          status: 403
        }
      });
    }

    // Validate password (plain text comparison per requirement 13.4)
    if (password !== user.password) {
      return res.status(401).json({
        error: {
          message: 'Invalid username or password',
          status: 401
        }
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role
    });

    // Return user info and token
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred during login',
        status: 500
      }
    });
  }
};

/**
 * POST /api/auth/logout
 * Invalidates user session (client-side token removal)
 * 
 * Note: Since we're using stateless JWT tokens, logout is primarily handled
 * client-side by removing the token. This endpoint provides a standard
 * logout confirmation.
 * 
 * Validates: Requirement 13.6
 */
export const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // This endpoint provides confirmation and could be extended
    // to implement token blacklisting if needed in the future

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred during logout',
        status: 500
      }
    });
  }
};

/**
 * GET /api/auth/me
 * Returns current authenticated user information
 * Requires authentication middleware to be applied
 * 
 * @returns {Object} Current user info
 * 
 * Validates: Requirement 13.6
 */
export const getCurrentUser = async (req, res) => {
  try {
    // User info is attached by authenticateToken middleware
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          status: 401
        }
      });
    }

    // Fetch fresh user data from database
    const sql = `
      SELECT id, username, full_name, role, is_active, created_at, updated_at
      FROM users
      WHERE id = ?
    `;
    
    const users = await query(sql, [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }

    const user = users[0];

    // Check if user is still active
    if (!user.is_active) {
      return res.status(403).json({
        error: {
          message: 'User account is deactivated',
          status: 403
        }
      });
    }

    // Return user info
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching user information',
        status: 500
      }
    });
  }
};
