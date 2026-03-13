import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import {
  getSalesCatalogCustomers,
  getSalesCatalogItems,
  getSalesBudgets,
  getSalesBudgetById,
  createSalesBudget,
  updateSalesBudget,
  deleteSalesBudget,
  convertSalesBudgetToOrder,
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrderStatus
} from '../controllers/salesController.js';

const router = express.Router();

router.get('/sales-catalog/customers', authenticateToken, requireRole(['ventas', 'tesoreria', 'administrador']), getSalesCatalogCustomers);
router.get('/sales-catalog/items', authenticateToken, requireRole(['ventas', 'tesoreria', 'administrador']), getSalesCatalogItems);

router.get('/sales-budgets', authenticateToken, requireRole(['ventas', 'administrador']), getSalesBudgets);
router.get('/sales-budgets/:id', authenticateToken, requireRole(['ventas', 'administrador']), getSalesBudgetById);
router.post('/sales-budgets', authenticateToken, requireRole(['ventas', 'administrador']), createSalesBudget);
router.put('/sales-budgets/:id', authenticateToken, requireRole(['ventas', 'administrador']), updateSalesBudget);
router.delete('/sales-budgets/:id', authenticateToken, requireRole(['ventas', 'administrador']), deleteSalesBudget);
router.post('/sales-budgets/:id/convert', authenticateToken, requireRole(['ventas', 'administrador']), convertSalesBudgetToOrder);

router.get('/sales-orders', authenticateToken, requireRole(['ventas', 'tesoreria', 'administrador']), getSalesOrders);
router.get('/sales-orders/:id', authenticateToken, requireRole(['ventas', 'tesoreria', 'administrador']), getSalesOrderById);
router.post('/sales-orders', authenticateToken, requireRole(['ventas', 'administrador']), createSalesOrder);
router.put('/sales-orders/:id/status', authenticateToken, requireRole(['ventas', 'administrador']), updateSalesOrderStatus);

export default router;
