import { query, beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';
import inventoryService from '../services/inventoryService.js';
import accountingService from '../services/accountingService.js';
import traceabilityService from '../services/traceabilityService.js';

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

export const getSalesCatalogCustomers = async (req, res) => {
  try {
    const customers = await query(
      `SELECT id, code, name
       FROM customers
       ORDER BY code ASC`
    );

    res.json({
      success: true,
      data: customers.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name
      }))
    });
  } catch (error) {
    console.error('Get sales catalog customers error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching customers catalog',
        status: 500
      }
    });
  }
};

export const getSalesCatalogItems = async (req, res) => {
  try {
    const items = await query(
      `SELECT id, code, description, unit_of_measure, standard_cost
       FROM items
       ORDER BY code ASC`
    );

    res.json({
      success: true,
      data: items.map((i) => ({
        id: i.id,
        code: i.code,
        description: i.description,
        unitOfMeasure: i.unit_of_measure,
        standardCost: parseFloat(i.standard_cost)
      }))
    });
  } catch (error) {
    console.error('Get sales catalog items error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching items catalog',
        status: 500
      }
    });
  }
};

/**
 * =========================
 * Sales Budgets Endpoints
 * =========================
 */

export const getSalesBudgets = async (req, res) => {
  try {
    const budgets = await query(
      `SELECT
         sb.id,
         sb.budget_number,
         sb.budget_date,
         sb.status,
         sb.total_amount,
         c.id as customer_id,
         c.name as customer_name
       FROM sales_budgets sb
       JOIN customers c ON sb.customer_id = c.id
       ORDER BY sb.budget_date DESC, sb.id DESC`
    );

    res.json({
      success: true,
      data: budgets.map((b) => ({
        id: b.id,
        budgetNumber: b.budget_number,
        budgetDate: b.budget_date,
        status: b.status,
        totalAmount: parseFloat(b.total_amount),
        customer: {
          id: b.customer_id,
          name: b.customer_name
        }
      }))
    });
  } catch (error) {
    console.error('Get sales budgets error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching sales budgets',
        status: 500
      }
    });
  }
};

export const getSalesBudgetById = async (req, res) => {
  try {
    const { id } = req.params;

    const budgets = await query(
      `SELECT
         sb.*,
         c.name as customer_name
       FROM sales_budgets sb
       JOIN customers c ON sb.customer_id = c.id
       WHERE sb.id = ?`,
      [id]
    );

    if (!budgets || budgets.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Sales budget not found',
          status: 404
        }
      });
    }

    const budget = budgets[0];

    const lines = await query(
      `SELECT
         sbl.*,
         i.code as item_code,
         i.description as item_description,
         i.unit_of_measure
       FROM sales_budget_lines sbl
       JOIN items i ON sbl.item_id = i.id
       WHERE sbl.sales_budget_id = ?
       ORDER BY sbl.id`,
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
        customer: {
          id: budget.customer_id,
          name: budget.customer_name
        },
        lines: lines.map((line) => ({
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
    console.error('Get sales budget by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the sales budget',
        status: 500
      }
    });
  }
};

export const createSalesBudget = async (req, res) => {
  let connection = null;

  try {
    const { customerId, budgetDate, lines } = req.body;
    const userId = getUserId(req);

    if (!customerId || !budgetDate || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Customer, budget date and at least one line are required',
          status: 400
        }
      });
    }

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

    const temporaryBudgetNumber = buildTempNumber('PRESV');

    const headerResult = await connection.execute(
      `INSERT INTO sales_budgets
         (budget_number, budget_date, customer_id, status, total_amount, created_by)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [temporaryBudgetNumber, budgetDate, customerId, totalAmount, userId]
    ).then(([result]) => result);

    const budgetId = headerResult.insertId;
    const budgetNumber = buildDocumentNumber('PRESV', budgetDate, budgetId);

    await connection.execute(
      `UPDATE sales_budgets SET budget_number = ? WHERE id = ?`,
      [budgetNumber, budgetId]
    );

    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const lineTotal = quantity * unitPrice;

      await connection.execute(
        `INSERT INTO sales_budget_lines
           (sales_budget_id, item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [budgetId, line.itemId, quantity, unitPrice, lineTotal]
      );
    }

    await traceabilityService.logAction(
      userId,
      'create',
      'sales_budget',
      budgetId,
      null,
      { customerId, budgetDate, totalAmount, status: 'pending' },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Sales budget created successfully',
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
    console.error('Create sales budget error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the sales budget',
        status: 500
      }
    });
  }
};

export const updateSalesBudget = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const { customerId, budgetDate, lines } = req.body;
    const userId = getUserId(req);

    if (!customerId || !budgetDate || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Customer, budget date and at least one line are required',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const budgets = await connection.execute(
      'SELECT * FROM sales_budgets WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!budgets || budgets.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Sales budget not found',
          status: 404
        }
      });
    }

    const existing = budgets[0];

    if (existing.status === 'converted') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Sales budget is already converted and cannot be updated',
          status: 409
        }
      });
    }

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

    await connection.execute('DELETE FROM sales_budget_lines WHERE sales_budget_id = ?', [id]);

    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const lineTotal = quantity * unitPrice;

      await connection.execute(
        `INSERT INTO sales_budget_lines
           (sales_budget_id, item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [id, line.itemId, quantity, unitPrice, lineTotal]
      );
    }

    await connection.execute(
      `UPDATE sales_budgets
         SET customer_id = ?, budget_date = ?, total_amount = ?
       WHERE id = ?`,
      [customerId, budgetDate, totalAmount, id]
    );

    await traceabilityService.logAction(
      userId,
      'update',
      'sales_budget',
      Number(id),
      {
        customerId: existing.customer_id,
        budgetDate: existing.budget_date,
        totalAmount: parseFloat(existing.total_amount),
        status: existing.status
      },
      {
        customerId,
        budgetDate,
        totalAmount,
        status: existing.status
      },
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: 'Sales budget updated successfully',
      data: {
        id: Number(id),
        customerId,
        budgetDate,
        totalAmount,
        status: existing.status
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Update sales budget error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the sales budget',
        status: 500
      }
    });
  }
};

export const deleteSalesBudget = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const userId = getUserId(req);

    connection = await beginTransaction();

    const budgets = await connection.execute(
      'SELECT * FROM sales_budgets WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!budgets || budgets.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Sales budget not found',
          status: 404
        }
      });
    }

    const existing = budgets[0];

    if (existing.status === 'converted') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Sales budget is already converted and cannot be deleted',
          status: 409
        }
      });
    }

    const canDelete = await traceabilityService.canDeleteDocument('sales_budget', Number(id));
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

    await connection.execute('DELETE FROM sales_budget_lines WHERE sales_budget_id = ?', [id]);
    await connection.execute('DELETE FROM sales_budgets WHERE id = ?', [id]);

    await traceabilityService.logAction(
      userId,
      'delete',
      'sales_budget',
      Number(id),
      {
        customerId: existing.customer_id,
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
      message: 'Sales budget deleted successfully'
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Delete sales budget error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while deleting the sales budget',
        status: 500
      }
    });
  }
};

export const convertSalesBudgetToOrder = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const userId = getUserId(req);

    connection = await beginTransaction();

    const budgets = await connection.execute(
      'SELECT * FROM sales_budgets WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!budgets || budgets.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Sales budget not found',
          status: 404
        }
      });
    }

    const budget = budgets[0];

    if (budget.status === 'converted') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Sales budget is already converted',
          status: 409
        }
      });
    }

    const lines = await connection.execute(
      'SELECT * FROM sales_budget_lines WHERE sales_budget_id = ?',
      [id]
    ).then(([rows]) => rows);

    if (!lines || lines.length === 0) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Sales budget has no lines and cannot be converted',
          status: 400
        }
      });
    }

    const orderDate = new Date().toISOString().split('T')[0];
    const temporaryOrderNumber = buildTempNumber('PEDV');

    const orderResult = await connection.execute(
      `INSERT INTO sales_orders
         (order_number, order_date, customer_id, sales_budget_id, status, total_amount, created_by)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      [temporaryOrderNumber, orderDate, budget.customer_id, Number(id), budget.total_amount, userId]
    ).then(([result]) => result);

    const orderId = orderResult.insertId;
    const orderNumber = buildDocumentNumber('PEDV', orderDate, orderId);

    await connection.execute(
      `UPDATE sales_orders SET order_number = ? WHERE id = ?`,
      [orderNumber, orderId]
    );

    for (const line of lines) {
      await connection.execute(
        `INSERT INTO sales_order_lines
           (sales_order_id, item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, line.item_id, line.quantity, line.unit_price, line.line_total]
      );
    }

    await connection.execute(
      `UPDATE sales_budgets SET status = 'converted' WHERE id = ?`,
      [id]
    );

    await traceabilityService.createDocumentLink(
      'sales_budget',
      'sales_order',
      Number(id),
      orderId,
      'converted_to',
      connection
    );

    await traceabilityService.logAction(
      userId,
      'convert',
      'sales_budget',
      Number(id),
      { status: budget.status },
      { status: 'converted', salesOrderId: orderId },
      connection
    );

    await traceabilityService.logAction(
      userId,
      'create',
      'sales_order',
      orderId,
      null,
      { orderNumber, customerId: budget.customer_id, totalAmount: parseFloat(budget.total_amount) },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Sales budget converted to sales order successfully',
      data: {
        orderId,
        orderNumber,
        status: 'draft',
        totalAmount: parseFloat(budget.total_amount)
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Convert sales budget error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while converting the sales budget',
        status: 500
      }
    });
  }
};

/**
 * =========================
 * Sales Orders Endpoints
 * =========================
 */

export const getSalesOrders = async (req, res) => {
  try {
    const orders = await query(
      `SELECT
         so.id,
         so.order_number,
         so.order_date,
         so.status,
         so.total_amount,
         c.id as customer_id,
         c.name as customer_name
       FROM sales_orders so
       JOIN customers c ON so.customer_id = c.id
       ORDER BY so.order_date DESC, so.id DESC`
    );

    res.json({
      success: true,
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        orderDate: o.order_date,
        status: o.status,
        totalAmount: parseFloat(o.total_amount),
        customer: {
          id: o.customer_id,
          name: o.customer_name
        }
      }))
    });
  } catch (error) {
    console.error('Get sales orders error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching sales orders',
        status: 500
      }
    });
  }
};

export const getSalesOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const orders = await query(
      `SELECT
         so.*,
         c.name as customer_name
       FROM sales_orders so
       JOIN customers c ON so.customer_id = c.id
       WHERE so.id = ?`,
      [id]
    );

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Sales order not found',
          status: 404
        }
      });
    }

    const order = orders[0];

    const lines = await query(
      `SELECT
         sol.*,
         i.code as item_code,
         i.description as item_description,
         i.unit_of_measure
       FROM sales_order_lines sol
       JOIN items i ON sol.item_id = i.id
       WHERE sol.sales_order_id = ?
       ORDER BY sol.id`,
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
        customer: {
          id: order.customer_id,
          name: order.customer_name
        },
        lines: lines.map((line) => ({
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
    console.error('Get sales order by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the sales order',
        status: 500
      }
    });
  }
};

export const createSalesOrder = async (req, res) => {
  let connection = null;

  try {
    const { customerId, orderDate, salesBudgetId, lines } = req.body;
    const userId = getUserId(req);

    if (!customerId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Customer and at least one line are required',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    let linkedBudget = null;
    if (salesBudgetId) {
      const budgets = await connection.execute(
        'SELECT * FROM sales_budgets WHERE id = ? FOR UPDATE',
        [salesBudgetId]
      ).then(([rows]) => rows);

      if (!budgets || budgets.length === 0) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Sales budget not found for provided salesBudgetId',
            status: 400
          }
        });
      }

      linkedBudget = budgets[0];

      if (linkedBudget.status === 'converted') {
        await rollbackTransaction(connection);
        return res.status(409).json({
          error: {
            message: 'Sales budget is already converted',
            status: 409
          }
        });
      }
    }

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
    const temporaryOrderNumber = buildTempNumber('PEDV');

    const headerResult = await connection.execute(
      `INSERT INTO sales_orders
         (order_number, order_date, customer_id, sales_budget_id, status, total_amount, created_by)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      [temporaryOrderNumber, effectiveOrderDate, customerId, salesBudgetId || null, totalAmount, userId]
    ).then(([result]) => result);

    const orderId = headerResult.insertId;
    const orderNumber = buildDocumentNumber('PEDV', effectiveOrderDate, orderId);

    await connection.execute(
      `UPDATE sales_orders SET order_number = ? WHERE id = ?`,
      [orderNumber, orderId]
    );

    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const lineTotal = quantity * unitPrice;

      await connection.execute(
        `INSERT INTO sales_order_lines
           (sales_order_id, item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, line.itemId, quantity, unitPrice, lineTotal]
      );
    }

    if (linkedBudget) {
      await connection.execute(
        `UPDATE sales_budgets SET status = 'converted' WHERE id = ?`,
        [salesBudgetId]
      );

      await traceabilityService.createDocumentLink(
        'sales_budget',
        'sales_order',
        Number(salesBudgetId),
        orderId,
        'converted_to',
        connection
      );

      await traceabilityService.logAction(
        userId,
        'convert',
        'sales_budget',
        Number(salesBudgetId),
        { status: linkedBudget.status },
        { status: 'converted', salesOrderId: orderId },
        connection
      );
    }

    await traceabilityService.logAction(
      userId,
      'create',
      'sales_order',
      orderId,
      null,
      { orderNumber, customerId, totalAmount },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Sales order created successfully',
      data: {
        id: orderId,
        orderNumber,
        orderDate: effectiveOrderDate,
        status: 'draft',
        totalAmount
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create sales order error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the sales order',
        status: 500
      }
    });
  }
};

export const updateSalesOrderStatus = async (req, res) => {
  let connection = null;
  let generatedInvoiceNumber = null;
  let generatedCollectionNumber = null;

  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = getUserId(req);

    const allowedStatuses = ['draft', 'pending_stock', 'ready_to_invoice', 'invoiced', 'cancelled'];
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
      'SELECT * FROM sales_orders WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!orders || orders.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Sales order not found',
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
      draft: ['pending_stock', 'ready_to_invoice', 'cancelled'],
      pending_stock: ['ready_to_invoice', 'cancelled'],
      ready_to_invoice: ['invoiced', 'cancelled'],
      invoiced: [],
      cancelled: []
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
      'UPDATE sales_orders SET status = ? WHERE id = ?',
      [status, id]
    );

    let salesInvoiceId = null;
    let journalEntryId = null;
    let collectionId = null;

    if (status === 'invoiced') {
      const [alreadyGenerated] = await connection.execute(
        `SELECT COUNT(*) as count
         FROM document_links
         WHERE source_document_type = 'sales_order'
           AND source_document_id = ?
           AND target_document_type = 'sales_invoice'`,
        [id]
      ).then(([rows]) => rows);

      if ((alreadyGenerated?.count || 0) > 0) {
        await rollbackTransaction(connection);
        return res.status(409).json({
          error: {
            message: 'This sales order already has a generated sales invoice',
            status: 409
          }
        });
      }

      const orderLines = await connection.execute(
        'SELECT * FROM sales_order_lines WHERE sales_order_id = ?',
        [id]
      ).then(([rows]) => rows);

      if (!orderLines || orderLines.length === 0) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Cannot invoice order without lines',
            status: 400
          }
        });
      }

      for (const line of orderLines) {
        const currentStock = await inventoryService.calculateCurrentStock(line.item_id);
        if (currentStock < Number(line.quantity)) {
          await rollbackTransaction(connection);
          return res.status(409).json({
            error: {
              message: `Insufficient stock for item ${line.item_id}. Available: ${currentStock}, requested: ${line.quantity}`,
              status: 409
            }
          });
        }
      }

      const invoiceDate = new Date().toISOString().split('T')[0];
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + 90);
      const dueDate = dueDateObj.toISOString().split('T')[0];
      const vatRate = 0.21;
      const baseTotalAmount = Number(existing.total_amount);
      const grossTotalAmount = Number((baseTotalAmount * (1 + vatRate)).toFixed(2));
      const temporaryInvoiceNumber = buildTempNumber('FAV');

      const headerResult = await connection.execute(
        `INSERT INTO sales_invoices
           (invoice_number, invoice_date, due_date, customer_id, sales_order_id, total_amount, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [temporaryInvoiceNumber, invoiceDate, dueDate, existing.customer_id, Number(id), grossTotalAmount, userId]
      ).then(([result]) => result);

      salesInvoiceId = headerResult.insertId;
      const invoiceNumber = buildDocumentNumber('FAV', invoiceDate, salesInvoiceId);
      generatedInvoiceNumber = invoiceNumber;

      await connection.execute(
        `UPDATE sales_invoices SET invoice_number = ? WHERE id = ?`,
        [invoiceNumber, salesInvoiceId]
      );

      for (const line of orderLines) {
        await connection.execute(
          `INSERT INTO sales_invoice_lines
             (sales_invoice_id, item_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?)`,
          [salesInvoiceId, line.item_id, line.quantity, line.unit_price, line.line_total]
        );

        await inventoryService.createOutboundMovement(
          line.item_id,
          Number(line.quantity),
          'sales_invoice',
          salesInvoiceId,
          userId,
          null,
          connection
        );
      }

      journalEntryId = await accountingService.generateSalesInvoiceEntry(
        salesInvoiceId,
        connection,
        {
          includeVAT: true,
          vatRate,
          outputTaxAccountCode: '477'
        }
      );

      const temporaryCollectionNumber = buildTempNumber('COB');
      const collectionResult = await connection.execute(
        `INSERT INTO collections
           (collection_number, collection_date, sales_invoice_id, amount, status, payment_method, notes, created_by)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [temporaryCollectionNumber, dueDate, salesInvoiceId, grossTotalAmount, 'bank_transfer', `Cobro pendiente - Factura ${invoiceNumber}`, userId]
      ).then(([r]) => r);

      collectionId = collectionResult.insertId;
      const collectionNumber = buildDocumentNumber('COB', dueDate, collectionId);
      generatedCollectionNumber = collectionNumber;

      await connection.execute(
        `UPDATE collections SET collection_number = ? WHERE id = ?`,
        [collectionNumber, collectionId]
      );

      await traceabilityService.createDocumentLink(
        'sales_order',
        'sales_invoice',
        Number(id),
        salesInvoiceId,
        'generated',
        connection
      );

      await traceabilityService.createDocumentLink(
        'sales_invoice',
        'journal_entry',
        salesInvoiceId,
        journalEntryId,
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
        { invoiceNumber, totalAmount: grossTotalAmount, salesOrderId: Number(id) },
        connection
      );

      await traceabilityService.logAction(
        userId,
        'create',
        'collection',
        collectionId,
        null,
        { collectionNumber, amount: grossTotalAmount, salesInvoiceId },
        connection
      );
    }

    await traceabilityService.logAction(
      userId,
      'update',
      'sales_order',
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

    if (status === 'invoiced') {
      responseData.generated = {
        salesInvoiceId,
        invoiceNumber: generatedInvoiceNumber,
        journalEntryId,
        collectionId,
        collectionNumber: generatedCollectionNumber
      };
    }

    res.json({
      success: true,
      message: status === 'invoiced'
        ? 'Sales order invoiced. Sales invoice, journal entry, inventory movement and pending collection generated successfully'
        : 'Sales order status updated successfully',
      data: responseData
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Update sales order status error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the sales order status',
        status: 500
      }
    });
  }
};

export default {
  getSalesCatalogCustomers,
  getSalesCatalogItems,
  getSalesBudgets,
  getSalesBudgetById,
  createSalesBudget,
  updateSalesBudget,
  deleteSalesBudget,
  convertSalesBudgetToOrder,
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrderStatus
};
