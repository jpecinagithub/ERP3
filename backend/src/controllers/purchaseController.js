import { query, beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';
import inventoryService from '../services/inventoryService.js';
import accountingService from '../services/accountingService.js';
import traceabilityService from '../services/traceabilityService.js';

/**
 * Purchase Controller
 * Handles budgets, purchase orders, purchase invoices and inventory endpoints
 * 
 * Requirements:
 * - 7.1 Budgets CRUD and conversion to purchase orders
 * - 7.2 Purchase orders CRUD and status updates
 * - 7.3 Purchase invoices with automatic accounting and inventory movements
 * - 7.4 Inventory endpoints (stock, adjustments, movements)
 */

/**
 * Helper to get current authenticated user ID from request
 * Falls back to null if not available (should be set by auth middleware)
 */
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

/**
 * =========================
 * 7.1 Budgets Endpoints
 * =========================
 */

/**
 * GET /api/budgets
 * List budgets with status
 */
export const getBudgets = async (req, res) => {
  try {
    const budgets = await query(
      `SELECT 
         b.id,
         b.budget_number,
         b.budget_date,
         b.status,
         b.total_amount,
         s.id as supplier_id,
         s.name as supplier_name
       FROM budgets b
       JOIN suppliers s ON b.supplier_id = s.id
       ORDER BY b.budget_date DESC, b.id DESC`
    );

    res.json({
      success: true,
      data: budgets.map(b => ({
        id: b.id,
        budgetNumber: b.budget_number,
        budgetDate: b.budget_date,
        status: b.status,
        totalAmount: parseFloat(b.total_amount),
        supplier: {
          id: b.supplier_id,
          name: b.supplier_name
        }
      }))
    });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching budgets',
        status: 500
      }
    });
  }
};

/**
 * GET /api/budgets/:id
 * Get budget details with lines
 */
export const getBudgetById = async (req, res) => {
  try {
    const { id } = req.params;

    const budgets = await query(
      `SELECT 
         b.*,
         s.name as supplier_name
       FROM budgets b
       JOIN suppliers s ON b.supplier_id = s.id
       WHERE b.id = ?`,
      [id]
    );

    if (!budgets || budgets.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Budget not found',
          status: 404
        }
      });
    }

    const budget = budgets[0];

    const lines = await query(
      `SELECT 
         bl.*,
         i.code as item_code,
         i.description as item_description,
         i.unit_of_measure
       FROM budget_lines bl
       JOIN items i ON bl.item_id = i.id
       WHERE bl.budget_id = ?
       ORDER BY bl.id`,
      [id]
    );

    res.json({
      success: true,
      data: {
        id: budget.id,
        budgetNumber: budget.budget_number,
        budgetDate: budget.budget_date,
        status: budget.status,
        totalAmount: parseFloat(budget.total_amount),
        supplier: {
          id: budget.supplier_id,
          name: budget.supplier_name
        },
        lines: lines.map(line => ({
          id: line.id,
          itemId: line.item_id,
          itemCode: line.item_code,
          itemDescription: line.item_description,
          quantity: parseFloat(line.quantity),
          unitPrice: parseFloat(line.unit_price),
          lineTotal: parseFloat(line.line_total),
          unitOfMeasure: line.unit_of_measure
        }))
      }
    });
  } catch (error) {
    console.error('Get budget by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the budget',
        status: 500
      }
    });
  }
};

/**
 * POST /api/budgets
 * Create budget and log to audit trail
 * Expects body: { supplierId, budgetDate, lines: [{ itemId, quantity, unitPrice }] }
 */
export const createBudget = async (req, res) => {
  let connection = null;

  try {
    const { supplierId, budgetDate, lines } = req.body;
    const userId = getUserId(req);

    if (!supplierId || !budgetDate || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Supplier, budget date and at least one line are required',
          status: 400
        }
      });
    }

    // Calculate totals
    let totalAmount = 0;
    for (const line of lines) {
      if (!line.itemId || !line.quantity || !line.unitPrice) {
        return res.status(400).json({
          error: {
            message: 'Each line requires itemId, quantity and unitPrice',
            status: 400
          }
        });
      }
      totalAmount += Number(line.quantity) * Number(line.unitPrice);
    }

    connection = await beginTransaction();

    const temporaryBudgetNumber = buildTempNumber('PRES');

    // Insert header first, then derive final number from insertId to avoid races
    const headerResult = await connection.execute(
      `INSERT INTO budgets 
         (budget_number, budget_date, supplier_id, status, total_amount, created_by)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [temporaryBudgetNumber, budgetDate, supplierId, totalAmount, userId]
    ).then(([result]) => result);

    const budgetId = headerResult.insertId;
    const budgetNumber = buildDocumentNumber('PRES', budgetDate, budgetId);

    await connection.execute(
      `UPDATE budgets SET budget_number = ? WHERE id = ?`,
      [budgetNumber, budgetId]
    );

    // Insert lines
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const lineTotal = quantity * unitPrice;

      await connection.execute(
        `INSERT INTO budget_lines 
           (budget_id, item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [budgetId, line.itemId, quantity, unitPrice, lineTotal]
      );
    }

    // Audit log
    await traceabilityService.logAction(
      userId,
      'create',
      'budget',
      budgetId,
      null,
      { supplierId, budgetDate, totalAmount, status: 'pending' },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: {
        id: budgetId,
        budgetNumber,
        budgetDate,
        status: 'pending',
        totalAmount
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create budget error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the budget',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/budgets/:id
 * Update budget if not converted
 * Expects same body as createBudget
 */
export const updateBudget = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const { supplierId, budgetDate, lines } = req.body;
    const userId = getUserId(req);

    if (!supplierId || !budgetDate || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Supplier, budget date and at least one line are required',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const budgets = await connection.execute(
      'SELECT * FROM budgets WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!budgets || budgets.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Budget not found',
          status: 404
        }
      });
    }

    const existing = budgets[0];

    if (existing.status === 'converted') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Budget is already converted and cannot be updated',
          status: 409
        }
      });
    }

    // Recalculate total
    let totalAmount = 0;
    for (const line of lines) {
      if (!line.itemId || !line.quantity || !line.unitPrice) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Each line requires itemId, quantity and unitPrice',
            status: 400
          }
        });
      }
      totalAmount += Number(line.quantity) * Number(line.unitPrice);
    }

    // Delete old lines
    await connection.execute('DELETE FROM budget_lines WHERE budget_id = ?', [id]);

    // Insert new lines
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const lineTotal = quantity * unitPrice;

      await connection.execute(
        `INSERT INTO budget_lines 
           (budget_id, item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [id, line.itemId, quantity, unitPrice, lineTotal]
      );
    }

    // Update header
    await connection.execute(
      `UPDATE budgets 
         SET supplier_id = ?, budget_date = ?, total_amount = ?
       WHERE id = ?`,
      [supplierId, budgetDate, totalAmount, id]
    );

    await traceabilityService.logAction(
      userId,
      'update',
      'budget',
      Number(id),
      {
        supplierId: existing.supplier_id,
        budgetDate: existing.budget_date,
        totalAmount: parseFloat(existing.total_amount),
        status: existing.status
      },
      {
        supplierId,
        budgetDate,
        totalAmount,
        status: existing.status
      },
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: 'Budget updated successfully',
      data: {
        id: Number(id),
        supplierId,
        budgetDate,
        totalAmount,
        status: existing.status
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Update budget error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the budget',
        status: 500
      }
    });
  }
};

/**
 * DELETE /api/budgets/:id
 * Delete budget if not converted and not linked in traceability chain
 */
export const deleteBudget = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const userId = getUserId(req);

    connection = await beginTransaction();

    const budgets = await connection.execute(
      'SELECT * FROM budgets WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!budgets || budgets.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Budget not found',
          status: 404
        }
      });
    }

    const existing = budgets[0];

    if (existing.status === 'converted') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Budget is already converted and cannot be deleted',
          status: 409
        }
      });
    }

    // Check traceability (if part of chain, prevent deletion)
    const canDelete = await traceabilityService.canDeleteDocument('budget', Number(id));
    if (!canDelete.canDelete) {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: canDelete.reason,
          status: 409,
          details: canDelete
        }
      });
    }

    await connection.execute('DELETE FROM budget_lines WHERE budget_id = ?', [id]);
    await connection.execute('DELETE FROM budgets WHERE id = ?', [id]);

    await traceabilityService.logAction(
      userId,
      'delete',
      'budget',
      Number(id),
      {
        supplierId: existing.supplier_id,
        budgetDate: existing.budget_date,
        totalAmount: parseFloat(existing.total_amount),
        status: existing.status
      },
      null,
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Delete budget error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while deleting the budget',
        status: 500
      }
    });
  }
};

/**
 * POST /api/budgets/:id/convert
 * Convert budget to purchase order
 */
export const convertBudgetToOrder = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const userId = getUserId(req);

    connection = await beginTransaction();

    const budgets = await connection.execute(
      'SELECT * FROM budgets WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!budgets || budgets.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Budget not found',
          status: 404
        }
      });
    }

    const budget = budgets[0];

    if (budget.status === 'converted') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Budget is already converted',
          status: 409
        }
      });
    }

    const lines = await connection.execute(
      'SELECT * FROM budget_lines WHERE budget_id = ?',
      [id]
    ).then(([rows]) => rows);

    if (!lines || lines.length === 0) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Budget has no lines and cannot be converted',
          status: 400
        }
      });
    }

    const orderDate = new Date().toISOString().split('T')[0];
    const temporaryOrderNumber = buildTempNumber('PED');

    // Create purchase order header
    const orderResult = await connection.execute(
      `INSERT INTO purchase_orders 
         (order_number, order_date, supplier_id, status, total_amount, created_by)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [temporaryOrderNumber, orderDate, budget.supplier_id, budget.total_amount, userId]
    ).then(([result]) => result);

    const orderId = orderResult.insertId;
    const orderNumber = buildDocumentNumber('PED', orderDate, orderId);

    await connection.execute(
      `UPDATE purchase_orders SET order_number = ? WHERE id = ?`,
      [orderNumber, orderId]
    );

    // Create purchase order lines from budget lines
    for (const line of lines) {
      await connection.execute(
        `INSERT INTO purchase_order_lines 
           (purchase_order_id, item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, line.item_id, line.quantity, line.unit_price, line.line_total]
      );
    }

    // Update budget status
    await connection.execute(
      `UPDATE budgets SET status = 'converted' WHERE id = ?`,
      [id]
    );

    // Traceability: link budget -> purchase_order
    await traceabilityService.createDocumentLink(
      'budget',
      'purchase_order',
      Number(id),
      orderId,
      'converted_to',
      connection
    );

    // Audit log
    await traceabilityService.logAction(
      userId,
      'convert',
      'budget',
      Number(id),
      { status: budget.status },
      { status: 'converted', purchaseOrderId: orderId },
      connection
    );

    await traceabilityService.logAction(
      userId,
      'create',
      'purchase_order',
      orderId,
      null,
      { orderNumber, supplierId: budget.supplier_id, totalAmount: parseFloat(budget.total_amount) },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Budget converted to purchase order successfully',
      data: {
        orderId,
        orderNumber,
        status: 'pending',
        totalAmount: parseFloat(budget.total_amount)
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Convert budget error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while converting the budget',
        status: 500
      }
    });
  }
};

/**
 * ==============================
 * 7.2 Purchase Orders Endpoints
 * ==============================
 */

/**
 * GET /api/purchase-orders
 * List purchase orders with status
 */
export const getPurchaseOrders = async (req, res) => {
  try {
    const orders = await query(
      `SELECT 
         po.id,
         po.order_number,
         po.order_date,
         po.status,
         po.total_amount,
         s.id as supplier_id,
         s.name as supplier_name
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       ORDER BY po.order_date DESC, po.id DESC`
    );

    res.json({
      success: true,
      data: orders.map(o => ({
        id: o.id,
        orderNumber: o.order_number,
        orderDate: o.order_date,
        status: o.status,
        totalAmount: parseFloat(o.total_amount),
        supplier: {
          id: o.supplier_id,
          name: o.supplier_name
        }
      }))
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching purchase orders',
        status: 500
      }
    });
  }
};

/**
 * GET /api/purchase-orders/:id
 * Get purchase order details with lines
 */
export const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const orders = await query(
      `SELECT 
         po.*,
         s.name as supplier_name
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.id = ?`,
      [id]
    );

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Purchase order not found',
          status: 404
        }
      });
    }

    const order = orders[0];

    const lines = await query(
      `SELECT 
         pol.*,
         i.code as item_code,
         i.description as item_description,
         i.unit_of_measure
       FROM purchase_order_lines pol
       JOIN items i ON pol.item_id = i.id
       WHERE pol.purchase_order_id = ?
       ORDER BY pol.id`,
      [id]
    );

    res.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        orderDate: order.order_date,
        status: order.status,
        totalAmount: parseFloat(order.total_amount),
        supplier: {
          id: order.supplier_id,
          name: order.supplier_name
        },
        lines: lines.map(line => ({
          id: line.id,
          itemId: line.item_id,
          itemCode: line.item_code,
          itemDescription: line.item_description,
          quantity: parseFloat(line.quantity),
          unitPrice: parseFloat(line.unit_price),
          lineTotal: parseFloat(line.line_total),
          unitOfMeasure: line.unit_of_measure
        }))
      }
    });
  } catch (error) {
    console.error('Get purchase order by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the purchase order',
        status: 500
      }
    });
  }
};

/**
 * POST /api/purchase-orders
 * Create purchase order (direct or from budget)
 * Expects body: { supplierId, orderDate?, budgetId?, lines: [{ itemId, quantity, unitPrice }] }
 */
export const createPurchaseOrder = async (req, res) => {
  let connection = null;

  try {
    const { supplierId, orderDate, budgetId, lines } = req.body;
    const userId = getUserId(req);

    if (!supplierId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Supplier and at least one line are required',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    // If budgetId is provided, validate and mark as converted
    let linkedBudget = null;
    if (budgetId) {
      const budgets = await connection.execute(
        'SELECT * FROM budgets WHERE id = ? FOR UPDATE',
        [budgetId]
      ).then(([rows]) => rows);

      if (!budgets || budgets.length === 0) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Budget not found for provided budgetId',
            status: 400
          }
        });
      }

      linkedBudget = budgets[0];

      if (linkedBudget.status === 'converted') {
        await rollbackTransaction(connection);
        return res.status(409).json({
          error: {
            message: 'Budget is already converted',
            status: 409
          }
        });
      }
    }

    // Calculate total
    let totalAmount = 0;
    for (const line of lines) {
      if (!line.itemId || !line.quantity || !line.unitPrice) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Each line requires itemId, quantity and unitPrice',
            status: 400
          }
        });
      }
      totalAmount += Number(line.quantity) * Number(line.unitPrice);
    }

    const effectiveOrderDate = orderDate || new Date().toISOString().split('T')[0];
    const temporaryOrderNumber = buildTempNumber('PED');

    const headerResult = await connection.execute(
      `INSERT INTO purchase_orders 
         (order_number, order_date, supplier_id, status, total_amount, created_by)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [temporaryOrderNumber, effectiveOrderDate, supplierId, totalAmount, userId]
    ).then(([result]) => result);

    const orderId = headerResult.insertId;
    const orderNumber = buildDocumentNumber('PED', effectiveOrderDate, orderId);

    await connection.execute(
      `UPDATE purchase_orders SET order_number = ? WHERE id = ?`,
      [orderNumber, orderId]
    );

    // Insert lines
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const lineTotal = quantity * unitPrice;

      await connection.execute(
        `INSERT INTO purchase_order_lines 
           (purchase_order_id, item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, line.itemId, quantity, unitPrice, lineTotal]
      );
    }

    // If created from budget, update budget and traceability
    if (linkedBudget) {
      await connection.execute(
        `UPDATE budgets SET status = 'converted' WHERE id = ?`,
        [budgetId]
      );

      await traceabilityService.createDocumentLink(
        'budget',
        'purchase_order',
        Number(budgetId),
        orderId,
        'converted_to',
        connection
      );

      await traceabilityService.logAction(
        userId,
        'convert',
        'budget',
        Number(budgetId),
        { status: linkedBudget.status },
        { status: 'converted', purchaseOrderId: orderId },
        connection
      );
    }

    await traceabilityService.logAction(
      userId,
      'create',
      'purchase_order',
      orderId,
      null,
      { orderNumber, supplierId, totalAmount },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: {
        id: orderId,
        orderNumber,
        orderDate: effectiveOrderDate,
        status: 'pending',
        totalAmount
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create purchase order error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the purchase order',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/purchase-orders/:id
 * Update purchase order status
 * Expects body: { status }
 * When status changes to 'fully_received', automatically creates:
 * - Purchase invoice
 * - Journal entry
 * - Inventory movements (inbound)
 * - Pending payment
 */
export const updatePurchaseOrderStatus = async (req, res) => {
  let connection = null;
  let generatedInvoiceNumber = null;
  let generatedPaymentNumber = null;

  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = getUserId(req);

    const allowedStatuses = ['pending', 'partially_received', 'fully_received'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: {
          message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}`,
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const orders = await connection.execute(
      'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!orders || orders.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Purchase order not found',
          status: 404
        }
      });
    }

    const existing = orders[0];

    if (existing.status === status) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Status is already the same',
          status: 400
        }
      });
    }

    const validTransitions = {
      pending: ['partially_received', 'fully_received'],
      partially_received: ['fully_received'],
      fully_received: []
    };

    if (!validTransitions[existing.status]?.includes(status)) {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: `Invalid status transition from '${existing.status}' to '${status}'`,
          status: 409
        }
      });
    }

    await connection.execute(
      'UPDATE purchase_orders SET status = ? WHERE id = ?',
      [status, id]
    );

    let purchaseInvoiceId = null;
    let journalEntryId = null;
    let paymentId = null;

    if (status === 'fully_received') {
      const [alreadyGenerated] = await connection.execute(
        `SELECT COUNT(*) as count
         FROM document_links
         WHERE source_document_type = 'purchase_order'
           AND source_document_id = ?
           AND target_document_type = 'purchase_invoice'`,
        [id]
      ).then(([rows]) => rows);

      if ((alreadyGenerated?.count || 0) > 0) {
        await rollbackTransaction(connection);
        return res.status(409).json({
          error: {
            message: 'This purchase order already has a generated purchase invoice',
            status: 409
          }
        });
      }

      const orderLines = await connection.execute(
        'SELECT * FROM purchase_order_lines WHERE purchase_order_id = ?',
        [id]
      ).then(([rows]) => rows);

      if (!orderLines || orderLines.length === 0) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Cannot receive order without lines',
            status: 400
          }
        });
      }

      const invoiceDate = new Date().toISOString().split('T')[0];
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + 60);
      const dueDate = dueDateObj.toISOString().split('T')[0];
      const vatRate = 0.21;
      const baseTotalAmount = Number(existing.total_amount);
      const grossTotalAmount = Number((baseTotalAmount * (1 + vatRate)).toFixed(2));

      const temporaryInvoiceNumber = buildTempNumber('FAC');

      const headerResult = await connection.execute(
        `INSERT INTO purchase_invoices 
           (invoice_number, invoice_type, invoice_date, due_date, supplier_id, total_amount, status, created_by)
         VALUES (?, 'mercaderia', ?, ?, ?, ?, 'pending', ?)`,
        [temporaryInvoiceNumber, invoiceDate, dueDate, existing.supplier_id, grossTotalAmount, userId]
      ).then(([result]) => result);

      purchaseInvoiceId = headerResult.insertId;
      const invoiceNumber = buildDocumentNumber('FAC', invoiceDate, purchaseInvoiceId);
      generatedInvoiceNumber = invoiceNumber;

      await connection.execute(
        `UPDATE purchase_invoices SET invoice_number = ? WHERE id = ?`,
        [invoiceNumber, purchaseInvoiceId]
      );

      for (const line of orderLines) {
        await connection.execute(
          `INSERT INTO purchase_invoice_lines 
             (purchase_invoice_id, item_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?)`,
          [purchaseInvoiceId, line.item_id, line.quantity, line.unit_price, line.line_total]
        );

        await inventoryService.createInboundMovement(
          line.item_id,
          line.quantity,
          line.unit_price,
          'purchase_invoice',
          purchaseInvoiceId,
          userId,
          null,
          connection
        );
      }

      journalEntryId = await accountingService.generatePurchaseInvoiceEntry(
        purchaseInvoiceId,
        connection,
        {
          includeVAT: true,
          vatRate,
          inputTaxAccountCode: '472'
        }
      );

      const temporaryPaymentNumber = buildTempNumber('PAG');

      const paymentResult = await connection.execute(
        `INSERT INTO payments 
           (payment_number, payment_date, purchase_invoice_id, amount, status, payment_method, notes, created_by)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [temporaryPaymentNumber, dueDate, purchaseInvoiceId, grossTotalAmount, 'bank_transfer', `Pago pendiente - Factura ${invoiceNumber}`, userId]
      ).then(([r]) => r);

      paymentId = paymentResult.insertId;
      const paymentNumber = buildDocumentNumber('PAG', dueDate, paymentId);
      generatedPaymentNumber = paymentNumber;

      await connection.execute(
        `UPDATE payments SET payment_number = ? WHERE id = ?`,
        [paymentNumber, paymentId]
      );

      await traceabilityService.createDocumentLink(
        'purchase_order',
        'purchase_invoice',
        Number(id),
        purchaseInvoiceId,
        'generated',
        connection
      );

      await traceabilityService.createDocumentLink(
        'purchase_invoice',
        'journal_entry',
        purchaseInvoiceId,
        journalEntryId,
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
    }

    await traceabilityService.logAction(
      userId,
      'update',
      'purchase_order',
      Number(id),
      { status: existing.status },
      { status },
      connection
    );

    await commitTransaction(connection);

    const responseData = {
      id: Number(id),
      status
    };

    if (status === 'fully_received') {
      responseData.generated = {
        purchaseInvoiceId,
        invoiceNumber: generatedInvoiceNumber,
        journalEntryId,
        paymentId,
        paymentNumber: generatedPaymentNumber
      };
    }

    res.json({
      success: true,
      message: status === 'fully_received' 
        ? 'Purchase order received. Invoice, journal entry, inventory movement and pending payment generated successfully'
        : 'Purchase order status updated successfully',
      data: responseData
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Update purchase order status error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the purchase order status',
        status: 500
      }
    });
  }
};

/**
 * ===============================
 * 7.3 Purchase Invoices Endpoints
 * ===============================
 */

/**
 * GET /api/purchase-invoices
 * List purchase invoices
 */
export const getPurchaseInvoices = async (req, res) => {
  try {
    const invoices = await query(
      `SELECT 
         pi.id,
         pi.invoice_number,
         pi.invoice_type,
         pi.invoice_date,
         pi.due_date,
         pi.total_amount,
         pi.status,
         s.id as supplier_id,
         s.name as supplier_name
       FROM purchase_invoices pi
       JOIN suppliers s ON pi.supplier_id = s.id
       ORDER BY pi.invoice_date DESC, pi.id DESC`
    );

    const invoicesWithPayments = await Promise.all(
      invoices.map(async (inv) => {
        const [paid] = await query(
          `SELECT 
             COALESCE(SUM(CASE WHEN status = 'realized' THEN amount ELSE 0 END), 0) as paid_amount,
             COALESCE(SUM(amount), 0) as committed_amount
           FROM payments
           WHERE purchase_invoice_id = ?`,
          [inv.id]
        );
        const paidAmount = parseFloat(paid?.paid_amount) || 0;
        const committedAmount = parseFloat(paid?.committed_amount) || 0;
        const totalAmount = parseFloat(inv.total_amount);
        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          invoiceType: inv.invoice_type || 'mercaderia',
          invoiceDate: inv.invoice_date,
          dueDate: inv.due_date,
          totalAmount,
          paidAmount,
          pendingAmount: Math.max(totalAmount - committedAmount, 0),
          status: inv.status,
          supplier: {
            id: inv.supplier_id,
            name: inv.supplier_name
          }
        };
      })
    );

    res.json({
      success: true,
      data: invoicesWithPayments
    });
  } catch (error) {
    console.error('Get purchase invoices error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching purchase invoices',
        status: 500
      }
    });
  }
};

/**
 * GET /api/purchase-invoices/:id
 * Get purchase invoice details with linked documents
 */
export const getPurchaseInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoices = await query(
      `SELECT 
         pi.*,
         s.name as supplier_name
       FROM purchase_invoices pi
       JOIN suppliers s ON pi.supplier_id = s.id
       WHERE pi.id = ?`,
      [id]
    );

    if (!invoices || invoices.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Purchase invoice not found',
          status: 404
        }
      });
    }

    const invoice = invoices[0];

    const lines = await query(
      `SELECT 
         pil.*,
         i.code as item_code,
         i.description as item_description,
         i.unit_of_measure
       FROM purchase_invoice_lines pil
       LEFT JOIN items i ON pil.item_id = i.id
       WHERE pil.purchase_invoice_id = ?
       ORDER BY pil.id`,
      [id]
    );

    const fixedAssets = invoice.invoice_type === 'inmovilizado'
      ? await query(
        `SELECT
           fa.id,
           fa.asset_code,
           fa.description,
           fa.acquisition_value,
           fa.accumulated_depreciation,
           fa.status
         FROM fixed_assets fa
         WHERE fa.purchase_invoice_id = ?
         ORDER BY fa.id`,
        [id]
      )
      : [];

    // Get traceability chain (linked documents)
    const traceability = await traceabilityService.getTraceabilityChain('purchase_invoice', Number(id));

    res.json({
      success: true,
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceType: invoice.invoice_type || 'mercaderia',
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        totalAmount: parseFloat(invoice.total_amount),
        status: invoice.status,
        supplier: {
          id: invoice.supplier_id,
          name: invoice.supplier_name
        },
        lines: lines.map(line => ({
          id: line.id,
          itemId: line.item_id,
          itemCode: line.item_code,
          itemDescription: line.line_description || line.item_description,
          quantity: parseFloat(line.quantity),
          unitPrice: parseFloat(line.unit_price),
          lineTotal: parseFloat(line.line_total),
          unitOfMeasure: line.unit_of_measure
        })),
        fixedAssets: fixedAssets.map((asset) => ({
          id: asset.id,
          assetCode: asset.asset_code,
          description: asset.description,
          acquisitionValue: parseFloat(asset.acquisition_value),
          accumulatedDepreciation: parseFloat(asset.accumulated_depreciation),
          status: asset.status
        })),
        traceability
      }
    });
  } catch (error) {
    console.error('Get purchase invoice by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the purchase invoice',
        status: 500
      }
    });
  }
};

/**
 * POST /api/purchase-invoices
 * Create purchase invoice, generate journal entry, create inventory movements, log to audit trail
 * Expects body: { supplierId, invoiceNumber, invoiceDate, purchaseOrderId?, lines: [{ itemId, quantity, unitPrice }] }
 */
export const createPurchaseInvoice = async (req, res) => {
  let connection = null;

  try {
    const {
      supplierId,
      invoiceNumber,
      invoiceDate,
      purchaseOrderId,
      invoiceType,
      expenseAccountCode,
      assetAccountCode,
      usefulLifeMonths,
      paymentMethod,
      includeVAT,
      vatRate,
      lines
    } = req.body;
    const userId = getUserId(req);
    const effectiveInvoiceType = invoiceType || 'mercaderia';
    const allowedInvoiceTypes = ['mercaderia', 'inmovilizado', 'gasto'];
    const effectivePaymentMethod = paymentMethod || 'bank_transfer';
    const applyVAT = includeVAT !== false;
    const normalizedVatRateRaw = Number(vatRate);
    const normalizedVatRate = Number.isFinite(normalizedVatRateRaw)
      ? (normalizedVatRateRaw > 1 ? normalizedVatRateRaw / 100 : normalizedVatRateRaw)
      : 0.21;

    if (!supplierId || !invoiceNumber || !invoiceDate || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Supplier, invoice number, invoice date and at least one line are required',
          status: 400
        }
      });
    }

    if (!allowedInvoiceTypes.includes(effectiveInvoiceType)) {
      return res.status(400).json({
        error: {
          message: `Invalid invoiceType. Allowed: ${allowedInvoiceTypes.join(', ')}`,
          status: 400
        }
      });
    }

    if (!['bank_transfer', 'check'].includes(effectivePaymentMethod)) {
      return res.status(400).json({
        error: {
          message: 'paymentMethod must be bank_transfer or check',
          status: 400
        }
      });
    }

    if (normalizedVatRate < 0 || normalizedVatRate > 1) {
      return res.status(400).json({
        error: {
          message: 'vatRate must be between 0 and 1 (or 0 to 100 if sent as percentage)',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    // Optional: validate purchase order linkage
    let linkedOrder = null;
    if (purchaseOrderId) {
      const orders = await connection.execute(
        'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
        [purchaseOrderId]
      ).then(([rows]) => rows);

      if (!orders || orders.length === 0) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Purchase order not found for provided purchaseOrderId',
            status: 400
          }
        });
      }

      linkedOrder = orders[0];
    }

    // Calculate total and due date (invoice_date + 60 days)
    let baseTotalAmount = 0;
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const lineDescription = String(line.lineDescription || line.itemDescription || '').trim();
      const requiresItem = effectiveInvoiceType !== 'inmovilizado';

      if ((requiresItem && !line.itemId) || !quantity || !unitPrice) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: requiresItem
              ? 'Each line requires itemId, quantity and unitPrice'
              : 'Each line requires description, quantity and unitPrice',
            status: 400
          }
        });
      }

      if (!requiresItem && !lineDescription) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Each fixed-asset line requires a manual description',
            status: 400
          }
        });
      }

      baseTotalAmount += quantity * unitPrice;
    }

    baseTotalAmount = Number(baseTotalAmount.toFixed(2));
    const vatAmount = applyVAT ? Number((baseTotalAmount * normalizedVatRate).toFixed(2)) : 0;
    const totalAmount = Number((baseTotalAmount + vatAmount).toFixed(2));

    const invoiceDateObj = new Date(invoiceDate);
    const dueDateObj = new Date(invoiceDateObj);
    dueDateObj.setDate(dueDateObj.getDate() + 60);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    // Insert invoice header
    const headerResult = await connection.execute(
      `INSERT INTO purchase_invoices 
         (invoice_number, invoice_type, invoice_date, due_date, supplier_id, total_amount, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [invoiceNumber, effectiveInvoiceType, invoiceDate, dueDate, supplierId, totalAmount, userId]
    ).then(([result]) => result);

    const invoiceId = headerResult.insertId;
    const createdFixedAssetIds = [];

    // Insert lines and generate side effects by invoice type
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const lineTotal = quantity * unitPrice;
      const lineDescription = String(line.lineDescription || line.itemDescription || '').trim();
      const lineItemId = line.itemId ? Number(line.itemId) : null;

      await connection.execute(
        `INSERT INTO purchase_invoice_lines 
           (purchase_invoice_id, item_id, line_description, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceId, lineItemId, effectiveInvoiceType === 'inmovilizado' ? lineDescription : null, quantity, unitPrice, lineTotal]
      );

      if (effectiveInvoiceType === 'mercaderia') {
        await inventoryService.createInboundMovement(
          lineItemId,
          quantity,
          unitPrice,
          'purchase_invoice',
          invoiceId,
          userId,
          null,
          connection
        );
      }

      if (effectiveInvoiceType === 'inmovilizado') {
        const temporaryAssetCode = buildTempAssetCode();
        const assetResult = await connection.execute(
          `INSERT INTO fixed_assets
             (asset_code, description, purchase_invoice_id, acquisition_date, acquisition_value, residual_value,
              useful_life_months, asset_account_code, depreciation_account_code, accumulated_depreciation, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?)`,
          [
            temporaryAssetCode,
            line.assetDescription || lineDescription,
            invoiceId,
            invoiceDate,
            lineTotal,
            Number(line.residualValue || 0),
            Number(line.usefulLifeMonths || usefulLifeMonths || 60),
            line.assetAccountCode || assetAccountCode || '223',
            line.depreciationAccountCode || '681',
            userId
          ]
        ).then(([result]) => result);

        const fixedAssetId = assetResult.insertId;
        const generatedAssetCode = buildAssetCode(invoiceDate, fixedAssetId);
        createdFixedAssetIds.push(fixedAssetId);

        await connection.execute(
          `UPDATE fixed_assets SET asset_code = ? WHERE id = ?`,
          [generatedAssetCode, fixedAssetId]
        );

        await traceabilityService.createDocumentLink(
          'purchase_invoice',
          'fixed_asset',
          invoiceId,
          fixedAssetId,
          'generated',
          connection
        );
      }
    }

    // Generate automatic journal entry
    const journalEntryId = await accountingService.generatePurchaseInvoiceEntry(
      invoiceId,
      connection,
      {
        invoiceType: effectiveInvoiceType,
        expenseAccountCode: expenseAccountCode || '621',
        assetAccountCode: assetAccountCode || '223',
        includeVAT: applyVAT,
        vatRate: normalizedVatRate,
        inputTaxAccountCode: '472'
      }
    );

    const temporaryPaymentNumber = buildTempNumber('PAG');
    const paymentResult = await connection.execute(
      `INSERT INTO payments
         (payment_number, payment_date, purchase_invoice_id, amount, status, payment_method, notes, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        temporaryPaymentNumber,
        dueDate,
        invoiceId,
        totalAmount,
        effectivePaymentMethod,
        `Pago pendiente - Factura ${invoiceNumber}`,
        userId
      ]
    ).then(([result]) => result);

    const paymentId = paymentResult.insertId;
    const paymentNumber = buildDocumentNumber('PAG', dueDate, paymentId);

    await connection.execute(
      `UPDATE payments SET payment_number = ? WHERE id = ?`,
      [paymentNumber, paymentId]
    );

    // Traceability: link purchase_order -> purchase_invoice if applicable
    if (linkedOrder) {
      await traceabilityService.createDocumentLink(
        'purchase_order',
        'purchase_invoice',
        Number(purchaseOrderId),
        invoiceId,
        'generated',
        connection
      );
    }

    // Link purchase_invoice -> journal_entry and inventory movements through accounting/stock
    await traceabilityService.createDocumentLink(
      'purchase_invoice',
      'journal_entry',
      invoiceId,
      journalEntryId,
      'generated',
      connection
    );

    await traceabilityService.createDocumentLink(
      'purchase_invoice',
      'payment',
      invoiceId,
      paymentId,
      'generated',
      connection
    );

    // Audit log
    await traceabilityService.logAction(
      userId,
      'create',
      'purchase_invoice',
      invoiceId,
      null,
      { supplierId, invoiceNumber, invoiceDate, dueDate, totalAmount, invoiceType: effectiveInvoiceType },
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
        purchaseInvoiceId: invoiceId,
        amount: totalAmount,
        status: 'pending'
      },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Purchase invoice created. Journal entry and pending payment generated successfully',
      data: {
        id: invoiceId,
        invoiceNumber,
        invoiceType: effectiveInvoiceType,
        invoiceDate,
        dueDate,
        totalAmount,
        status: 'pending',
        vatAmount,
        paymentId,
        paymentNumber,
        fixedAssetIds: createdFixedAssetIds
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create purchase invoice error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the purchase invoice',
        status: 500
      }
    });
  }
};

/**
 * ==========================
 * 7.4 Inventory Endpoints
 * ==========================
 */

/**
 * GET /api/inventory
 * View current stock for all items
 */
export const getInventoryStatus = async (req, res) => {
  try {
    const status = await inventoryService.getAllInventoryStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get inventory status error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching inventory status',
        status: 500
      }
    });
  }
};

/**
 * GET /api/inventory/movements
 * View movement history
 * Optional query: itemId, startDate, endDate
 */
export const getInventoryMovements = async (req, res) => {
  try {
    const { itemId, startDate, endDate } = req.query;

    const movements = await inventoryService.getItemMovements(
      itemId ? Number(itemId) : null,
      startDate || null,
      endDate || null
    );

    res.json({
      success: true,
      data: movements
    });
  } catch (error) {
    console.error('Get inventory movements error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching inventory movements',
        status: 500
      }
    });
  }
};

/**
 * POST /api/inventory/adjust
 * Manual inventory adjustment with justification
 * Expects body: { itemId, adjustmentQuantity, justification }
 */
export const createInventoryAdjustment = async (req, res) => {
  let connection = null;

  try {
    const { itemId, adjustmentQuantity, justification } = req.body;
    const userId = getUserId(req);

    if (!itemId || !adjustmentQuantity || !justification) {
      return res.status(400).json({
        error: {
          message: 'itemId, adjustmentQuantity and justification are required',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const movementId = await inventoryService.createAdjustment(
      Number(itemId),
      Number(adjustmentQuantity),
      justification,
      userId,
      connection
    );

    await traceabilityService.logAction(
      userId,
      'adjust',
      'inventory_movement',
      movementId,
      null,
      { itemId, adjustmentQuantity, justification },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Inventory adjustment created successfully',
      data: {
        movementId
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create inventory adjustment error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the inventory adjustment',
        status: 500
      }
    });
  }
};

export default {
  getBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  convertBudgetToOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseInvoices,
  getPurchaseInvoiceById,
  createPurchaseInvoice,
  getInventoryStatus,
  getInventoryMovements,
  createInventoryAdjustment
};

