import { query } from '../config/database.js';

/**
 * InventoryService - Manages inventory based on movements (no direct stock field)
 * Stock is always calculated as the sum of all movements (inbound - outbound)
 * Ensures complete traceability and historical accuracy
 */
class InventoryService {
  /**
   * Creates an inbound inventory movement (entry)
   * Used when receiving goods from purchase invoices or manual adjustments
   * 
   * @param {number} itemId - Item ID
   * @param {number} quantity - Quantity received (positive number)
   * @param {number} unitCost - Unit cost of the item
   * @param {string} sourceDocType - Source document type ('purchase_invoice', 'adjustment')
   * @param {number} sourceDocId - Source document ID
   * @param {number} userId - User creating the movement
   * @param {string} notes - Optional notes
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created movement ID
   */
  async createInboundMovement(itemId, quantity, unitCost, sourceDocType, sourceDocId, userId, notes = null, connection = null) {
    const executeQuery = connection 
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      // Validate inputs
      if (quantity <= 0) {
        throw new Error('Inbound quantity must be positive');
      }

      if (unitCost < 0) {
        throw new Error('Unit cost cannot be negative');
      }

      // Verify item exists
      const [item] = await executeQuery(
        'SELECT id, code, description FROM items WHERE id = ?',
        [itemId]
      );

      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      const totalValue = quantity * unitCost;
      const movementDate = new Date().toISOString().split('T')[0];

      // Create inbound movement
      const result = await executeQuery(
        `INSERT INTO inventory_movements 
         (item_id, movement_date, movement_type, quantity, unit_cost, total_value, 
          source_document_type, source_document_id, notes, created_by)
         VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, movementDate, quantity, unitCost, totalValue, sourceDocType, sourceDocId, notes, userId]
      );

      return result.insertId;
    } catch (error) {
      console.error('Error creating inbound movement:', error);
      throw error;
    }
  }

  /**
   * Creates an outbound inventory movement (exit)
   * Used when goods are sold, consumed, or adjusted out
   * 
   * @param {number} itemId - Item ID
   * @param {number} quantity - Quantity to exit (positive number, will be stored as negative)
   * @param {string} sourceDocType - Source document type ('sales_invoice', 'adjustment')
   * @param {number} sourceDocId - Source document ID
   * @param {number} userId - User creating the movement
   * @param {string} notes - Optional notes
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created movement ID
   */
  async createOutboundMovement(itemId, quantity, sourceDocType, sourceDocId, userId, notes = null, connection = null) {
    const executeQuery = connection 
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      // Validate inputs
      if (quantity <= 0) {
        throw new Error('Outbound quantity must be positive');
      }

      // Verify item exists
      const [item] = await executeQuery(
        'SELECT id, code, description FROM items WHERE id = ?',
        [itemId]
      );

      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      // Check current stock to prevent negative inventory
      const currentStock = await this.calculateCurrentStock(itemId);
      
      if (currentStock < quantity) {
        throw new Error(
          `Insufficient stock for item ${item.code}. Available: ${currentStock}, Requested: ${quantity}`
        );
      }

      // Calculate average unit cost from existing inventory
      const avgCost = await this.calculateAverageUnitCost(itemId);
      const totalValue = -(quantity * avgCost); // Negative value for outbound
      const movementDate = new Date().toISOString().split('T')[0];

      // Create outbound movement (quantity stored as negative)
      const result = await executeQuery(
        `INSERT INTO inventory_movements 
         (item_id, movement_date, movement_type, quantity, unit_cost, total_value, 
          source_document_type, source_document_id, notes, created_by)
         VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, movementDate, -quantity, avgCost, totalValue, sourceDocType, sourceDocId, notes, userId]
      );

      return result.insertId;
    } catch (error) {
      console.error('Error creating outbound movement:', error);
      throw error;
    }
  }

  /**
   * Calculates current stock for a specific item
   * Stock = SUM of all movements (inbound positive, outbound negative)
   * 
   * @param {number} itemId - Item ID
   * @returns {Promise<number>} Current stock quantity
   */
  async calculateCurrentStock(itemId) {
    try {
      const [result] = await query(
        `SELECT COALESCE(SUM(quantity), 0) as current_stock
         FROM inventory_movements
         WHERE item_id = ?`,
        [itemId]
      );

      return parseFloat(result.current_stock) || 0;
    } catch (error) {
      console.error('Error calculating current stock:', error);
      throw error;
    }
  }

  /**
   * Calculates average unit cost for an item based on current inventory
   * Used for outbound movements to determine cost
   * 
   * @param {number} itemId - Item ID
   * @returns {Promise<number>} Average unit cost
   */
  async calculateAverageUnitCost(itemId) {
    try {
      const [result] = await query(
        `SELECT 
          COALESCE(SUM(total_value), 0) as total_value,
          COALESCE(SUM(quantity), 0) as total_quantity
         FROM inventory_movements
         WHERE item_id = ?`,
        [itemId]
      );

      const totalValue = parseFloat(result.total_value) || 0;
      const totalQuantity = parseFloat(result.total_quantity) || 0;

      // If no inventory, return 0
      if (totalQuantity <= 0) {
        return 0;
      }

      return totalValue / totalQuantity;
    } catch (error) {
      console.error('Error calculating average unit cost:', error);
      throw error;
    }
  }

  /**
   * Calculates total inventory value across all items
   * Total value = SUM of all movement values
   * 
   * @returns {Promise<number>} Total inventory value
   */
  async calculateTotalInventoryValue() {
    try {
      const [result] = await query(
        `SELECT COALESCE(SUM(total_value), 0) as total_inventory_value
         FROM inventory_movements`
      );

      return parseFloat(result.total_inventory_value) || 0;
    } catch (error) {
      console.error('Error calculating total inventory value:', error);
      throw error;
    }
  }

  /**
   * Retrieves movement history for one item or all items
   * Optionally filtered by date range
   * 
   * @param {number|null} itemId - Item ID (optional, null for all items)
   * @param {string} startDate - Start date (YYYY-MM-DD, optional)
   * @param {string} endDate - End date (YYYY-MM-DD, optional)
   * @returns {Promise<Array>} Array of movement records
   */
  async getItemMovements(itemId = null, startDate = null, endDate = null) {
    try {
      let sql = `
        SELECT 
          im.*,
          i.code as item_code,
          i.description as item_description,
          u.username as created_by_username,
          u.full_name as created_by_name
        FROM inventory_movements im
        JOIN items i ON im.item_id = i.id
        JOIN users u ON im.created_by = u.id
        WHERE 1 = 1
      `;

      const params = [];

      if (itemId) {
        sql += ' AND im.item_id = ?';
        params.push(itemId);
      }

      if (startDate) {
        sql += ' AND im.movement_date >= ?';
        params.push(startDate);
      }

      if (endDate) {
        sql += ' AND im.movement_date <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY im.movement_date DESC, im.created_at DESC';

      const movements = await query(sql, params);

      return movements.map(movement => ({
        id: movement.id,
        itemId: movement.item_id,
        itemCode: movement.item_code,
        itemDescription: movement.item_description,
        movementDate: movement.movement_date,
        movementType: movement.movement_type,
        quantity: parseFloat(movement.quantity),
        unitCost: parseFloat(movement.unit_cost),
        totalValue: parseFloat(movement.total_value),
        sourceDocumentType: movement.source_document_type,
        sourceDocumentId: movement.source_document_id,
        notes: movement.notes,
        createdBy: movement.created_by,
        createdByUsername: movement.created_by_username,
        createdByName: movement.created_by_name,
        createdAt: movement.created_at
      }));
    } catch (error) {
      console.error('Error getting item movements:', error);
      throw error;
    }
  }

  /**
   * Gets current inventory status for all items
   * Returns items with their current stock and value
   * 
   * @returns {Promise<Array>} Array of items with stock information
   */
  async getAllInventoryStatus() {
    try {
      const items = await query(
        `SELECT 
          i.id,
          i.code,
          i.description,
          i.unit_of_measure,
          i.standard_cost,
          COALESCE(SUM(im.quantity), 0) as current_stock,
          COALESCE(SUM(im.total_value), 0) as current_value
         FROM items i
         LEFT JOIN inventory_movements im ON i.id = im.item_id
         GROUP BY i.id, i.code, i.description, i.unit_of_measure, i.standard_cost
         HAVING current_stock > 0.01 OR current_stock < -0.01
         ORDER BY i.code`
      );

      return items.map(item => ({
        id: item.id,
        code: item.code,
        description: item.description,
        unitOfMeasure: item.unit_of_measure,
        standardCost: parseFloat(item.standard_cost),
        currentStock: parseFloat(item.current_stock),
        currentValue: parseFloat(item.current_value),
        averageUnitCost: item.current_stock > 0 
          ? parseFloat(item.current_value) / parseFloat(item.current_stock)
          : 0
      }));
    } catch (error) {
      console.error('Error getting all inventory status:', error);
      throw error;
    }
  }

  /**
   * Creates a manual inventory adjustment
   * Can be used for corrections, physical inventory adjustments, etc.
   * 
   * @param {number} itemId - Item ID
   * @param {number} adjustmentQuantity - Quantity to adjust (positive for increase, negative for decrease)
   * @param {string} justification - Reason for adjustment
   * @param {number} userId - User creating the adjustment
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created movement ID
   */
  async createAdjustment(itemId, adjustmentQuantity, justification, userId, connection = null) {
    try {
      if (adjustmentQuantity === 0) {
        throw new Error('Adjustment quantity cannot be zero');
      }

      if (!justification || justification.trim() === '') {
        throw new Error('Justification is required for inventory adjustments');
      }

      // If positive adjustment, create inbound movement
      if (adjustmentQuantity > 0) {
        // Get item standard cost for adjustment
        const [item] = await query(
          'SELECT standard_cost FROM items WHERE id = ?',
          [itemId]
        );

        if (!item) {
          throw new Error(`Item ${itemId} not found`);
        }

        return await this.createInboundMovement(
          itemId,
          adjustmentQuantity,
          parseFloat(item.standard_cost),
          'adjustment',
          null,
          userId,
          `Ajuste: ${justification}`,
          connection
        );
      } else {
        // If negative adjustment, create outbound movement
        return await this.createOutboundMovement(
          itemId,
          Math.abs(adjustmentQuantity),
          'adjustment',
          null,
          userId,
          `Ajuste: ${justification}`,
          connection
        );
      }
    } catch (error) {
      console.error('Error creating inventory adjustment:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new InventoryService();
