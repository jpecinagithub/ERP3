import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, logout, getCurrentUser } from './authController.js';
import * as database from '../config/database.js';
import * as auth from '../middleware/auth.js';

/**
 * Unit Tests for Authentication Controller
 * Tests login, logout, and getCurrentUser endpoints
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.6
 */

// Mock dependencies
vi.mock('../config/database.js');
vi.mock('../middleware/auth.js');

describe('AuthController', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup request and response mocks
    req = {
      body: {},
      user: null
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  describe('login', () => {
    it('should return 400 if username is missing', async () => {
      req.body = { password: 'test123' };

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Username and password are required',
          status: 400
        }
      });
    });

    it('should return 400 if password is missing', async () => {
      req.body = { username: 'testuser' };

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Username and password are required',
          status: 400
        }
      });
    });

    it('should return 401 if user does not exist', async () => {
      req.body = { username: 'nonexistent', password: 'test123' };
      vi.mocked(database.query).mockResolvedValue([]);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid username or password',
          status: 401
        }
      });
    });

    it('should return 403 if user is deactivated', async () => {
      req.body = { username: 'testuser', password: 'test123' };
      vi.mocked(database.query).mockResolvedValue([{
        id: 1,
        username: 'testuser',
        password: 'test123',
        full_name: 'Test User',
        role: 'compras',
        is_active: false
      }]);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'User account is deactivated',
          status: 403
        }
      });
    });

    it('should return 401 if password is incorrect', async () => {
      req.body = { username: 'testuser', password: 'wrongpassword' };
      vi.mocked(database.query).mockResolvedValue([{
        id: 1,
        username: 'testuser',
        password: 'test123',
        full_name: 'Test User',
        role: 'compras',
        is_active: true
      }]);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid username or password',
          status: 401
        }
      });
    });

    it('should return token and user info on successful login', async () => {
      req.body = { username: 'testuser', password: 'test123' };
      const mockUser = {
        id: 1,
        username: 'testuser',
        password: 'test123',
        full_name: 'Test User',
        role: 'compras',
        is_active: true
      };
      const mockToken = 'mock.jwt.token';

      vi.mocked(database.query).mockResolvedValue([mockUser]);
      vi.mocked(auth.generateToken).mockReturnValue(mockToken);

      await login(req, res);

      expect(auth.generateToken).toHaveBeenCalledWith({
        id: mockUser.id,
        username: mockUser.username,
        role: mockUser.role
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: mockUser.id,
            username: mockUser.username,
            fullName: mockUser.full_name,
            role: mockUser.role
          },
          token: mockToken
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      req.body = { username: 'testuser', password: 'test123' };
      vi.mocked(database.query).mockRejectedValue(new Error('Database error'));

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'An error occurred during login',
          status: 500
        }
      });
    });
  });

  describe('logout', () => {
    it('should return success message', async () => {
      await logout(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful'
      });
    });

    it('should handle errors gracefully', async () => {
      res.json = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCurrentUser', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = null;

      await getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Authentication required',
          status: 401
        }
      });
    });

    it('should return 404 if user not found in database', async () => {
      req.user = { id: 999, username: 'testuser', role: 'compras' };
      vi.mocked(database.query).mockResolvedValue([]);

      await getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    });

    it('should return 403 if user is deactivated', async () => {
      req.user = { id: 1, username: 'testuser', role: 'compras' };
      vi.mocked(database.query).mockResolvedValue([{
        id: 1,
        username: 'testuser',
        full_name: 'Test User',
        role: 'compras',
        is_active: false,
        created_at: new Date(),
        updated_at: new Date()
      }]);

      await getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'User account is deactivated',
          status: 403
        }
      });
    });

    it('should return user info on success', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        full_name: 'Test User',
        role: 'compras',
        is_active: true,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-02')
      };

      req.user = { id: 1, username: 'testuser', role: 'compras' };
      vi.mocked(database.query).mockResolvedValue([mockUser]);

      await getCurrentUser(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: mockUser.id,
          username: mockUser.username,
          fullName: mockUser.full_name,
          role: mockUser.role,
          isActive: mockUser.is_active,
          createdAt: mockUser.created_at,
          updatedAt: mockUser.updated_at
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      req.user = { id: 1, username: 'testuser', role: 'compras' };
      vi.mocked(database.query).mockRejectedValue(new Error('Database error'));

      await getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'An error occurred while fetching user information',
          status: 500
        }
      });
    });
  });
});
