import { query } from '../config/database.js';

/**
 * Master Data Controller
 * Handles master data operations for items, customers, suppliers
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

/**
 * GET /api/items
 * List all items with optional search by code or description
 * 
 * @param {string} req.query.search - Optional search term for code or description
 * @returns {Array} List of items
 * 
 * Validates: Requirement 15.2, 15.5
 */
export const getItems = async (req, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT id, code, description, unit_of_measure, standard_cost, created_at, updated_at
      FROM items
    `;
    const params = [];

    // Add search filter if provided
    if (search) {
      sql += ` WHERE code LIKE ? OR description LIKE ?`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    sql += ` ORDER BY code ASC`;

    const items = await query(sql, params);

    res.json({
      success: true,
      data: items.map(item => ({
        id: item.id,
        code: item.code,
        description: item.description,
        unitOfMeasure: item.unit_of_measure,
        standardCost: parseFloat(item.standard_cost),
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }))
    });

  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching items',
        status: 500
      }
    });
  }
};

/**
 * POST /api/items
 * Create a new item with unique code validation
 * 
 * @param {string} req.body.code - Unique item code
 * @param {string} req.body.description - Item description
 * @param {string} req.body.unitOfMeasure - Unit of measure
 * @param {number} req.body.standardCost - Standard cost
 * @returns {Object} Created item
 * 
 * Validates: Requirement 15.1, 15.4
 */
export const createItem = async (req, res) => {
  try {
    const { code, description, unitOfMeasure, standardCost } = req.body;

    // Validate required fields
    if (!code || !description || !unitOfMeasure || standardCost === undefined) {
      return res.status(400).json({
        error: {
          message: 'Code, description, unit of measure, and standard cost are required',
          status: 400
        }
      });
    }

    // Validate standard cost is non-negative
    if (standardCost < 0) {
      return res.status(400).json({
        error: {
          message: 'Standard cost must be non-negative',
          status: 400
        }
      });
    }

    // Check if code already exists (unique validation)
    const checkSql = `SELECT id FROM items WHERE code = ?`;
    const existing = await query(checkSql, [code]);

    if (existing.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Item code already exists',
          status: 409
        }
      });
    }

    // Insert new item
    const insertSql = `
      INSERT INTO items (code, description, unit_of_measure, standard_cost)
      VALUES (?, ?, ?, ?)
    `;
    
    const result = await query(insertSql, [code, description, unitOfMeasure, standardCost]);

    // Fetch the created item
    const selectSql = `SELECT * FROM items WHERE id = ?`;
    const items = await query(selectSql, [result.insertId]);
    const item = items[0];

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: {
        id: item.id,
        code: item.code,
        description: item.description,
        unitOfMeasure: item.unit_of_measure,
        standardCost: parseFloat(item.standard_cost),
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }
    });

  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the item',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/items/:id
 * Update an existing item
 * 
 * @param {number} req.params.id - Item ID
 * @param {string} req.body.code - Unique item code
 * @param {string} req.body.description - Item description
 * @param {string} req.body.unitOfMeasure - Unit of measure
 * @param {number} req.body.standardCost - Standard cost
 * @returns {Object} Updated item
 * 
 * Validates: Requirement 15.2, 15.4
 */
export const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, description, unitOfMeasure, standardCost } = req.body;

    // Validate required fields
    if (!code || !description || !unitOfMeasure || standardCost === undefined) {
      return res.status(400).json({
        error: {
          message: 'Code, description, unit of measure, and standard cost are required',
          status: 400
        }
      });
    }

    // Validate standard cost is non-negative
    if (standardCost < 0) {
      return res.status(400).json({
        error: {
          message: 'Standard cost must be non-negative',
          status: 400
        }
      });
    }

    // Check if item exists
    const checkItemSql = `SELECT id FROM items WHERE id = ?`;
    const existingItem = await query(checkItemSql, [id]);

    if (existingItem.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Item not found',
          status: 404
        }
      });
    }

    // Check if code is unique (excluding current item)
    const checkCodeSql = `SELECT id FROM items WHERE code = ? AND id != ?`;
    const duplicateCode = await query(checkCodeSql, [code, id]);

    if (duplicateCode.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Item code already exists',
          status: 409
        }
      });
    }

    // Update item
    const updateSql = `
      UPDATE items
      SET code = ?, description = ?, unit_of_measure = ?, standard_cost = ?
      WHERE id = ?
    `;
    
    await query(updateSql, [code, description, unitOfMeasure, standardCost, id]);

    // Fetch the updated item
    const selectSql = `SELECT * FROM items WHERE id = ?`;
    const items = await query(selectSql, [id]);
    const item = items[0];

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: {
        id: item.id,
        code: item.code,
        description: item.description,
        unitOfMeasure: item.unit_of_measure,
        standardCost: parseFloat(item.standard_cost),
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }
    });

  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the item',
        status: 500
      }
    });
  }
};

/**
 * DELETE /api/items/:id
 * Delete an item if not used in transactions
 * 
 * @param {number} req.params.id - Item ID
 * @returns {Object} Success message
 * 
 * Validates: Requirement 15.3
 */
export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if item exists
    const checkItemSql = `SELECT id FROM items WHERE id = ?`;
    const existingItem = await query(checkItemSql, [id]);

    if (existingItem.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Item not found',
          status: 404
        }
      });
    }

    // Check if item is used in budget lines
    const checkBudgetSql = `SELECT id FROM budget_lines WHERE item_id = ? LIMIT 1`;
    const budgetUsage = await query(checkBudgetSql, [id]);

    if (budgetUsage.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Cannot delete item: it is used in budget transactions',
          status: 409
        }
      });
    }

    // Check if item is used in purchase order lines
    const checkOrderSql = `SELECT id FROM purchase_order_lines WHERE item_id = ? LIMIT 1`;
    const orderUsage = await query(checkOrderSql, [id]);

    if (orderUsage.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Cannot delete item: it is used in purchase order transactions',
          status: 409
        }
      });
    }

    // Check if item is used in purchase invoice lines
    const checkPurchaseInvoiceSql = `SELECT id FROM purchase_invoice_lines WHERE item_id = ? LIMIT 1`;
    const purchaseInvoiceUsage = await query(checkPurchaseInvoiceSql, [id]);

    if (purchaseInvoiceUsage.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Cannot delete item: it is used in purchase invoice transactions',
          status: 409
        }
      });
    }

    // Check if item is used in sales invoice lines
    const checkSalesInvoiceSql = `SELECT id FROM sales_invoice_lines WHERE item_id = ? LIMIT 1`;
    const salesInvoiceUsage = await query(checkSalesInvoiceSql, [id]);

    if (salesInvoiceUsage.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Cannot delete item: it is used in sales invoice transactions',
          status: 409
        }
      });
    }

    // Check if item is used in inventory movements
    const checkInventorySql = `SELECT id FROM inventory_movements WHERE item_id = ? LIMIT 1`;
    const inventoryUsage = await query(checkInventorySql, [id]);

    if (inventoryUsage.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Cannot delete item: it has inventory movements',
          status: 409
        }
      });
    }

    // Delete item
    const deleteSql = `DELETE FROM items WHERE id = ?`;
    await query(deleteSql, [id]);

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });

  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while deleting the item',
        status: 500
      }
    });
  }
};

/**
 * GET /api/customers
 * List all customers with optional search by code or name
 * 
 * @param {string} req.query.search - Optional search term for code or name
 * @returns {Array} List of customers
 * 
 * Validates: Requirement 16.2, 16.5
 */
export const getCustomers = async (req, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT id, code, name, tax_id, address, phone, email, created_at, updated_at
      FROM customers
    `;
    const params = [];

    // Add search filter if provided
    if (search) {
      sql += ` WHERE code LIKE ? OR name LIKE ?`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    sql += ` ORDER BY code ASC`;

    const customers = await query(sql, params);

    res.json({
      success: true,
      data: customers.map(customer => ({
        id: customer.id,
        code: customer.code,
        name: customer.name,
        taxId: customer.tax_id,
        address: customer.address,
        phone: customer.phone,
        email: customer.email,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at
      }))
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching customers',
        status: 500
      }
    });
  }
};

/**
 * POST /api/customers
 * Create a new customer with unique code validation
 * 
 * @param {string} req.body.code - Unique customer code
 * @param {string} req.body.name - Customer name
 * @param {string} req.body.taxId - Tax ID
 * @param {string} req.body.address - Address (optional)
 * @param {string} req.body.phone - Phone (optional)
 * @param {string} req.body.email - Email (optional)
 * @returns {Object} Created customer
 * 
 * Validates: Requirement 16.1, 16.4
 */
export const createCustomer = async (req, res) => {
  try {
    const { code, name, taxId, address, phone, email } = req.body;

    // Validate required fields
    if (!code || !name || !taxId) {
      return res.status(400).json({
        error: {
          message: 'Code, name, and tax ID are required',
          status: 400
        }
      });
    }

    // Check if code already exists (unique validation)
    const checkSql = `SELECT id FROM customers WHERE code = ?`;
    const existing = await query(checkSql, [code]);

    if (existing.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Customer code already exists',
          status: 409
        }
      });
    }

    // Insert new customer
    const insertSql = `
      INSERT INTO customers (code, name, tax_id, address, phone, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await query(insertSql, [code, name, taxId, address || null, phone || null, email || null]);

    // Fetch the created customer
    const selectSql = `SELECT * FROM customers WHERE id = ?`;
    const customers = await query(selectSql, [result.insertId]);
    const customer = customers[0];

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        taxId: customer.tax_id,
        address: customer.address,
        phone: customer.phone,
        email: customer.email,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at
      }
    });

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the customer',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/customers/:id
 * Update an existing customer
 * 
 * @param {number} req.params.id - Customer ID
 * @param {string} req.body.code - Unique customer code
 * @param {string} req.body.name - Customer name
 * @param {string} req.body.taxId - Tax ID
 * @param {string} req.body.address - Address (optional)
 * @param {string} req.body.phone - Phone (optional)
 * @param {string} req.body.email - Email (optional)
 * @returns {Object} Updated customer
 * 
 * Validates: Requirement 16.2, 16.4
 */
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, taxId, address, phone, email } = req.body;

    // Validate required fields
    if (!code || !name || !taxId) {
      return res.status(400).json({
        error: {
          message: 'Code, name, and tax ID are required',
          status: 400
        }
      });
    }

    // Check if customer exists
    const checkCustomerSql = `SELECT id FROM customers WHERE id = ?`;
    const existingCustomer = await query(checkCustomerSql, [id]);

    if (existingCustomer.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Customer not found',
          status: 404
        }
      });
    }

    // Check if code is unique (excluding current customer)
    const checkCodeSql = `SELECT id FROM customers WHERE code = ? AND id != ?`;
    const duplicateCode = await query(checkCodeSql, [code, id]);

    if (duplicateCode.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Customer code already exists',
          status: 409
        }
      });
    }

    // Update customer
    const updateSql = `
      UPDATE customers
      SET code = ?, name = ?, tax_id = ?, address = ?, phone = ?, email = ?
      WHERE id = ?
    `;
    
    await query(updateSql, [code, name, taxId, address || null, phone || null, email || null, id]);

    // Fetch the updated customer
    const selectSql = `SELECT * FROM customers WHERE id = ?`;
    const customers = await query(selectSql, [id]);
    const customer = customers[0];

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        taxId: customer.tax_id,
        address: customer.address,
        phone: customer.phone,
        email: customer.email,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at
      }
    });

  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the customer',
        status: 500
      }
    });
  }
};

/**
 * DELETE /api/customers/:id
 * Delete a customer if not used in transactions
 * 
 * @param {number} req.params.id - Customer ID
 * @returns {Object} Success message
 * 
 * Validates: Requirement 16.3
 */
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const checkCustomerSql = `SELECT id FROM customers WHERE id = ?`;
    const existingCustomer = await query(checkCustomerSql, [id]);

    if (existingCustomer.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Customer not found',
          status: 404
        }
      });
    }

    // Check if customer is used in sales invoices
    const checkSalesInvoiceSql = `SELECT id FROM sales_invoices WHERE customer_id = ? LIMIT 1`;
    const salesInvoiceUsage = await query(checkSalesInvoiceSql, [id]);

    if (salesInvoiceUsage.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Cannot delete customer: it has associated transactions',
          status: 409
        }
      });
    }

    // Delete customer
    const deleteSql = `DELETE FROM customers WHERE id = ?`;
    await query(deleteSql, [id]);

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while deleting the customer',
        status: 500
      }
    });
  }
};

/**
 * GET /api/suppliers
 * List all suppliers with optional search by code or name
 * 
 * @param {string} req.query.search - Optional search term for code or name
 * @returns {Array} List of suppliers
 * 
 * Validates: Requirement 17.2, 17.5
 */
export const getSuppliers = async (req, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT id, code, name, tax_id, address, phone, email, created_at, updated_at
      FROM suppliers
    `;
    const params = [];

    // Add search filter if provided
    if (search) {
      sql += ` WHERE code LIKE ? OR name LIKE ?`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    sql += ` ORDER BY code ASC`;

    const suppliers = await query(sql, params);

    res.json({
      success: true,
      data: suppliers.map(supplier => ({
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        taxId: supplier.tax_id,
        address: supplier.address,
        phone: supplier.phone,
        email: supplier.email,
        createdAt: supplier.created_at,
        updatedAt: supplier.updated_at
      }))
    });

  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching suppliers',
        status: 500
      }
    });
  }
};

/**
 * POST /api/suppliers
 * Create a new supplier with unique code validation
 * 
 * @param {string} req.body.code - Unique supplier code
 * @param {string} req.body.name - Supplier name
 * @param {string} req.body.taxId - Tax ID
 * @param {string} req.body.address - Address (optional)
 * @param {string} req.body.phone - Phone (optional)
 * @param {string} req.body.email - Email (optional)
 * @returns {Object} Created supplier
 * 
 * Validates: Requirement 17.1, 17.4
 */
export const createSupplier = async (req, res) => {
  try {
    const { code, name, taxId, address, phone, email } = req.body;

    // Validate required fields
    if (!code || !name || !taxId) {
      return res.status(400).json({
        error: {
          message: 'Code, name, and tax ID are required',
          status: 400
        }
      });
    }

    // Check if code already exists (unique validation)
    const checkSql = `SELECT id FROM suppliers WHERE code = ?`;
    const existing = await query(checkSql, [code]);

    if (existing.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Supplier code already exists',
          status: 409
        }
      });
    }

    // Insert new supplier
    const insertSql = `
      INSERT INTO suppliers (code, name, tax_id, address, phone, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await query(insertSql, [code, name, taxId, address || null, phone || null, email || null]);

    // Fetch the created supplier
    const selectSql = `SELECT * FROM suppliers WHERE id = ?`;
    const suppliers = await query(selectSql, [result.insertId]);
    const supplier = suppliers[0];

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        taxId: supplier.tax_id,
        address: supplier.address,
        phone: supplier.phone,
        email: supplier.email,
        createdAt: supplier.created_at,
        updatedAt: supplier.updated_at
      }
    });

  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the supplier',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/suppliers/:id
 * Update an existing supplier
 * 
 * @param {number} req.params.id - Supplier ID
 * @param {string} req.body.code - Unique supplier code
 * @param {string} req.body.name - Supplier name
 * @param {string} req.body.taxId - Tax ID
 * @param {string} req.body.address - Address (optional)
 * @param {string} req.body.phone - Phone (optional)
 * @param {string} req.body.email - Email (optional)
 * @returns {Object} Updated supplier
 * 
 * Validates: Requirement 17.2, 17.4
 */
export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, taxId, address, phone, email } = req.body;

    // Validate required fields
    if (!code || !name || !taxId) {
      return res.status(400).json({
        error: {
          message: 'Code, name, and tax ID are required',
          status: 400
        }
      });
    }

    // Check if supplier exists
    const checkSupplierSql = `SELECT id FROM suppliers WHERE id = ?`;
    const existingSupplier = await query(checkSupplierSql, [id]);

    if (existingSupplier.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Supplier not found',
          status: 404
        }
      });
    }

    // Check if code is unique (excluding current supplier)
    const checkCodeSql = `SELECT id FROM suppliers WHERE code = ? AND id != ?`;
    const duplicateCode = await query(checkCodeSql, [code, id]);

    if (duplicateCode.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Supplier code already exists',
          status: 409
        }
      });
    }

    // Update supplier
    const updateSql = `
      UPDATE suppliers
      SET code = ?, name = ?, tax_id = ?, address = ?, phone = ?, email = ?
      WHERE id = ?
    `;
    
    await query(updateSql, [code, name, taxId, address || null, phone || null, email || null, id]);

    // Fetch the updated supplier
    const selectSql = `SELECT * FROM suppliers WHERE id = ?`;
    const suppliers = await query(selectSql, [id]);
    const supplier = suppliers[0];

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        taxId: supplier.tax_id,
        address: supplier.address,
        phone: supplier.phone,
        email: supplier.email,
        createdAt: supplier.created_at,
        updatedAt: supplier.updated_at
      }
    });

  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the supplier',
        status: 500
      }
    });
  }
};

/**
 * DELETE /api/suppliers/:id
 * Delete a supplier if not used in transactions
 * 
 * @param {number} req.params.id - Supplier ID
 * @returns {Object} Success message
 * 
 * Validates: Requirement 17.3
 */
export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier exists
    const checkSupplierSql = `SELECT id FROM suppliers WHERE id = ?`;
    const existingSupplier = await query(checkSupplierSql, [id]);

    if (existingSupplier.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Supplier not found',
          status: 404
        }
      });
    }

    // Check if supplier is used in budgets
    const checkBudgetSql = `SELECT id FROM budgets WHERE supplier_id = ? LIMIT 1`;
    const budgetUsage = await query(checkBudgetSql, [id]);

    if (budgetUsage.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Cannot delete supplier: it has associated transactions',
          status: 409
        }
      });
    }

    // Check if supplier is used in purchase orders
    const checkOrderSql = `SELECT id FROM purchase_orders WHERE supplier_id = ? LIMIT 1`;
    const orderUsage = await query(checkOrderSql, [id]);

    if (orderUsage.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Cannot delete supplier: it has associated transactions',
          status: 409
        }
      });
    }

    // Check if supplier is used in purchase invoices
    const checkInvoiceSql = `SELECT id FROM purchase_invoices WHERE supplier_id = ? LIMIT 1`;
    const invoiceUsage = await query(checkInvoiceSql, [id]);

    if (invoiceUsage.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Cannot delete supplier: it has associated transactions',
          status: 409
        }
      });
    }

    // Delete supplier
    const deleteSql = `DELETE FROM suppliers WHERE id = ?`;
    await query(deleteSql, [id]);

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });

  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while deleting the supplier',
        status: 500
      }
    });
  }
};

/**
 * GET /api/users
 * List all users with optional search by username or full name
 * 
 * @param {string} req.query.search - Optional search term for username or full name
 * @returns {Array} List of users (without passwords)
 * 
 * Validates: Requirement 18.2, 18.5
 */
export const getUsers = async (req, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT id, username, full_name, role, is_active, created_at, updated_at
      FROM users
    `;
    const params = [];

    // Add search filter if provided
    if (search) {
      sql += ` WHERE username LIKE ? OR full_name LIKE ?`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    sql += ` ORDER BY username ASC`;

    const users = await query(sql, params);

    res.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }))
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching users',
        status: 500
      }
    });
  }
};

/**
 * POST /api/users
 * Create a new user with unique username validation
 * 
 * @param {string} req.body.username - Unique username
 * @param {string} req.body.password - User password
 * @param {string} req.body.fullName - Full name
 * @param {string} req.body.role - User role (compras, ventas, contabilidad, tesoreria, administrador)
 * @returns {Object} Created user (without password)
 * 
 * Validates: Requirement 18.1, 18.4
 */
export const createUser = async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;

    // Validate required fields
    if (!username || !password || !fullName || !role) {
      return res.status(400).json({
        error: {
          message: 'Username, password, full name, and role are required',
          status: 400
        }
      });
    }

    // Validate role
    const validRoles = ['compras', 'ventas', 'contabilidad', 'tesoreria', 'administrador'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: {
          message: 'Invalid role. Must be one of: compras, ventas, contabilidad, tesoreria, administrador',
          status: 400
        }
      });
    }

    // Check if username already exists (unique validation)
    const checkSql = `SELECT id FROM users WHERE username = ?`;
    const existing = await query(checkSql, [username]);

    if (existing.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Username already exists',
          status: 409
        }
      });
    }

    // Insert new user (password stored without encryption per requirement 13.4)
    const insertSql = `
      INSERT INTO users (username, password, full_name, role, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `;
    
    const result = await query(insertSql, [username, password, fullName, role]);

    // Fetch the created user (without password)
    const selectSql = `SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?`;
    const users = await query(selectSql, [result.insertId]);
    const user = users[0];

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the user',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/users/:id
 * Update an existing user
 * 
 * @param {number} req.params.id - User ID
 * @param {string} req.body.username - Unique username
 * @param {string} req.body.password - User password (optional, only update if provided)
 * @param {string} req.body.fullName - Full name
 * @param {string} req.body.role - User role
 * @returns {Object} Updated user (without password)
 * 
 * Validates: Requirement 18.2, 18.4
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, fullName, role } = req.body;

    // Validate required fields (password is optional for updates)
    if (!username || !fullName || !role) {
      return res.status(400).json({
        error: {
          message: 'Username, full name, and role are required',
          status: 400
        }
      });
    }

    // Validate role
    const validRoles = ['compras', 'ventas', 'contabilidad', 'tesoreria', 'administrador'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: {
          message: 'Invalid role. Must be one of: compras, ventas, contabilidad, tesoreria, administrador',
          status: 400
        }
      });
    }

    // Check if user exists
    const checkUserSql = `SELECT id FROM users WHERE id = ?`;
    const existingUser = await query(checkUserSql, [id]);

    if (existingUser.length === 0) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }

    // Check if username is unique (excluding current user)
    const checkUsernameSql = `SELECT id FROM users WHERE username = ? AND id != ?`;
    const duplicateUsername = await query(checkUsernameSql, [username, id]);

    if (duplicateUsername.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Username already exists',
          status: 409
        }
      });
    }

    // Update user (update password only if provided)
    let updateSql, params;
    if (password) {
      updateSql = `
        UPDATE users
        SET username = ?, password = ?, full_name = ?, role = ?
        WHERE id = ?
      `;
      params = [username, password, fullName, role, id];
    } else {
      updateSql = `
        UPDATE users
        SET username = ?, full_name = ?, role = ?
        WHERE id = ?
      `;
      params = [username, fullName, role, id];
    }
    
    await query(updateSql, params);

    // Fetch the updated user (without password)
    const selectSql = `SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?`;
    const users = await query(selectSql, [id]);
    const user = users[0];

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the user',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/users/:id/deactivate
 * Deactivate a user without deleting them
 * 
 * @param {number} req.params.id - User ID
 * @returns {Object} Updated user
 * 
 * Validates: Requirement 18.3
 */
export const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const checkUserSql = `SELECT id FROM users WHERE id = ?`;
    const existingUser = await query(checkUserSql, [id]);

    if (existingUser.length === 0) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }

    // Deactivate user
    const updateSql = `UPDATE users SET is_active = FALSE WHERE id = ?`;
    await query(updateSql, [id]);

    // Fetch the updated user
    const selectSql = `SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?`;
    const users = await query(selectSql, [id]);
    const user = users[0];

    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while deactivating the user',
        status: 500
      }
    });
  }
};
