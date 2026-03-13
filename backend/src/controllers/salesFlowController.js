import { query, beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';
import traceabilityService from '../services/traceabilityService.js';

const getUserId = (req) => (req.user?.id || null);

const buildTempNumber = (prefix) => (
  `${prefix}-TMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
);

const buildDocumentNumber = (prefix, dateValue, id) => {
  const year = new Date(dateValue || new Date()).getFullYear();
  return `${prefix}-${year}-${String(id).padStart(5, '0')}`;
};

const getCurrentStockWithConnection = async (connection, itemId) => {
  const [row] = await connection.execute(
    `SELECT COALESCE(SUM(quantity), 0) as current_stock
     FROM inventory_movements
     WHERE item_id = ?`,
    [itemId]
  ).then(([rows]) => rows);

  return parseFloat(row?.current_stock) || 0;
};

/**
 * =========================
 * Sales budgets
 * =========================
 */
export const getSalesBudgets = async (req, res) => {
  try {
    const budgets = await query(
      `SELECT
         sb.id,
         sb.budget_number,
         sb.budget_date,
         sb.total_amount,
         sb.status,
         c.id as customer_id,
         c.name as customer_name
       FROM sales_budgets sb
       JOIN customers c ON c.id = sb.customer_id
       ORDER BY sb.budget_date DESC, sb.id DESC`
    );

    res.json({
      success: true,
      data: budgets.map((b) => ({
        id: b.id,
        budgetNumber: b.budget_number,
        budgetDate: b.budget_date,
        totalAmount: parseFloat(b.total_amount),
        status: b.status,
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
    const [budget] = await query(
      `SELECT
         sb.*,
         c.name as customer_name
       FROM sales_budgets sb
       JOIN customers c ON c.id = sb.customer_id
       WHERE sb.id = ?`,
      [id]
    );

    if (!budget) {
      return res.status(404).json({
        error: {
          message: 'Sales budget not found',
          status: 404
        }
      });
    }

    const lines = await query(
      `SELECT
         sbl.*,
         i.code as item_code,
         i.description as item_description,
         i.unit_of_measure
       FROM sales_budget_lines sbl
       JOIN items i ON i.id = sbl.item_id
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
        totalAmount: parseFloat(budget.total_amount),
        status: budget.status,
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
    const { customerId, budgetDate, notes, lines } = req.body;
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

    const [customer] = await connection.execute(
      'SELECT id FROM customers WHERE id = ?',
      [customerId]
    ).then(([rows]) => rows);

    if (!customer) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Customer not found',
          status: 400
        }
      });
    }

    const temporaryNumber = buildTempNumber('PRESV');
    const header = await connection.execute(
      `INSERT INTO sales_budgets
         (budget_number, customer_id, budget_date, total_amount, status, notes, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [temporaryNumber, customerId, budgetDate, totalAmount, notes || null, userId]
    ).then(([result]) => result);

    const budgetId = header.insertId;
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
      { customerId, budgetDate, totalAmount },
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
        totalAmount,
        status: 'pending'
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

export const convertSalesBudgetToOrder = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const orderDate = new Date().toISOString().split('T')[0];

    connection = await beginTransaction();

    const [budget] = await connection.execute(
      'SELECT * FROM sales_budgets WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!budget) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Sales budget not found',
          status: 404
        }
      });
    }

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
      `SELECT * FROM sales_budget_lines WHERE sales_budget_id = ?`,
      [id]
    ).then(([rows]) => rows);

    if (!lines.length) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Sales budget has no lines and cannot be converted',
          status: 400
        }
      });
    }

    const temporaryNumber = buildTempNumber('PEDV');
    const orderHeader = await connection.execute(
      `INSERT INTO sales_orders
         (order_number, customer_id, sales_budget_id, order_date, total_amount, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [temporaryNumber, budget.customer_id, budget.id, orderDate, budget.total_amount, budget.notes, userId]
    ).then(([result]) => result);

    const orderId = orderHeader.insertId;
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

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Sales budget converted to sales order successfully',
      data: {
        orderId,
        orderNumber,
        status: 'draft'
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Convert sales budget to order error:', error);
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
 * Sales orders
 * =========================
 */
export const getSalesOrders = async (req, res) => {
  try {
    const orders = await query(
      `SELECT
         so.id,
         so.order_number,
         so.order_date,
         so.total_amount,
         so.status,
         c.id as customer_id,
         c.name as customer_name
       FROM sales_orders so
       JOIN customers c ON c.id = so.customer_id
       ORDER BY so.order_date DESC, so.id DESC`
    );

    res.json({
      success: true,
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        orderDate: o.order_date,
        totalAmount: parseFloat(o.total_amount),
        status: o.status,
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

    const [order] = await query(
      `SELECT
         so.*,
         c.name as customer_name
       FROM sales_orders so
       JOIN customers c ON c.id = so.customer_id
       WHERE so.id = ?`,
      [id]
    );

    if (!order) {
      return res.status(404).json({
        error: {
          message: 'Sales order not found',
          status: 404
        }
      });
    }

    const lines = await query(
      `SELECT
         sol.*,
         i.code as item_code,
         i.description as item_description,
         i.unit_of_measure
       FROM sales_order_lines sol
       JOIN items i ON i.id = sol.item_id
       WHERE sol.sales_order_id = ?
       ORDER BY sol.id`,
      [id]
    );

    const traceability = await traceabilityService.getTraceabilityChain('sales_order', Number(id));

    res.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        orderDate: order.order_date,
        totalAmount: parseFloat(order.total_amount),
        status: order.status,
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
          suppliedQuantity: parseFloat(line.supplied_quantity),
          unitPrice: parseFloat(line.unit_price),
          lineTotal: parseFloat(line.line_total),
          unitOfMeasure: line.unit_of_measure
        })),
        traceability
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
    const { customerId, orderDate, notes, lines } = req.body;
    const userId = getUserId(req);
    const effectiveOrderDate = orderDate || new Date().toISOString().split('T')[0];

    if (!customerId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Customer and at least one line are required',
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

    const [customer] = await connection.execute(
      'SELECT id FROM customers WHERE id = ?',
      [customerId]
    ).then(([rows]) => rows);

    if (!customer) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Customer not found',
          status: 400
        }
      });
    }

    const temporaryNumber = buildTempNumber('PEDV');
    const header = await connection.execute(
      `INSERT INTO sales_orders
         (order_number, customer_id, order_date, total_amount, status, notes, created_by)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      [temporaryNumber, customerId, effectiveOrderDate, totalAmount, notes || null, userId]
    ).then(([result]) => result);

    const orderId = header.insertId;
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

    await traceabilityService.logAction(
      userId,
      'create',
      'sales_order',
      orderId,
      null,
      { customerId, orderDate: effectiveOrderDate, totalAmount },
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
        totalAmount,
        status: 'draft'
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

export const confirmSalesOrder = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const { fallbackSupplierId } = req.body || {};
    const userId = getUserId(req);

    connection = await beginTransaction();

    const [order] = await connection.execute(
      `SELECT * FROM sales_orders WHERE id = ? FOR UPDATE`,
      [id]
    ).then(([rows]) => rows);

    if (!order) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Sales order not found',
          status: 404
        }
      });
    }

    if (!['draft', 'pending_stock'].includes(order.status)) {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: `Sales order cannot be confirmed from status '${order.status}'`,
          status: 409
        }
      });
    }

    const lines = await connection.execute(
      `SELECT
         sol.*,
         i.code as item_code,
         i.description as item_description,
         i.standard_cost
       FROM sales_order_lines sol
       JOIN items i ON i.id = sol.item_id
       WHERE sol.sales_order_id = ?
       ORDER BY sol.id`,
      [id]
    ).then(([rows]) => rows);

    if (!lines.length) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Sales order has no lines',
          status: 400
        }
      });
    }

    const shortages = [];
    for (const line of lines) {
      const requestedQty = parseFloat(line.quantity) || 0;
      const currentStock = await getCurrentStockWithConnection(connection, line.item_id);
      const shortageQty = Math.max(requestedQty - currentStock, 0);

      if (shortageQty > 0) {
        shortages.push({
          itemId: line.item_id,
          itemCode: line.item_code,
          itemDescription: line.item_description,
          requestedQty,
          availableQty: currentStock,
          shortageQty,
          unitPrice: parseFloat(line.standard_cost) || parseFloat(line.unit_price) || 0
        });
      }
    }

    let generatedPurchaseOrder = null;
    let nextStatus = 'ready_to_invoice';

    if (shortages.length > 0) {
      let supplierId = fallbackSupplierId ? Number(fallbackSupplierId) : null;

      if (supplierId) {
        const [supplier] = await connection.execute(
          `SELECT id FROM suppliers WHERE id = ?`,
          [supplierId]
        ).then(([rows]) => rows);
        if (!supplier) {
          await rollbackTransaction(connection);
          return res.status(400).json({
            error: {
              message: 'Fallback supplier not found',
              status: 400
            }
          });
        }
      } else {
        const [defaultSupplier] = await connection.execute(
          `SELECT id FROM suppliers ORDER BY id ASC LIMIT 1`
        ).then(([rows]) => rows);

        if (!defaultSupplier) {
          await rollbackTransaction(connection);
          return res.status(400).json({
            error: {
              message: 'No suppliers available to auto-generate purchase order',
              status: 400
            }
          });
        }
        supplierId = defaultSupplier.id;
      }

      const purchaseTotal = shortages.reduce(
        (sum, row) => sum + (row.shortageQty * row.unitPrice),
        0
      );

      const orderDate = new Date().toISOString().split('T')[0];
      const temporaryNumber = buildTempNumber('PED');
      const purchaseHeader = await connection.execute(
        `INSERT INTO purchase_orders
           (order_number, supplier_id, order_date, total_amount, status, notes, created_by)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        [
          temporaryNumber,
          supplierId,
          orderDate,
          purchaseTotal,
          `Auto-generado por pedido de venta ${order.order_number}`,
          userId
        ]
      ).then(([result]) => result);

      const purchaseOrderId = purchaseHeader.insertId;
      const purchaseOrderNumber = buildDocumentNumber('PED', orderDate, purchaseOrderId);

      await connection.execute(
        `UPDATE purchase_orders SET order_number = ? WHERE id = ?`,
        [purchaseOrderNumber, purchaseOrderId]
      );

      for (const row of shortages) {
        const lineTotal = row.shortageQty * row.unitPrice;
        await connection.execute(
          `INSERT INTO purchase_order_lines
             (purchase_order_id, item_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?)`,
          [purchaseOrderId, row.itemId, row.shortageQty, row.unitPrice, lineTotal]
        );
      }

      await traceabilityService.createDocumentLink(
        'sales_order',
        'purchase_order',
        Number(id),
        purchaseOrderId,
        'procurement',
        connection
      );

      generatedPurchaseOrder = {
        id: purchaseOrderId,
        orderNumber: purchaseOrderNumber,
        totalAmount: purchaseTotal,
        supplierId
      };
      nextStatus = 'pending_stock';
    }

    await connection.execute(
      `UPDATE sales_orders SET status = ? WHERE id = ?`,
      [nextStatus, id]
    );

    await traceabilityService.logAction(
      userId,
      'confirm',
      'sales_order',
      Number(id),
      { status: order.status },
      { status: nextStatus, generatedPurchaseOrder },
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: nextStatus === 'pending_stock'
        ? 'Sales order confirmed with shortages. Purchase order generated automatically.'
        : 'Sales order confirmed and ready to invoice',
      data: {
        id: Number(id),
        status: nextStatus,
        shortages,
        generatedPurchaseOrder
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Confirm sales order error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while confirming the sales order',
        status: 500
      }
    });
  }
};

export default {
  getSalesBudgets,
  getSalesBudgetById,
  createSalesBudget,
  convertSalesBudgetToOrder,
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  confirmSalesOrder
};
