import express from 'express';
import { login, logout, getCurrentUser } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * Authentication Routes
 * Defines routes for user authentication operations
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.6, 30.2
 */

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user and generate JWT token
 * Public route - no authentication required
 */
router.post('/login', login);

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 * Public route - no authentication required (client handles token removal)
 */
router.post('/logout', logout);

/**
 * GET /api/auth/me
 * Get current authenticated user information
 * Protected route - requires valid JWT token
 */
router.get('/me', authenticateToken, getCurrentUser);

export default router;
