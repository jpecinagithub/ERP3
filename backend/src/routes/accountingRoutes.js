import express from 'express';
import * as accountingController from '../controllers/accountingController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';

const router = express.Router();

/**
 * Accounting Module Routes
 * All routes require authentication
 * Role requirements:
 * - contabilidad: Full access to accounting
 * - administrador: Full access
 */

router.use(authenticateToken);

/**
 * =========================
 * 8.1 Account Management
 * =========================
 */

router.get(
  '/accounts',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getAccounts
);

router.get(
  '/accounts/reference-data',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getAccountingReferenceData
);

router.get(
  '/accounts/:id',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getAccountById
);

router.post(
  '/accounts',
  requireRole(['contabilidad', 'administrador']),
  accountingController.createAccount
);

router.put(
  '/accounts/:id',
  requireRole(['contabilidad', 'administrador']),
  accountingController.updateAccount
);

router.delete(
  '/accounts/:id',
  requireRole(['contabilidad', 'administrador']),
  accountingController.deleteAccount
);

/**
 * =========================
 * 8.2 Journal Entry Management
 * =========================
 */

router.get(
  '/journal-entries',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getJournalEntries
);

router.get(
  '/journal-entries/:id',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getJournalEntryById
);

router.post(
  '/journal-entries',
  requireRole(['contabilidad', 'administrador']),
  accountingController.createJournalEntry
);

router.post(
  '/journal-entries/:id/validate',
  requireRole(['contabilidad', 'administrador']),
  accountingController.validateJournalEntry
);

/**
 * =========================
 * 8.3 Financial Reports
 * =========================
 */

router.get(
  '/reports/balance',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getBalanceSheet
);

router.get(
  '/reports/pnl',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getPnLReport
);

router.post(
  '/reports/custom',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getCustomReport
);

router.get(
  '/reports/reconciliation',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getReconciliationReport
);

/**
 * =========================
 * 10. Fiscal Period Management
 * =========================
 */

router.get(
  '/fiscal-periods',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getFiscalPeriods
);

router.post(
  '/fiscal-periods',
  requireRole(['contabilidad', 'administrador']),
  accountingController.createFiscalPeriod
);

router.put(
  '/fiscal-periods/:id/close',
  requireRole(['contabilidad', 'administrador']),
  accountingController.closeFiscalPeriod
);

router.put(
  '/fiscal-periods/:id/reopen',
  requireRole(['contabilidad', 'administrador']),
  accountingController.reopenFiscalPeriod
);

/**
 * =========================
 * 8.4 Journal Entry Templates
 * =========================
 */

router.get(
  '/journal-entry-templates',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getJournalEntryTemplates
);

router.get(
  '/journal-entry-templates/:id',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getJournalEntryTemplateById
);

/**
 * =========================
 * Dashboard KPIs
 * =========================
 */

router.get(
  '/dashboard/kpis',
  requireRole(['contabilidad', 'administrador']),
  accountingController.getDashboardKPIs
);

/**
 * =========================
 * Year-end Closing
 * =========================
 */

router.post(
  '/fiscal-periods/:id/close-year',
  requireRole(['contabilidad', 'administrador']),
  accountingController.closeFiscalPeriodYear
);

/**
 * =========================
 * Export Reports
 * =========================
 */

router.get(
  '/reports/export/csv',
  requireRole(['contabilidad', 'administrador']),
  accountingController.exportReportCSV
);

export default router;
