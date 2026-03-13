import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import inventoryService from './inventoryService.js';
import { query, beginTransaction, commitTransaction, rollbackTransaction, testConnection } from '../config/database.js';

describe('InventoryService', () => {
  let testItemId;
  let testUserId;

  beforeAll(async () => {
    // Test database connection
    await testConnection();

    // Create test user
    const userResult = await query(
      `INSERT INTO users (username, password, full_name, role) 
       VALUES ('test_inventory_user', 'password123', 'Test Inventory User', 'compras')`
    );
    testUserId = userResult.insertId;

    // Create test item
    const itemResult = await query(
      `INSERT INTO items (code, description, unit_of_measure, standard_cost)
       VALUES ('TEST-INV-001', 'Test Inventory Item', 'units', 10.00)`
    );
    testItemId = itemResult.insertId;
  });

  afterAll(async () => {
    // Clean up test data
    await query('DELETE FROM inventory_movements WHERE item_id = ?', [testItemId]);
    await query('DELETE FROM items WHERE id = ?', [testItemId]);
    await query('DELETE FROM users WHERE id = ?', [testUserId]);
  });

  beforeEach(async () => {
    // Clear inventory movements before each test
    await query('DELETE FROM inventory_movements WHERE item_id = ?', [testItemId]);
  });

  describe('createInboundMovement', () => {
    it('should create an inbound movement successfully', async () => {
      const movementId = await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.50,
        'purchase_invoice',
        1,
        testUserId,
        'Initial stock'
      );

      expect(movementId).toBeGreaterThan(0);

      // Verify movement was created
      const [movement] = await query(
        'SELECT * FROM inventory_movements WHERE id = ?',
        [movementId]
      );

      expect(movement).toBeDefined();
      expect(movement.item_id).toBe(testItemId);
      expect(parseFloat(movement.quantity)).toBe(100);
      expect(parseFloat(movement.unit_cost)).toBe(10.50);
      expect(parseFloat(movement.total_value)).toBe(1050);
      expect(movement.movement_type).toBe('inbound');
    });

    it('should reject negative quantity', async () => {
      await expect(
        inventoryService.createInboundMovement(
          testItemId,
          -50,
          10.00,
          'purchase_invoice',
          1,
          testUserId
        )
      ).rejects.toThrow('Inbound quantity must be positive');
    });

    it('should reject negative unit cost', async () => {
      await expect(
        inventoryService.createInboundMovement(
          testItemId,
          50,
          -10.00,
          'purchase_invoice',
          1,
          testUserId
        )
      ).rejects.toThrow('Unit cost cannot be negative');
    });

    it('should reject non-existent item', async () => {
      await expect(
        inventoryService.createInboundMovement(
          999999,
          50,
          10.00,
          'purchase_invoice',
          1,
          testUserId
        )
      ).rejects.toThrow('Item 999999 not found');
    });
  });

  describe('createOutboundMovement', () => {
    beforeEach(async () => {
      // Create initial stock for outbound tests
      await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.00,
        'purchase_invoice',
        1,
        testUserId
      );
    });

    it('should create an outbound movement successfully', async () => {
      const movementId = await inventoryService.createOutboundMovement(
        testItemId,
        30,
        'sales_invoice',
        1,
        testUserId,
        'Sale to customer'
      );

      expect(movementId).toBeGreaterThan(0);

      // Verify movement was created
      const [movement] = await query(
        'SELECT * FROM inventory_movements WHERE id = ?',
        [movementId]
      );

      expect(movement).toBeDefined();
      expect(movement.item_id).toBe(testItemId);
      expect(parseFloat(movement.quantity)).toBe(-30);
      expect(movement.movement_type).toBe('outbound');
      expect(parseFloat(movement.total_value)).toBeLessThan(0);
    });

    it('should prevent negative inventory', async () => {
      await expect(
        inventoryService.createOutboundMovement(
          testItemId,
          150, // More than available stock (100)
          'sales_invoice',
          1,
          testUserId
        )
      ).rejects.toThrow('Insufficient stock');
    });

    it('should reject negative quantity', async () => {
      await expect(
        inventoryService.createOutboundMovement(
          testItemId,
          -30,
          'sales_invoice',
          1,
          testUserId
        )
      ).rejects.toThrow('Outbound quantity must be positive');
    });
  });

  describe('calculateCurrentStock', () => {
    it('should return zero for item with no movements', async () => {
      const stock = await inventoryService.calculateCurrentStock(testItemId);
      expect(stock).toBe(0);
    });

    it('should calculate stock correctly with inbound movements', async () => {
      await inventoryService.createInboundMovement(
        testItemId,
        50,
        10.00,
        'purchase_invoice',
        1,
        testUserId
      );

      await inventoryService.createInboundMovement(
        testItemId,
        30,
        12.00,
        'purchase_invoice',
        2,
        testUserId
      );

      const stock = await inventoryService.calculateCurrentStock(testItemId);
      expect(stock).toBe(80);
    });

    it('should calculate stock correctly with inbound and outbound movements', async () => {
      await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.00,
        'purchase_invoice',
        1,
        testUserId
      );

      await inventoryService.createOutboundMovement(
        testItemId,
        30,
        'sales_invoice',
        1,
        testUserId
      );

      await inventoryService.createOutboundMovement(
        testItemId,
        20,
        'sales_invoice',
        2,
        testUserId
      );

      const stock = await inventoryService.calculateCurrentStock(testItemId);
      expect(stock).toBe(50);
    });
  });

  describe('calculateTotalInventoryValue', () => {
    it('should return zero when no inventory exists', async () => {
      const value = await inventoryService.calculateTotalInventoryValue();
      expect(value).toBeGreaterThanOrEqual(0);
    });

    it('should calculate total value correctly', async () => {
      // Clear all inventory movements for accurate test
      await query('DELETE FROM inventory_movements');

      await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.00,
        'purchase_invoice',
        1,
        testUserId
      );

      const value = await inventoryService.calculateTotalInventoryValue();
      expect(value).toBe(1000);
    });

    it('should calculate value correctly after outbound movements', async () => {
      // Clear all inventory movements for accurate test
      await query('DELETE FROM inventory_movements');

      await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.00,
        'purchase_invoice',
        1,
        testUserId
      );

      await inventoryService.createOutboundMovement(
        testItemId,
        40,
        'sales_invoice',
        1,
        testUserId
      );

      const value = await inventoryService.calculateTotalInventoryValue();
      expect(value).toBe(600); // 60 units * 10.00
    });
  });

  describe('getItemMovements', () => {
    it('should return empty array for item with no movements', async () => {
      const movements = await inventoryService.getItemMovements(testItemId);
      expect(movements).toEqual([]);
    });

    it('should return all movements for an item', async () => {
      await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.00,
        'purchase_invoice',
        1,
        testUserId,
        'First inbound'
      );

      await inventoryService.createInboundMovement(
        testItemId,
        50,
        12.00,
        'purchase_invoice',
        2,
        testUserId,
        'Second inbound'
      );

      const movements = await inventoryService.getItemMovements(testItemId);
      expect(movements).toHaveLength(2);
      expect(movements[0].movementType).toBe('inbound');
      expect(movements[1].movementType).toBe('inbound');
    });

    it('should filter movements by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.00,
        'purchase_invoice',
        1,
        testUserId
      );

      const movements = await inventoryService.getItemMovements(
        testItemId,
        today,
        today
      );

      expect(movements.length).toBeGreaterThan(0);
      movements.forEach(movement => {
        expect(movement.movementDate).toBe(today);
      });
    });

    it('should include user information in movements', async () => {
      await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.00,
        'purchase_invoice',
        1,
        testUserId
      );

      const movements = await inventoryService.getItemMovements(testItemId);
      expect(movements[0].createdByUsername).toBe('test_inventory_user');
      expect(movements[0].createdByName).toBe('Test Inventory User');
    });
  });

  describe('getAllInventoryStatus', () => {
    it('should return inventory status for all items with stock', async () => {
      await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.00,
        'purchase_invoice',
        1,
        testUserId
      );

      const status = await inventoryService.getAllInventoryStatus();
      const testItem = status.find(item => item.id === testItemId);

      expect(testItem).toBeDefined();
      expect(testItem.currentStock).toBe(100);
      expect(testItem.currentValue).toBe(1000);
      expect(testItem.averageUnitCost).toBe(10);
    });

    it('should not include items with zero stock', async () => {
      const status = await inventoryService.getAllInventoryStatus();
      const testItem = status.find(item => item.id === testItemId);

      expect(testItem).toBeUndefined();
    });
  });

  describe('createAdjustment', () => {
    it('should create positive adjustment', async () => {
      const movementId = await inventoryService.createAdjustment(
        testItemId,
        50,
        'Physical inventory count adjustment',
        testUserId
      );

      expect(movementId).toBeGreaterThan(0);

      const stock = await inventoryService.calculateCurrentStock(testItemId);
      expect(stock).toBe(50);
    });

    it('should create negative adjustment', async () => {
      // Create initial stock
      await inventoryService.createInboundMovement(
        testItemId,
        100,
        10.00,
        'purchase_invoice',
        1,
        testUserId
      );

      const movementId = await inventoryService.createAdjustment(
        testItemId,
        -20,
        'Damaged goods write-off',
        testUserId
      );

      expect(movementId).toBeGreaterThan(0);

      const stock = await inventoryService.calculateCurrentStock(testItemId);
      expect(stock).toBe(80);
    });

    it('should reject zero adjustment', async () => {
      await expect(
        inventoryService.createAdjustment(
          testItemId,
          0,
          'No adjustment',
          testUserId
        )
      ).rejects.toThrow('Adjustment quantity cannot be zero');
    });

    it('should require justification', async () => {
      await expect(
        inventoryService.createAdjustment(
          testItemId,
          50,
          '',
          testUserId
        )
      ).rejects.toThrow('Justification is required');
    });

    it('should prevent negative stock from adjustment', async () => {
      await expect(
        inventoryService.createAdjustment(
          testItemId,
          -50,
          'Invalid adjustment',
          testUserId
        )
      ).rejects.toThrow('Insufficient stock');
    });
  });

  describe('Transaction support', () => {
    it('should work within a transaction', async () => {
      const connection = await beginTransaction();

      try {
        await inventoryService.createInboundMovement(
          testItemId,
          100,
          10.00,
          'purchase_invoice',
          1,
          testUserId,
          'Transaction test',
          connection
        );

        await commitTransaction(connection);

        const stock = await inventoryService.calculateCurrentStock(testItemId);
        expect(stock).toBe(100);
      } catch (error) {
        await rollbackTransaction(connection);
        throw error;
      }
    });

    it('should rollback on transaction failure', async () => {
      const connection = await beginTransaction();

      try {
        await inventoryService.createInboundMovement(
          testItemId,
          100,
          10.00,
          'purchase_invoice',
          1,
          testUserId,
          'Transaction test',
          connection
        );

        // Simulate error
        throw new Error('Simulated error');
      } catch (error) {
        await rollbackTransaction(connection);
      }

      const stock = await inventoryService.calculateCurrentStock(testItemId);
      expect(stock).toBe(0);
    });
  });
});
