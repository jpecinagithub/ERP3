import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import {
  getSalesBudgets,
  getSalesBudgetById,
  createSalesBudget,
  convertSalesBudgetToOrder,
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  confirmSalesOrder
} from '../controllers/salesFlowController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/sales-budgets', requireRole(['ventas', 'administrador']), getSalesBudgets);
router.get('/sales-budgets/:id', requireRole(['ventas', 'administrador']), getSalesBudgetById);
router.post('/sales-budgets', requireRole(['ventas', 'administrador']), createSalesBudget);
router.post('/sales-budgets/:id/convert', requireRole(['ventas', 'administrador']), convertSalesBudgetToOrder);

router.get('/sales-orders', requireRole(['ventas', 'administrador']), getSalesOrders);
router.get('/sales-orders/:id', requireRole(['ventas', 'administrador']), getSalesOrderById);
router.post('/sales-orders', requireRole(['ventas', 'administrador']), createSalesOrder);
router.post('/sales-orders/:id/confirm', requireRole(['ventas', 'administrador']), confirmSalesOrder);

export default router;
