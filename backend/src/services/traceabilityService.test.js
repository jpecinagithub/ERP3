import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import traceabilityService from './traceabilityService.js';
import { query, testConnection } from '../config/database.js';

describe('TraceabilityService - Integration Tests', () => {
  let testUserId;
  let testSupplierId;
  let testCustomerId;
  let testItemId;
  let testBudgetId;
  let testPurchaseOrderId;
  let testPurchaseInvoiceId;
  let testSalesInvoiceId;

  beforeAll(async () => {
    // Test database connection
    await testConnection();

    // Create test user
    const userResult = await query(
      `INSERT INTO users (username, password, full_name, role) 
       VALUES ('test_trace_user', 'password123', 'Test Trace User', 'administrador')`
    );
    testUserId = userResult.insertId;

    // Create test supplier
    const supplierResult = await query(
      `INSERT INTO suppliers (code, name, tax_id, address, phone, email)
       VALUES ('TRACE-SUP-001', 'Test Trace Supplier', 'B12345678', '123 Test St', '555-0001', 'supplier@test.com')`
    );
    testSupplierId = supplierResult.insertId;

    // Create test customer
    const customerResult = await query(
      `INSERT INTO customers (code, name, tax_id, address, phone, email)
       VALUES ('TRACE-CUST-001', 'Test Trace Customer', 'B87654321', '456 Test Ave', '555-0002', 'customer@test.com')`
    );
    testCustomerId = customerResult.insertId;

    // Create test item
    const itemResult = await query(
      `INSERT INTO items (code, description, unit_of_measure, standard_cost)
       VALUES ('TRACE-ITEM-001', 'Test Trace Item', 'units', 15.00)`
    );
    testItemId = itemResult.insertId;
  });

  afterAll(async () => {
    // Clean up test data in reverse order of dependencies
    await query('DELETE FROM document_links WHERE source_document_id IN (?, ?, ?, ?) OR target_document_id IN (?, ?, ?, ?)', 
      [testBudgetId, testPurchaseOrderId, testPurchaseInvoiceId, testSalesInvoiceId,
       testBudgetId, testPurchaseOrderId, testPurchaseInvoiceId, testSalesInvoiceId]);
    await query('DELETE FROM audit_log WHERE user_id = ?', [testUserId]);
    await query('DELETE FROM sales_invoices WHERE id = ?', [testSalesInvoiceId]);
    await query('DELETE FROM purchase_invoices WHERE id = ?', [testPurchaseInvoiceId]);
    await query('DELETE FROM purchase_orders WHERE id = ?', [testPurchaseOrderId]);
    await query('DELETE FROM budgets WHERE id = ?', [testBudgetId]);
    await query('DELETE FROM items WHERE id = ?', [testItemId]);
    await query('DELETE FROM customers WHERE id = ?', [testCustomerId]);
    await query('DELETE FROM suppliers WHERE id = ?', [testSupplierId]);
    await query('DELETE FROM users WHERE id = ?', [testUserId]);
  });

  beforeEach(async () => {
    // Clear document links and audit log before each test
    if (testBudgetId) {
      await query('DELETE FROM document_links WHERE source_document_id = ? OR target_document_id = ?', 
        [testBudgetId, testBudgetId]);
    }
    if (testPurchaseOrderId) {
      await query('DELETE FROM document_links WHERE source_document_id = ? OR target_document_id = ?', 
        [testPurchaseOrderId, testPurchaseOrderId]);
    }
    if (testPurchaseInvoiceId) {
      await query('DELETE FROM document_links WHERE source_document_id = ? OR target_document_id = ?', 
        [testPurchaseInvoiceId, testPurchaseInvoiceId]);
    }
    if (testSalesInvoiceId) {
      await query('DELETE FROM document_links WHERE source_document_id = ? OR target_document_id = ?', 
        [testSalesInvoiceId, testSalesInvoiceId]);
    }
    await query('DELETE FROM audit_log WHERE user_id = ?', [testUserId]);
  });

  describe('createDocumentLink', () => {
    beforeEach(async () => {
      // Create test budget
      const budgetResult = await query(
        `INSERT INTO budgets (budget_number, supplier_id, budget_date, total_amount, status, created_by)
         VALUES ('TRACE-BUD-001', ?, '2025-01-15', 1500.00, 'pending', ?)`,
        [testSupplierId, testUserId]
      );
      testBudgetId = budgetResult.insertId;

      // Create test purchase order
      const orderResult = await query(
        `INSERT INTO purchase_orders (order_number, supplier_id, order_date, total_amount, status, created_by)
         VALUES ('TRACE-PO-001', ?, '2025-01-16', 1500.00, 'pending', ?)`,
        [testSupplierId, testUserId]
      );
      testPurchaseOrderId = orderResult.insertId;
    });

    it('should create a document link successfully', async () => {
      const linkId = await traceabilityService.createDocumentLink(
        'budget',
        'purchase_order',
        testBudgetId,
        testPurchaseOrderId,
        'converted_to'
      );

      expect(linkId).toBeGreaterThan(0);

      // Verify link was created
      const [link] = await query(
        'SELECT * FROM document_links WHERE id = ?',
        [linkId]
      );

      expect(link).toBeDefined();
      expect(link.source_document_type).toBe('budget');
      expect(link.source_document_id).toBe(testBudgetId);
      expect(link.target_document_type).toBe('purchase_order');
      expect(link.target_document_id).toBe(testPurchaseOrderId);
      expect(link.link_type).toBe('converted_to');
    });

    it('should prevent duplicate links', async () => {
      // Create first link
      const linkId1 = await traceabilityService.createDocumentLink(
        'budget',
        'purchase_order',
        testBudgetId,
        testPurchaseOrderId,
        'converted_to'
      );

      // Try to create duplicate link
      const linkId2 = await traceabilityService.createDocumentLink(
        'budget',
        'purchase_order',
        testBudgetId,
        testPurchaseOrderId,
        'converted_to'
      );

      // Should return the same link ID
      expect(linkId1).toBe(linkId2);

      // Verify only one link exists
      const links = await query(
        `SELECT COUNT(*) as count FROM document_links 
         WHERE source_document_type = 'budget' 
           AND source_document_id = ? 
           AND target_document_type = 'purchase_order' 
           AND target_document_id = ?`,
        [testBudgetId, testPurchaseOrderId]
      );

      expect(links[0].count).toBe(1);
    });

    it('should reject invalid source document type', async () => {
      await expect(
        traceabilityService.createDocumentLink(
          'invalid_type',
          'purchase_order',
          testBudgetId,
          testPurchaseOrderId
        )
      ).rejects.toThrow('Invalid source document type');
    });

    it('should reject invalid target document type', async () => {
      await expect(
        traceabilityService.createDocumentLink(
          'budget',
          'invalid_type',
          testBudgetId,
          testPurchaseOrderId
        )
      ).rejects.toThrow('Invalid target document type');
    });

    it('should reject invalid link type', async () => {
      await expect(
        traceabilityService.createDocumentLink(
          'budget',
          'purchase_order',
          testBudgetId,
          testPurchaseOrderId,
          'invalid_link'
        )
      ).rejects.toThrow('Invalid link type');
    });

    it('should reject missing required parameters', async () => {
      await expect(
        traceabilityService.createDocumentLink(null, 'purchase_order', testBudgetId, testPurchaseOrderId)
      ).rejects.toThrow('Source and target document information is required');

      await expect(
        traceabilityService.createDocumentLink('budget', null, testBudgetId, testPurchaseOrderId)
      ).rejects.toThrow('Source and target document information is required');

      await expect(
        traceabilityService.createDocumentLink('budget', 'purchase_order', null, testPurchaseOrderId)
      ).rejects.toThrow('Source and target document information is required');

      await expect(
        traceabilityService.createDocumentLink('budget', 'purchase_order', testBudgetId, null)
      ).rejects.toThrow('Source and target document information is required');
    });
  });

  describe('getTraceabilityChain', () => {
    beforeEach(async () => {
      // Create complete purchase cycle: Budget → Order → Invoice
      const budgetResult = await query(
        `INSERT INTO budgets (budget_number, supplier_id, budget_date, total_amount, status, created_by)
         VALUES ('TRACE-BUD-002', ?, '2025-01-15', 2000.00, 'converted', ?)`,
        [testSupplierId, testUserId]
      );
      testBudgetId = budgetResult.insertId;

      const orderResult = await query(
        `INSERT INTO purchase_orders (order_number, supplier_id, order_date, total_amount, status, created_by)
         VALUES ('TRACE-PO-002', ?, '2025-01-16', 2000.00, 'pending', ?)`,
        [testSupplierId, testUserId]
      );
      testPurchaseOrderId = orderResult.insertId;

      const invoiceResult = await query(
        `INSERT INTO purchase_invoices (invoice_number, supplier_id, invoice_date, due_date, total_amount, status, created_by)
         VALUES ('TRACE-PI-002', ?, '2025-01-17', '2025-03-17', 2000.00, 'pending', ?)`,
        [testSupplierId, testUserId]
      );
      testPurchaseInvoiceId = invoiceResult.insertId;

      // Create links
      await traceabilityService.createDocumentLink(
        'budget',
        'purchase_order',
        testBudgetId,
        testPurchaseOrderId,
        'converted_to'
      );

      await traceabilityService.createDocumentLink(
        'purchase_order',
        'purchase_invoice',
        testPurchaseOrderId,
        testPurchaseInvoiceId,
        'converted_to'
      );
    });

    it('should retrieve complete traceability chain from middle document', async () => {
      const chain = await traceabilityService.getTraceabilityChain('purchase_order', testPurchaseOrderId);

      expect(chain).toBeDefined();
      expect(chain.document.type).toBe('purchase_order');
      expect(chain.document.id).toBe(testPurchaseOrderId);
      expect(chain.ancestors).toHaveLength(1);
      expect(chain.descendants).toHaveLength(1);
      expect(chain.ancestors[0].documentType).toBe('budget');
      expect(chain.descendants[0].documentType).toBe('purchase_invoice');
    });

    it('should retrieve chain from first document (budget)', async () => {
      const chain = await traceabilityService.getTraceabilityChain('budget', testBudgetId);

      expect(chain).toBeDefined();
      expect(chain.document.type).toBe('budget');
      expect(chain.ancestors).toHaveLength(0); // No ancestors
      expect(chain.descendants.length).toBeGreaterThan(0); // Has descendants
    });

    it('should retrieve chain from last document (invoice)', async () => {
      const chain = await traceabilityService.getTraceabilityChain('purchase_invoice', testPurchaseInvoiceId);

      expect(chain).toBeDefined();
      expect(chain.document.type).toBe('purchase_invoice');
      expect(chain.ancestors.length).toBeGreaterThan(0); // Has ancestors
      expect(chain.descendants).toHaveLength(0); // No descendants
    });

    it('should build full chain correctly', async () => {
      const chain = await traceabilityService.getTraceabilityChain('purchase_order', testPurchaseOrderId);

      expect(chain.fullChain).toBeDefined();
      expect(chain.fullChain.length).toBeGreaterThanOrEqual(3); // Budget, Order, Invoice
      
      // Verify order in chain
      const types = chain.fullChain.map(doc => doc.type);
      const budgetIndex = types.indexOf('budget');
      const orderIndex = types.indexOf('purchase_order');
      const invoiceIndex = types.indexOf('purchase_invoice');

      expect(budgetIndex).toBeLessThan(orderIndex);
      expect(orderIndex).toBeLessThan(invoiceIndex);
    });

    it('should reject missing parameters', async () => {
      await expect(
        traceabilityService.getTraceabilityChain(null, testBudgetId)
      ).rejects.toThrow('Document type and ID are required');

      await expect(
        traceabilityService.getTraceabilityChain('budget', null)
      ).rejects.toThrow('Document type and ID are required');
    });
  });

  describe('logAction', () => {
    it('should log a create action successfully', async () => {
      const logId = await traceabilityService.logAction(
        testUserId,
        'create',
        'budget',
        testBudgetId || 1,
        null,
        { budget_number: 'TEST-001', total_amount: 1000 }
      );

      expect(logId).toBeGreaterThan(0);

      // Verify log entry
      const [log] = await query(
        'SELECT * FROM audit_log WHERE id = ?',
        [logId]
      );

      expect(log).toBeDefined();
      expect(log.user_id).toBe(testUserId);
      expect(log.action).toBe('create');
      expect(log.entity_type).toBe('budget');
      expect(log.old_values).toBeNull();
      expect(log.new_values).toBeDefined();
    });

    it('should log an update action with old and new values', async () => {
      const logId = await traceabilityService.logAction(
        testUserId,
        'update',
        'budget',
        testBudgetId || 1,
        { status: 'pending' },
        { status: 'converted' }
      );

      expect(logId).toBeGreaterThan(0);

      // Verify log entry
      const [log] = await query(
        'SELECT * FROM audit_log WHERE id = ?',
        [logId]
      );

      expect(log).toBeDefined();
      expect(log.action).toBe('update');
      expect(log.old_values).toBeDefined();
      expect(log.new_values).toBeDefined();

      const oldValues = JSON.parse(log.old_values);
      const newValues = JSON.parse(log.new_values);
      expect(oldValues.status).toBe('pending');
      expect(newValues.status).toBe('converted');
    });

    it('should log a delete action', async () => {
      const logId = await traceabilityService.logAction(
        testUserId,
        'delete',
        'budget',
        testBudgetId || 1,
        { budget_number: 'TEST-001', status: 'pending' },
        null
      );

      expect(logId).toBeGreaterThan(0);

      const [log] = await query(
        'SELECT * FROM audit_log WHERE id = ?',
        [logId]
      );

      expect(log).toBeDefined();
      expect(log.action).toBe('delete');
      expect(log.old_values).toBeDefined();
      expect(log.new_values).toBeNull();
    });

    it('should reject invalid action type', async () => {
      await expect(
        traceabilityService.logAction(
          testUserId,
          'invalid_action',
          'budget',
          1
        )
      ).rejects.toThrow('Invalid action type');
    });

    it('should reject missing required parameters', async () => {
      await expect(
        traceabilityService.logAction(null, 'create', 'budget', 1)
      ).rejects.toThrow('User ID, action, entity type, and entity ID are required');

      await expect(
        traceabilityService.logAction(testUserId, null, 'budget', 1)
      ).rejects.toThrow('User ID, action, entity type, and entity ID are required');

      await expect(
        traceabilityService.logAction(testUserId, 'create', null, 1)
      ).rejects.toThrow('User ID, action, entity type, and entity ID are required');

      await expect(
        traceabilityService.logAction(testUserId, 'create', 'budget', null)
      ).rejects.toThrow('User ID, action, entity type, and entity ID are required');
    });
  });

  describe('canDeleteDocument', () => {
    beforeEach(async () => {
      // Create test documents
      const budgetResult = await query(
        `INSERT INTO budgets (budget_number, supplier_id, budget_date, total_amount, status, created_by)
         VALUES ('TRACE-BUD-003', ?, '2025-01-15', 1000.00, 'pending', ?)`,
        [testSupplierId, testUserId]
      );
      testBudgetId = budgetResult.insertId;

      const orderResult = await query(
        `INSERT INTO purchase_orders (order_number, supplier_id, order_date, total_amount, status, created_by)
         VALUES ('TRACE-PO-003', ?, '2025-01-16', 1000.00, 'pending', ?)`,
        [testSupplierId, testUserId]
      );
      testPurchaseOrderId = orderResult.insertId;
    });

    it('should allow deletion of document without links', async () => {
      const result = await traceabilityService.canDeleteDocument('budget', testBudgetId);

      expect(result.canDelete).toBe(true);
      expect(result.reason).toContain('no dependencies');
    });

    it('should prevent deletion of document with links', async () => {
      // Create link
      await traceabilityService.createDocumentLink(
        'budget',
        'purchase_order',
        testBudgetId,
        testPurchaseOrderId,
        'converted_to'
      );

      const result = await traceabilityService.canDeleteDocument('budget', testBudgetId);

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('traceability chain');
      expect(result.linkedDocumentsCount).toBeGreaterThan(0);
      expect(result.linkedDocuments).toBeDefined();
    });

    it('should prevent deletion of purchase invoice with payments', async () => {
      // Create purchase invoice
      const invoiceResult = await query(
        `INSERT INTO purchase_invoices (invoice_number, supplier_id, invoice_date, due_date, total_amount, status, created_by)
         VALUES ('TRACE-PI-003', ?, '2025-01-17', '2025-03-17', 1000.00, 'pending', ?)`,
        [testSupplierId, testUserId]
      );
      testPurchaseInvoiceId = invoiceResult.insertId;

      // Create payment
      await query(
        `INSERT INTO payments (payment_number, purchase_invoice_id, payment_date, amount, payment_method, created_by)
         VALUES ('TRACE-PAY-001', ?, '2025-01-20', 500.00, 'bank_transfer', ?)`,
        [testPurchaseInvoiceId, testUserId]
      );

      const result = await traceabilityService.canDeleteDocument('purchase_invoice', testPurchaseInvoiceId);

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('payments');
      expect(result.paymentsCount).toBeGreaterThan(0);
    });

    it('should prevent deletion of sales invoice with collections', async () => {
      // Create sales invoice
      const invoiceResult = await query(
        `INSERT INTO sales_invoices (invoice_number, customer_id, invoice_date, due_date, total_amount, status, created_by)
         VALUES ('TRACE-SI-003', ?, '2025-01-17', '2025-04-17', 1000.00, 'pending', ?)`,
        [testCustomerId, testUserId]
      );
      testSalesInvoiceId = invoiceResult.insertId;

      // Create collection
      await query(
        `INSERT INTO collections (collection_number, sales_invoice_id, collection_date, amount, collection_method, created_by)
         VALUES ('TRACE-COL-001', ?, '2025-01-20', 500.00, 'bank_transfer', ?)`,
        [testSalesInvoiceId, testUserId]
      );

      const result = await traceabilityService.canDeleteDocument('sales_invoice', testSalesInvoiceId);

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('collections');
      expect(result.collectionsCount).toBeGreaterThan(0);
    });

    it('should reject missing parameters', async () => {
      await expect(
        traceabilityService.canDeleteDocument(null, testBudgetId)
      ).rejects.toThrow('Document type and ID are required');

      await expect(
        traceabilityService.canDeleteDocument('budget', null)
      ).rejects.toThrow('Document type and ID are required');
    });
  });

  describe('getAuditLog', () => {
    beforeEach(async () => {
      // Create test budget
      const budgetResult = await query(
        `INSERT INTO budgets (budget_number, supplier_id, budget_date, total_amount, status, created_by)
         VALUES ('TRACE-BUD-004', ?, '2025-01-15', 1500.00, 'pending', ?)`,
        [testSupplierId, testUserId]
      );
      testBudgetId = budgetResult.insertId;

      // Create multiple audit log entries
      await traceabilityService.logAction(testUserId, 'create', 'budget', testBudgetId, null, { status: 'pending' });
      await traceabilityService.logAction(testUserId, 'update', 'budget', testBudgetId, { status: 'pending' }, { status: 'converted' });
    });

    it('should retrieve audit log for specific entity', async () => {
      const logs = await traceabilityService.getAuditLog('budget', testBudgetId);

      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs[0].entityType).toBe('budget');
      expect(logs[0].entityId).toBe(testBudgetId);
      expect(logs[0].username).toBe('test_trace_user');
    });

    it('should limit results correctly', async () => {
      const logs = await traceabilityService.getAuditLog('budget', testBudgetId, 1);

      expect(logs).toBeDefined();
      expect(logs.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for entity with no logs', async () => {
      const logs = await traceabilityService.getAuditLog('budget', 999999);

      expect(logs).toBeDefined();
      expect(logs).toHaveLength(0);
    });
  });

  describe('getRecentAuditLog', () => {
    beforeEach(async () => {
      // Create multiple audit entries
      await traceabilityService.logAction(testUserId, 'create', 'budget', 1, null, { test: 'data1' });
      await traceabilityService.logAction(testUserId, 'update', 'budget', 1, { test: 'data1' }, { test: 'data2' });
      await traceabilityService.logAction(testUserId, 'delete', 'budget', 2, { test: 'data2' }, null);
    });

    it('should retrieve recent audit logs', async () => {
      const logs = await traceabilityService.getRecentAuditLog(10);

      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.length).toBeLessThanOrEqual(10);
    });

    it('should filter by action type', async () => {
      const logs = await traceabilityService.getRecentAuditLog(10, 'create');

      expect(logs).toBeDefined();
      logs.forEach(log => {
        expect(log.action).toBe('create');
      });
    });

    it('should filter by user ID', async () => {
      const logs = await traceabilityService.getRecentAuditLog(10, null, testUserId);

      expect(logs).toBeDefined();
      logs.forEach(log => {
        expect(log.userId).toBe(testUserId);
      });
    });

    it('should filter by both action and user', async () => {
      const logs = await traceabilityService.getRecentAuditLog(10, 'update', testUserId);

      expect(logs).toBeDefined();
      logs.forEach(log => {
        expect(log.action).toBe('update');
        expect(log.userId).toBe(testUserId);
      });
    });
  });
});
