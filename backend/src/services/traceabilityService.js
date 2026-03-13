import { query } from '../config/database.js';

const normalizeJsonField = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return JSON.parse(value);
  return value;
};

const sanitizeLimit = (value, fallback, max = 1000) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

/**
 * TraceabilityService - Maintains complete audit trail and document traceability
 * Implements Requirements 21 (Purchase Cycle Traceability) and 22 (Sales Cycle Traceability)
 * Ensures all operations are traceable from origin to completion
 */
class TraceabilityService {
  /**
   * Creates a link between two related documents
   * Used to maintain the chain: Budget → Order → Invoice → Payment/Collection
   * 
   * @param {string} sourceType - Source document type ('budget', 'sales_budget', 'purchase_order', 'sales_order', 'purchase_invoice', 'sales_invoice', 'payment', 'collection')
   * @param {number} sourceId - Source document ID
   * @param {string} targetType - Target document type
   * @param {number} targetId - Target document ID
   * @param {string} linkType - Type of link ('converted_to', 'generated', 'paid_by', 'collected_by')
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created link ID
   */
  async createDocumentLink(sourceType, targetType, sourceId, targetId, linkType = 'converted_to', connection = null) {
    const executeQuery = connection 
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      // Validate inputs
      if (!sourceType || !targetType || !sourceId || !targetId) {
        throw new Error('Source and target document information is required');
      }

      const validDocTypes = [
        'budget', 
        'sales_budget',
        'purchase_order', 
        'sales_order',
        'purchase_invoice', 
        'sales_invoice', 
        'payment', 
        'collection',
        'journal_entry',
        'inventory_movement',
        'fixed_asset'
      ];

      if (!validDocTypes.includes(sourceType)) {
        throw new Error(`Invalid source document type: ${sourceType}`);
      }

      if (!validDocTypes.includes(targetType)) {
        throw new Error(`Invalid target document type: ${targetType}`);
      }

      const validLinkTypes = ['converted_to', 'generated', 'paid_by', 'collected_by', 'linked_to', 'procurement'];
      if (!validLinkTypes.includes(linkType)) {
        throw new Error(`Invalid link type: ${linkType}`);
      }

      // Check if link already exists to prevent duplicates
      const existingLinks = await executeQuery(
        `SELECT id FROM document_links 
         WHERE source_document_type = ? 
           AND source_document_id = ? 
           AND target_document_type = ? 
           AND target_document_id = ?`,
        [sourceType, sourceId, targetType, targetId]
      );

      if (existingLinks.length > 0) {
        // Link already exists, return existing ID
        return existingLinks[0].id;
      }

      // Create the document link
      const result = await executeQuery(
        `INSERT INTO document_links 
         (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
         VALUES (?, ?, ?, ?, ?)`,
        [sourceType, sourceId, targetType, targetId, linkType]
      );

      return result.insertId;
    } catch (error) {
      console.error('Error creating document link:', error);
      throw error;
    }
  }

  /**
   * Retrieves the complete traceability chain for a document
   * Returns all related documents (ancestors and descendants) in the chain
   * 
   * @param {string} docType - Document type
   * @param {number} docId - Document ID
   * @returns {Promise<object>} Complete traceability chain with ancestors and descendants
   */
  async getTraceabilityChain(docType, docId) {
    try {
      // Validate inputs
      if (!docType || !docId) {
        throw new Error('Document type and ID are required');
      }

      // Get all links where this document is the source (descendants)
      const descendants = await this._getDescendants(docType, docId);

      // Get all links where this document is the target (ancestors)
      const ancestors = await this._getAncestors(docType, docId);

      // Get document details
      const documentDetails = await this._getDocumentDetails(docType, docId);

      return {
        document: {
          type: docType,
          id: docId,
          details: documentDetails
        },
        ancestors,
        descendants,
        fullChain: this._buildFullChain(ancestors, { type: docType, id: docId, details: documentDetails }, descendants)
      };
    } catch (error) {
      console.error('Error getting traceability chain:', error);
      throw error;
    }
  }

  /**
   * Gets all descendant documents (documents created from this one)
   * @private
   */
  async _getDescendants(docType, docId, visited = new Set()) {
    const visitKey = `${docType}:${docId}`;
    
    // Prevent infinite loops
    if (visited.has(visitKey)) {
      return [];
    }
    visited.add(visitKey);

    const links = await query(
      `SELECT 
        dl.*,
        DATE_FORMAT(dl.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
       FROM document_links dl
       WHERE dl.source_document_type = ? AND dl.source_document_id = ?
       ORDER BY dl.created_at`,
      [docType, docId]
    );

    const descendants = [];

    for (const link of links) {
      const targetDetails = await this._getDocumentDetails(
        link.target_document_type, 
        link.target_document_id
      );

      const descendant = {
        linkId: link.id,
        linkType: link.link_type,
        documentType: link.target_document_type,
        documentId: link.target_document_id,
        details: targetDetails,
        createdAt: link.created_at_formatted,
        children: await this._getDescendants(
          link.target_document_type, 
          link.target_document_id, 
          visited
        )
      };

      descendants.push(descendant);
    }

    return descendants;
  }

  /**
   * Gets all ancestor documents (documents this one was created from)
   * @private
   */
  async _getAncestors(docType, docId, visited = new Set()) {
    const visitKey = `${docType}:${docId}`;
    
    // Prevent infinite loops
    if (visited.has(visitKey)) {
      return [];
    }
    visited.add(visitKey);

    const links = await query(
      `SELECT 
        dl.*,
        DATE_FORMAT(dl.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
       FROM document_links dl
       WHERE dl.target_document_type = ? AND dl.target_document_id = ?
       ORDER BY dl.created_at`,
      [docType, docId]
    );

    const ancestors = [];

    for (const link of links) {
      const sourceDetails = await this._getDocumentDetails(
        link.source_document_type, 
        link.source_document_id
      );

      const ancestor = {
        linkId: link.id,
        linkType: link.link_type,
        documentType: link.source_document_type,
        documentId: link.source_document_id,
        details: sourceDetails,
        createdAt: link.created_at_formatted,
        parents: await this._getAncestors(
          link.source_document_type, 
          link.source_document_id, 
          visited
        )
      };

      ancestors.push(ancestor);
    }

    return ancestors;
  }

  /**
   * Gets document details based on document type
   * @private
   */
  async _getDocumentDetails(docType, docId) {
    try {
      let result = null;

      switch (docType) {
        case 'sales_budget':
          [result] = await query(
            `SELECT sb.*, c.name as customer_name, u.username as created_by_username
             FROM sales_budgets sb
             LEFT JOIN customers c ON sb.customer_id = c.id
             LEFT JOIN users u ON sb.created_by = u.id
             WHERE sb.id = ?`,
            [docId]
          );
          break;

        case 'sales_order':
          [result] = await query(
            `SELECT so.*, c.name as customer_name, u.username as created_by_username
             FROM sales_orders so
             LEFT JOIN customers c ON so.customer_id = c.id
             LEFT JOIN users u ON so.created_by = u.id
             WHERE so.id = ?`,
            [docId]
          );
          break;

        case 'budget':
          [result] = await query(
            `SELECT b.*, s.name as supplier_name, u.username as created_by_username
             FROM budgets b
             LEFT JOIN suppliers s ON b.supplier_id = s.id
             LEFT JOIN users u ON b.created_by = u.id
             WHERE b.id = ?`,
            [docId]
          );
          break;

        case 'sales_budget':
          [result] = await query(
            `SELECT sb.*, c.name as customer_name, u.username as created_by_username
             FROM sales_budgets sb
             LEFT JOIN customers c ON sb.customer_id = c.id
             LEFT JOIN users u ON sb.created_by = u.id
             WHERE sb.id = ?`,
            [docId]
          );
          break;

        case 'purchase_order':
          [result] = await query(
            `SELECT po.*, s.name as supplier_name, u.username as created_by_username
             FROM purchase_orders po
             LEFT JOIN suppliers s ON po.supplier_id = s.id
             LEFT JOIN users u ON po.created_by = u.id
             WHERE po.id = ?`,
            [docId]
          );
          break;

        case 'purchase_invoice':
          [result] = await query(
            `SELECT pi.*, s.name as supplier_name, u.username as created_by_username
             FROM purchase_invoices pi
             LEFT JOIN suppliers s ON pi.supplier_id = s.id
             LEFT JOIN users u ON pi.created_by = u.id
             WHERE pi.id = ?`,
            [docId]
          );
          break;

        case 'sales_invoice':
          [result] = await query(
            `SELECT si.*, c.name as customer_name, u.username as created_by_username
             FROM sales_invoices si
             LEFT JOIN customers c ON si.customer_id = c.id
             LEFT JOIN users u ON si.created_by = u.id
             WHERE si.id = ?`,
            [docId]
          );
          break;

        case 'payment':
          [result] = await query(
            `SELECT p.*, pi.invoice_number, s.name as supplier_name, u.username as created_by_username
             FROM payments p
             LEFT JOIN purchase_invoices pi ON p.purchase_invoice_id = pi.id
             LEFT JOIN suppliers s ON pi.supplier_id = s.id
             LEFT JOIN users u ON p.created_by = u.id
             WHERE p.id = ?`,
            [docId]
          );
          break;

        case 'collection':
          [result] = await query(
            `SELECT col.*, si.invoice_number, c.name as customer_name, u.username as created_by_username
             FROM collections col
             LEFT JOIN sales_invoices si ON col.sales_invoice_id = si.id
             LEFT JOIN customers c ON si.customer_id = c.id
             LEFT JOIN users u ON col.created_by = u.id
             WHERE col.id = ?`,
            [docId]
          );
          break;

        case 'journal_entry':
          [result] = await query(
            `SELECT je.*, u.username as created_by_username
             FROM journal_entries je
             LEFT JOIN users u ON je.created_by = u.id
             WHERE je.id = ?`,
            [docId]
          );
          break;

        case 'inventory_movement':
          [result] = await query(
            `SELECT im.*, i.code as item_code, i.description as item_description, u.username as created_by_username
             FROM inventory_movements im
             LEFT JOIN items i ON im.item_id = i.id
             LEFT JOIN users u ON im.created_by = u.id
             WHERE im.id = ?`,
            [docId]
          );
          break;

        case 'sales_order':
          [result] = await query(
            `SELECT so.*, c.name as customer_name, u.username as created_by_username
             FROM sales_orders so
             LEFT JOIN customers c ON so.customer_id = c.id
             LEFT JOIN users u ON so.created_by = u.id
             WHERE so.id = ?`,
            [docId]
          );
          break;

        case 'fixed_asset':
          [result] = await query(
            `SELECT fa.*, u.username as created_by_username
             FROM fixed_assets fa
             LEFT JOIN users u ON fa.created_by = u.id
             WHERE fa.id = ?`,
            [docId]
          );
          break;

        default:
          return { error: `Unknown document type: ${docType}` };
      }

      return result || { error: 'Document not found' };
    } catch (error) {
      console.error(`Error getting details for ${docType} ${docId}:`, error);
      return { error: error.message };
    }
  }

  /**
   * Builds a linear representation of the full chain
   * @private
   */
  _buildFullChain(ancestors, current, descendants) {
    const chain = [];

    // Add all ancestors (recursively flatten)
    const flattenAncestors = (ancestorList) => {
      for (const ancestor of ancestorList) {
        if (ancestor.parents && ancestor.parents.length > 0) {
          flattenAncestors(ancestor.parents);
        }
        chain.push({
          type: ancestor.documentType,
          id: ancestor.documentId,
          linkType: ancestor.linkType,
          details: ancestor.details
        });
      }
    };
    flattenAncestors(ancestors);

    // Add current document
    chain.push({
      type: current.type,
      id: current.id,
      linkType: 'current',
      details: current.details
    });

    // Add all descendants (recursively flatten)
    const flattenDescendants = (descendantList) => {
      for (const descendant of descendantList) {
        chain.push({
          type: descendant.documentType,
          id: descendant.documentId,
          linkType: descendant.linkType,
          details: descendant.details
        });
        if (descendant.children && descendant.children.length > 0) {
          flattenDescendants(descendant.children);
        }
      }
    };
    flattenDescendants(descendants);

    return chain;
  }

  /**
   * Logs a user action in the audit log
   * Records all create, update, delete operations for compliance and debugging
   * 
   * @param {number} userId - User performing the action
   * @param {string} action - Action type ('create', 'update', 'delete', 'close_period', 'reopen_period')
   * @param {string} entityType - Entity type being acted upon
   * @param {number} entityId - Entity ID
   * @param {object} oldValues - Previous values (for updates/deletes)
   * @param {object} newValues - New values (for creates/updates)
   * @param {object} connection - Database connection (optional, for transactions)
   * @returns {Promise<number>} Created audit log entry ID
   */
  async logAction(userId, action, entityType, entityId, oldValues = null, newValues = null, connection = null) {
    if (!userId || !action || !entityType || !entityId) {
      throw new Error('User ID, action, entity type, and entity ID are required for audit logging');
    }

    const validActions = ['create', 'update', 'delete', 'close_period', 'reopen_period', 'adjust', 'convert'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action type: ${action}`);
    }

    const executeQuery = connection 
      ? (sql, params) => connection.execute(sql, params).then(([results]) => results)
      : query;

    try {
      // Convert values to JSON strings
      const oldValuesJson = oldValues ? JSON.stringify(oldValues) : null;
      const newValuesJson = newValues ? JSON.stringify(newValues) : null;

      // Insert audit log entry
      const result = await executeQuery(
        `INSERT INTO audit_log 
         (user_id, action, entity_type, entity_id, old_values, new_values)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, action, entityType, entityId, oldValuesJson, newValuesJson]
      );

      return result.insertId;
    } catch (error) {
      console.error('Error logging action:', error);
      // Don't throw error for audit logging failures - log and continue
      console.error('Audit log entry failed but operation will continue');
      return null;
    }
  }

  /**
   * Checks if a document can be safely deleted
   * Documents that are part of a traceability chain cannot be deleted
   * 
   * @param {string} docType - Document type
   * @param {number} docId - Document ID
   * @returns {Promise<object>} Result with canDelete flag and reason
   */
  async canDeleteDocument(docType, docId) {
    try {
      // Validate inputs
      if (!docType || !docId) {
        throw new Error('Document type and ID are required');
      }

      // Check if document has any links (as source or target)
      const linksAsSource = await query(
        `SELECT COUNT(*) as count 
         FROM document_links 
         WHERE source_document_type = ? AND source_document_id = ?`,
        [docType, docId]
      );

      const linksAsTarget = await query(
        `SELECT COUNT(*) as count 
         FROM document_links 
         WHERE target_document_type = ? AND target_document_id = ?`,
        [docType, docId]
      );

      const sourceCount = linksAsSource[0]?.count || 0;
      const targetCount = linksAsTarget[0]?.count || 0;
      const totalLinks = sourceCount + targetCount;

      if (totalLinks > 0) {
        // Get details of linked documents
        const linkedDocs = await query(
          `SELECT 
            CASE 
              WHEN source_document_type = ? AND source_document_id = ? 
              THEN target_document_type 
              ELSE source_document_type 
            END as linked_type,
            CASE 
              WHEN source_document_type = ? AND source_document_id = ? 
              THEN target_document_id 
              ELSE source_document_id 
            END as linked_id,
            link_type
           FROM document_links
           WHERE (source_document_type = ? AND source_document_id = ?)
              OR (target_document_type = ? AND target_document_id = ?)
           LIMIT 5`,
          [docType, docId, docType, docId, docType, docId, docType, docId]
        );

        return {
          canDelete: false,
          reason: 'Document is part of a traceability chain and cannot be deleted',
          linkedDocumentsCount: totalLinks,
          linkedDocuments: linkedDocs.map(doc => ({
            type: doc.linked_type,
            id: doc.linked_id,
            linkType: doc.link_type
          }))
        };
      }

      // Additional checks based on document type
      switch (docType) {
        case 'purchase_invoice':
          // Check if invoice has payments
          const payments = await query(
            'SELECT COUNT(*) as count FROM payments WHERE purchase_invoice_id = ?',
            [docId]
          );
          if (payments[0]?.count > 0) {
            return {
              canDelete: false,
              reason: 'Purchase invoice has associated payments and cannot be deleted',
              paymentsCount: payments[0].count
            };
          }
          break;

        case 'sales_invoice':
          // Check if invoice has collections
          const collections = await query(
            'SELECT COUNT(*) as count FROM collections WHERE sales_invoice_id = ?',
            [docId]
          );
          if (collections[0]?.count > 0) {
            return {
              canDelete: false,
              reason: 'Sales invoice has associated collections and cannot be deleted',
              collectionsCount: collections[0].count
            };
          }
          break;

        case 'budget':
          // Check if budget was converted to purchase order
          const orders = await query(
            `SELECT COUNT(*) as count FROM document_links 
             WHERE source_document_type = 'budget' 
               AND source_document_id = ? 
               AND target_document_type = 'purchase_order'`,
            [docId]
          );
          if (orders[0]?.count > 0) {
            return {
              canDelete: false,
              reason: 'Budget has been converted to purchase order and cannot be deleted',
              ordersCount: orders[0].count
            };
          }
          break;

        case 'sales_budget':
          // Check if sales budget was converted to sales order
          const salesOrders = await query(
            `SELECT COUNT(*) as count FROM document_links 
             WHERE source_document_type = 'sales_budget' 
               AND source_document_id = ? 
               AND target_document_type = 'sales_order'`,
            [docId]
          );
          if (salesOrders[0]?.count > 0) {
            return {
              canDelete: false,
              reason: 'Sales budget has been converted to sales order and cannot be deleted',
              ordersCount: salesOrders[0].count
            };
          }
          break;
      }

      // Document can be deleted
      return {
        canDelete: true,
        reason: 'Document has no dependencies and can be safely deleted'
      };
    } catch (error) {
      console.error('Error checking if document can be deleted:', error);
      throw error;
    }
  }

  /**
   * Gets audit log entries for a specific entity
   * Useful for viewing the complete history of changes to a document
   * 
   * @param {string} entityType - Entity type
   * @param {number} entityId - Entity ID
   * @param {number} limit - Maximum number of entries to return (default: 50)
   * @returns {Promise<Array>} Array of audit log entries
   */
  async getAuditLog(entityType, entityId, limit = 50) {
    try {
      const safeLimit = sanitizeLimit(limit, 50);
      const entries = await query(
        `SELECT 
          al.*,
          u.username,
          u.full_name,
          DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
         FROM audit_log al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.entity_type = ? AND al.entity_id = ?
         ORDER BY al.created_at DESC
         LIMIT ?`,
        [entityType, entityId, safeLimit]
      );

      return entries.map(entry => ({
        id: entry.id,
        userId: entry.user_id,
        username: entry.username,
        fullName: entry.full_name,
        action: entry.action,
        entityType: entry.entity_type,
        entityId: entry.entity_id,
        oldValues: normalizeJsonField(entry.old_values),
        newValues: normalizeJsonField(entry.new_values),
        createdAt: entry.created_at_formatted
      }));
    } catch (error) {
      console.error('Error getting audit log:', error);
      throw error;
    }
  }

  /**
   * Gets recent audit log entries across all entities
   * Useful for system-wide audit trail viewing
   * 
   * @param {number} limit - Maximum number of entries to return (default: 100)
   * @param {string} action - Filter by action type (optional)
   * @param {number} userId - Filter by user ID (optional)
   * @returns {Promise<Array>} Array of audit log entries
   */
  async getRecentAuditLog(limit = 100, action = null, userId = null) {
    try {
      const safeLimit = sanitizeLimit(limit, 100);
      let sql = `
        SELECT 
          al.*,
          u.username,
          u.full_name,
          DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;

      const params = [];

      if (action) {
        sql += ' AND al.action = ?';
        params.push(action);
      }

      if (userId) {
        sql += ' AND al.user_id = ?';
        params.push(userId);
      }

      sql += ' ORDER BY al.created_at DESC LIMIT ?';
      params.push(safeLimit);

      const entries = await query(sql, params);

      return entries.map(entry => ({
        id: entry.id,
        userId: entry.user_id,
        username: entry.username,
        fullName: entry.full_name,
        action: entry.action,
        entityType: entry.entity_type,
        entityId: entry.entity_id,
        oldValues: normalizeJsonField(entry.old_values),
        newValues: normalizeJsonField(entry.new_values),
        createdAt: entry.created_at_formatted
      }));
    } catch (error) {
      console.error('Error getting recent audit log:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new TraceabilityService();
