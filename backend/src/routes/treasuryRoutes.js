import express from 'express';
import * as treasuryController from '../controllers/treasuryController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';

const router = express.Router();

/**
 * Treasury Module Routes
 * All routes require authentication
 * Role requirements:
 * - tesorería: Full access to treasury operations
 * - administrador: Full access
 */

router.use(authenticateToken);

/**
 * =========================
 * 9.1 Sales Invoices
 * =========================
 */

router.get(
  '/sales-invoices',
  requireRole(['ventas', 'tesoreria', 'administrador']),
  treasuryController.getSalesInvoices
);

router.get(
  '/sales-invoices/:id',
  requireRole(['ventas', 'tesoreria', 'administrador']),
  treasuryController.getSalesInvoiceById
);

router.get(
  '/sales-invoices/:id/pdf',
  requireRole(['ventas', 'tesoreria', 'administrador']),
  treasuryController.downloadSalesInvoicePdf
);

router.post(
  '/sales-invoices',
  requireRole(['ventas', 'tesoreria', 'administrador']),
  treasuryController.createSalesInvoice
);

/**
 * =========================
 * 9.2 Collections
 * =========================
 */

router.get(
  '/collections',
  requireRole(['ventas', 'tesoreria', 'administrador']),
  treasuryController.getCollections
);

router.get(
  '/collections/:id',
  requireRole(['ventas', 'tesoreria', 'administrador']),
  treasuryController.getCollectionById
);

router.post(
  '/collections',
  requireRole(['ventas', 'tesoreria', 'administrador']),
  treasuryController.createCollection
);

router.put(
  '/collections/:id/status',
  requireRole(['ventas', 'tesoreria', 'administrador']),
  treasuryController.updateCollectionStatus
);

/**
 * =========================
 * 9.3 Payments
 * =========================
 */

router.get(
  '/payments',
  requireRole(['tesoreria', 'administrador']),
  treasuryController.getPayments
);

router.get(
  '/payments/:id',
  requireRole(['tesoreria', 'administrador']),
  treasuryController.getPaymentById
);

router.post(
  '/payments',
  requireRole(['tesoreria', 'administrador']),
  treasuryController.createPayment
);

router.put(
  '/payments/:id/status',
  requireRole(['tesoreria', 'administrador']),
  treasuryController.updatePaymentStatus
);

export default router;
