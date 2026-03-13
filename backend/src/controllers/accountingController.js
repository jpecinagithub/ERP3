import { query, beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';
import accountingService from '../services/accountingService.js';
import validationService from '../services/validationService.js';
import traceabilityService from '../services/traceabilityService.js';
import inventoryService from '../services/inventoryService.js';

const getUserId = (req) => {
  if (req.user && req.user.id) {
    return req.user.id;
  }
  return null;
};

const buildTempNumber = (prefix) => (
  `${prefix}-TMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
);

const buildDocumentNumber = (prefix, dateValue, id) => {
  const year = new Date(dateValue || new Date()).getFullYear();
  return `${prefix}-${year}-${String(id).padStart(5, '0')}`;
};

const buildTempAssetCode = () => (
  `FA-TMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
);

const buildAssetCode = (dateValue, id) => {
  const year = new Date(dateValue || new Date()).getFullYear();
  return `FA-${year}-${String(id).padStart(5, '0')}`;
};

const toDateString = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return parsed.toISOString().split('T')[0];
};

const addDays = (dateValue, days) => {
  const parsed = new Date(dateValue);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().split('T')[0];
};

const roundToCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const createFixedAssetPurchaseFlow = async ({
  connection,
  userId,
  entryId,
  entryDate,
  description,
  lines,
  integrationData
}) => {
  const supplierId = Number(integrationData?.supplierId);
  const itemDescription = String(integrationData?.itemDescription || '').trim();
  const quantity = Number(integrationData?.quantity || 1);
  const usefulLifeMonths = Number(integrationData?.usefulLifeMonths || 60);
  const residualValue = Number(integrationData?.residualValue || 0);
  const invoiceNumberInput = integrationData?.invoiceNumber ? String(integrationData.invoiceNumber).trim() : '';
  const paymentMethod = integrationData?.paymentMethod || 'bank_transfer';

  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error('supplierId is required for fixed asset purchase flow');
  }

  if (!itemDescription) {
    throw new Error('itemDescription is required for fixed asset purchase flow');
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('quantity must be greater than zero');
  }

  if (!Number.isFinite(usefulLifeMonths) || usefulLifeMonths <= 0) {
    throw new Error('usefulLifeMonths must be greater than zero');
  }

  if (!Number.isFinite(residualValue) || residualValue < 0) {
    throw new Error('residualValue must be zero or positive');
  }

  if (!['bank_transfer', 'check'].includes(paymentMethod)) {
    throw new Error('paymentMethod must be bank_transfer or check');
  }

  const [supplier] = await connection.execute(
    `SELECT id, name FROM suppliers WHERE id = ?`,
    [supplierId]
  ).then(([rows]) => rows);

  if (!supplier) {
    throw new Error(`Supplier ${supplierId} not found`);
  }

  const accountIds = [...new Set(lines.map((line) => Number(line.accountId)).filter((id) => Number.isInteger(id) && id > 0))];
  if (accountIds.length === 0) {
    throw new Error('At least one valid account line is required');
  }

  const accountPlaceholders = accountIds.map(() => '?').join(', ');
  const accountRows = await connection.execute(
    `SELECT id, code FROM accounts WHERE id IN (${accountPlaceholders})`,
    accountIds
  ).then(([rows]) => rows);

  const accountCodeById = new Map(accountRows.map((row) => [row.id, row.code]));

  const normalizedLines = lines.map((line) => ({
    accountCode: accountCodeById.get(Number(line.accountId)) || null,
    debit: parseFloat(line.debit) || 0
  }));

  let assetAccountCode = integrationData?.assetAccountCode ? String(integrationData.assetAccountCode).trim() : '';
  let acquisitionValue = 0;

  if (assetAccountCode) {
    acquisitionValue = normalizedLines
      .filter((line) => line.accountCode === assetAccountCode)
      .reduce((sum, line) => sum + line.debit, 0);
  } else {
    const assetLines = normalizedLines.filter((line) => line.accountCode && line.accountCode.startsWith('2') && line.debit > 0);
    if (assetLines.length > 0) {
      assetAccountCode = assetLines[0].accountCode;
      acquisitionValue = assetLines.reduce((sum, line) => sum + line.debit, 0);
    }
  }

  if (!assetAccountCode || acquisitionValue <= 0.01) {
    throw new Error('Unable to infer fixed asset amount. Provide assetAccountCode and ensure it has debit amount');
  }

  acquisitionValue = Number(acquisitionValue.toFixed(2));

  if (residualValue > acquisitionValue) {
    throw new Error('residualValue cannot be greater than acquisition value');
  }

  const invoiceDate = toDateString(integrationData?.invoiceDate || entryDate);
  const dueDate = toDateString(integrationData?.dueDate || addDays(invoiceDate, 60));
  const paymentDate = toDateString(integrationData?.paymentDate || dueDate);

  if (dueDate < invoiceDate) {
    throw new Error('dueDate cannot be before invoiceDate');
  }

  const temporaryInvoiceNumber = buildTempNumber('FAC');
  const invoiceResult = await connection.execute(
    `INSERT INTO purchase_invoices
       (invoice_number, supplier_id, invoice_type, invoice_date, due_date, total_amount, status, notes, created_by)
     VALUES (?, ?, 'inmovilizado', ?, ?, ?, 'pending', ?, ?)`,
    [
      temporaryInvoiceNumber,
      supplierId,
      invoiceDate,
      dueDate,
      acquisitionValue,
      integrationData?.invoiceNotes || `Factura de inmovilizado generada desde asiento #${entryId}`,
      userId
    ]
  ).then(([result]) => result);

  const purchaseInvoiceId = invoiceResult.insertId;
  const invoiceNumber = invoiceNumberInput || buildDocumentNumber('FAC', invoiceDate, purchaseInvoiceId);

  await connection.execute(
    `UPDATE purchase_invoices SET invoice_number = ? WHERE id = ?`,
    [invoiceNumber, purchaseInvoiceId]
  );

  const unitPrice = Number((acquisitionValue / quantity).toFixed(2));
  await connection.execute(
    `INSERT INTO purchase_invoice_lines
       (purchase_invoice_id, item_id, line_description, quantity, unit_price, line_total)
     VALUES (?, NULL, ?, ?, ?, ?)`,
    [purchaseInvoiceId, itemDescription, quantity, unitPrice, acquisitionValue]
  );

  const temporaryAssetCode = buildTempAssetCode();
  const fixedAssetResult = await connection.execute(
    `INSERT INTO fixed_assets
       (asset_code, description, purchase_invoice_id, acquisition_date, acquisition_value, residual_value,
        useful_life_months, asset_account_code, depreciation_account_code, accumulated_depreciation, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?)`,
    [
      temporaryAssetCode,
      integrationData?.fixedAssetDescription || itemDescription || description,
      purchaseInvoiceId,
      invoiceDate,
      acquisitionValue,
      residualValue,
      usefulLifeMonths,
      assetAccountCode,
      integrationData?.depreciationAccountCode || '681',
      userId
    ]
  ).then(([result]) => result);

  const fixedAssetId = fixedAssetResult.insertId;
  const assetCode = buildAssetCode(invoiceDate, fixedAssetId);

  await connection.execute(
    `UPDATE fixed_assets SET asset_code = ? WHERE id = ?`,
    [assetCode, fixedAssetId]
  );

  const temporaryPaymentNumber = buildTempNumber('PAG');
  const paymentResult = await connection.execute(
    `INSERT INTO payments
       (payment_number, payment_date, purchase_invoice_id, amount, status, payment_method, notes, created_by)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      temporaryPaymentNumber,
      paymentDate,
      purchaseInvoiceId,
      acquisitionValue,
      paymentMethod,
      integrationData?.paymentNotes || `Pago pendiente - Factura ${invoiceNumber}`,
      userId
    ]
  ).then(([result]) => result);

  const paymentId = paymentResult.insertId;
  const paymentNumber = buildDocumentNumber('PAG', paymentDate, paymentId);

  await connection.execute(
    `UPDATE payments SET payment_number = ? WHERE id = ?`,
    [paymentNumber, paymentId]
  );

  await connection.execute(
    `UPDATE journal_entries
     SET source_document_type = 'purchase_invoice', source_document_id = ?
     WHERE id = ?`,
    [purchaseInvoiceId, entryId]
  );

  await traceabilityService.createDocumentLink(
    'purchase_invoice',
    'journal_entry',
    purchaseInvoiceId,
    entryId,
    'generated',
    connection
  );

  await traceabilityService.createDocumentLink(
    'purchase_invoice',
    'fixed_asset',
    purchaseInvoiceId,
    fixedAssetId,
    'generated',
    connection
  );

  await traceabilityService.createDocumentLink(
    'purchase_invoice',
    'payment',
    purchaseInvoiceId,
    paymentId,
    'generated',
    connection
  );

  await traceabilityService.logAction(
    userId,
    'create',
    'purchase_invoice',
    purchaseInvoiceId,
    null,
    {
      invoiceNumber,
      invoiceType: 'inmovilizado',
      supplierId,
      totalAmount: acquisitionValue
    },
    connection
  );

  await traceabilityService.logAction(
    userId,
    'create',
    'fixed_asset',
    fixedAssetId,
    null,
    {
      assetCode,
      purchaseInvoiceId,
      acquisitionValue
    },
    connection
  );

  await traceabilityService.logAction(
    userId,
    'create',
    'payment',
    paymentId,
    null,
    {
      paymentNumber,
      purchaseInvoiceId,
      amount: acquisitionValue,
      status: 'pending'
    },
    connection
  );

  return {
    flowType: 'fixed_asset_purchase',
    sourceDocumentType: 'purchase_invoice',
    sourceDocumentId: purchaseInvoiceId,
    purchaseInvoiceId,
    invoiceNumber,
    fixedAssetId,
    assetCode,
    paymentId,
    paymentNumber
  };
};

const resolveVatRate = (rawVatRate, fallback = 0.21) => {
  const parsed = Number(rawVatRate);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed > 1 ? parsed / 100 : parsed;
};

const getAccountCodeMapByLineAccountId = async (connection, lines = []) => {
  const accountIds = [...new Set(lines
    .map((line) => Number(line.accountId))
    .filter((value) => Number.isInteger(value) && value > 0))];

  if (accountIds.length === 0) {
    return new Map();
  }

  const placeholders = accountIds.map(() => '?').join(', ');
  const rows = await connection.execute(
    `SELECT id, code FROM accounts WHERE id IN (${placeholders})`,
    accountIds
  ).then(([resultRows]) => resultRows);

  return new Map(rows.map((row) => [Number(row.id), String(row.code)]));
};

const getEntryAccountSideAmount = (lines, accountCodeById, targetAccountCode, side) => (
  roundToCurrency(lines
    .filter((line) => accountCodeById.get(Number(line.accountId)) === targetAccountCode)
    .reduce((sum, line) => sum + (parseFloat(line?.[side]) || 0), 0))
);

const createPurchaseMerchandiseFlow = async ({
  connection,
  userId,
  entryId,
  entryDate,
  lines,
  integrationData
}) => {
  const supplierId = Number(integrationData?.supplierId);
  const paymentMethod = integrationData?.paymentMethod || 'bank_transfer';
  const invoiceNumberInput = integrationData?.invoiceNumber
    ? String(integrationData.invoiceNumber).trim()
    : '';
  const invoiceLines = Array.isArray(integrationData?.lines) ? integrationData.lines : [];

  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error('supplierId is required for purchase merchandise flow');
  }

  if (!['bank_transfer', 'check'].includes(paymentMethod)) {
    throw new Error('paymentMethod must be bank_transfer or check');
  }

  if (invoiceLines.length === 0) {
    throw new Error('At least one purchase invoice line is required');
  }

  const [supplier] = await connection.execute(
    `SELECT id, name FROM suppliers WHERE id = ?`,
    [supplierId]
  ).then(([rows]) => rows);

  if (!supplier) {
    throw new Error(`Supplier ${supplierId} not found`);
  }

  const normalizedLines = invoiceLines.map((line, index) => {
    const itemId = Number(line?.itemId);
    const quantity = Number(line?.quantity);
    const unitPrice = Number(line?.unitPrice);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new Error(`Line ${index + 1}: itemId is required`);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Line ${index + 1}: quantity must be greater than zero`);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Line ${index + 1}: unitPrice cannot be negative`);
    }

    return {
      itemId,
      quantity,
      unitPrice,
      lineTotal: roundToCurrency(quantity * unitPrice),
      lineDescription: String(line?.lineDescription || '').trim() || null
    };
  });

  const baseAmount = roundToCurrency(
    normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0)
  );
  if (baseAmount <= 0) {
    throw new Error('Purchase invoice base amount must be greater than zero');
  }

  const accountCodeById = await getAccountCodeMapByLineAccountId(connection, lines);
  const supplierAmountFromEntry = getEntryAccountSideAmount(lines, accountCodeById, '400', 'credit');
  const fallbackVatAmount = roundToCurrency(baseAmount * resolveVatRate(integrationData?.vatRate, 0.21));

  let totalAmount = supplierAmountFromEntry > 0
    ? supplierAmountFromEntry
    : roundToCurrency(baseAmount + fallbackVatAmount);
  let vatAmount = roundToCurrency(totalAmount - baseAmount);

  if (vatAmount < 0) {
    vatAmount = fallbackVatAmount;
    totalAmount = roundToCurrency(baseAmount + vatAmount);
  }

  const invoiceDate = toDateString(integrationData?.invoiceDate || entryDate);
  const dueDate = toDateString(integrationData?.dueDate || addDays(invoiceDate, 60));
  const paymentDate = toDateString(integrationData?.paymentDate || dueDate);

  if (dueDate < invoiceDate) {
    throw new Error('dueDate cannot be before invoiceDate');
  }

  if (paymentDate < invoiceDate) {
    throw new Error('paymentDate cannot be before invoiceDate');
  }

  const temporaryInvoiceNumber = buildTempNumber('FAC');
  const invoiceResult = await connection.execute(
    `INSERT INTO purchase_invoices
       (invoice_number, supplier_id, invoice_type, invoice_date, due_date, total_amount, status, notes, created_by)
     VALUES (?, ?, 'mercaderia', ?, ?, ?, 'pending', ?, ?)`,
    [
      temporaryInvoiceNumber,
      supplierId,
      invoiceDate,
      dueDate,
      totalAmount,
      integrationData?.invoiceNotes || `Factura de compra de mercaderías generada desde asiento #${entryId}`,
      userId
    ]
  ).then(([result]) => result);

  const purchaseInvoiceId = invoiceResult.insertId;
  const invoiceNumber = invoiceNumberInput || buildDocumentNumber('FAC', invoiceDate, purchaseInvoiceId);

  await connection.execute(
    `UPDATE purchase_invoices SET invoice_number = ? WHERE id = ?`,
    [invoiceNumber, purchaseInvoiceId]
  );

  const inventoryMovementIds = [];

  for (const line of normalizedLines) {
    await connection.execute(
      `INSERT INTO purchase_invoice_lines
         (purchase_invoice_id, item_id, line_description, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [purchaseInvoiceId, line.itemId, line.lineDescription, line.quantity, line.unitPrice, line.lineTotal]
    );

    const movementId = await inventoryService.createInboundMovement(
      line.itemId,
      line.quantity,
      line.unitPrice,
      'purchase_invoice',
      purchaseInvoiceId,
      userId,
      `Entrada por factura ${invoiceNumber}`,
      connection
    );

    inventoryMovementIds.push(movementId);

    await traceabilityService.createDocumentLink(
      'purchase_invoice',
      'inventory_movement',
      purchaseInvoiceId,
      movementId,
      'generated',
      connection
    );
  }

  const temporaryPaymentNumber = buildTempNumber('PAG');
  const paymentResult = await connection.execute(
    `INSERT INTO payments
       (payment_number, payment_date, purchase_invoice_id, amount, status, payment_method, notes, created_by)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      temporaryPaymentNumber,
      paymentDate,
      purchaseInvoiceId,
      totalAmount,
      paymentMethod,
      integrationData?.paymentNotes || `Pago pendiente - Factura ${invoiceNumber}`,
      userId
    ]
  ).then(([result]) => result);

  const paymentId = paymentResult.insertId;
  const paymentNumber = buildDocumentNumber('PAG', paymentDate, paymentId);

  await connection.execute(
    `UPDATE payments SET payment_number = ? WHERE id = ?`,
    [paymentNumber, paymentId]
  );

  await connection.execute(
    `UPDATE journal_entries
     SET source_document_type = 'purchase_invoice', source_document_id = ?
     WHERE id = ?`,
    [purchaseInvoiceId, entryId]
  );

  await traceabilityService.createDocumentLink(
    'purchase_invoice',
    'journal_entry',
    purchaseInvoiceId,
    entryId,
    'generated',
    connection
  );

  await traceabilityService.createDocumentLink(
    'purchase_invoice',
    'payment',
    purchaseInvoiceId,
    paymentId,
    'generated',
    connection
  );

  await traceabilityService.logAction(
    userId,
    'create',
    'purchase_invoice',
    purchaseInvoiceId,
    null,
    {
      invoiceNumber,
      invoiceType: 'mercaderia',
      supplierId,
      baseAmount,
      vatAmount,
      totalAmount
    },
    connection
  );

  await traceabilityService.logAction(
    userId,
    'create',
    'payment',
    paymentId,
    null,
    {
      paymentNumber,
      purchaseInvoiceId,
      amount: totalAmount,
      status: 'pending'
    },
    connection
  );

  return {
    flowType: 'purchase_merchandise',
    sourceDocumentType: 'purchase_invoice',
    sourceDocumentId: purchaseInvoiceId,
    purchaseInvoiceId,
    invoiceNumber,
    paymentId,
    paymentNumber,
    inventoryMovementIds
  };
};

const createSalesMerchandiseFlow = async ({
  connection,
  userId,
  entryId,
  entryDate,
  lines,
  integrationData
}) => {
  const customerId = Number(integrationData?.customerId);
  const collectionMethod = integrationData?.collectionMethod || 'bank_transfer';
  const invoiceNumberInput = integrationData?.invoiceNumber
    ? String(integrationData.invoiceNumber).trim()
    : '';
  const invoiceLines = Array.isArray(integrationData?.lines) ? integrationData.lines : [];

  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new Error('customerId is required for sales merchandise flow');
  }

  if (!['bank_transfer', 'check', 'card'].includes(collectionMethod)) {
    throw new Error('collectionMethod must be bank_transfer, check or card');
  }

  if (invoiceLines.length === 0) {
    throw new Error('At least one sales invoice line is required');
  }

  const [customer] = await connection.execute(
    `SELECT id, name FROM customers WHERE id = ?`,
    [customerId]
  ).then(([rows]) => rows);

  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }

  const normalizedLines = invoiceLines.map((line, index) => {
    const itemId = Number(line?.itemId);
    const quantity = Number(line?.quantity);
    const unitPrice = Number(line?.unitPrice);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new Error(`Line ${index + 1}: itemId is required`);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Line ${index + 1}: quantity must be greater than zero`);
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Line ${index + 1}: unitPrice cannot be negative`);
    }

    return {
      itemId,
      quantity,
      unitPrice,
      lineTotal: roundToCurrency(quantity * unitPrice)
    };
  });

  const baseAmount = roundToCurrency(
    normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0)
  );
  if (baseAmount <= 0) {
    throw new Error('Sales invoice base amount must be greater than zero');
  }

  const accountCodeById = await getAccountCodeMapByLineAccountId(connection, lines);
  const customerAmountFromEntry = getEntryAccountSideAmount(lines, accountCodeById, '430', 'debit');
  const fallbackVatAmount = roundToCurrency(baseAmount * resolveVatRate(integrationData?.vatRate, 0.21));

  let totalAmount = customerAmountFromEntry > 0
    ? customerAmountFromEntry
    : roundToCurrency(baseAmount + fallbackVatAmount);
  let vatAmount = roundToCurrency(totalAmount - baseAmount);

  if (vatAmount < 0) {
    vatAmount = fallbackVatAmount;
    totalAmount = roundToCurrency(baseAmount + vatAmount);
  }

  const invoiceDate = toDateString(integrationData?.invoiceDate || entryDate);
  const dueDate = toDateString(integrationData?.dueDate || addDays(invoiceDate, 90));
  const collectionDate = toDateString(integrationData?.collectionDate || dueDate);

  if (dueDate < invoiceDate) {
    throw new Error('dueDate cannot be before invoiceDate');
  }

  if (collectionDate < invoiceDate) {
    throw new Error('collectionDate cannot be before invoiceDate');
  }

  const temporaryInvoiceNumber = buildTempNumber('FAV');
  const invoiceResult = await connection.execute(
    `INSERT INTO sales_invoices
       (invoice_number, customer_id, sales_order_id, invoice_date, due_date, total_amount, status, notes, created_by)
     VALUES (?, ?, NULL, ?, ?, ?, 'pending', ?, ?)`,
    [
      temporaryInvoiceNumber,
      customerId,
      invoiceDate,
      dueDate,
      totalAmount,
      integrationData?.invoiceNotes || `Factura de venta de mercaderías generada desde asiento #${entryId}`,
      userId
    ]
  ).then(([result]) => result);

  const salesInvoiceId = invoiceResult.insertId;
  const invoiceNumber = invoiceNumberInput || buildDocumentNumber('FAV', invoiceDate, salesInvoiceId);

  await connection.execute(
    `UPDATE sales_invoices SET invoice_number = ? WHERE id = ?`,
    [invoiceNumber, salesInvoiceId]
  );

  const inventoryMovementIds = [];

  for (const line of normalizedLines) {
    await connection.execute(
      `INSERT INTO sales_invoice_lines
         (sales_invoice_id, item_id, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?)`,
      [salesInvoiceId, line.itemId, line.quantity, line.unitPrice, line.lineTotal]
    );

    const movementId = await inventoryService.createOutboundMovement(
      line.itemId,
      line.quantity,
      'sales_invoice',
      salesInvoiceId,
      userId,
      `Salida por factura ${invoiceNumber}`,
      connection
    );

    inventoryMovementIds.push(movementId);

    await traceabilityService.createDocumentLink(
      'sales_invoice',
      'inventory_movement',
      salesInvoiceId,
      movementId,
      'generated',
      connection
    );
  }

  const temporaryCollectionNumber = buildTempNumber('COB');
  const collectionResult = await connection.execute(
    `INSERT INTO collections
       (collection_number, collection_date, sales_invoice_id, amount, status, payment_method, notes, created_by)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      temporaryCollectionNumber,
      collectionDate,
      salesInvoiceId,
      totalAmount,
      collectionMethod,
      integrationData?.collectionNotes || `Cobro pendiente - Factura ${invoiceNumber}`,
      userId
    ]
  ).then(([result]) => result);

  const collectionId = collectionResult.insertId;
  const collectionNumber = buildDocumentNumber('COB', collectionDate, collectionId);

  await connection.execute(
    `UPDATE collections SET collection_number = ? WHERE id = ?`,
    [collectionNumber, collectionId]
  );

  await connection.execute(
    `UPDATE journal_entries
     SET source_document_type = 'sales_invoice', source_document_id = ?
     WHERE id = ?`,
    [salesInvoiceId, entryId]
  );

  await traceabilityService.createDocumentLink(
    'sales_invoice',
    'journal_entry',
    salesInvoiceId,
    entryId,
    'generated',
    connection
  );

  await traceabilityService.createDocumentLink(
    'sales_invoice',
    'collection',
    salesInvoiceId,
    collectionId,
    'generated',
    connection
  );

  await traceabilityService.logAction(
    userId,
    'create',
    'sales_invoice',
    salesInvoiceId,
    null,
    {
      invoiceNumber,
      customerId,
      baseAmount,
      vatAmount,
      totalAmount
    },
    connection
  );

  await traceabilityService.logAction(
    userId,
    'create',
    'collection',
    collectionId,
    null,
    {
      collectionNumber,
      salesInvoiceId,
      amount: totalAmount,
      status: 'pending'
    },
    connection
  );

  return {
    flowType: 'sales_merchandise',
    sourceDocumentType: 'sales_invoice',
    sourceDocumentId: salesInvoiceId,
    salesInvoiceId,
    invoiceNumber,
    collectionId,
    collectionNumber,
    inventoryMovementIds
  };
};

/**
 * =========================
 * 8.1 Accounts Endpoints
 * =========================
 */

/**
 * GET /api/accounts
 * List all accounts
 */
export const getAccounts = async (req, res) => {
  try {
    const { search, accountType } = req.query;
    
    let sql = `
      SELECT id, code, name, account_type, parent_id, is_active, allow_movements
      FROM accounts
      WHERE is_active = TRUE
    `;
    const params = [];

    if (search) {
      sql += ` AND (code LIKE ? OR name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (accountType) {
      sql += ` AND account_type = ?`;
      params.push(accountType);
    }

    sql += ` ORDER BY code`;

    const accounts = await query(sql, params);

    res.json({
      success: true,
      data: accounts.map(a => ({
        id: a.id,
        code: a.code,
        name: a.name,
        accountType: a.account_type,
        parentId: a.parent_id,
        isActive: a.is_active,
        allowMovements: a.allow_movements
      }))
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching accounts',
        status: 500
      }
    });
  }
};

/**
 * GET /api/accounts/reference-data
 * Returns minimal suppliers/items data needed by accounting integration flows.
 */
export const getAccountingReferenceData = async (req, res) => {
  try {
    const [suppliers, customers, items] = await Promise.all([
      query(
        `SELECT id, code, name
         FROM suppliers
         ORDER BY name`
      ),
      query(
        `SELECT id, code, name
         FROM customers
         ORDER BY name`
      ),
      query(
        `SELECT id, code, description, standard_cost
         FROM items
         ORDER BY code`
      )
    ]);

    res.json({
      success: true,
      data: {
        suppliers: suppliers.map((supplier) => ({
          id: supplier.id,
          code: supplier.code,
          name: supplier.name
        })),
        customers: customers.map((customer) => ({
          id: customer.id,
          code: customer.code,
          name: customer.name
        })),
        items: items.map((item) => ({
          id: item.id,
          code: item.code,
          description: item.description,
          standardCost: parseFloat(item.standard_cost) || 0
        }))
      }
    });
  } catch (error) {
    console.error('Get accounting reference data error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching accounting reference data',
        status: 500
      }
    });
  }
};

/**
 * GET /api/accounts/:id
 * Get account details
 */
export const getAccountById = async (req, res) => {
  try {
    const { id } = req.params;

    const accounts = await query(
      `SELECT * FROM accounts WHERE id = ?`,
      [id]
    );

    if (!accounts || accounts.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Account not found',
          status: 404
        }
      });
    }

    const account = accounts[0];

    const balance = await query(
      `SELECT 
        COALESCE(SUM(debit), 0) as total_debit,
        COALESCE(SUM(credit), 0) as total_credit,
        COALESCE(SUM(debit) - SUM(credit), 0) as balance
       FROM journal_entry_lines
       WHERE account_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.account_type,
        parentId: account.parent_id,
        isActive: account.is_active,
        allowMovements: account.allow_movements,
        balance: parseFloat(balance[0].balance) || 0
      }
    });
  } catch (error) {
    console.error('Get account by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the account',
        status: 500
      }
    });
  }
};

/**
 * POST /api/accounts
 * Create account
 */
export const createAccount = async (req, res) => {
  let connection = null;

  try {
    const { code, name, accountType, parentId, allowMovements } = req.body;
    const userId = getUserId(req);

    if (!code || !name || !accountType) {
      return res.status(400).json({
        error: {
          message: 'Code, name and account type are required',
          status: 400
        }
      });
    }

    const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    if (!validTypes.includes(accountType)) {
      return res.status(400).json({
        error: {
          message: `Invalid account type. Allowed: ${validTypes.join(', ')}`,
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const existing = await connection.execute(
      'SELECT id FROM accounts WHERE code = ?',
      [code]
    ).then(([rows]) => rows);

    if (existing && existing.length > 0) {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Account code already exists',
          status: 409
        }
      });
    }

    const result = await connection.execute(
      `INSERT INTO accounts (code, name, account_type, parent_id, allow_movements, is_active)
       VALUES (?, ?, ?, ?, TRUE, TRUE)`,
      [code, name, accountType, parentId || null, allowMovements !== false]
    ).then(([r]) => r);

    const accountId = result.insertId;

    await traceabilityService.logAction(
      userId,
      'create',
      'account',
      accountId,
      null,
      { code, name, accountType },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        id: accountId,
        code,
        name,
        accountType
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create account error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the account',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/accounts/:id
 * Update account
 */
export const updateAccount = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const { name, allowMovements } = req.body;
    const userId = getUserId(req);

    if (!name) {
      return res.status(400).json({
        error: {
          message: 'Name is required',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const accounts = await connection.execute(
      'SELECT * FROM accounts WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!accounts || accounts.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Account not found',
          status: 404
        }
      });
    }

    const existing = accounts[0];

    await connection.execute(
      'UPDATE accounts SET name = ?, allow_movements = ? WHERE id = ?',
      [name, allowMovements !== false, id]
    );

    await traceabilityService.logAction(
      userId,
      'update',
      'account',
      Number(id),
      { name: existing.name, allowMovements: existing.allow_movements },
      { name, allowMovements },
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: 'Account updated successfully',
      data: {
        id: Number(id),
        name,
        allowMovements
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Update account error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the account',
        status: 500
      }
    });
  }
};

/**
 * DELETE /api/accounts/:id
 * Delete account if not used in entries
 */
export const deleteAccount = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const userId = getUserId(req);

    connection = await beginTransaction();

    const accounts = await connection.execute(
      'SELECT * FROM accounts WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!accounts || accounts.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Account not found',
          status: 404
        }
      });
    }

    const existing = accounts[0];

    const usage = await connection.execute(
      'SELECT COUNT(*) as count FROM journal_entry_lines WHERE account_id = ?',
      [id]
    ).then(([rows]) => rows[0]);

    if (usage.count > 0) {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Cannot delete account that has journal entries',
          status: 409
        }
      });
    }

    await connection.execute('DELETE FROM accounts WHERE id = ?', [id]);

    await traceabilityService.logAction(
      userId,
      'delete',
      'account',
      Number(id),
      { code: existing.code, name: existing.name, accountType: existing.account_type },
      null,
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Delete account error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while deleting the account',
        status: 500
      }
    });
  }
};

/**
 * ==============================
 * 8.2 Journal Entry Endpoints
 * ==============================
 */

/**
 * GET /api/journal-entries
 * List entries with filtering
 */
export const getJournalEntries = async (req, res) => {
  try {
    const { startDate, endDate, sourceDocumentType, minAmount, maxAmount } = req.query;

    let sql = `
      SELECT je.id, je.entry_date, je.description, je.source_document_type, 
             je.source_document_id, je.status, je.created_by
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

    if (minAmount) {
      sql += ` AND (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) >= ?`;
      params.push(minAmount);
    }

    if (maxAmount) {
      sql += ` AND (SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id) <= ?`;
      params.push(maxAmount);
    }

    sql += ` ORDER BY je.entry_date DESC, je.id DESC`;

    const entries = await query(sql, params);

    const entriesWithTotals = await Promise.all(
      entries.map(async (entry) => {
        const totals = await query(
          `SELECT 
            SUM(debit) as total_debit, 
            SUM(credit) as total_credit
           FROM journal_entry_lines
           WHERE journal_entry_id = ?`,
          [entry.id]
        );
        return {
          id: entry.id,
          entryDate: entry.entry_date,
          description: entry.description,
          sourceDocumentType: entry.source_document_type,
          sourceDocumentId: entry.source_document_id,
          status: entry.status,
          totalDebit: parseFloat(totals[0].total_debit) || 0,
          totalCredit: parseFloat(totals[0].total_credit) || 0
        };
      })
    );

    res.json({
      success: true,
      data: entriesWithTotals
    });
  } catch (error) {
    console.error('Get journal entries error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching journal entries',
        status: 500
      }
    });
  }
};

/**
 * GET /api/journal-entries/:id
 * Get entry details with lines
 */
export const getJournalEntryById = async (req, res) => {
  try {
    const { id } = req.params;

    const entries = await query(
      `SELECT * FROM journal_entries WHERE id = ?`,
      [id]
    );

    if (!entries || entries.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Journal entry not found',
          status: 404
        }
      });
    }

    const entry = entries[0];

    const lines = await query(
      `SELECT jel.*, a.code as account_code, a.name as account_name
       FROM journal_entry_lines jel
       JOIN accounts a ON jel.account_id = a.id
       WHERE jel.journal_entry_id = ?
       ORDER BY jel.id`,
      [id]
    );

    const totals = await query(
      `SELECT 
        SUM(debit) as total_debit, 
        SUM(credit) as total_credit
       FROM journal_entry_lines
       WHERE journal_entry_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        id: entry.id,
        entryDate: entry.entry_date,
        description: entry.description,
        sourceDocumentType: entry.source_document_type,
        sourceDocumentId: entry.source_document_id,
        status: entry.status,
        totalDebit: parseFloat(totals[0].total_debit) || 0,
        totalCredit: parseFloat(totals[0].total_credit) || 0,
        lines: lines.map(line => ({
          id: line.id,
          accountId: line.account_id,
          accountCode: line.account_code,
          accountName: line.account_name,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
          description: line.description
        }))
      }
    });
  } catch (error) {
    console.error('Get journal entry by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the journal entry',
        status: 500
      }
    });
  }
};

/**
 * POST /api/journal-entries
 * Create entry, validate debit=credit, check period status, log to audit trail
 */
export const createJournalEntry = async (req, res) => {
  let connection = null;

  try {
    const {
      entryDate,
      description,
      lines,
      sourceDocumentType,
      sourceDocumentId,
      integrationData
    } = req.body;
    const userId = getUserId(req);

    if (!entryDate || !description || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Entry date, description and at least one line are required',
          status: 400
        }
      });
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (!line.accountId) {
        return res.status(400).json({
          error: {
            message: 'Each line requires accountId',
            status: 400
          }
        });
      }
      const debit = parseFloat(line.debit) || 0;
      const credit = parseFloat(line.credit) || 0;
      totalDebit += debit;
      totalCredit += credit;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        error: {
          message: `Entry is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const periodCheck = await connection.execute(
      `SELECT fp.id, fp.status, fp.year, fp.period_number
       FROM fiscal_periods fp
       WHERE ? BETWEEN fp.start_date AND fp.end_date
       LIMIT 1`,
      [entryDate]
    ).then(([rows]) => rows);

    if (!periodCheck || periodCheck.length === 0) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'No fiscal period found for the entry date',
          status: 400
        }
      });
    }

    if (periodCheck[0].status === 'closed') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Cannot create entries in a closed fiscal period',
          status: 409
        }
      });
    }

    const integratedSourceTypes = new Set([
      'compra_inmovilizado',
      'compra_mercaderias',
      'venta_mercaderias'
    ]);
    const isIntegratedFlow = integratedSourceTypes.has(sourceDocumentType);

    const persistedSourceType = isIntegratedFlow
      ? null
      : (sourceDocumentType || null);

    const persistedSourceId = isIntegratedFlow
      ? null
      : (sourceDocumentId || null);

    const headerResult = await connection.execute(
      `INSERT INTO journal_entries (entry_date, description, source_document_type, source_document_id, status, created_by)
       VALUES (?, ?, ?, ?, 'posted', ?)`,
      [entryDate, description, persistedSourceType, persistedSourceId, userId]
    ).then(([result]) => result);

    const entryId = headerResult.insertId;

    for (const line of lines) {
      const debit = parseFloat(line.debit) || 0;
      const credit = parseFloat(line.credit) || 0;

      if (debit > 0 || credit > 0) {
        await connection.execute(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
           VALUES (?, ?, ?, ?, ?)`,
          [entryId, line.accountId, debit, credit, line.description || null]
        );
      }
    }

    let generatedFlow = null;
    if (sourceDocumentType === 'compra_inmovilizado') {
      try {
        generatedFlow = await createFixedAssetPurchaseFlow({
          connection,
          userId,
          entryId,
          entryDate,
          description,
          lines,
          integrationData
        });
      } catch (flowError) {
        await rollbackTransaction(connection);
        const status = flowError.code === 'ER_DUP_ENTRY' ? 409 : 400;
        return res.status(status).json({
          error: {
            message: flowError.message || 'Invalid fixed asset purchase integration data',
            status
          }
        });
      }
    } else if (sourceDocumentType === 'compra_mercaderias') {
      try {
        generatedFlow = await createPurchaseMerchandiseFlow({
          connection,
          userId,
          entryId,
          entryDate,
          lines,
          integrationData
        });
      } catch (flowError) {
        await rollbackTransaction(connection);
        const status = flowError.code === 'ER_DUP_ENTRY' ? 409 : 400;
        return res.status(status).json({
          error: {
            message: flowError.message || 'Invalid purchase merchandise integration data',
            status
          }
        });
      }
    } else if (sourceDocumentType === 'venta_mercaderias') {
      try {
        generatedFlow = await createSalesMerchandiseFlow({
          connection,
          userId,
          entryId,
          entryDate,
          lines,
          integrationData
        });
      } catch (flowError) {
        await rollbackTransaction(connection);
        const status = flowError.code === 'ER_DUP_ENTRY' ? 409 : 400;
        return res.status(status).json({
          error: {
            message: flowError.message || 'Invalid sales merchandise integration data',
            status
          }
        });
      }
    }

    const resolvedSourceDocumentType = generatedFlow?.sourceDocumentType || (sourceDocumentType || null);
    const resolvedSourceDocumentId = generatedFlow?.sourceDocumentId || (sourceDocumentId || null);

    await traceabilityService.logAction(
      userId,
      'create',
      'journal_entry',
      entryId,
      null,
      {
        entryDate,
        description,
        totalDebit,
        totalCredit,
        sourceDocumentType: resolvedSourceDocumentType,
        sourceDocumentId: resolvedSourceDocumentId
      },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: generatedFlow?.flowType === 'fixed_asset_purchase'
        ? 'Journal entry created. Fixed asset, purchase invoice and pending payment generated successfully'
        : generatedFlow?.flowType === 'purchase_merchandise'
          ? 'Journal entry created. Purchase invoice, inventory movement and pending payment generated successfully'
          : generatedFlow?.flowType === 'sales_merchandise'
            ? 'Journal entry created. Sales invoice, inventory movement and pending collection generated successfully'
            : 'Journal entry created successfully',
      data: {
        id: entryId,
        entryDate,
        description,
        totalDebit,
        totalCredit,
        status: 'posted',
        generated: generatedFlow
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create journal entry error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the journal entry',
        status: 500
      }
    });
  }
};

/**
 * ==============================
 * 8.3 Financial Reports Endpoints
 * ==============================
 */

/**
 * GET /api/reports/balance
 * Generate balance sheet, validate fundamental equation
 */
export const getBalanceSheet = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'startDate and endDate query parameters are required',
          status: 400
        }
      });
    }

    const balanceSheet = await accountingService.calculateBalanceSheet(startDate, endDate);

    const validation = await validationService.validateFundamentalEquation(startDate, endDate);

    res.json({
      success: true,
      data: {
        ...balanceSheet,
        validation: {
          isValid: validation.isValid,
          message: validation.message
        }
      }
    });
  } catch (error) {
    console.error('Get balance sheet error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while generating the balance sheet',
        status: 500
      }
    });
  }
};

/**
 * GET /api/reports/pnl
 * Generate P&L report, validate result vs account 129
 */
export const getPnLReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'startDate and endDate query parameters are required',
          status: 400
        }
      });
    }

    const pnl = await accountingService.calculatePnL(startDate, endDate);

    const validation = await validationService.validatePnLResult(startDate, endDate);

    res.json({
      success: true,
      data: {
        ...pnl,
        validation: {
          isValid: validation.isValid,
          message: validation.message
        }
      }
    });
  } catch (error) {
    console.error('Get P&L report error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while generating the P&L report',
        status: 500
      }
    });
  }
};

/**
 * POST /api/reports/custom
 * Generate custom report with filters
 */
export const getCustomReport = async (req, res) => {
  try {
    const { startDate, endDate, accountCodes, groupBy } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'startDate and endDate are required',
          status: 400
        }
      });
    }

    let sql = `
      SELECT 
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
        AND je.entry_date BETWEEN ? AND ?
      WHERE a.is_active = TRUE
    `;
    const params = [startDate, endDate];

    if (accountCodes && Array.isArray(accountCodes) && accountCodes.length > 0) {
      sql += ` AND a.code IN (?)`;
      params.push(accountCodes);
    }

    sql += ` GROUP BY a.id, a.code, a.name, a.account_type`;

    if (groupBy === 'type') {
      sql = `
        SELECT 
          a.account_type as group_name,
          COALESCE(SUM(jel.debit), 0) as total_debit,
          COALESCE(SUM(jel.credit), 0) as total_credit,
          COALESCE(SUM(jel.debit) - SUM(jel.credit), 0) as balance
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
          AND je.entry_date BETWEEN ? AND ?
        WHERE a.is_active = TRUE
      `;
      const groupParams = [startDate, endDate];
      
      if (accountCodes && Array.isArray(accountCodes) && accountCodes.length > 0) {
        sql += ` AND a.code IN (?)`;
        groupParams.push(accountCodes);
      }
      
      sql += ` GROUP BY a.account_type`;

      const results = await query(sql, groupParams);
      
      return res.json({
        success: true,
        data: results.map(r => ({
          groupName: r.group_name,
          totalDebit: parseFloat(r.total_debit) || 0,
          totalCredit: parseFloat(r.total_credit) || 0,
          balance: parseFloat(r.balance) || 0
        }))
      });
    }

    sql += ` ORDER BY a.code`;

    const results = await query(sql, params);

    res.json({
      success: true,
      data: results.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        accountType: r.account_type,
        totalDebit: parseFloat(r.total_debit) || 0,
        totalCredit: parseFloat(r.total_credit) || 0,
        balance: parseFloat(r.balance) || 0
      }))
    });
  } catch (error) {
    console.error('Get custom report error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while generating the custom report',
        status: 500
      }
    });
  }
};

/**
 * GET /api/reconciliation
 * Generate reconciliation reports for inventory, receivables, payables
 */
export const getReconciliationReport = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    if (!type || !['inventory', 'receivables', 'payables'].includes(type)) {
      return res.status(400).json({
        error: {
          message: 'type query parameter is required. Allowed: inventory, receivables, payables',
          status: 400
        }
      });
    }

    const effectiveStartDate = startDate || '2025-01-01';
    const effectiveEndDate = endDate || new Date().toISOString().split('T')[0];

    let result;

    if (type === 'inventory') {
      result = await validationService.validateInventoryCoherence(effectiveStartDate, effectiveEndDate);
    } else if (type === 'receivables') {
      result = await validationService.validateReceivablesCoherence(effectiveStartDate, effectiveEndDate);
    } else if (type === 'payables') {
      result = await validationService.validatePayablesCoherence(effectiveStartDate, effectiveEndDate);
    }

    res.json({
      success: true,
      data: {
        type,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        ...result
      }
    });
  } catch (error) {
    console.error('Get reconciliation report error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while generating the reconciliation report',
        status: 500
      }
    });
  }
};

/**
 * ==============================
 * 10. Fiscal Period Endpoints
 * ==============================
 */

/**
 * GET /api/fiscal-periods
 * List fiscal periods
 */
export const getFiscalPeriods = async (req, res) => {
  try {
    const periods = await query(
      `SELECT id, year, period_number, start_date, end_date, status, closed_at, reopened_at, reopen_justification
       FROM fiscal_periods
       ORDER BY year DESC, period_number DESC`
    );

    res.json({
      success: true,
      data: periods.map(p => ({
        id: p.id,
        year: p.year,
        periodNumber: p.period_number,
        startDate: p.start_date,
        endDate: p.end_date,
        status: p.status,
        closedAt: p.closed_at,
        reopenedAt: p.reopened_at,
        reopenJustification: p.reopen_justification
      }))
    });
  } catch (error) {
    console.error('Get fiscal periods error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching fiscal periods',
        status: 500
      }
    });
  }
};

/**
 * POST /api/fiscal-periods
 * Create fiscal period
 */
export const createFiscalPeriod = async (req, res) => {
  let connection = null;

  try {
    const { year, periodNumber, startDate, endDate } = req.body;
    const userId = getUserId(req);

    if (!year || !periodNumber || !startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'Year, period number, start date and end date are required',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const existing = await connection.execute(
      'SELECT id FROM fiscal_periods WHERE year = ? AND period_number = ?',
      [year, periodNumber]
    ).then(([rows]) => rows);

    if (existing && existing.length > 0) {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Fiscal period already exists for this year and period',
          status: 409
        }
      });
    }

    const result = await connection.execute(
      `INSERT INTO fiscal_periods (year, period_number, start_date, end_date, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [year, periodNumber, startDate, endDate]
    ).then(([r]) => r);

    const periodId = result.insertId;

    await traceabilityService.logAction(
      userId,
      'create',
      'fiscal_period',
      periodId,
      null,
      { year, periodNumber, startDate, endDate, status: 'open' },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Fiscal period created successfully',
      data: {
        id: periodId,
        year,
        periodNumber,
        startDate,
        endDate,
        status: 'open'
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create fiscal period error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the fiscal period',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/fiscal-periods/:id/close
 * Close period after validation, transfer result to account 129
 */
export const closeFiscalPeriod = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const userId = getUserId(req);

    connection = await beginTransaction();

    const periods = await connection.execute(
      'SELECT * FROM fiscal_periods WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!periods || periods.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Fiscal period not found',
          status: 404
        }
      });
    }

    const period = periods[0];

    if (period.status === 'closed') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Fiscal period is already closed',
          status: 409
        }
      });
    }

    const validation = await validationService.validateAllRules(period.start_date, period.end_date);

    if (!validation.allValid) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Cannot close period. Validation errors found',
          status: 400,
          validationErrors: validation.failedValidations
        }
      });
    }

    await connection.execute(
      `UPDATE fiscal_periods 
       SET status = 'closed', closed_at = NOW(), closed_by = ?
       WHERE id = ?`,
      [userId, id]
    );

    await traceabilityService.logAction(
      userId,
      'close_period',
      'fiscal_period',
      Number(id),
      { status: period.status },
      { status: 'closed' },
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: 'Fiscal period closed successfully',
      data: {
        id: Number(id),
        status: 'closed',
        validation
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Close fiscal period error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while closing the fiscal period',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/fiscal-periods/:id/reopen
 * Reopen period with justification
 */
export const reopenFiscalPeriod = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const { justification } = req.body;
    const userId = getUserId(req);

    if (!justification) {
      return res.status(400).json({
        error: {
          message: 'Justification is required to reopen a fiscal period',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const periods = await connection.execute(
      'SELECT * FROM fiscal_periods WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!periods || periods.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Fiscal period not found',
          status: 404
        }
      });
    }

    const period = periods[0];

    if (period.status !== 'closed') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Only closed fiscal periods can be reopened',
          status: 409
        }
      });
    }

    await connection.execute(
      `UPDATE fiscal_periods 
       SET status = 'open', reopened_at = NOW(), reopen_justification = ? 
       WHERE id = ?`,
      [justification, id]
    );

    await traceabilityService.logAction(
      userId,
      'reopen_period',
      'fiscal_period',
      Number(id),
      { status: 'closed' },
      { status: 'open', justification },
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: 'Fiscal period reopened successfully',
      data: {
        id: Number(id),
        status: 'open',
        justification
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Reopen fiscal period error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while reopening the fiscal period',
        status: 500
      }
    });
  }
};

/**
 * ==============================
 * 8.4 Journal Entry Templates
 * ==============================
 */

const DEPRECATED_JOURNAL_TEMPLATE_NAMES = [
  'Factura de compra de mercaderías',
  'Factura de venta de mercaderías'
];

const JOURNAL_TEMPLATE_NAME_ALIASES = {
  'Gastos varios': 'Factura de gastos con IVA'
};

const normalizeJournalTemplateName = (templateName) =>
  JOURNAL_TEMPLATE_NAME_ALIASES[templateName] || templateName;

const isDeprecatedJournalTemplate = (templateName) =>
  DEPRECATED_JOURNAL_TEMPLATE_NAMES.includes(templateName);

/**
 * GET /api/journal-entry-templates
 * List all templates
 */
export const getJournalEntryTemplates = async (req, res) => {
  try {
    const { category } = req.query;

    let sql = `
      SELECT id, name, description, category, template_data, created_at, updated_at
      FROM journal_entry_templates
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` AND name NOT IN (?, ?)`;
    params.push(...DEPRECATED_JOURNAL_TEMPLATE_NAMES);

    sql += ` ORDER BY category, name`;

    const templates = await query(sql, params);
    const activeTemplates = templates.filter((template) => !isDeprecatedJournalTemplate(template.name));

    res.json({
      success: true,
      data: activeTemplates.map(t => {
        let templateData;
        try {
          const rawData = typeof t.template_data === 'string' ? t.template_data : JSON.stringify(t.template_data);
          templateData = JSON.parse(rawData);
        } catch (e) {
          templateData = { lines: [] };
        }
        return {
          id: t.id,
          name: normalizeJournalTemplateName(t.name),
          description: t.description,
          category: t.category,
          templateData,
          createdAt: t.created_at,
          updatedAt: t.updated_at
        };
      })
    });
  } catch (error) {
    console.error('Get journal entry templates error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching templates',
        status: 500
      }
    });
  }
};

/**
 * GET /api/journal-entry-templates/:id
 * Get template by id
 */
export const getJournalEntryTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const templates = await query(
      `SELECT * 
       FROM journal_entry_templates 
       WHERE id = ?
         AND name NOT IN (?, ?)`,
      [id, ...DEPRECATED_JOURNAL_TEMPLATE_NAMES]
    );

    if (!templates || templates.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Template not found',
          status: 404
        }
      });
    }

    const template = templates[0];
    if (isDeprecatedJournalTemplate(template.name)) {
      return res.status(404).json({
        error: {
          message: 'Template not found',
          status: 404
        }
      });
    }

    const accounts = await query(
      `SELECT id, code, name FROM accounts WHERE is_active = TRUE ORDER BY code`
    );

    let templateData;
    try {
      const rawData = typeof template.template_data === 'string' 
        ? template.template_data 
        : JSON.stringify(template.template_data);
      templateData = JSON.parse(rawData);
    } catch (e) {
      console.error('Error parsing template_data:', e);
      templateData = { lines: [] };
    }
    
    const mappedLines = templateData.lines.map(line => {
      const account = accounts.find(a => a.code === line.account_code);
      return {
        accountId: account ? account.id : null,
        accountCode: line.account_code,
        accountName: account ? account.name : 'Cuenta no encontrada',
        debit: line.debit,
        credit: line.credit,
        description: line.description
      };
    });

    res.json({
      success: true,
      data: {
        id: template.id,
        name: normalizeJournalTemplateName(template.name),
        description: template.description,
        category: template.category,
        templateData: {
          lines: mappedLines
        }
      }
    });
  } catch (error) {
    console.error('Get journal entry template by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the template',
        status: 500
      }
    });
  }
};

/**
 * POST /api/journal-entries/:id/validate
 * Validate that a journal entry is balanced (debit = credit)
 */
export const validateJournalEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const validation = await accountingService.validateEntryBalance(Number(id));

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Validate journal entry error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while validating the journal entry',
        status: 500
      }
    });
  }
};

/**
 * ==============================
 * Dashboard KPIs
 * ==============================
 */

/**
 * GET /api/dashboard/kpis
 * Get dashboard KPIs for the current period
 */
export const getDashboardKPIs = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'startDate and endDate query parameters are required',
          status: 400
        }
      });
    }

    const kpis = await accountingService.getDashboardKPIs(startDate, endDate);

    res.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    console.error('Get dashboard KPIs error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching dashboard KPIs',
        status: 500
      }
    });
  }
};

/**
 * ==============================
 * Year-end Closing
 * ==============================
 */

/**
 * POST /api/fiscal-periods/:id/close-year
 * Generate year-end closing entries
 */
export const closeFiscalPeriodYear = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const userId = getUserId(req);

    connection = await beginTransaction();

    const periods = await connection.execute(
      'SELECT * FROM fiscal_periods WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!periods || periods.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Fiscal period not found',
          status: 404
        }
      });
    }

    const period = periods[0];

    if (period.status === 'closed') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Fiscal period is already closed',
          status: 409
        }
      });
    }

    const validation = await validationService.validateAllRules(period.start_date, period.end_date);

    if (!validation.allValid) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Cannot close period. Validation errors found',
          status: 400,
          validationErrors: validation.failedValidations
        }
      });
    }

    const closingResult = await accountingService.generateYearEndClosingEntries(
      period.end_date,
      userId,
      connection
    );

    await connection.execute(
      `UPDATE fiscal_periods 
       SET status = 'closed', closed_at = NOW(), closed_by = ?
       WHERE id = ?`,
      [userId, id]
    );

    await traceabilityService.logAction(
      userId,
      'close_period',
      'fiscal_period',
      Number(id),
      { status: period.status },
      { status: 'closed', yearEndClosing: true },
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: 'Fiscal period closed successfully with year-end entries',
      data: {
        periodId: Number(id),
        status: 'closed',
        closingEntries: closingResult
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Close fiscal period year error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while closing the fiscal period',
        status: 500
      }
    });
  }
};

/**
 * ==============================
 * Export Reports
 * ==============================
 */

/**
 * GET /api/reports/export/csv
 * Export report to CSV
 */
export const exportReportCSV = async (req, res) => {
  try {
    const { type, startDate, endDate, accounts } = req.query;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'type, startDate and endDate query parameters are required',
          status: 400
        }
      });
    }

    let data;
    let filename;

    if (type === 'balance') {
      const balance = await accountingService.calculateBalanceSheet(startDate, endDate);
      data = [
        ['BALANCE DE SITUACIÓN'],
        [`Período: ${startDate} a ${endDate}`],
        [],
        ['ACTIVO'],
        ['Código', 'Cuenta', 'Saldo'],
        ...balance.assets.map(a => [a.code, a.name, a.balance.toFixed(2)]),
        ['Total Activo', '', balance.totalAssets.toFixed(2)],
        [],
        ['PASIVO'],
        ...balance.liabilities.map(l => [l.code, l.name, l.balance.toFixed(2)]),
        ['Total Pasivo', '', balance.totalLiabilities.toFixed(2)],
        [],
        ['PATRIMONIO NETO'],
        ...balance.equity.map(e => [e.code, e.name, e.balance.toFixed(2)]),
        ['Total Patrimonio Neto', '', balance.totalEquity.toFixed(2)]
      ];
      filename = `balance_${startDate}_${endDate}.csv`;
    } else if (type === 'pnl') {
      const pnl = await accountingService.calculatePnL(startDate, endDate);
      data = [
        ['CUENTA DE PÉRDIDAS Y GANANCIAS'],
        [`Período: ${startDate} a ${endDate}`],
        [],
        ['INGRESOS'],
        ['Código', 'Cuenta', 'Importe'],
        ...pnl.income.map(i => [i.code, i.name, i.amount.toFixed(2)]),
        ['Total Ingresos', '', pnl.totalIncome.toFixed(2)],
        [],
        ['GASTOS'],
        ...pnl.expenses.map(e => [e.code, e.name, e.amount.toFixed(2)]),
        ['Total Gastos', '', pnl.totalExpenses.toFixed(2)],
        [],
        ['RESULTADO DEL EJERCICIO', '', pnl.result.toFixed(2)]
      ];
      filename = `pnl_${startDate}_${endDate}.csv`;
    } else if (type === 'journal') {
      const entries = await accountingService.getJournalEntries({ startDate, endDate });
      data = [
        ['LIBRO DIARIO'],
        [`Período: ${startDate} a ${endDate}`],
        [],
        ['Fecha', 'Asiento', 'Descripción', 'Cuenta', 'Debe', 'Haber']
      ];
      for (const entry of entries) {
        for (const line of entry.lines || []) {
          data.push([
            entry.entry_date,
            entry.id,
            entry.description,
            line.accountCode,
            (line.debit || 0).toFixed(2),
            (line.credit || 0).toFixed(2)
          ]);
        }
      }
      filename = `diario_${startDate}_${endDate}.csv`;
    } else {
      return res.status(400).json({
        error: {
          message: 'Invalid type. Allowed: balance, pnl, journal',
          status: 400
        }
      });
    }

    const csvContent = data.map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export report CSV error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while exporting the report',
        status: 500
      }
    });
  }
};

export default {
  getAccounts,
  getAccountingReferenceData,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  getJournalEntries,
  getJournalEntryById,
  createJournalEntry,
  validateJournalEntry,
  getBalanceSheet,
  getPnLReport,
  getCustomReport,
  getReconciliationReport,
  getFiscalPeriods,
  createFiscalPeriod,
  closeFiscalPeriod,
  reopenFiscalPeriod,
  getJournalEntryTemplates,
  getJournalEntryTemplateById,
  getDashboardKPIs,
  closeFiscalPeriodYear,
  exportReportCSV
};
