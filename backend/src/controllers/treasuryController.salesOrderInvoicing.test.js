import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();
const mockConnection = { execute: executeMock };

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  beginTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  rollbackTransaction: vi.fn()
}));

vi.mock('../services/inventoryService.js', () => ({
  default: {
    calculateCurrentStock: vi.fn(),
    createOutboundMovement: vi.fn()
  }
}));

vi.mock('../services/accountingService.js', () => ({
  default: {
    generateSalesInvoiceEntry: vi.fn(),
    generateSalesInventoryOutputEntry: vi.fn()
  }
}));

vi.mock('../services/traceabilityService.js', () => ({
  default: {
    createDocumentLink: vi.fn(),
    logAction: vi.fn()
  }
}));

import { beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';
import inventoryService from '../services/inventoryService.js';
import accountingService from '../services/accountingService.js';
import traceabilityService from '../services/traceabilityService.js';
import { createSalesInvoice } from './treasuryController.js';

const mockedBeginTransaction = vi.mocked(beginTransaction);
const mockedCommitTransaction = vi.mocked(commitTransaction);
const mockedRollbackTransaction = vi.mocked(rollbackTransaction);
const mockedCalculateCurrentStock = vi.mocked(inventoryService.calculateCurrentStock);
const mockedCreateOutboundMovement = vi.mocked(inventoryService.createOutboundMovement);
const mockedGenerateSalesInvoiceEntry = vi.mocked(accountingService.generateSalesInvoiceEntry);
const mockedGenerateSalesInventoryOutputEntry = vi.mocked(accountingService.generateSalesInventoryOutputEntry);
const mockedCreateDocumentLink = vi.mocked(traceabilityService.createDocumentLink);
const mockedLogAction = vi.mocked(traceabilityService.logAction);

const createRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis()
});

describe('TreasuryController - sales order invoicing flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBeginTransaction.mockResolvedValue(mockConnection);
    mockedCommitTransaction.mockResolvedValue(undefined);
    mockedRollbackTransaction.mockResolvedValue(undefined);
    mockedCreateOutboundMovement.mockResolvedValue(1);
    mockedGenerateSalesInvoiceEntry.mockResolvedValue(9001);
    mockedGenerateSalesInventoryOutputEntry.mockResolvedValue(9002);
    mockedCreateDocumentLink.mockResolvedValue(1);
    mockedLogAction.mockResolvedValue(1);

    executeMock.mockImplementation(async (sql, params) => {
      if (sql.includes('SELECT * FROM sales_orders WHERE id = ? FOR UPDATE')) {
        return [[{ id: 1, status: 'pending_stock', customer_id: 7 }], []];
      }
      if (sql.includes('SELECT item_id as itemId, quantity, unit_price as unitPrice')) {
        return [[{ itemId: 10, quantity: 2, unitPrice: 500 }], []];
      }
      if (sql.includes('SELECT * FROM customers WHERE id = ?')) {
        return [[{ id: 7, name: 'Cliente Test' }], []];
      }
      if (sql.includes('INSERT INTO sales_invoices')) {
        return [{ insertId: 123 }, []];
      }
      if (sql.includes('INSERT INTO sales_invoice_lines')) {
        return [{ insertId: 1 }, []];
      }
      if (sql.includes("UPDATE sales_orders SET status = 'invoiced' WHERE id = ?")) {
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('UPDATE sales_order_lines')) {
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 1 }, []];
    });
  });

  it('allows invoicing a pending_stock order when current stock is enough', async () => {
    mockedCalculateCurrentStock.mockResolvedValue(10);

    const req = {
      body: {
        invoiceNumber: 'FAV-2026-00001',
        invoiceDate: '2026-03-13',
        salesOrderId: 1
      },
      user: { id: 99 }
    };
    const res = createRes();

    await createSalesInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Sales invoice created successfully',
      data: expect.objectContaining({
        id: 123,
        salesOrderId: 1,
        status: 'pending'
      })
    });
    expect(mockedRollbackTransaction).not.toHaveBeenCalled();
    expect(mockedCommitTransaction).toHaveBeenCalledWith(mockConnection);
  });

  it('returns 409 when stock is insufficient', async () => {
    mockedCalculateCurrentStock.mockResolvedValue(1);

    const req = {
      body: {
        invoiceNumber: 'FAV-2026-00002',
        invoiceDate: '2026-03-13',
        salesOrderId: 1
      },
      user: { id: 99 }
    };
    const res = createRes();

    await createSalesInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: expect.stringContaining('Insufficient stock for item 10'),
        status: 409
      }
    });
    expect(mockedRollbackTransaction).toHaveBeenCalledWith(mockConnection);
  });
});
