import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireComprasOrAdmin, requireRole } from '../middleware/roleCheck.js';
import {
  getBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  convertBudgetToOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseInvoices,
  getPurchaseInvoiceById,
  createPurchaseInvoice,
  getInventoryStatus,
  getInventoryMovements,
  createInventoryAdjustment
} from '../controllers/purchaseController.js';

const router = express.Router();

/**
 * Purchase Module Routes
 * All routes require authentication.
 * Most routes require compras/administrador; purchase invoices also allow tesoreria.
 * 
 * Requirements: 1.x, 2.x, 3.x, 4.x, 14.2, 14.5
 */

// Budgets
router.get('/budgets', authenticateToken, requireComprasOrAdmin, getBudgets);
router.get('/budgets/:id', authenticateToken, requireComprasOrAdmin, getBudgetById);
router.post('/budgets', authenticateToken, requireComprasOrAdmin, createBudget);
router.put('/budgets/:id', authenticateToken, requireComprasOrAdmin, updateBudget);
router.delete('/budgets/:id', authenticateToken, requireComprasOrAdmin, deleteBudget);
router.post('/budgets/:id/convert', authenticateToken, requireComprasOrAdmin, convertBudgetToOrder);

// Purchase orders
router.get('/purchase-orders', authenticateToken, requireComprasOrAdmin, getPurchaseOrders);
router.get('/purchase-orders/:id', authenticateToken, requireComprasOrAdmin, getPurchaseOrderById);
router.post('/purchase-orders', authenticateToken, requireComprasOrAdmin, createPurchaseOrder);
router.put('/purchase-orders/:id', authenticateToken, requireComprasOrAdmin, updatePurchaseOrderStatus);

// Purchase invoices (also accessible by tesoreria)
router.get('/purchase-invoices', authenticateToken, requireRole(['compras', 'tesoreria', 'administrador']), getPurchaseInvoices);
router.get('/purchase-invoices/:id', authenticateToken, requireRole(['compras', 'tesoreria', 'administrador']), getPurchaseInvoiceById);
router.post('/purchase-invoices', authenticateToken, requireRole(['compras', 'tesoreria', 'administrador']), createPurchaseInvoice);

// Inventory
router.get('/inventory', authenticateToken, requireComprasOrAdmin, getInventoryStatus);
router.get('/inventory/movements', authenticateToken, requireComprasOrAdmin, getInventoryMovements);
router.post('/inventory/adjust', authenticateToken, requireComprasOrAdmin, createInventoryAdjustment);

export default router;

