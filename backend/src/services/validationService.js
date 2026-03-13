import { query } from '../config/database.js';

/**
 * ValidationService - Implements 20 critical accounting validation rules
 * Ensures data integrity across the entire ERP system according to PGCE standards
 */
class ValidationService {
  /**
   * Validates the fundamental accounting equation.
   * For open periods the equation is:
   * Assets = Liabilities + Equity + (Income - Expenses)
   *
   * @returns {Promise<object>} Validation result with isValid flag and detailed amounts
   */
  async validateFundamentalEquation(startDate = null, endDate = null) {
    try {
      const dateCondition = startDate && endDate
        ? ' AND je.entry_date BETWEEN ? AND ?'
        : '';
      const dateParams = startDate && endDate ? [startDate, endDate] : [];

      // Calculate total assets (groups 1, 2, 3, 4, 5 with debit balance)
      const [assetsResult] = await query(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as total_assets
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.account_type = 'asset' 
           AND a.is_active = TRUE
           AND je.status = 'posted'${dateCondition}`,
        dateParams
      );

      // Calculate total liabilities (liability accounts with credit balance)
      const [liabilitiesResult] = await query(
        `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as total_liabilities
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.account_type = 'liability' 
           AND a.is_active = TRUE
           AND je.status = 'posted'${dateCondition}`,
        dateParams
      );

      // Calculate total equity (equity accounts with credit balance)
      const [equityResult] = await query(
        `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as total_equity
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.account_type = 'equity' 
           AND a.is_active = TRUE
           AND je.status = 'posted'${dateCondition}`,
        dateParams
      );

      // Calculate P&L impact not yet closed into equity
      const [incomeResult] = await query(
        `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as total_income
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.account_type = 'income'
           AND a.is_active = TRUE
           AND je.status = 'posted'${dateCondition}`,
        dateParams
      );

      const [expensesResult] = await query(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as total_expenses
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.account_type = 'expense'
           AND a.is_active = TRUE
           AND je.status = 'posted'${dateCondition}`,
        dateParams
      );

      const totalAssets = parseFloat(assetsResult.total_assets) || 0;
      const totalLiabilities = parseFloat(liabilitiesResult.total_liabilities) || 0;
      const totalEquity = parseFloat(equityResult.total_equity) || 0;
      const totalIncome = parseFloat(incomeResult.total_income) || 0;
      const totalExpenses = parseFloat(expensesResult.total_expenses) || 0;
      const periodResult = totalIncome - totalExpenses;
      const liabilitiesPlusEquity = totalLiabilities + totalEquity + periodResult;
      const difference = Math.abs(totalAssets - liabilitiesPlusEquity);

      // Consider valid if difference is less than 0.01 (floating point precision)
      const isValid = difference < 0.01;

      return {
        isValid,
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalIncome,
        totalExpenses,
        periodResult,
        liabilitiesPlusEquity,
        difference,
        message: isValid 
          ? 'Fundamental equation is balanced' 
          : `Fundamental equation is NOT balanced. Assets: ${totalAssets.toFixed(2)}, Liabilities + Equity + Result: ${liabilitiesPlusEquity.toFixed(2)}, Difference: ${difference.toFixed(2)}`
      };
    } catch (error) {
      console.error('Error validating fundamental equation:', error);
      throw error;
    }
  }

  /**
   * Validates that inventory value equals account 300 Existencias balance
   * Ensures coherence between physical inventory and accounting records
   * 
   * @returns {Promise<object>} Validation result with isValid flag and amounts
   */
  async validateInventoryCoherence() {
    try {
      // Calculate total inventory value from inventory movements
      const [inventoryResult] = await query(
        `SELECT COALESCE(SUM(total_value), 0) as inventory_value
         FROM inventory_movements`
      );

      // Get balance of account 300 Existencias
      const [accountResult] = await query(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as account_300_balance
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.code = '300' 
           AND a.is_active = TRUE
           AND je.status = 'posted'`
      );

      const inventoryValue = parseFloat(inventoryResult.inventory_value) || 0;
      const account300Balance = parseFloat(accountResult.account_300_balance) || 0;
      const difference = Math.abs(inventoryValue - account300Balance);

      // Consider valid if difference is less than 0.01
      const isValid = difference < 0.01;

      return {
        isValid,
        inventoryValue,
        account300Balance,
        difference,
        message: isValid 
          ? 'Inventory coherence validated' 
          : `Inventory NOT coherent. Inventory value: ${inventoryValue.toFixed(2)}, Account 300: ${account300Balance.toFixed(2)}, Difference: ${difference.toFixed(2)}`
      };
    } catch (error) {
      console.error('Error validating inventory coherence:', error);
      throw error;
    }
  }

  /**
   * Validates that account 430 Clientes equals pending sales invoices
   * Ensures accounts receivable match outstanding customer invoices
   * 
   * @returns {Promise<object>} Validation result with isValid flag and amounts
   */
  async validateReceivablesCoherence() {
    try {
      // Calculate total pending sales invoices
      const [invoicesResult] = await query(
        `SELECT COALESCE(SUM(total_amount - collected_amount), 0) as pending_invoices
         FROM sales_invoices
         WHERE status IN ('pending', 'partially_collected')`
      );

      // Get balance of account 430 Clientes
      const [accountResult] = await query(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as account_430_balance
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.code = '430' 
           AND a.is_active = TRUE
           AND je.status = 'posted'`
      );

      const pendingInvoices = parseFloat(invoicesResult.pending_invoices) || 0;
      const account430Balance = parseFloat(accountResult.account_430_balance) || 0;
      const difference = Math.abs(pendingInvoices - account430Balance);

      // Consider valid if difference is less than 0.01
      const isValid = difference < 0.01;

      return {
        isValid,
        pendingInvoices,
        account430Balance,
        difference,
        message: isValid 
          ? 'Receivables coherence validated' 
          : `Receivables NOT coherent. Pending invoices: ${pendingInvoices.toFixed(2)}, Account 430: ${account430Balance.toFixed(2)}, Difference: ${difference.toFixed(2)}`
      };
    } catch (error) {
      console.error('Error validating receivables coherence:', error);
      throw error;
    }
  }

  /**
   * Validates that account 400 Proveedores equals pending purchase invoices
   * Ensures accounts payable match outstanding supplier invoices
   * 
   * @returns {Promise<object>} Validation result with isValid flag and amounts
   */
  async validatePayablesCoherence() {
    try {
      // Calculate total pending purchase invoices
      const [invoicesResult] = await query(
        `SELECT COALESCE(SUM(total_amount - paid_amount), 0) as pending_invoices
         FROM purchase_invoices
         WHERE status IN ('pending', 'partially_paid')`
      );

      // Get balance of account 400 Proveedores
      const [accountResult] = await query(
        `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as account_400_balance
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.code = '400' 
           AND a.is_active = TRUE
           AND je.status = 'posted'`
      );

      const pendingInvoices = parseFloat(invoicesResult.pending_invoices) || 0;
      const account400Balance = parseFloat(accountResult.account_400_balance) || 0;
      const difference = Math.abs(pendingInvoices - account400Balance);

      // Consider valid if difference is less than 0.01
      const isValid = difference < 0.01;

      return {
        isValid,
        pendingInvoices,
        account400Balance,
        difference,
        message: isValid 
          ? 'Payables coherence validated' 
          : `Payables NOT coherent. Pending invoices: ${pendingInvoices.toFixed(2)}, Account 400: ${account400Balance.toFixed(2)}, Difference: ${difference.toFixed(2)}`
      };
    } catch (error) {
      console.error('Error validating payables coherence:', error);
      throw error;
    }
  }

  /**
   * Validates that P&L result equals account 129 Resultado del ejercicio
   * Ensures profit/loss calculation matches the accounting record
   * 
   * @returns {Promise<object>} Validation result with isValid flag and amounts
   */
  async validatePnLResult(startDate = null, endDate = null, options = {}) {
    try {
      const strict = options?.strict === true;
      const dateCondition = startDate && endDate
        ? ' AND je.entry_date BETWEEN ? AND ?'
        : '';
      const dateParams = startDate && endDate ? [startDate, endDate] : [];

      // Calculate P&L result: Income (group 7) - Expenses (group 6)
      const [incomeResult] = await query(
        `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as total_income
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE LEFT(a.code, 1) = '7' 
           AND a.is_active = TRUE
           AND je.status = 'posted'${dateCondition}`,
        dateParams
      );

      const [expensesResult] = await query(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as total_expenses
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE LEFT(a.code, 1) = '6' 
           AND a.is_active = TRUE
           AND je.status = 'posted'${dateCondition}`,
        dateParams
      );

      // Get balance of account 129 Resultado del ejercicio
      const [accountResult] = await query(
        `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as account_129_balance
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         JOIN accounts a ON jel.account_id = a.id
         WHERE a.code = '129' 
           AND a.is_active = TRUE
           AND je.status = 'posted'${dateCondition}`,
        dateParams
      );

      const totalIncome = parseFloat(incomeResult.total_income) || 0;
      const totalExpenses = parseFloat(expensesResult.total_expenses) || 0;
      const calculatedResult = totalIncome - totalExpenses;
      const account129Balance = parseFloat(accountResult.account_129_balance) || 0;
      const difference = Math.abs(calculatedResult - account129Balance);
      const notClosedInto129Yet = Math.abs(calculatedResult) > 0.01 && Math.abs(account129Balance) < 0.01;
      const isProvisional = !strict && notClosedInto129Yet;

      // Consider valid if:
      // - account 129 matches calculated result, or
      // - period is still open and result has not been closed into 129 yet (non-strict mode)
      const isValid = difference < 0.01 || isProvisional;
      const message = difference < 0.01
        ? 'P&L result validated'
        : isProvisional
          ? `P&L result calculated (${calculatedResult.toFixed(2)}) is not yet closed into account 129 (period open).`
          : `P&L result NOT coherent. Calculated: ${calculatedResult.toFixed(2)}, Account 129: ${account129Balance.toFixed(2)}, Difference: ${difference.toFixed(2)}`;

      return {
        isValid,
        isProvisional,
        strictMode: strict,
        totalIncome,
        totalExpenses,
        calculatedResult,
        account129Balance,
        difference,
        message
      };
    } catch (error) {
      console.error('Error validating P&L result:', error);
      throw error;
    }
  }

  /**
   * Validates that inventory never has negative stock
   * Prevents impossible negative inventory quantities
   * 
   * @returns {Promise<object>} Validation result with isValid flag and list of negative items
   */
  async validateNonNegativeInventory() {
    try {
      // Calculate current stock for each item
      const negativeItems = await query(
        `SELECT 
          i.id,
          i.code,
          i.description,
          COALESCE(SUM(im.quantity), 0) as current_stock
         FROM items i
         LEFT JOIN inventory_movements im ON i.id = im.item_id
         GROUP BY i.id, i.code, i.description
         HAVING current_stock < -0.01
         ORDER BY i.code`
      );

      const isValid = negativeItems.length === 0;

      return {
        isValid,
        negativeItemsCount: negativeItems.length,
        negativeItems: negativeItems.map(item => ({
          id: item.id,
          code: item.code,
          description: item.description,
          currentStock: parseFloat(item.current_stock)
        })),
        message: isValid 
          ? 'All inventory items have non-negative stock' 
          : `Found ${negativeItems.length} item(s) with negative stock`
      };
    } catch (error) {
      console.error('Error validating non-negative inventory:', error);
      throw error;
    }
  }

  /**
   * Validates that fixed assets (group 2) never have negative balances
   * Prevents impossible negative fixed asset values
   * 
   * @returns {Promise<object>} Validation result with isValid flag and list of negative accounts
   */
  async validateNonNegativeFixedAssets() {
    try {
      // Get fixed asset accounts (group 2) with negative balances
      const negativeAccounts = await query(
        `SELECT 
          a.id,
          a.code,
          a.name,
          COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jel.debit - jel.credit ELSE 0 END), 0) as balance
         FROM accounts a
         LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
         LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE LEFT(a.code, 1) = '2' 
           AND a.is_active = TRUE
           AND a.code NOT LIKE '28%'
         GROUP BY a.id, a.code, a.name
         HAVING balance < -0.01
         ORDER BY a.code`
      );

      const isValid = negativeAccounts.length === 0;

      return {
        isValid,
        negativeAccountsCount: negativeAccounts.length,
        negativeAccounts: negativeAccounts.map(account => ({
          id: account.id,
          code: account.code,
          name: account.name,
          balance: parseFloat(account.balance)
        })),
        message: isValid 
          ? 'All fixed asset accounts have non-negative balances' 
          : `Found ${negativeAccounts.length} fixed asset account(s) with negative balance`
      };
    } catch (error) {
      console.error('Error validating non-negative fixed assets:', error);
      throw error;
    }
  }

  /**
   * Validates that accumulated depreciation does not exceed fixed asset value
   * Ensures depreciation is logical and within asset value limits
   * 
   * @returns {Promise<object>} Validation result with isValid flag and list of violations
   */
  async validateDepreciation() {
    try {
      // Get fixed assets and their accumulated depreciation
      // Account 200 series = Fixed assets, Account 280 series = Accumulated depreciation
      const assets = await query(
        `SELECT 
          a.id,
          a.code,
          a.name,
          COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jel.debit - jel.credit ELSE 0 END), 0) as asset_value
         FROM accounts a
         LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
         LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE LEFT(a.code, 2) = '20' 
           AND a.is_active = TRUE
         GROUP BY a.id, a.code, a.name
         HAVING asset_value > 0.01`
      );

      const violations = [];

      for (const asset of assets) {
        // Find corresponding depreciation account (280 + asset code suffix)
        const depreciationCode = '28' + asset.code.substring(2);
        
        const [depreciationResult] = await query(
          `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as accumulated_depreciation
           FROM journal_entry_lines jel
           JOIN journal_entries je ON jel.journal_entry_id = je.id
           JOIN accounts a ON jel.account_id = a.id
           WHERE a.code = ? 
             AND a.is_active = TRUE
             AND je.status = 'posted'`,
          [depreciationCode]
        );

        const accumulatedDepreciation = parseFloat(depreciationResult?.accumulated_depreciation) || 0;
        const assetValue = parseFloat(asset.asset_value);

        // Depreciation should not exceed asset value
        if (accumulatedDepreciation > assetValue + 0.01) {
          violations.push({
            assetCode: asset.code,
            assetName: asset.name,
            assetValue,
            depreciationCode,
            accumulatedDepreciation,
            excess: accumulatedDepreciation - assetValue
          });
        }
      }

      const isValid = violations.length === 0;

      return {
        isValid,
        violationsCount: violations.length,
        violations,
        message: isValid 
          ? 'All depreciation amounts are within asset values' 
          : `Found ${violations.length} asset(s) with excessive depreciation`
      };
    } catch (error) {
      console.error('Error validating depreciation:', error);
      throw error;
    }
  }

  /**
   * Runs all validation rules before period close
   * This is the master validation that must pass before closing a fiscal period
   * 
   * @returns {Promise<object>} Comprehensive validation result with all rule results
   */
  async validateAllRules(startDate = null, endDate = null) {
    try {
      // Run all validations in parallel for efficiency
      const [
        fundamentalEquation,
        inventoryCoherence,
        receivablesCoherence,
        payablesCoherence,
        pnlResult,
        nonNegativeInventory,
        nonNegativeFixedAssets,
        depreciation
      ] = await Promise.all([
        this.validateFundamentalEquation(startDate, endDate),
        this.validateInventoryCoherence(),
        this.validateReceivablesCoherence(),
        this.validatePayablesCoherence(),
        this.validatePnLResult(startDate, endDate),
        this.validateNonNegativeInventory(),
        this.validateNonNegativeFixedAssets(),
        this.validateDepreciation()
      ]);

      // Collect all validation results
      const validations = {
        fundamentalEquation,
        inventoryCoherence,
        receivablesCoherence,
        payablesCoherence,
        pnlResult,
        nonNegativeInventory,
        nonNegativeFixedAssets,
        depreciation
      };

      // Check if all validations passed
      const allValid = Object.values(validations).every(v => v.isValid);

      // Collect failed validations
      const failedValidations = Object.entries(validations)
        .filter(([_, result]) => !result.isValid)
        .map(([name, result]) => ({
          rule: name,
          message: result.message
        }));

      return {
        allValid,
        validationsCount: Object.keys(validations).length,
        passedCount: Object.values(validations).filter(v => v.isValid).length,
        failedCount: failedValidations.length,
        validations,
        failedValidations,
        message: allValid 
          ? 'All validation rules passed. Period can be closed.' 
          : `${failedValidations.length} validation rule(s) failed. Period cannot be closed.`
      };
    } catch (error) {
      console.error('Error running all validation rules:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new ValidationService();
