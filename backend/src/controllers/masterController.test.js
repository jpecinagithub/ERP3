import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getItems, createItem, updateItem, deleteItem } from './masterController.js';
import * as database from '../config/database.js';

/**
 * Unit Tests for Master Data Controller
 * Tests items CRUD operations
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

// Mock dependencies
vi.mock('../config/database.js');

describe('MasterController - Items', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup request and response mocks
    req = {
      body: {},
      params: {},
      query: {}
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  describe('getItems', () => {
    it('should return all items when no search term provided', async () => {
      const mockItems = [
        {
          id: 1,
          code: 'ITEM001',
          description: 'Test Item 1',
          unit_of_measure: 'unit',
          standard_cost: 10.50,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 2,
          code: 'ITEM002',
          description: 'Test Item 2',
          unit_of_measure: 'kg',
          standard_cost: 25.00,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      vi.mocked(database.query).mockResolvedValue(mockItems);

      await getItems(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            code: 'ITEM001',
            description: 'Test Item 1',
            unitOfMeasure: 'unit',
            standardCost: 10.50
          }),
          expect.objectContaining({
            id: 2,
            code: 'ITEM002',
            description: 'Test Item 2',
            unitOfMeasure: 'kg',
            standardCost: 25.00
          })
        ])
      });
    });

    it('should filter items by search term in code', async () => {
      req.query.search = 'ITEM001';
      const mockItems = [
        {
          id: 1,
          code: 'ITEM001',
          description: 'Test Item 1',
          unit_of_measure: 'unit',
          standard_cost: 10.50,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      vi.mocked(database.query).mockResolvedValue(mockItems);

      await getItems(req, res);

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE code LIKE ? OR description LIKE ?'),
        expect.arrayContaining(['%ITEM001%', '%ITEM001%'])
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ code: 'ITEM001' })
        ])
      });
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(database.query).mockRejectedValue(new Error('Database error'));

      await getItems(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'An error occurred while fetching items',
          status: 500
        }
      });
    });
  });

  describe('createItem', () => {
    it('should create a new item successfully', async () => {
      req.body = {
        code: 'ITEM001',
        description: 'Test Item',
        unitOfMeasure: 'unit',
        standardCost: 10.50
      };

      const mockInsertResult = { insertId: 1 };
      const mockCreatedItem = {
        id: 1,
        code: 'ITEM001',
        description: 'Test Item',
        unit_of_measure: 'unit',
        standard_cost: 10.50,
        created_at: new Date(),
        updated_at: new Date()
      };

      vi.mocked(database.query)
        .mockResolvedValueOnce([]) // Check for existing code
        .mockResolvedValueOnce(mockInsertResult) // Insert
        .mockResolvedValueOnce([mockCreatedItem]); // Fetch created item

      await createItem(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Item created successfully',
        data: expect.objectContaining({
          id: 1,
          code: 'ITEM001',
          description: 'Test Item',
          unitOfMeasure: 'unit',
          standardCost: 10.50
        })
      });
    });

    it('should return 400 if required fields are missing', async () => {
      req.body = {
        code: 'ITEM001',
        description: 'Test Item'
        // Missing unitOfMeasure and standardCost
      };

      await createItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Code, description, unit of measure, and standard cost are required',
          status: 400
        }
      });
    });

    it('should return 400 if standard cost is negative', async () => {
      req.body = {
        code: 'ITEM001',
        description: 'Test Item',
        unitOfMeasure: 'unit',
        standardCost: -10.50
      };

      await createItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Standard cost must be non-negative',
          status: 400
        }
      });
    });

    it('should return 409 if item code already exists', async () => {
      req.body = {
        code: 'ITEM001',
        description: 'Test Item',
        unitOfMeasure: 'unit',
        standardCost: 10.50
      };

      vi.mocked(database.query).mockResolvedValue([{ id: 1 }]); // Code exists

      await createItem(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Item code already exists',
          status: 409
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      req.body = {
        code: 'ITEM001',
        description: 'Test Item',
        unitOfMeasure: 'unit',
        standardCost: 10.50
      };

      vi.mocked(database.query).mockRejectedValue(new Error('Database error'));

      await createItem(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'An error occurred while creating the item',
          status: 500
        }
      });
    });
  });

  describe('updateItem', () => {
    it('should update an item successfully', async () => {
      req.params.id = '1';
      req.body = {
        code: 'ITEM001',
        description: 'Updated Item',
        unitOfMeasure: 'kg',
        standardCost: 15.00
      };

      const mockUpdatedItem = {
        id: 1,
        code: 'ITEM001',
        description: 'Updated Item',
        unit_of_measure: 'kg',
        standard_cost: 15.00,
        created_at: new Date(),
        updated_at: new Date()
      };

      vi.mocked(database.query)
        .mockResolvedValueOnce([{ id: 1 }]) // Check item exists
        .mockResolvedValueOnce([]) // Check code uniqueness
        .mockResolvedValueOnce({}) // Update
        .mockResolvedValueOnce([mockUpdatedItem]); // Fetch updated item

      await updateItem(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Item updated successfully',
        data: expect.objectContaining({
          id: 1,
          code: 'ITEM001',
          description: 'Updated Item',
          unitOfMeasure: 'kg',
          standardCost: 15.00
        })
      });
    });

    it('should return 400 if required fields are missing', async () => {
      req.params.id = '1';
      req.body = {
        code: 'ITEM001'
        // Missing other fields
      };

      await updateItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Code, description, unit of measure, and standard cost are required',
          status: 400
        }
      });
    });

    it('should return 400 if standard cost is negative', async () => {
      req.params.id = '1';
      req.body = {
        code: 'ITEM001',
        description: 'Test Item',
        unitOfMeasure: 'unit',
        standardCost: -5.00
      };

      await updateItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Standard cost must be non-negative',
          status: 400
        }
      });
    });

    it('should return 404 if item does not exist', async () => {
      req.params.id = '999';
      req.body = {
        code: 'ITEM001',
        description: 'Test Item',
        unitOfMeasure: 'unit',
        standardCost: 10.50
      };

      vi.mocked(database.query).mockResolvedValue([]); // Item not found

      await updateItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Item not found',
          status: 404
        }
      });
    });

    it('should return 409 if code already exists for another item', async () => {
      req.params.id = '1';
      req.body = {
        code: 'ITEM002',
        description: 'Test Item',
        unitOfMeasure: 'unit',
        standardCost: 10.50
      };

      vi.mocked(database.query)
        .mockResolvedValueOnce([{ id: 1 }]) // Item exists
        .mockResolvedValueOnce([{ id: 2 }]); // Code exists for another item

      await updateItem(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Item code already exists',
          status: 409
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      req.params.id = '1';
      req.body = {
        code: 'ITEM001',
        description: 'Test Item',
        unitOfMeasure: 'unit',
        standardCost: 10.50
      };

      vi.mocked(database.query).mockRejectedValue(new Error('Database error'));

      await updateItem(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'An error occurred while updating the item',
          status: 500
        }
      });
    });
  });

  describe('deleteItem', () => {
    it('should delete an item successfully when not used in transactions', async () => {
      req.params.id = '1';

      vi.mocked(database.query)
        .mockResolvedValueOnce([{ id: 1 }]) // Item exists
        .mockResolvedValueOnce([]) // Not in budget_lines
        .mockResolvedValueOnce([]) // Not in purchase_order_lines
        .mockResolvedValueOnce([]) // Not in purchase_invoice_lines
        .mockResolvedValueOnce([]) // Not in sales_invoice_lines
        .mockResolvedValueOnce([]) // Not in inventory_movements
        .mockResolvedValueOnce({}); // Delete

      await deleteItem(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Item deleted successfully'
      });
    });

    it('should return 404 if item does not exist', async () => {
      req.params.id = '999';

      vi.mocked(database.query).mockResolvedValue([]); // Item not found

      await deleteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Item not found',
          status: 404
        }
      });
    });

    it('should return 409 if item is used in budget transactions', async () => {
      req.params.id = '1';

      vi.mocked(database.query)
        .mockResolvedValueOnce([{ id: 1 }]) // Item exists
        .mockResolvedValueOnce([{ id: 1 }]); // Used in budget_lines

      await deleteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Cannot delete item: it is used in budget transactions',
          status: 409
        }
      });
    });

    it('should return 409 if item is used in purchase order transactions', async () => {
      req.params.id = '1';

      vi.mocked(database.query)
        .mockResolvedValueOnce([{ id: 1 }]) // Item exists
        .mockResolvedValueOnce([]) // Not in budget_lines
        .mockResolvedValueOnce([{ id: 1 }]); // Used in purchase_order_lines

      await deleteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Cannot delete item: it is used in purchase order transactions',
          status: 409
        }
      });
    });

    it('should return 409 if item is used in purchase invoice transactions', async () => {
      req.params.id = '1';

      vi.mocked(database.query)
        .mockResolvedValueOnce([{ id: 1 }]) // Item exists
        .mockResolvedValueOnce([]) // Not in budget_lines
        .mockResolvedValueOnce([]) // Not in purchase_order_lines
        .mockResolvedValueOnce([{ id: 1 }]); // Used in purchase_invoice_lines

      await deleteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Cannot delete item: it is used in purchase invoice transactions',
          status: 409
        }
      });
    });

    it('should return 409 if item is used in sales invoice transactions', async () => {
      req.params.id = '1';

      vi.mocked(database.query)
        .mockResolvedValueOnce([{ id: 1 }]) // Item exists
        .mockResolvedValueOnce([]) // Not in budget_lines
        .mockResolvedValueOnce([]) // Not in purchase_order_lines
        .mockResolvedValueOnce([]) // Not in purchase_invoice_lines
        .mockResolvedValueOnce([{ id: 1 }]); // Used in sales_invoice_lines

      await deleteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Cannot delete item: it is used in sales invoice transactions',
          status: 409
        }
      });
    });

    it('should return 409 if item has inventory movements', async () => {
      req.params.id = '1';

      vi.mocked(database.query)
        .mockResolvedValueOnce([{ id: 1 }]) // Item exists
        .mockResolvedValueOnce([]) // Not in budget_lines
        .mockResolvedValueOnce([]) // Not in purchase_order_lines
        .mockResolvedValueOnce([]) // Not in purchase_invoice_lines
        .mockResolvedValueOnce([]) // Not in sales_invoice_lines
        .mockResolvedValueOnce([{ id: 1 }]); // Has inventory_movements

      await deleteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Cannot delete item: it has inventory movements',
          status: 409
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      req.params.id = '1';

      vi.mocked(database.query).mockRejectedValue(new Error('Database error'));

      await deleteItem(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'An error occurred while deleting the item',
          status: 500
        }
      });
    });
  });
});
