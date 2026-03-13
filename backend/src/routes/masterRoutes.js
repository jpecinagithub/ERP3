import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getUsers,
  createUser,
  updateUser,
  deactivateUser
} from '../controllers/masterController.js';

const router = express.Router();

/**
 * Master Data Routes
 * All routes require authentication and administrador role
 * 
 * Requirements: 14.5, 15.1, 15.2, 15.3, 15.4, 15.5
 */

// Items endpoints - require administrador role
router.get('/items', authenticateToken, requireRole(['administrador']), getItems);
router.post('/items', authenticateToken, requireRole(['administrador']), createItem);
router.put('/items/:id', authenticateToken, requireRole(['administrador']), updateItem);
router.delete('/items/:id', authenticateToken, requireRole(['administrador']), deleteItem);

// Customers endpoints - require administrador role
router.get('/customers', authenticateToken, requireRole(['administrador']), getCustomers);
router.post('/customers', authenticateToken, requireRole(['administrador']), createCustomer);
router.put('/customers/:id', authenticateToken, requireRole(['administrador']), updateCustomer);
router.delete('/customers/:id', authenticateToken, requireRole(['administrador']), deleteCustomer);

// Suppliers endpoints - require administrador role
router.get('/suppliers', authenticateToken, requireRole(['administrador']), getSuppliers);
router.post('/suppliers', authenticateToken, requireRole(['administrador']), createSupplier);
router.put('/suppliers/:id', authenticateToken, requireRole(['administrador']), updateSupplier);
router.delete('/suppliers/:id', authenticateToken, requireRole(['administrador']), deleteSupplier);

// Users endpoints - require administrador role
router.get('/users', authenticateToken, requireRole(['administrador']), getUsers);
router.post('/users', authenticateToken, requireRole(['administrador']), createUser);
router.put('/users/:id', authenticateToken, requireRole(['administrador']), updateUser);
router.put('/users/:id/deactivate', authenticateToken, requireRole(['administrador']), deactivateUser);

export default router;
