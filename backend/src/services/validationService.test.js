import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import validationService from './validationService.js';
import { query, beginTransaction, commitTransaction, rollbackTransaction, testConnection } from '../config/database.js';

describe('ValidationService', () => {
  let testUserId;
  let testAccountIds = {};

  beforeAll(async () => {
    // Test database connection
    await testConnection();

    // Create test user
    const userResult = await query(
      `INSERT INTO users (username, password, full_name, role) 
       VALUES ('test_validation', 'password', 'Test Validation User', 'contabilidad')`
    );
    testUserId = userResult.insertId;

    // Ensure fundamental PGCE accounts exist
    const accounts = [
      { code: '100', name: 'Capital social', type: 'equity' },
      { code: '129', name: 'Resultado del ejercicio', type: 'equity' },
      { code: '200', name: 'Inmovilizado material', type: 'asset' },
      { code: '280', name: 'Amortización acumulada', type: 'asset' },
      { code: '300', name: 'Existencias', type: 'asset' },
      { code: '400', name: 'Proveedores', type: 'liability' },
      { code: '430', name: 'Clientes', type: 'asset' },
      { code: '570', name: 'Caja', type: 'asset' },
      { code: '600', name: 'Compras', type: 'expense' },
      { code: '700', name: 'Ventas', type: 'income' }
    ];

    for (const account of accounts) {
      const existing = await query('SELECT id FROM accounts WHERE code = ?', [account.code]);
      if (existing.length > 0) {
        testAccountIds[account.code] = existing[0].id;
      } else {
        const result = await query(
          'INSERT INTO accounts (code, name, account_type) VALUES (?, ?, ?)',
          [account.code, account.name, account.type]
        );
        testAccountIds[account.code] = result.insertId;
      }
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await query('DELETE FROM users WHERE id = ?', [testUserId]);
    }
  });

  beforeEach(async () => {
    // Clean up test entries before each test
    await query('DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE created_by = ?)', [testUserId]);
    await query('DELETE FROM journal_entries WHERE created_by = ?', [testUserId]);
    await query('DELETE FROM inventory_movements WHERE created_by = ?', [testUserId]);
    await query('DELETE FROM sales_invoices WHERE created_by = ?', [testUserId]);
    await query('DELETE FROM purchase_invoices WHERE created_by = ?', [testUserId]);
  });

  describe('validateFundamentalEquation', () => {
    it('should validate balanced equation when Assets = Liabilities + Equity', async () => {
      // Create balanced journal entry: Debit Cash 1000, Credit Capital 1000
      const entryResult = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Test balanced entry', testUserId]
      );
      const entryId = entryResult.insertId;

      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['570'], 1000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['100'], 0, 1000]
      );

      const result = await validationService.validateFundamentalEquation();

      expect(result.isValid).toBe(true);
      expect(result.totalAssets).toBe(1000);
      expect(result.totalEquity).toBe(1000);
      expect(result.difference).toBeLessThan(0.01);
    });

    it('should detect imbalanced equation', async () => {
      // Create imbalanced entry: Only debit side
      const entryResult = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Test imbalanced entry', testUserId]
      );
      const entryId = entryResult.insertId;

      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['570'], 500, 0]
      );

      const result = await validationService.validateFundamentalEquation();

      expect(result.isValid).toBe(false);
      expect(result.difference).toBeGreaterThan(0);
    });

    it('should remain balanced when period has expenses not closed into account 129 yet', async () => {
      // Initial contribution: Dr 570 / Cr 100
      const initialEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2026-01-01', 'Initial capital', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [initialEntry.insertId, testAccountIds['570'], 15000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [initialEntry.insertId, testAccountIds['100'], 0, 15000]
      );

      // Supplier invoice: Dr 600 / Cr 400
      const invoiceEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2026-03-12', 'Purchase invoice', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [invoiceEntry.insertId, testAccountIds['600'], 1650, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [invoiceEntry.insertId, testAccountIds['400'], 0, 1650]
      );

      // Payment to supplier: Dr 400 / Cr 570
      const paymentEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2026-03-13', 'Supplier payment', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [paymentEntry.insertId, testAccountIds['400'], 1650, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [paymentEntry.insertId, testAccountIds['570'], 0, 1650]
      );

      const result = await validationService.validateFundamentalEquation('2026-01-01', '2026-12-31');

      expect(result.isValid).toBe(true);
      expect(result.totalAssets).toBe(13350);
      expect(result.totalEquity).toBe(15000);
      expect(result.periodResult).toBe(-1650);
      expect(result.liabilitiesPlusEquity).toBe(13350);
      expect(result.difference).toBeLessThan(0.01);
    });
  });

  describe('validateInventoryCoherence', () => {
    it('should validate when inventory value matches account 300', async () => {
      // Create test item
      const itemResult = await query(
        'INSERT INTO items (code, description, unit_of_measure, standard_cost) VALUES (?, ?, ?, ?)',
        ['TEST001', 'Test Item', 'unit', 10.00]
      );
      const itemId = itemResult.insertId;

      // Create inventory movement: 100 units at 10.00 = 1000.00
      await query(
        'INSERT INTO inventory_movements (item_id, movement_date, movement_type, quantity, unit_cost, total_value, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [itemId, '2025-01-01', 'inbound', 100, 10.00, 1000.00, testUserId]
      );

      // Create matching journal entry for account 300
      const entryResult = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Inventory entry', testUserId]
      );
      const entryId = entryResult.insertId;

      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['300'], 1000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['400'], 0, 1000]
      );

      const result = await validationService.validateInventoryCoherence();

      expect(result.isValid).toBe(true);
      expect(result.inventoryValue).toBe(1000);
      expect(result.account300Balance).toBe(1000);
      expect(result.difference).toBeLessThan(0.01);

      // Cleanup
      await query('DELETE FROM inventory_movements WHERE item_id = ?', [itemId]);
      await query('DELETE FROM items WHERE id = ?', [itemId]);
    });

    it('should detect mismatch between inventory and account 300', async () => {
      // Create test item
      const itemResult = await query(
        'INSERT INTO items (code, description, unit_of_measure, standard_cost) VALUES (?, ?, ?, ?)',
        ['TEST002', 'Test Item 2', 'unit', 10.00]
      );
      const itemId = itemResult.insertId;

      // Create inventory movement: 100 units = 1000.00
      await query(
        'INSERT INTO inventory_movements (item_id, movement_date, movement_type, quantity, unit_cost, total_value, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [itemId, '2025-01-01', 'inbound', 100, 10.00, 1000.00, testUserId]
      );

      // Create mismatched journal entry for account 300 (only 500)
      const entryResult = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Inventory entry', testUserId]
      );
      const entryId = entryResult.insertId;

      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['300'], 500, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['400'], 0, 500]
      );

      const result = await validationService.validateInventoryCoherence();

      expect(result.isValid).toBe(false);
      expect(result.difference).toBeGreaterThan(0);

      // Cleanup
      await query('DELETE FROM inventory_movements WHERE item_id = ?', [itemId]);
      await query('DELETE FROM items WHERE id = ?', [itemId]);
    });
  });

  describe('validateReceivablesCoherence', () => {
    it('should validate when account 430 matches pending sales invoices', async () => {
      // Create test customer
      const customerResult = await query(
        'INSERT INTO customers (code, name, tax_id) VALUES (?, ?, ?)',
        ['CUST001', 'Test Customer', 'B12345678']
      );
      const customerId = customerResult.insertId;

      // Create pending sales invoice
      await query(
        'INSERT INTO sales_invoices (invoice_number, customer_id, invoice_date, due_date, total_amount, collected_amount, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['SV001', customerId, '2025-01-01', '2025-04-01', 1000.00, 0, 'pending', testUserId]
      );

      // Create matching journal entry for account 430
      const entryResult = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Sales invoice', testUserId]
      );
      const entryId = entryResult.insertId;

      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['430'], 1000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['700'], 0, 1000]
      );

      const result = await validationService.validateReceivablesCoherence();

      expect(result.isValid).toBe(true);
      expect(result.pendingInvoices).toBe(1000);
      expect(result.account430Balance).toBe(1000);

      // Cleanup
      await query('DELETE FROM customers WHERE id = ?', [customerId]);
    });
  });

  describe('validatePayablesCoherence', () => {
    it('should validate when account 400 matches pending purchase invoices', async () => {
      // Create test supplier
      const supplierResult = await query(
        'INSERT INTO suppliers (code, name, tax_id) VALUES (?, ?, ?)',
        ['SUPP001', 'Test Supplier', 'B87654321']
      );
      const supplierId = supplierResult.insertId;

      // Create pending purchase invoice
      await query(
        'INSERT INTO purchase_invoices (invoice_number, supplier_id, invoice_date, due_date, total_amount, paid_amount, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['PI001', supplierId, '2025-01-01', '2025-03-02', 2000.00, 0, 'pending', testUserId]
      );

      // Create matching journal entry for account 400
      const entryResult = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Purchase invoice', testUserId]
      );
      const entryId = entryResult.insertId;

      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['600'], 2000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['400'], 0, 2000]
      );

      const result = await validationService.validatePayablesCoherence();

      expect(result.isValid).toBe(true);
      expect(result.pendingInvoices).toBe(2000);
      expect(result.account400Balance).toBe(2000);

      // Cleanup
      await query('DELETE FROM suppliers WHERE id = ?', [supplierId]);
    });
  });

  describe('validatePnLResult', () => {
    it('should validate when P&L result matches account 129', async () => {
      // Create income entry: Credit 700 (Sales) 5000
      const incomeEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Sales', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [incomeEntry.insertId, testAccountIds['430'], 5000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [incomeEntry.insertId, testAccountIds['700'], 0, 5000]
      );

      // Create expense entry: Debit 600 (Purchases) 3000
      const expenseEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Purchases', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [expenseEntry.insertId, testAccountIds['600'], 3000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [expenseEntry.insertId, testAccountIds['400'], 0, 3000]
      );

      // Create result entry: Credit 129 with result (5000 - 3000 = 2000)
      const resultEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Period result', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [resultEntry.insertId, testAccountIds['700'], 5000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [resultEntry.insertId, testAccountIds['600'], 0, 3000]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [resultEntry.insertId, testAccountIds['129'], 0, 2000]
      );

      const result = await validationService.validatePnLResult();

      expect(result.isValid).toBe(true);
      expect(result.totalIncome).toBe(5000);
      expect(result.totalExpenses).toBe(3000);
      expect(result.calculatedResult).toBe(2000);
      expect(result.account129Balance).toBe(2000);
      expect(result.isProvisional).toBe(false);
    });

    it('should be valid in non-strict mode when P&L is not closed into account 129 yet', async () => {
      const incomeEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-02-01', 'Sales open period', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [incomeEntry.insertId, testAccountIds['430'], 4000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [incomeEntry.insertId, testAccountIds['700'], 0, 4000]
      );

      const expenseEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-02-02', 'Expense open period', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [expenseEntry.insertId, testAccountIds['600'], 3100, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [expenseEntry.insertId, testAccountIds['400'], 0, 3100]
      );

      const result = await validationService.validatePnLResult();

      expect(result.calculatedResult).toBe(900);
      expect(result.account129Balance).toBe(0);
      expect(result.isValid).toBe(true);
      expect(result.isProvisional).toBe(true);
      expect(result.strictMode).toBe(false);
    });

    it('should fail in strict mode when P&L is not closed into account 129', async () => {
      const incomeEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-03-01', 'Sales strict mode', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [incomeEntry.insertId, testAccountIds['430'], 2000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [incomeEntry.insertId, testAccountIds['700'], 0, 2000]
      );

      const result = await validationService.validatePnLResult(null, null, { strict: true });

      expect(result.calculatedResult).toBe(2000);
      expect(result.account129Balance).toBe(0);
      expect(result.isValid).toBe(false);
      expect(result.isProvisional).toBe(false);
      expect(result.strictMode).toBe(true);
    });
  });

  describe('validateNonNegativeInventory', () => {
    it('should pass when all inventory items have non-negative stock', async () => {
      // Create test item with positive stock
      const itemResult = await query(
        'INSERT INTO items (code, description, unit_of_measure, standard_cost) VALUES (?, ?, ?, ?)',
        ['TEST003', 'Test Item 3', 'unit', 10.00]
      );
      const itemId = itemResult.insertId;

      await query(
        'INSERT INTO inventory_movements (item_id, movement_date, movement_type, quantity, unit_cost, total_value, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [itemId, '2025-01-01', 'inbound', 50, 10.00, 500.00, testUserId]
      );

      const result = await validationService.validateNonNegativeInventory();

      expect(result.isValid).toBe(true);
      expect(result.negativeItemsCount).toBe(0);

      // Cleanup
      await query('DELETE FROM inventory_movements WHERE item_id = ?', [itemId]);
      await query('DELETE FROM items WHERE id = ?', [itemId]);
    });

    it('should detect negative inventory stock', async () => {
      // Create test item with negative stock
      const itemResult = await query(
        'INSERT INTO items (code, description, unit_of_measure, standard_cost) VALUES (?, ?, ?, ?)',
        ['TEST004', 'Test Item 4', 'unit', 10.00]
      );
      const itemId = itemResult.insertId;

      await query(
        'INSERT INTO inventory_movements (item_id, movement_date, movement_type, quantity, unit_cost, total_value, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [itemId, '2025-01-01', 'outbound', -30, 10.00, -300.00, testUserId]
      );

      const result = await validationService.validateNonNegativeInventory();

      expect(result.isValid).toBe(false);
      expect(result.negativeItemsCount).toBeGreaterThan(0);
      expect(result.negativeItems[0].code).toBe('TEST004');

      // Cleanup
      await query('DELETE FROM inventory_movements WHERE item_id = ?', [itemId]);
      await query('DELETE FROM items WHERE id = ?', [itemId]);
    });
  });

  describe('validateNonNegativeFixedAssets', () => {
    it('should pass when all fixed assets have non-negative balances', async () => {
      // Create fixed asset entry with positive balance
      const entryResult = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Fixed asset purchase', testUserId]
      );
      const entryId = entryResult.insertId;

      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['200'], 10000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['570'], 0, 10000]
      );

      const result = await validationService.validateNonNegativeFixedAssets();

      expect(result.isValid).toBe(true);
      expect(result.negativeAccountsCount).toBe(0);
    });
  });

  describe('validateDepreciation', () => {
    it('should pass when depreciation does not exceed asset value', async () => {
      // Create fixed asset: 10000
      const assetEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Fixed asset', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [assetEntry.insertId, testAccountIds['200'], 10000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [assetEntry.insertId, testAccountIds['570'], 0, 10000]
      );

      // Create depreciation: 2000 (less than asset value)
      const depEntry = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Depreciation', testUserId]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [depEntry.insertId, testAccountIds['600'], 2000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [depEntry.insertId, testAccountIds['280'], 0, 2000]
      );

      const result = await validationService.validateDepreciation();

      expect(result.isValid).toBe(true);
      expect(result.violationsCount).toBe(0);
    });
  });

  describe('validateAllRules', () => {
    it('should run all validation rules and return comprehensive result', async () => {
      // Create a simple balanced scenario
      const entryResult = await query(
        'INSERT INTO journal_entries (entry_date, description, created_by) VALUES (?, ?, ?)',
        ['2025-01-01', 'Initial capital', testUserId]
      );
      const entryId = entryResult.insertId;

      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['570'], 10000, 0]
      );
      await query(
        'INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        [entryId, testAccountIds['100'], 0, 10000]
      );

      const result = await validationService.validateAllRules();

      expect(result).toHaveProperty('allValid');
      expect(result).toHaveProperty('validationsCount');
      expect(result).toHaveProperty('passedCount');
      expect(result).toHaveProperty('failedCount');
      expect(result).toHaveProperty('validations');
      expect(result.validationsCount).toBe(8);
      expect(result.validations).toHaveProperty('fundamentalEquation');
      expect(result.validations).toHaveProperty('inventoryCoherence');
      expect(result.validations).toHaveProperty('receivablesCoherence');
      expect(result.validations).toHaveProperty('payablesCoherence');
      expect(result.validations).toHaveProperty('pnlResult');
      expect(result.validations).toHaveProperty('nonNegativeInventory');
      expect(result.validations).toHaveProperty('nonNegativeFixedAssets');
      expect(result.validations).toHaveProperty('depreciation');
    });
  });
});
