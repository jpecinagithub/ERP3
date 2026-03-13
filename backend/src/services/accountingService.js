import { query } from '../config/database.js';

/**
 * AccountingService - Core service for automatic journal entry generation
 * Implements double-entry bookkeeping according to Spanish PGCE standards
 */
class AccountingService {
  /**
   * Gets journal entries with optional filters
   * 
   * @param {object} filters - Filters for journal entries
   * @returns {Promise<array>} Journal entries with lines
   */
  async getJournalEntries(filters = {}) {
    try {
      const { startDate, endDate, sourceDocumentType } = filters;

      let sql = `
        SELECT je.id, je.entry_date, je.description, je.source_document_type, je.created_by
        FROM journal_entries je
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        sql += ` AND je.entry_date >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        sql += ` AND je.entry_date <= ?`;
        params.push(endDate);
      }

      if (sourceDocumentType) {
        sql += ` AND je.source_document_type = ?`;
        params.push(sourceDocumentType);
      }

      sql += ` ORDER BY je.entry_date DESC, je.id DESC`;

      const entries = await query(sql, params);

      const entriesWithLines = await Promise.all(
        entries.map(async (entry) => {
          const lines = await query(
            `SELECT jel.*, a.code as account_code, a.name as account_name
             FROM journal_entry_lines jel
             JOIN accounts a ON jel.account_id = a.id
             WHERE jel.journal_entry_id = ?
             ORDER BY jel.id`,
            [entry.id]
          );

          return {
            ...entry,
            lines: lines.map(line => ({
              accountId: line.account_id,
              accountCode: line.account_code,
              accountName: line.account_name,
              debit: parseFloat(line.debit) || 0,
              credit: parseFloat(line.credit) || 0,
              description: line.description
            }))
          };
        })
      );

      return entriesWithLines;
    } catch (error) {
      console.error('Error getting journal entries:', error);
      throw error;
    }
  }

  /**
   * Generates automatic journal entry for a purchase invoice
   * Debit: Expense/Inventory account (600 or 300)
   * Credit: Account 400 Proveedores
   * 
   * @param {number} invoiceId - Purchase invoice ID
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created journal entry ID
   */
  async generatePurchaseInvoiceEntry(invoiceId, connection = null, options = {}) {
    const executeQuery = connection 
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      const invoiceType = options.invoiceType || null;
      const configuredExpenseAccountCode = options.expenseAccountCode || null;
      const configuredAssetAccountCode = options.assetAccountCode || null;
      const includeVAT = options.includeVAT === true;
      const vatRate = Number.isFinite(Number(options.vatRate)) ? Number(options.vatRate) : 0.21;
      const inputTaxAccountCode = options.inputTaxAccountCode || '472';

      // Get purchase invoice details
      const [invoice] = await executeQuery(
        `SELECT pi.*, s.name as supplier_name 
         FROM purchase_invoices pi
         JOIN suppliers s ON pi.supplier_id = s.id
         WHERE pi.id = ?`,
        [invoiceId]
      );

      if (!invoice) {
        throw new Error(`Purchase invoice ${invoiceId} not found`);
      }

      // Get invoice lines to determine if it's inventory or expense
      const lines = await executeQuery(
        `SELECT pil.*, i.description as item_description
         FROM purchase_invoice_lines pil
         LEFT JOIN items i ON pil.item_id = i.id
         WHERE pil.purchase_invoice_id = ?`,
        [invoiceId]
      );

      if (!lines || lines.length === 0) {
        throw new Error(`No lines found for purchase invoice ${invoiceId}`);
      }

      const linesBaseAmount = Number(
        lines.reduce((sum, line) => sum + (parseFloat(line.line_total) || 0), 0).toFixed(2)
      );
      const grossAmount = Number((parseFloat(invoice.total_amount) || 0).toFixed(2));
      const baseAmount = includeVAT ? linesBaseAmount : grossAmount;
      const inferredVatAmount = Number((grossAmount - baseAmount).toFixed(2));
      const fallbackVatAmount = Number((baseAmount * vatRate).toFixed(2));
      const vatAmount = includeVAT
        ? (inferredVatAmount > 0 ? inferredVatAmount : fallbackVatAmount)
        : 0;
      const supplierAmount = Number((baseAmount + vatAmount).toFixed(2));

      // Create journal entry header
      const entryResult = await executeQuery(
        `INSERT INTO journal_entries (entry_date, description, source_document_type, source_document_id, created_by)
         VALUES (?, ?, 'purchase_invoice', ?, ?)`,
        [
          invoice.invoice_date,
          `Factura de compra ${invoice.invoice_number} - ${invoice.supplier_name}`,
          invoiceId,
          invoice.created_by
        ]
      );

      const journalEntryId = entryResult.insertId;

      const effectiveInvoiceType = invoiceType || invoice.invoice_type || 'mercaderia';
      const debitAccountCode = effectiveInvoiceType === 'inmovilizado'
        ? (configuredAssetAccountCode || '223')
        : effectiveInvoiceType === 'gasto'
          ? (configuredExpenseAccountCode || '621')
          : '600';
      const debitDescription = effectiveInvoiceType === 'inmovilizado'
        ? `Alta inmovilizado según factura ${invoice.invoice_number}`
        : effectiveInvoiceType === 'gasto'
          ? `Gasto según factura ${invoice.invoice_number}`
          : `Compra según factura ${invoice.invoice_number}`;

      // Debit line: account by purchase invoice type
      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = ?), ?, 0, ?)`,
        [
          journalEntryId,
          debitAccountCode,
          baseAmount,
          debitDescription
        ]
      );

      if (vatAmount > 0.01) {
        await executeQuery(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
           VALUES (?, (SELECT id FROM accounts WHERE code = ?), ?, 0, ?)`,
          [
            journalEntryId,
            inputTaxAccountCode,
            vatAmount,
            `IVA soportado factura ${invoice.invoice_number}`
          ]
        );
      }

      // Credit line: Account 400 Proveedores
      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = '400'), 0, ?, ?)`,
        [
          journalEntryId,
          supplierAmount,
          `Proveedor ${invoice.supplier_name}`
        ]
      );

      return journalEntryId;
    } catch (error) {
      console.error('Error generating purchase invoice entry:', error);
      throw error;
    }
  }

  /**
   * Generates automatic journal entry for a sales invoice
   * Debit: Account 430 Clientes
   * Credit: Income account 700 Ventas
   * 
   * @param {number} invoiceId - Sales invoice ID
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created journal entry ID
   */
  async generateSalesInvoiceEntry(invoiceId, connection = null, options = {}) {
    const executeQuery = connection 
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      const includeVAT = options.includeVAT === true;
      const vatRate = Number.isFinite(Number(options.vatRate)) ? Number(options.vatRate) : 0.21;
      const outputTaxAccountCode = options.outputTaxAccountCode || '477';

      // Get sales invoice details
      const [invoice] = await executeQuery(
        `SELECT si.*, c.name as customer_name 
         FROM sales_invoices si
         JOIN customers c ON si.customer_id = c.id
         WHERE si.id = ?`,
        [invoiceId]
      );

      if (!invoice) {
        throw new Error(`Sales invoice ${invoiceId} not found`);
      }

      const lines = await executeQuery(
        `SELECT line_total
         FROM sales_invoice_lines
         WHERE sales_invoice_id = ?`,
        [invoiceId]
      );

      if (!lines || lines.length === 0) {
        throw new Error(`No lines found for sales invoice ${invoiceId}`);
      }

      const linesBaseAmount = Number(
        lines.reduce((sum, line) => sum + (parseFloat(line.line_total) || 0), 0).toFixed(2)
      );
      const grossAmount = Number((parseFloat(invoice.total_amount) || 0).toFixed(2));
      const baseAmount = includeVAT ? linesBaseAmount : grossAmount;
      const inferredVatAmount = Number((grossAmount - baseAmount).toFixed(2));
      const fallbackVatAmount = Number((baseAmount * vatRate).toFixed(2));
      const vatAmount = includeVAT
        ? (inferredVatAmount > 0 ? inferredVatAmount : fallbackVatAmount)
        : 0;
      const customerAmount = Number((baseAmount + vatAmount).toFixed(2));

      // Create journal entry header
      const entryResult = await executeQuery(
        `INSERT INTO journal_entries (entry_date, description, source_document_type, source_document_id, created_by)
         VALUES (?, ?, 'sales_invoice', ?, ?)`,
        [
          invoice.invoice_date,
          `Factura de venta ${invoice.invoice_number} - ${invoice.customer_name}`,
          invoiceId,
          invoice.created_by
        ]
      );

      const journalEntryId = entryResult.insertId;

      // Debit line: Account 430 Clientes
      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = '430'), ?, 0, ?)`,
        [
          journalEntryId,
          customerAmount,
          `Cliente ${invoice.customer_name}`
        ]
      );

      const revenueAccountCode = options.revenueAccountCode || '700';

      // Credit line: Account 700 Ventas
      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = ?), 0, ?, ?)`,
        [
          journalEntryId,
          revenueAccountCode,
          baseAmount,
          `Venta según factura ${invoice.invoice_number}`
        ]
      );

      if (vatAmount > 0.01) {
        await executeQuery(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
           VALUES (?, (SELECT id FROM accounts WHERE code = ?), 0, ?, ?)`,
          [
            journalEntryId,
            outputTaxAccountCode,
            vatAmount,
            `IVA repercutido factura ${invoice.invoice_number}`
          ]
        );
      }

      return journalEntryId;
    } catch (error) {
      console.error('Error generating sales invoice entry:', error);
      throw error;
    }
  }

  /**
   * Generates inventory output journal entry for a sales invoice of mercaderias.
   * Debit: 610 Variacion de existencias
   * Credit: 300 Existencias
   *
   * @param {number} invoiceId - Sales invoice ID
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number|null>} Created journal entry ID or null if there is no inventory output
   */
  async generateSalesInventoryOutputEntry(invoiceId, connection = null) {
    const executeQuery = connection
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      const [invoice] = await executeQuery(
        `SELECT si.*, c.name as customer_name
         FROM sales_invoices si
         JOIN customers c ON si.customer_id = c.id
         WHERE si.id = ?`,
        [invoiceId]
      );

      if (!invoice) {
        throw new Error(`Sales invoice ${invoiceId} not found`);
      }

      const [movementSummary] = await executeQuery(
        `SELECT COALESCE(SUM(ABS(total_value)), 0) as output_value
         FROM inventory_movements
         WHERE source_document_type = 'sales_invoice'
           AND source_document_id = ?
           AND movement_type = 'outbound'`,
        [invoiceId]
      );

      const outputValue = parseFloat(movementSummary?.output_value) || 0;
      if (outputValue <= 0) {
        return null;
      }

      const entryResult = await executeQuery(
        `INSERT INTO journal_entries (entry_date, description, source_document_type, source_document_id, created_by)
         VALUES (?, ?, 'sales_invoice_inventory', ?, ?)`,
        [
          invoice.invoice_date,
          `Salida de existencias factura ${invoice.invoice_number} - ${invoice.customer_name}`,
          invoiceId,
          invoice.created_by
        ]
      );

      const journalEntryId = entryResult.insertId;

      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = '610'), ?, 0, ?)`,
        [journalEntryId, outputValue, `Coste de salida factura ${invoice.invoice_number}`]
      );

      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = '300'), 0, ?, ?)`,
        [journalEntryId, outputValue, `Salida de existencias factura ${invoice.invoice_number}`]
      );

      return journalEntryId;
    } catch (error) {
      console.error('Error generating sales inventory output entry:', error);
      throw error;
    }
  }

  /**
   * Generates depreciation journal entry for a fixed asset.
   * Debit: expense account (default 681)
   * Credit: accumulated depreciation account (derived from asset account, default 281)
   *
   * @param {number} fixedAssetId - Fixed asset ID
   * @param {string} depreciationDate - Depreciation date (YYYY-MM-DD)
   * @param {number} amount - Depreciation amount
   * @param {number} userId - User posting the entry
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created journal entry ID
   */
  async generateFixedAssetDepreciationEntry(fixedAssetId, depreciationDate, amount, userId, connection = null) {
    const executeQuery = connection
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      const [asset] = await executeQuery(
        `SELECT id, asset_code, description, asset_account_code, depreciation_account_code
         FROM fixed_assets
         WHERE id = ?`,
        [fixedAssetId]
      );

      if (!asset) {
        throw new Error(`Fixed asset ${fixedAssetId} not found`);
      }

      const expenseAccountCode = asset.depreciation_account_code || '681';
      const derivedAccumulatedAccountCode = asset.asset_account_code?.startsWith('2')
        ? `28${asset.asset_account_code.substring(2)}`
        : '281';

      const entryResult = await executeQuery(
        `INSERT INTO journal_entries (entry_date, description, source_document_type, source_document_id, created_by)
         VALUES (?, ?, 'fixed_asset_depreciation', ?, ?)`,
        [
          depreciationDate,
          `Amortizacion ${asset.asset_code} - ${asset.description}`,
          fixedAssetId,
          userId
        ]
      );

      const journalEntryId = entryResult.insertId;

      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = ?), ?, 0, ?)`,
        [
          journalEntryId,
          expenseAccountCode,
          amount,
          `Amortizacion ${asset.asset_code}`
        ]
      );

      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = ?), 0, ?, ?)`,
        [
          journalEntryId,
          derivedAccumulatedAccountCode,
          amount,
          `Amortizacion acumulada ${asset.asset_code}`
        ]
      );

      return journalEntryId;
    } catch (error) {
      console.error('Error generating fixed asset depreciation entry:', error);
      throw error;
    }
  }

  /**
   * Generates automatic journal entry for a collection (customer payment)
   * Debit: Account 572 Bancos
   * Credit: Account 430 Clientes
   * 
   * @param {number} collectionId - Collection ID
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created journal entry ID
   */
  async generateCollectionEntry(collectionId, connection = null) {
    const executeQuery = connection 
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      // Get collection details
      const [collection] = await executeQuery(
        `SELECT col.*, si.invoice_number, c.name as customer_name
         FROM collections col
         JOIN sales_invoices si ON col.sales_invoice_id = si.id
         JOIN customers c ON si.customer_id = c.id
         WHERE col.id = ?`,
        [collectionId]
      );

      if (!collection) {
        throw new Error(`Collection ${collectionId} not found`);
      }

      // Create journal entry header
      const entryResult = await executeQuery(
        `INSERT INTO journal_entries (entry_date, description, source_document_type, source_document_id, created_by)
         VALUES (?, ?, 'collection', ?, ?)`,
        [
          collection.collection_date,
          `Cobro ${collection.collection_number} - Factura ${collection.invoice_number}`,
          collectionId,
          collection.created_by
        ]
      );

      const journalEntryId = entryResult.insertId;

      // Debit line: Account 572 Bancos
      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = '572'), ?, 0, ?)`,
        [
          journalEntryId,
          collection.amount,
          `Cobro de ${collection.customer_name}`
        ]
      );

      // Credit line: Account 430 Clientes
      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = '430'), 0, ?, ?)`,
        [
          journalEntryId,
          collection.amount,
          `Cliente ${collection.customer_name}`
        ]
      );

      return journalEntryId;
    } catch (error) {
      console.error('Error generating collection entry:', error);
      throw error;
    }
  }

  /**
   * Generates automatic journal entry for a payment (supplier payment)
   * Debit: Account 400 Proveedores
   * Credit: Account 572 Bancos
   * 
   * @param {number} paymentId - Payment ID
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created journal entry ID
   */
  async generatePaymentEntry(paymentId, connection = null) {
    const executeQuery = connection 
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      // Get payment details
      const [payment] = await executeQuery(
        `SELECT p.*, pi.invoice_number, s.name as supplier_name
         FROM payments p
         JOIN purchase_invoices pi ON p.purchase_invoice_id = pi.id
         JOIN suppliers s ON pi.supplier_id = s.id
         WHERE p.id = ?`,
        [paymentId]
      );

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      // Create journal entry header
      const entryResult = await executeQuery(
        `INSERT INTO journal_entries (entry_date, description, source_document_type, source_document_id, created_by)
         VALUES (?, ?, 'payment', ?, ?)`,
        [
          payment.payment_date,
          `Pago ${payment.payment_number} - Factura ${payment.invoice_number}`,
          paymentId,
          payment.created_by
        ]
      );

      const journalEntryId = entryResult.insertId;

      // Debit line: Account 400 Proveedores
      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = '400'), ?, 0, ?)`,
        [
          journalEntryId,
          payment.amount,
          `Proveedor ${payment.supplier_name}`
        ]
      );

      // Credit line: Account 572 Bancos
      await executeQuery(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES (?, (SELECT id FROM accounts WHERE code = '572'), 0, ?, ?)`,
        [
          journalEntryId,
          payment.amount,
          `Pago a ${payment.supplier_name}`
        ]
      );

      return journalEntryId;
    } catch (error) {
      console.error('Error generating payment entry:', error);
      throw error;
    }
  }

  /**
   * Validates that a journal entry is balanced (debit = credit)
   * 
   * @param {number} entryId - Journal entry ID
   * @returns {Promise<object>} Validation result with isBalanced flag and amounts
   */
  async validateEntryBalance(entryId) {
    try {
      const [result] = await query(
        `SELECT 
          SUM(debit) as total_debit,
          SUM(credit) as total_credit
         FROM journal_entry_lines
         WHERE journal_entry_id = ?`,
        [entryId]
      );

      if (!result) {
        throw new Error(`Journal entry ${entryId} not found or has no lines`);
      }

      const totalDebit = parseFloat(result.total_debit) || 0;
      const totalCredit = parseFloat(result.total_credit) || 0;
      const difference = Math.abs(totalDebit - totalCredit);
      
      // Consider balanced if difference is less than 0.01 (to handle floating point precision)
      const isBalanced = difference < 0.01;

      return {
        isBalanced,
        totalDebit,
        totalCredit,
        difference
      };
    } catch (error) {
      console.error('Error validating entry balance:', error);
      throw error;
    }
  }

  /**
   * Calculates balance sheet (Balance de Situación)
   * Groups: 1 (Financing), 2 (Fixed Assets), 3 (Inventory), 4 (Creditors/Debtors), 5 (Financial)
   * 
   * @param {string} startDate - Start date for the period (YYYY-MM-DD)
   * @param {string} endDate - End date for the period (YYYY-MM-DD)
   * @returns {Promise<object>} Balance sheet with assets, liabilities, and equity
   */
  async calculateBalanceSheet(startDate, endDate) {
    try {
      // Get all account balances for the period
      const balances = await query(
        `SELECT 
          a.id,
          a.code,
          a.name,
          a.account_type,
          COALESCE(SUM(jel.debit), 0) as total_debit,
          COALESCE(SUM(jel.credit), 0) as total_credit,
          COALESCE(SUM(jel.debit) - SUM(jel.credit), 0) as balance
         FROM accounts a
         LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
         LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE a.is_active = TRUE
           AND (je.id IS NULL OR (je.status = 'posted' AND je.entry_date BETWEEN ? AND ?))
           AND LEFT(a.code, 1) IN ('1', '2', '3', '4', '5')
         GROUP BY a.id, a.code, a.name, a.account_type
         HAVING ABS(balance) > 0.01
         ORDER BY a.code`,
        [startDate, endDate]
      );

      // Separate into assets, liabilities, and equity
      const assets = [];
      const liabilities = [];
      const equity = [];

      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;

      balances.forEach(account => {
        const balance = parseFloat(account.balance) || 0; // debit - credit

        if (account.account_type === 'asset') {
          assets.push({
            code: account.code,
            name: account.name,
            balance
          });
          totalAssets += balance;
        } else if (account.account_type === 'liability') {
          const liabilityBalance = -balance; // credit - debit
          liabilities.push({
            code: account.code,
            name: account.name,
            balance: liabilityBalance
          });
          totalLiabilities += liabilityBalance;
        } else if (account.account_type === 'equity') {
          const equityBalance = -balance; // credit - debit
          equity.push({
            code: account.code,
            name: account.name,
            balance: equityBalance
          });
          totalEquity += equityBalance;
        }
      });

      // Include current period result in a provisional 129 line for reporting purposes
      // when 6/7 are not yet closed into account 129. This is NOT a posted journal entry.
      const pnl = await this.calculatePnL(startDate, endDate);
      const periodResult = parseFloat(pnl.result) || 0;
      const provisionalResult129 = Math.abs(periodResult) > 0.01
        ? Number(periodResult.toFixed(2))
        : 0;

      const equityWithProvisional = [...equity];
      if (Math.abs(provisionalResult129) > 0.01) {
        equityWithProvisional.push({
          code: '129',
          name: 'Resultado del ejercicio (provisional, no contabilizado)',
          balance: provisionalResult129,
          isProvisional: true
        });
      }

      const totalEquityWithProvisional = totalEquity + provisionalResult129;
      const liabilitiesPlusEquity = totalLiabilities + totalEquityWithProvisional;
      const isBalanced = Math.abs(totalAssets - liabilitiesPlusEquity) < 0.01;

      return {
        startDate,
        endDate,
        assets,
        liabilities,
        equity: equityWithProvisional,
        totalAssets,
        totalLiabilities,
        totalEquity: totalEquityWithProvisional,
        totalEquityLedger: totalEquity,
        provisionalResult129,
        periodResult,
        liabilitiesPlusEquity,
        isBalanced,
        difference: totalAssets - liabilitiesPlusEquity
      };
    } catch (error) {
      console.error('Error calculating balance sheet:', error);
      throw error;
    }
  }

  /**
   * Calculates Profit & Loss report (Pérdidas y Ganancias)
   * Group 6: Expenses, Group 7: Income
   * 
   * @param {string} startDate - Start date for the period (YYYY-MM-DD)
   * @param {string} endDate - End date for the period (YYYY-MM-DD)
   * @returns {Promise<object>} P&L report with income, expenses, and result
   */
  async calculatePnL(startDate, endDate) {
    try {
      // Get income and expense account balances for the period
      const balances = await query(
        `SELECT 
          a.id,
          a.code,
          a.name,
          a.account_type,
          COALESCE(SUM(jel.debit), 0) as total_debit,
          COALESCE(SUM(jel.credit), 0) as total_credit,
          COALESCE(SUM(jel.credit) - SUM(jel.debit), 0) as balance
         FROM accounts a
         LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
         LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE a.is_active = TRUE
           AND (je.id IS NULL OR (je.status = 'posted' AND je.entry_date BETWEEN ? AND ?))
           AND LEFT(a.code, 1) IN ('6', '7')
         GROUP BY a.id, a.code, a.name, a.account_type
         HAVING ABS(balance) > 0.01
         ORDER BY a.code`,
        [startDate, endDate]
      );

      // Separate into income and expenses
      const income = [];
      const expenses = [];

      let totalIncome = 0;
      let totalExpenses = 0;

      balances.forEach(account => {
        const balance = parseFloat(account.balance);
        const accountGroup = account.code.charAt(0);

        if (accountGroup === '7') {
          // Income accounts (group 7) - credit balance is positive
          income.push({
            code: account.code,
            name: account.name,
            amount: Math.abs(balance)
          });
          totalIncome += Math.abs(balance);
        } else if (accountGroup === '6') {
          // Expense accounts (group 6) - debit balance is positive
          expenses.push({
            code: account.code,
            name: account.name,
            amount: Math.abs(balance)
          });
          totalExpenses += Math.abs(balance);
        }
      });

      // Calculate result (income - expenses)
      const result = totalIncome - totalExpenses;

      return {
        startDate,
        endDate,
        income,
        expenses,
        totalIncome,
        totalExpenses,
        result,
        resultType: result >= 0 ? 'profit' : 'loss'
      };
    } catch (error) {
      console.error('Error calculating P&L:', error);
      throw error;
    }
  }

  /**
   * Generates year-end closing entries
   * 1. Regularize inventory (610 Variación de existencias -> 300 Existencias)
   * 2. Close expense accounts (6XX -> 129 Resultado del ejercicio)
   * 3. Close income accounts (7XX -> 129 Resultado del ejercicio)
   * 
   * @param {string} endDate - End date of the fiscal year
   * @param {number} userId - User performing the closing
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<object>} Closing entries created
   */
  async generateYearEndClosingEntries(endDate, userId, connection = null) {
    const executeQuery = connection 
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      const closingEntries = [];

      // 1. Regularize inventory - get balance of 610 Variación de existencias
      const [variacionResult] = await executeQuery(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as balance
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.code = '610'
           AND je.status = 'posted'
           AND je.entry_date <= ?`,
        [endDate]
      );
      const variacionBalance = parseFloat(variacionResult.balance) || 0;

      if (Math.abs(variacionBalance) > 0.01) {
        // Create regularizing entry for inventory
        const entryResult = await executeQuery(
          `INSERT INTO journal_entries (entry_date, description, source_document_type, created_by)
           VALUES (?, 'Regularización de existencias', 'closing', ?)`,
          [endDate, userId]
        );
        const entryId = entryResult.insertId;

        // If positive, it's an increase in inventory (610 Debit -> 300 Credit)
        // If negative, it's a decrease (300 Debit -> 610 Credit)
        if (variacionBalance > 0) {
          await executeQuery(
            `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
             VALUES (?, (SELECT id FROM accounts WHERE code = '610'), ?, 0, 'Regularización existencias')`,
            [entryId, variacionBalance]
          );
          await executeQuery(
            `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
             VALUES (?, (SELECT id FROM accounts WHERE code = '300'), 0, ?, 'Regularización existencias')`,
            [entryId, variacionBalance]
          );
        } else {
          await executeQuery(
            `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
             VALUES (?, (SELECT id FROM accounts WHERE code = '300'), ?, 0, 'Regularización existencias')`,
            [entryId, Math.abs(variacionBalance)]
          );
          await executeQuery(
            `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
             VALUES (?, (SELECT id FROM accounts WHERE code = '610'), 0, ?, 'Regularización existencias')`,
            [entryId, Math.abs(variacionBalance)]
          );
        }

        closingEntries.push({ type: 'inventory_regularization', entryId, amount: variacionBalance });
      }

      // 2. Close expense accounts (Group 6) to account 129
      const expenseAccounts = await executeQuery(
        `SELECT 
           a.id as account_id,
           a.code as account_code,
           a.name as account_name,
           COALESCE(SUM(jel.debit - jel.credit), 0) as balance
         FROM journal_entry_lines jel
         JOIN accounts a ON a.id = jel.account_id
         JOIN journal_entries je ON je.id = jel.journal_entry_id
         WHERE a.code LIKE '6%' 
           AND a.is_active = TRUE
           AND je.status = 'posted'
           AND je.entry_date <= ?
         GROUP BY a.id, a.code, a.name
         HAVING balance > 0.01
         ORDER BY a.code`,
        [endDate]
      );
      const totalExpenses = expenseAccounts.reduce(
        (sum, account) => sum + (parseFloat(account.balance) || 0),
        0
      );

      if (totalExpenses > 0.01) {
        const entryResult = await executeQuery(
          `INSERT INTO journal_entries (entry_date, description, source_document_type, created_by)
           VALUES (?, 'Cierre de cuentas de gastos', 'closing', ?)`,
          [endDate, userId]
        );
        const entryId = entryResult.insertId;

        // Debit to Result (129), Credit to expenses
        await executeQuery(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
           VALUES (?, (SELECT id FROM accounts WHERE code = '129'), ?, 0, 'Cierre cuenta de resultados - Gastos')`,
          [entryId, totalExpenses]
        );
        for (const account of expenseAccounts) {
          await executeQuery(
            `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
             VALUES (?, ?, 0, ?, ?)`,
            [
              entryId,
              account.account_id,
              parseFloat(account.balance),
              `Cierre cuenta de gasto ${account.account_code} - ${account.account_name}`
            ]
          );
        }

        closingEntries.push({ type: 'expense_closing', entryId, amount: totalExpenses });
      }

      // 3. Close income accounts (Group 7) to account 129
      const incomeAccounts = await executeQuery(
        `SELECT 
           a.id as account_id,
           a.code as account_code,
           a.name as account_name,
           COALESCE(SUM(jel.credit - jel.debit), 0) as balance
         FROM journal_entry_lines jel
         JOIN accounts a ON a.id = jel.account_id
         JOIN journal_entries je ON je.id = jel.journal_entry_id
         WHERE a.code LIKE '7%' 
           AND a.is_active = TRUE
           AND je.status = 'posted'
           AND je.entry_date <= ?
         GROUP BY a.id, a.code, a.name
         HAVING balance > 0.01
         ORDER BY a.code`,
        [endDate]
      );
      const totalIncome = incomeAccounts.reduce(
        (sum, account) => sum + (parseFloat(account.balance) || 0),
        0
      );

      if (totalIncome > 0.01) {
        const entryResult = await executeQuery(
          `INSERT INTO journal_entries (entry_date, description, source_document_type, created_by)
           VALUES (?, 'Cierre de cuentas de ingresos', 'closing', ?)`,
          [endDate, userId]
        );
        const entryId = entryResult.insertId;

        // Debit from income, Credit to Result (129)
        for (const account of incomeAccounts) {
          await executeQuery(
            `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
             VALUES (?, ?, ?, 0, ?)`,
            [
              entryId,
              account.account_id,
              parseFloat(account.balance),
              `Cierre cuenta de ingreso ${account.account_code} - ${account.account_name}`
            ]
          );
        }
        await executeQuery(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
           VALUES (?, (SELECT id FROM accounts WHERE code = '129'), 0, ?, 'Cierre cuenta de resultados - Ingresos')`,
          [entryId, totalIncome]
        );

        closingEntries.push({ type: 'income_closing', entryId, amount: totalIncome });
      }

      return {
        success: true,
        closingEntries,
        summary: {
          inventoryRegularization: variacionBalance,
          expensesClosed: totalExpenses,
          incomeClosed: totalIncome,
          finalResult: totalIncome - totalExpenses
        }
      };
    } catch (error) {
      console.error('Error generating year-end closing entries:', error);
      throw error;
    }
  }

  /**
   * Gets dashboard KPIs
   * 
   * @param {string} startDate - Start date for the period
   * @param {string} endDate - End date for the period
   * @returns {Promise<object>} Dashboard KPIs
   */
  async getDashboardKPIs(startDate, endDate) {
    try {
      // Total Sales (from group 7 income)
      const [salesResult] = await query(
        `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as total
         FROM journal_entry_lines jel
         JOIN accounts a ON jel.account_id = a.id
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE a.code LIKE '7%' AND je.entry_date BETWEEN ? AND ?`,
        [startDate, endDate]
      );

      // Total Purchases (from group 6 expense)
      const [purchasesResult] = await query(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as total
         FROM journal_entry_lines jel
         JOIN accounts a ON jel.account_id = a.id
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE a.code LIKE '6%' AND je.entry_date BETWEEN ? AND ?`,
        [startDate, endDate]
      );

      // Accounts Receivable (430 Clients balance)
      const [receivableResult] = await query(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as total
         FROM journal_entry_lines jel
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.code = '430'`
      );

      // Accounts Payable (400 Suppliers balance)
      const [payableResult] = await query(
        `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as total
         FROM journal_entry_lines jel
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.code = '400'`
      );

      // Pending Sales Invoices
      const [pendingSalesResult] = await query(
        `SELECT COALESCE(SUM(total_amount - collected_amount), 0) as total
         FROM sales_invoices
         WHERE status != 'collected'`
      );

      // Pending Purchase Invoices
      const [pendingPurchasesResult] = await query(
        `SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total
         FROM purchase_invoices
         WHERE status != 'paid'`
      );

      // Active Customers count
      const [customersCountResult] = await query(
        `SELECT COUNT(*) as count FROM customers`
      );

      // Active Suppliers count
      const [suppliersCountResult] = await query(
        `SELECT COUNT(*) as count FROM suppliers`
      );

      return {
        totalSales: parseFloat(salesResult.total) || 0,
        totalPurchases: parseFloat(purchasesResult.total) || 0,
        accountsReceivable: parseFloat(receivableResult.total) || 0,
        accountsPayable: parseFloat(payableResult.total) || 0,
        pendingSalesInvoices: parseFloat(pendingSalesResult.total) || 0,
        pendingPurchaseInvoices: parseFloat(pendingPurchasesResult.total) || 0,
        activeCustomers: customersCountResult.count || 0,
        activeSuppliers: suppliersCountResult.count || 0,
        period: { startDate, endDate }
      };
    } catch (error) {
      console.error('Error getting dashboard KPIs:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new AccountingService();
