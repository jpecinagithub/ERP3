import { query, beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';
import PDFDocument from 'pdfkit';
import accountingService from '../services/accountingService.js';
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

const normalizeInvoicePaymentMethod = (method) => (
  method === 'cash' ? 'bank_transfer' : method
);

const ALLOWED_PAYMENT_METHODS = ['bank_transfer', 'check'];
const ALLOWED_COLLECTION_METHODS = ['bank_transfer', 'check', 'card'];

const formatDateForDocument = (dateValue) => {
  if (!dateValue) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split('-');
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return String(dateValue);
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatCurrencyEUR = (value) => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR'
}).format(Number(value) || 0);

const truncateText = (value, maxLength = 60) => {
  if (typeof value !== 'string') return value || '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getDefaultVatRate = () => {
  const parsed = Number(process.env.INVOICE_DEFAULT_VAT_RATE);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return 21;
};

const computeInvoiceTaxBreakdown = (invoiceData, vatRate) => {
  const headerTotal = roundMoney(invoiceData?.totalAmount);
  const lines = Array.isArray(invoiceData?.lines) ? invoiceData.lines : [];
  const linesBase = roundMoney(
    lines.reduce((acc, line) => acc + (Number(line?.lineTotal) || 0), 0)
  );
  const vatMultiplier = 1 + (vatRate / 100);
  const expectedTotalFromBase = roundMoney(linesBase * vatMultiplier);

  // If header total already includes VAT (common case), keep header as final total.
  if (linesBase > 0 && Math.abs(headerTotal - expectedTotalFromBase) <= 0.02) {
    return {
      baseAmount: linesBase,
      vatAmount: roundMoney(headerTotal - linesBase),
      totalAmount: headerTotal
    };
  }

  // If header total matches lines base, VAT must be added.
  if (linesBase > 0 && Math.abs(headerTotal - linesBase) <= 0.02) {
    const vatAmount = roundMoney(linesBase * vatRate / 100);
    return {
      baseAmount: linesBase,
      vatAmount,
      totalAmount: roundMoney(linesBase + vatAmount)
    };
  }

  // Fallback when data is inconsistent: trust lines as base when available.
  if (linesBase > 0) {
    const vatAmount = headerTotal > linesBase
      ? roundMoney(headerTotal - linesBase)
      : roundMoney(linesBase * vatRate / 100);
    const totalAmount = headerTotal > linesBase
      ? headerTotal
      : roundMoney(linesBase + vatAmount);
    return {
      baseAmount: linesBase,
      vatAmount,
      totalAmount
    };
  }

  // Last fallback: infer base from header total.
  const inferredBase = vatMultiplier > 0
    ? roundMoney(headerTotal / vatMultiplier)
    : headerTotal;
  return {
    baseAmount: inferredBase,
    vatAmount: roundMoney(headerTotal - inferredBase),
    totalAmount: headerTotal
  };
};

const getInvoiceIssuerData = () => ({
  name: process.env.INVOICE_ISSUER_NAME || 'ERP Enterprise S.L.',
  taxId: process.env.INVOICE_ISSUER_TAX_ID || 'B00000000',
  address: process.env.INVOICE_ISSUER_ADDRESS || 'Calle Ejemplo 123, 28001 Madrid',
  phone: process.env.INVOICE_ISSUER_PHONE || '+34 900 000 000',
  email: process.env.INVOICE_ISSUER_EMAIL || 'facturacion@erp-enterprise.local'
});

const getSalesInvoiceCoreData = async (id) => {
  const invoices = await query(
    `SELECT 
      si.*,
      so.order_number as sales_order_number,
      c.code as customer_code,
      c.name as customer_name,
      c.tax_id as customer_tax_id,
      c.address as customer_address,
      c.phone as customer_phone,
      c.email as customer_email
    FROM sales_invoices si
    JOIN customers c ON si.customer_id = c.id
    LEFT JOIN sales_orders so ON so.id = si.sales_order_id
    WHERE si.id = ?`,
    [id]
  );

  if (!invoices || invoices.length === 0) {
    return null;
  }

  const invoice = invoices[0];
  const lines = await query(
    `SELECT 
      sil.*,
      i.code as item_code,
      i.description as item_description,
      i.unit_of_measure
    FROM sales_invoice_lines sil
    JOIN items i ON sil.item_id = i.id
    WHERE sil.sales_invoice_id = ?
    ORDER BY sil.id`,
    [id]
  );

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    salesOrderId: invoice.sales_order_id,
    salesOrderNumber: invoice.sales_order_number || null,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    totalAmount: parseFloat(invoice.total_amount),
    status: invoice.status,
    customer: {
      id: invoice.customer_id,
      code: invoice.customer_code,
      name: invoice.customer_name,
      taxId: invoice.customer_tax_id,
      address: invoice.customer_address,
      phone: invoice.customer_phone,
      email: invoice.customer_email
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
  };
};

/**
 * =========================
 * 9.1 Sales Invoices Endpoints
 * =========================
 */

/**
 * GET /api/sales-invoices
 * List sales invoices with payment status
 */
export const getSalesInvoices = async (req, res) => {
  try {
    const invoices = await query(
      `SELECT 
        si.id,
        si.invoice_number,
        si.sales_order_id,
        si.invoice_date,
        si.due_date,
        si.total_amount,
        si.status,
        so.order_number as sales_order_number,
        c.id as customer_id,
        c.name as customer_name
      FROM sales_invoices si
      JOIN customers c ON si.customer_id = c.id
      LEFT JOIN sales_orders so ON so.id = si.sales_order_id
      ORDER BY si.invoice_date DESC, si.id DESC`
    );

    const invoicesWithPayment = await Promise.all(
      invoices.map(async (inv) => {
        const payments = await query(
          `SELECT 
             COALESCE(SUM(CASE WHEN status = 'realized' THEN amount ELSE 0 END), 0) as paid_amount,
             COALESCE(SUM(amount), 0) as committed_amount
           FROM collections
           WHERE sales_invoice_id = ?`,
          [inv.id]
        );
        const paidAmount = parseFloat(payments[0].paid_amount) || 0;
        const committedAmount = parseFloat(payments[0].committed_amount) || 0;
        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          salesOrderId: inv.sales_order_id,
          salesOrderNumber: inv.sales_order_number || null,
          invoiceDate: inv.invoice_date,
          dueDate: inv.due_date,
          totalAmount: parseFloat(inv.total_amount),
          paidAmount,
          pendingAmount: Math.max(parseFloat(inv.total_amount) - committedAmount, 0),
          status: inv.status,
          customer: {
            id: inv.customer_id,
            name: inv.customer_name
          }
        };
      })
    );

    res.json({
      success: true,
      data: invoicesWithPayment
    });
  } catch (error) {
    console.error('Get sales invoices error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching sales invoices',
        status: 500
      }
    });
  }
};

/**
 * GET /api/sales-invoices/:id
 * Get invoice details with linked documents
 */
export const getSalesInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const invoiceData = await getSalesInvoiceCoreData(id);
    if (!invoiceData) {
      return res.status(404).json({
        error: {
          message: 'Sales invoice not found',
          status: 404
        }
      });
    }

    const collections = await query(
      `SELECT * FROM collections WHERE sales_invoice_id = ? ORDER BY collection_date DESC`,
      [invoiceData.id]
    );

    const traceability = await traceabilityService.getTraceabilityChain('sales_invoice', Number(invoiceData.id));

    res.json({
      success: true,
      data: {
        ...invoiceData,
        collections: collections.map(c => ({
          id: c.id,
          collectionNumber: c.collection_number,
          collectionDate: c.collection_date,
          amount: parseFloat(c.amount),
          status: c.status
        })),
        traceability
      }
    });
  } catch (error) {
    console.error('Get sales invoice by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the sales invoice',
        status: 500
      }
    });
  }
};

/**
 * GET /api/sales-invoices/:id/pdf
 * Download sales invoice as PDF file
 */
export const downloadSalesInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const invoiceData = await getSalesInvoiceCoreData(id);

    if (!invoiceData) {
      return res.status(404).json({
        error: {
          message: 'Sales invoice not found',
          status: 404
        }
      });
    }

    const issuer = getInvoiceIssuerData();
    const safeFileName = `factura_venta_${invoiceData.invoiceNumber || invoiceData.id}.pdf`
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    const vatRate = getDefaultVatRate();
    const {
      baseAmount: invoiceBaseAmount,
      vatAmount,
      totalAmount: totalWithVat
    } = computeInvoiceTaxBreakdown(invoiceData, vatRate);

    const drawInfoCard = (title, x, y, width, height, lines) => {
      doc
        .roundedRect(x, y, width, height, 6)
        .fillAndStroke('#ffffff', '#e5e7eb');
      doc.fontSize(10).fillColor('#1f2937').text(title, x + 12, y + 10, { width: width - 24 });
      let nextY = y + 28;
      doc.fontSize(9).fillColor('#374151');
      for (const line of lines) {
        if (!line) continue;
        if (nextY > y + height - 12) break;
        doc.text(line, x + 12, nextY, { width: width - 24 });
        nextY = doc.y + 1;
      }
    };

    doc
      .roundedRect(50, 50, 492, 78, 10)
      .fill('#0f172a');
    doc
      .fontSize(18)
      .fillColor('#f8fafc')
      .text(issuer.name, 66, 72, { width: 300 });
    doc
      .fontSize(11)
      .fillColor('#cbd5e1')
      .text('FACTURA DE VENTA', 360, 70, { width: 168, align: 'right' })
      .text(`Nº ${invoiceData.invoiceNumber}`, 360, 90, { width: 168, align: 'right' });

    const cardTopY = 144;
    drawInfoCard('Empresa emisora', 50, cardTopY, 238, 122, [
      issuer.taxId ? `NIF/CIF: ${issuer.taxId}` : null,
      issuer.address || null,
      issuer.phone ? `Tel: ${issuer.phone}` : null,
      issuer.email ? `Email: ${issuer.email}` : null
    ]);

    drawInfoCard('Cliente', 304, cardTopY, 238, 122, [
      invoiceData.customer?.name || null,
      invoiceData.customer?.code ? `Codigo: ${invoiceData.customer.code}` : null,
      invoiceData.customer?.taxId ? `NIF/CIF: ${invoiceData.customer.taxId}` : null,
      invoiceData.customer?.address || null,
      invoiceData.customer?.phone ? `Tel: ${invoiceData.customer.phone}` : null,
      invoiceData.customer?.email ? `Email: ${invoiceData.customer.email}` : null
    ]);

    const metadataY = 280;
    const drawMetaValue = (label, value, x) => {
      doc.fontSize(8).fillColor('#6b7280').text(label, x, metadataY);
      doc.fontSize(10).fillColor('#111827').text(value, x, metadataY + 11);
    };

    drawMetaValue('Fecha factura', formatDateForDocument(invoiceData.invoiceDate), 50);
    drawMetaValue('Vencimiento', formatDateForDocument(invoiceData.dueDate), 175);
    drawMetaValue('Estado', String(invoiceData.status || 'pending').toUpperCase(), 300);
    drawMetaValue('Pedido origen', invoiceData.salesOrderNumber || 'Sin pedido', 420);

    const tableColumns = {
      code: { x: 50, width: 70, align: 'left' },
      description: { x: 122, width: 205, align: 'left' },
      quantity: { x: 330, width: 55, align: 'right' },
      price: { x: 387, width: 75, align: 'right' },
      total: { x: 464, width: 78, align: 'right' }
    };

    const drawTableHeader = (y) => {
      doc
        .rect(50, y, 492, 20)
        .fill('#111827');
      doc
        .fillColor('#f8fafc')
        .fontSize(9)
        .text('Codigo', tableColumns.code.x, y + 6, tableColumns.code)
        .text('Descripcion', tableColumns.description.x, y + 6, tableColumns.description)
        .text('Cant.', tableColumns.quantity.x, y + 6, tableColumns.quantity)
        .text('Precio', tableColumns.price.x, y + 6, tableColumns.price)
        .text('Importe', tableColumns.total.x, y + 6, tableColumns.total);
      doc.fillColor('#374151');
    };

    const footerY = doc.page.height - 45;
    const totalSectionHeight = 78;
    const tableBottomLimit = footerY - totalSectionHeight - 12;
    const rowHeight = 16;
    let currentY = metadataY + 34;
    drawTableHeader(currentY);
    currentY += 24;

    const lines = Array.isArray(invoiceData.lines) ? invoiceData.lines : [];
    if (lines.length === 0) {
      doc
        .fontSize(10)
        .fillColor('#6b7280')
        .text('Sin lineas de factura.', 50, currentY + 4);
      currentY += 24;
    } else {
      const maxRows = Math.max(Math.floor((tableBottomLimit - currentY) / rowHeight), 0);
      const visibleLines = lines.slice(0, maxRows);
      const omittedLines = Math.max(lines.length - visibleLines.length, 0);

      visibleLines.forEach((line, index) => {
        const description = truncateText(line.itemDescription || '-', 52);
        if (index % 2 === 0) {
          doc
            .rect(50, currentY - 1, 492, rowHeight)
            .fill('#f9fafb');
        }

        doc
          .fontSize(9)
          .fillColor('#111827')
          .text(line.itemCode || '-', tableColumns.code.x, currentY, tableColumns.code)
          .text(description, tableColumns.description.x, currentY, tableColumns.description)
          .text(String(line.quantity ?? 0), tableColumns.quantity.x, currentY, tableColumns.quantity)
          .text(formatCurrencyEUR(line.unitPrice), tableColumns.price.x, currentY, tableColumns.price)
          .text(formatCurrencyEUR(line.lineTotal), tableColumns.total.x, currentY, tableColumns.total);

        doc
          .strokeColor('#e5e7eb')
          .moveTo(50, currentY + 14)
          .lineTo(542, currentY + 14)
          .stroke();
        currentY += rowHeight;
      });

      if (omittedLines > 0) {
        const omittedY = Math.min(currentY + 2, tableBottomLimit - 6);
        doc
          .fontSize(8)
          .fillColor('#b45309')
          .text(`Se han omitido ${omittedLines} linea(s) para mantener la factura en una sola pagina.`, 50, omittedY);
      }
    }

    const totalY = tableBottomLimit + 8;
    doc
      .roundedRect(332, totalY - 2, 210, 66, 6)
      .fillAndStroke('#f8fafc', '#d1d5db');
    doc
      .fontSize(9)
      .fillColor('#374151')
      .text('Base imponible', 344, totalY + 8, { width: 95, align: 'left' })
      .text(formatCurrencyEUR(invoiceBaseAmount), 444, totalY + 8, { width: 88, align: 'right' })
      .text(`IVA (${vatRate.toFixed(2)}%)`, 344, totalY + 24, { width: 95, align: 'left' })
      .text(formatCurrencyEUR(vatAmount), 444, totalY + 24, { width: 88, align: 'right' });
    doc
      .strokeColor('#cbd5e1')
      .moveTo(344, totalY + 42)
      .lineTo(532, totalY + 42)
      .stroke();
    doc
      .fontSize(11)
      .fillColor('#111827')
      .text('TOTAL', 344, totalY + 46, { width: 95, align: 'left' })
      .text(formatCurrencyEUR(totalWithVat), 444, totalY + 46, { width: 88, align: 'right' });

    doc
      .fontSize(8)
      .fillColor('#64748b')
      .text('Operacion sujeta a IVA general. Este PDF se genera en una sola pagina.', 50, totalY + 14, {
        width: 265
      });

    doc
      .fontSize(8)
      .fillColor('#6b7280')
      .text('Documento generado automaticamente por ERP.', 50, footerY, {
        width: 492,
        align: 'center'
      });

    doc.end();
  } catch (error) {
    console.error('Download sales invoice PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: 'An error occurred while generating the sales invoice PDF',
          status: 500
        }
      });
    } else {
      res.end();
    }
  }
};

/**
 * POST /api/sales-invoices
 * Create invoice, generate journal entry, log to audit trail
 * Calculates due date as invoice_date + 90 days
 */
export const createSalesInvoice = async (req, res) => {
  let connection = null;

  try {
    const { customerId, invoiceNumber, invoiceDate, salesOrderId, lines } = req.body;
    const userId = getUserId(req);

    if (!invoiceNumber || !invoiceDate) {
      return res.status(400).json({
        error: {
          message: 'Invoice number and invoice date are required',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    let effectiveCustomerId = customerId ? Number(customerId) : null;
    let effectiveLines = Array.isArray(lines) ? lines : [];
    let lockedSalesOrder = null;

    if (salesOrderId) {
      const salesOrders = await connection.execute(
        'SELECT * FROM sales_orders WHERE id = ? FOR UPDATE',
        [salesOrderId]
      ).then(([rows]) => rows);

      if (!salesOrders || salesOrders.length === 0) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Sales order not found',
            status: 400
          }
        });
      }

      lockedSalesOrder = salesOrders[0];
      effectiveCustomerId = lockedSalesOrder.customer_id;

      if (lockedSalesOrder.status === 'invoiced') {
        await rollbackTransaction(connection);
        return res.status(409).json({
          error: {
            message: 'Sales order is already invoiced',
            status: 409
          }
        });
      }

      if (lockedSalesOrder.status === 'cancelled') {
        await rollbackTransaction(connection);
        return res.status(409).json({
          error: {
            message: 'Cannot invoice a cancelled sales order',
            status: 409
          }
        });
      }

      if (effectiveLines.length === 0) {
        const orderLines = await connection.execute(
          `SELECT item_id as itemId, quantity, unit_price as unitPrice
           FROM sales_order_lines
           WHERE sales_order_id = ?
           ORDER BY id`,
          [salesOrderId]
        ).then(([rows]) => rows);
        effectiveLines = orderLines;
      }
    }

    if (!effectiveCustomerId || !Array.isArray(effectiveLines) || effectiveLines.length === 0) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Customer and at least one line are required',
          status: 400
        }
      });
    }

    const customers = await connection.execute(
      'SELECT * FROM customers WHERE id = ?',
      [effectiveCustomerId]
    ).then(([rows]) => rows);

    if (!customers || customers.length === 0) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Customer not found',
          status: 400
        }
      });
    }

    let totalAmount = 0;
    for (const line of effectiveLines) {
      if (!line.itemId || !line.quantity || !line.unitPrice) {
        await rollbackTransaction(connection);
        return res.status(400).json({
          error: {
            message: 'Each line requires itemId, quantity and unitPrice',
            status: 400
          }
        });
      }

      const requestedQty = Number(line.quantity);
      const currentStock = await inventoryService.calculateCurrentStock(Number(line.itemId));
      if (currentStock < requestedQty) {
        await rollbackTransaction(connection);
        return res.status(409).json({
          error: {
            message: `Insufficient stock for item ${line.itemId}. Available: ${currentStock}, requested: ${requestedQty}`,
            status: 409
          }
        });
      }

      totalAmount += requestedQty * Number(line.unitPrice);
    }

    const invoiceDateObj = new Date(invoiceDate);
    const dueDateObj = new Date(invoiceDateObj);
    dueDateObj.setDate(dueDateObj.getDate() + 90);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const headerResult = await connection.execute(
      `INSERT INTO sales_invoices 
        (invoice_number, sales_order_id, invoice_date, due_date, customer_id, total_amount, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [invoiceNumber, salesOrderId || null, invoiceDate, dueDate, effectiveCustomerId, totalAmount, userId]
    ).then(([result]) => result);

    const invoiceId = headerResult.insertId;

    for (const line of effectiveLines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      const lineTotal = quantity * unitPrice;

      await connection.execute(
        `INSERT INTO sales_invoice_lines 
          (sales_invoice_id, item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [invoiceId, line.itemId, quantity, unitPrice, lineTotal]
      );

      await inventoryService.createOutboundMovement(
        Number(line.itemId),
        quantity,
        'sales_invoice',
        invoiceId,
        userId,
        null,
        connection
      );
    }

    const journalEntryId = await accountingService.generateSalesInvoiceEntry(invoiceId, connection);
    const inventoryJournalEntryId = await accountingService.generateSalesInventoryOutputEntry(invoiceId, connection);

    await traceabilityService.createDocumentLink(
      'sales_invoice',
      'journal_entry',
      invoiceId,
      journalEntryId,
      'generated',
      connection
    );

    if (inventoryJournalEntryId) {
      await traceabilityService.createDocumentLink(
        'sales_invoice',
        'journal_entry',
        invoiceId,
        inventoryJournalEntryId,
        'generated',
        connection
      );
    }

    if (lockedSalesOrder) {
      await connection.execute(
        `UPDATE sales_orders SET status = 'invoiced' WHERE id = ?`,
        [salesOrderId]
      );

      await connection.execute(
        `UPDATE sales_order_lines
         SET supplied_quantity = quantity
         WHERE sales_order_id = ?`,
        [salesOrderId]
      );

      await traceabilityService.createDocumentLink(
        'sales_order',
        'sales_invoice',
        Number(salesOrderId),
        invoiceId,
        'generated',
        connection
      );
    }

    await traceabilityService.logAction(
      userId,
      'create',
      'sales_invoice',
      invoiceId,
      null,
      { customerId: effectiveCustomerId, invoiceNumber, invoiceDate, dueDate, totalAmount, salesOrderId: salesOrderId || null },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Sales invoice created successfully',
      data: {
        id: invoiceId,
        invoiceNumber,
        salesOrderId: salesOrderId || null,
        invoiceDate,
        dueDate,
        totalAmount,
        status: 'pending',
        journalEntryId,
        inventoryJournalEntryId
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create sales invoice error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the sales invoice',
        status: 500
      }
    });
  }
};

/**
 * =========================
 * 9.2 Collection Endpoints
 * =========================
 */

/**
 * GET /api/collections
 * List collections
 */
export const getCollections = async (req, res) => {
  try {
    const collections = await query(
      `SELECT 
        col.id,
        col.collection_number,
        col.collection_date,
        col.amount,
        col.status,
        col.payment_method,
        si.id as sales_invoice_id,
        si.invoice_number,
        c.id as customer_id,
        c.name as customer_name
      FROM collections col
      JOIN sales_invoices si ON col.sales_invoice_id = si.id
      JOIN customers c ON si.customer_id = c.id
      ORDER BY col.collection_date DESC, col.id DESC`
    );

    res.json({
      success: true,
      data: collections.map(col => ({
        id: col.id,
        collectionNumber: col.collection_number,
        collectionDate: col.collection_date,
        amount: parseFloat(col.amount),
        status: col.status,
        paymentMethod: col.payment_method,
        salesInvoice: {
          id: col.sales_invoice_id,
          invoiceNumber: col.invoice_number
        },
        customer: {
          id: col.customer_id,
          name: col.customer_name
        }
      }))
    });
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching collections',
        status: 500
      }
    });
  }
};

/**
 * GET /api/collections/:id
 * Get collection details
 */
export const getCollectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const collections = await query(
      `SELECT 
        col.*,
        si.id as sales_invoice_id,
        si.invoice_number,
        c.id as customer_id,
        c.name as customer_name
      FROM collections col
      JOIN sales_invoices si ON col.sales_invoice_id = si.id
      JOIN customers c ON si.customer_id = c.id
      WHERE col.id = ?`,
      [id]
    );

    if (!collections || collections.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Collection not found',
          status: 404
        }
      });
    }

    const collection = collections[0];

    res.json({
      success: true,
      data: {
        id: collection.id,
        collectionNumber: collection.collection_number,
        collectionDate: collection.collection_date,
        amount: parseFloat(collection.amount),
        status: collection.status,
        paymentMethod: collection.payment_method,
        notes: collection.notes,
        salesInvoice: {
          id: collection.sales_invoice_id,
          invoiceNumber: collection.invoice_number
        },
        customer: {
          id: collection.customer_id,
          name: collection.customer_name
        }
      }
    });
  } catch (error) {
    console.error('Get collection by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the collection',
        status: 500
      }
    });
  }
};

/**
 * POST /api/collections
 * Register collection as pending and link it to invoice
 * Prevents collection without prior sales invoice
 */
export const createCollection = async (req, res) => {
  let connection = null;

  try {
    const { salesInvoiceId, collectionDate, amount, paymentMethod, notes } = req.body;
    const userId = getUserId(req);
    const normalizedPaymentMethod = normalizeInvoicePaymentMethod(paymentMethod);

    if (!salesInvoiceId || !collectionDate || !amount || !paymentMethod) {
      return res.status(400).json({
        error: {
          message: 'Sales invoice, collection date, amount and payment method are required',
          status: 400
        }
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        error: {
          message: 'Collection amount must be greater than zero',
          status: 400
        }
      });
    }

    if (!ALLOWED_COLLECTION_METHODS.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        error: {
          message: `Invalid payment method. Allowed: ${ALLOWED_COLLECTION_METHODS.join(', ')}`,
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const invoices = await connection.execute(
      'SELECT * FROM sales_invoices WHERE id = ? FOR UPDATE',
      [salesInvoiceId]
    ).then(([rows]) => rows);

    if (!invoices || invoices.length === 0) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Sales invoice not found',
          status: 400
        }
      });
    }

    const invoice = invoices[0];

    const existingCollections = await connection.execute(
      'SELECT COALESCE(SUM(amount), 0) as total_collected FROM collections WHERE sales_invoice_id = ?',
      [salesInvoiceId]
    ).then(([rows]) => rows[0]);

    const totalCollected = parseFloat(existingCollections.total_collected) || 0;
    const newTotal = totalCollected + Number(amount);

    if (newTotal > parseFloat(invoice.total_amount)) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: `Collection amount exceeds pending balance. Pending: ${parseFloat(invoice.total_amount) - totalCollected}`,
          status: 400
        }
      });
    }

    const temporaryCollectionNumber = buildTempNumber('COB');

    const result = await connection.execute(
      `INSERT INTO collections 
        (collection_number, collection_date, sales_invoice_id, amount, status, payment_method, notes, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [temporaryCollectionNumber, collectionDate, salesInvoiceId, amount, normalizedPaymentMethod, notes || null, userId]
    ).then(([r]) => r);

    const collectionId = result.insertId;
    const collectionNumber = buildDocumentNumber('COB', collectionDate, collectionId);

    await connection.execute(
      'UPDATE collections SET collection_number = ? WHERE id = ?',
      [collectionNumber, collectionId]
    );

    await traceabilityService.createDocumentLink(
      'sales_invoice',
      'collection',
      salesInvoiceId,
      collectionId,
      'linked_to',
      connection
    );

    await traceabilityService.logAction(
      userId,
      'create',
      'collection',
      collectionId,
      null,
      { salesInvoiceId, collectionNumber, collectionDate, amount, paymentMethod: normalizedPaymentMethod },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Collection created as pending',
      data: {
        id: collectionId,
        collectionNumber,
        collectionDate,
        amount,
        status: 'pending',
        paymentMethod: normalizedPaymentMethod
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create collection error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while registering the collection',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/collections/:id/status
 * Change collection status. When it becomes realized, it is posted to accounting.
 * Expects body: { status: 'pending' | 'realized' }
 */
export const updateCollectionStatus = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = getUserId(req);

    if (!['pending', 'realized'].includes(status)) {
      return res.status(400).json({
        error: {
          message: 'Invalid status. Allowed: pending, realized',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const collections = await connection.execute(
      'SELECT * FROM collections WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!collections || collections.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Collection not found',
          status: 404
        }
      });
    }

    const existing = collections[0];

    if (existing.status === status) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Status is already the same',
          status: 400
        }
      });
    }

    if (existing.status === 'realized' && status === 'pending') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Realized collection cannot be moved back to pending',
          status: 409
        }
      });
    }

    await connection.execute(
      'UPDATE collections SET status = ? WHERE id = ?',
      [status, id]
    );

    let journalEntryId = null;
    let invoiceStatus = null;
    let collectedAmount = null;

    if (status === 'realized') {
      journalEntryId = await accountingService.generateCollectionEntry(Number(id), connection);

      await traceabilityService.createDocumentLink(
        'collection',
        'journal_entry',
        Number(id),
        journalEntryId,
        'generated',
        connection
      );

      const invoices = await connection.execute(
        'SELECT * FROM sales_invoices WHERE id = ? FOR UPDATE',
        [existing.sales_invoice_id]
      ).then(([rows]) => rows);

      const invoice = invoices[0];

      const [sumRow] = await connection.execute(
        `SELECT COALESCE(SUM(amount), 0) as collected_amount
         FROM collections
         WHERE sales_invoice_id = ?
           AND status = 'realized'`,
        [existing.sales_invoice_id]
      ).then(([rows]) => rows);

      collectedAmount = parseFloat(sumRow?.collected_amount) || 0;
      invoiceStatus = collectedAmount >= parseFloat(invoice.total_amount)
        ? 'collected'
        : collectedAmount > 0
          ? 'partially_collected'
          : 'pending';

      await connection.execute(
        'UPDATE sales_invoices SET collected_amount = ?, status = ? WHERE id = ?',
        [collectedAmount, invoiceStatus, existing.sales_invoice_id]
      );
    }

    await traceabilityService.logAction(
      userId,
      'update',
      'collection',
      Number(id),
      { status: existing.status },
      { status },
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: status === 'realized'
        ? 'Collection marked as realized and posted to accounting'
        : 'Collection status updated',
      data: {
        id: Number(id),
        status,
        journalEntryId,
        invoiceStatus,
        collectedAmount
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Update collection status error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the collection status',
        status: 500
      }
    });
  }
};

/**
 * =========================
 * 9.3 Payment Endpoints
 * =========================
 */

/**
 * GET /api/payments
 * List payments
 */
export const getPayments = async (req, res) => {
  try {
    const payments = await query(
      `SELECT 
        p.id,
        p.payment_number,
        p.payment_date,
        p.amount,
        p.status,
        p.payment_method,
        pi.id as purchase_invoice_id,
        pi.invoice_number,
        s.id as supplier_id,
        s.name as supplier_name
      FROM payments p
      JOIN purchase_invoices pi ON p.purchase_invoice_id = pi.id
      JOIN suppliers s ON pi.supplier_id = s.id
      ORDER BY p.payment_date DESC, p.id DESC`
    );

    res.json({
      success: true,
      data: payments.map(p => ({
        id: p.id,
        paymentNumber: p.payment_number,
        paymentDate: p.payment_date,
        amount: parseFloat(p.amount),
        status: p.status,
        paymentMethod: p.payment_method,
        purchaseInvoice: {
          id: p.purchase_invoice_id,
          invoiceNumber: p.invoice_number
        },
        supplier: {
          id: p.supplier_id,
          name: p.supplier_name
        }
      }))
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching payments',
        status: 500
      }
    });
  }
};

/**
 * GET /api/payments/:id
 * Get payment details
 */
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payments = await query(
      `SELECT 
        p.*,
        pi.id as purchase_invoice_id,
        pi.invoice_number,
        s.id as supplier_id,
        s.name as supplier_name
      FROM payments p
      JOIN purchase_invoices pi ON p.purchase_invoice_id = pi.id
      JOIN suppliers s ON pi.supplier_id = s.id
      WHERE p.id = ?`,
      [id]
    );

    if (!payments || payments.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Payment not found',
          status: 404
        }
      });
    }

    const payment = payments[0];

    res.json({
      success: true,
      data: {
        id: payment.id,
        paymentNumber: payment.payment_number,
        paymentDate: payment.payment_date,
        amount: parseFloat(payment.amount),
        status: payment.status,
        paymentMethod: payment.payment_method,
        notes: payment.notes,
        purchaseInvoice: {
          id: payment.purchase_invoice_id,
          invoiceNumber: payment.invoice_number
        },
        supplier: {
          id: payment.supplier_id,
          name: payment.supplier_name
        }
      }
    });
  } catch (error) {
    console.error('Get payment by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the payment',
        status: 500
      }
    });
  }
};

/**
 * POST /api/payments
 * Register payment as pending and link it to invoice
 * Prevents payment without prior purchase invoice
 */
export const createPayment = async (req, res) => {
  let connection = null;

  try {
    const { purchaseInvoiceId, paymentDate, amount, paymentMethod, notes } = req.body;
    const userId = getUserId(req);
    const normalizedPaymentMethod = normalizeInvoicePaymentMethod(paymentMethod);

    if (!purchaseInvoiceId || !paymentDate || !amount || !paymentMethod) {
      return res.status(400).json({
        error: {
          message: 'Purchase invoice, payment date, amount and payment method are required',
          status: 400
        }
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        error: {
          message: 'Payment amount must be greater than zero',
          status: 400
        }
      });
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        error: {
          message: `Invalid payment method. Allowed: ${ALLOWED_PAYMENT_METHODS.join(', ')}`,
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const invoices = await connection.execute(
      'SELECT * FROM purchase_invoices WHERE id = ? FOR UPDATE',
      [purchaseInvoiceId]
    ).then(([rows]) => rows);

    if (!invoices || invoices.length === 0) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Purchase invoice not found',
          status: 400
        }
      });
    }

    const invoice = invoices[0];

    const existingPayments = await connection.execute(
      'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE purchase_invoice_id = ?',
      [purchaseInvoiceId]
    ).then(([rows]) => rows[0]);

    const totalPaid = parseFloat(existingPayments.total_paid) || 0;
    const newTotal = totalPaid + Number(amount);

    if (newTotal > parseFloat(invoice.total_amount)) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: `Payment amount exceeds pending balance. Pending: ${parseFloat(invoice.total_amount) - totalPaid}`,
          status: 400
        }
      });
    }

    const temporaryPaymentNumber = buildTempNumber('PAG');

    const result = await connection.execute(
      `INSERT INTO payments 
        (payment_number, payment_date, purchase_invoice_id, amount, status, payment_method, notes, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [temporaryPaymentNumber, paymentDate, purchaseInvoiceId, amount, normalizedPaymentMethod, notes || null, userId]
    ).then(([r]) => r);

    const paymentId = result.insertId;
    const paymentNumber = buildDocumentNumber('PAG', paymentDate, paymentId);

    await connection.execute(
      'UPDATE payments SET payment_number = ? WHERE id = ?',
      [paymentNumber, paymentId]
    );

    await traceabilityService.createDocumentLink(
      'purchase_invoice',
      'payment',
      purchaseInvoiceId,
      paymentId,
      'linked_to',
      connection
    );

    await traceabilityService.logAction(
      userId,
      'create',
      'payment',
      paymentId,
      null,
      { purchaseInvoiceId, paymentNumber, paymentDate, amount, paymentMethod: normalizedPaymentMethod },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Payment created as pending',
      data: {
        id: paymentId,
        paymentNumber,
        paymentDate,
        amount,
        status: 'pending',
        paymentMethod: normalizedPaymentMethod
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create payment error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while registering the payment',
        status: 500
      }
    });
  }
};

/**
 * PUT /api/payments/:id/status
 * Change payment status. When it becomes realized, it is posted to accounting.
 * Expects body: { status: 'pending' | 'realized' }
 */
export const updatePaymentStatus = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = getUserId(req);

    if (!['pending', 'realized'].includes(status)) {
      return res.status(400).json({
        error: {
          message: 'Invalid status. Allowed: pending, realized',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const payments = await connection.execute(
      'SELECT * FROM payments WHERE id = ? FOR UPDATE',
      [id]
    ).then(([rows]) => rows);

    if (!payments || payments.length === 0) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Payment not found',
          status: 404
        }
      });
    }

    const existing = payments[0];

    if (existing.status === status) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Status is already the same',
          status: 400
        }
      });
    }

    if (existing.status === 'realized' && status === 'pending') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'Realized payment cannot be moved back to pending',
          status: 409
        }
      });
    }

    await connection.execute(
      'UPDATE payments SET status = ? WHERE id = ?',
      [status, id]
    );

    let journalEntryId = null;
    let invoiceStatus = null;
    let paidAmount = null;

    if (status === 'realized') {
      journalEntryId = await accountingService.generatePaymentEntry(Number(id), connection);

      await traceabilityService.createDocumentLink(
        'payment',
        'journal_entry',
        Number(id),
        journalEntryId,
        'generated',
        connection
      );

      const invoices = await connection.execute(
        'SELECT * FROM purchase_invoices WHERE id = ? FOR UPDATE',
        [existing.purchase_invoice_id]
      ).then(([rows]) => rows);

      const invoice = invoices[0];

      const [sumRow] = await connection.execute(
        `SELECT COALESCE(SUM(amount), 0) as paid_amount
         FROM payments
         WHERE purchase_invoice_id = ?
           AND status = 'realized'`,
        [existing.purchase_invoice_id]
      ).then(([rows]) => rows);

      paidAmount = parseFloat(sumRow?.paid_amount) || 0;
      invoiceStatus = paidAmount >= parseFloat(invoice.total_amount)
        ? 'paid'
        : paidAmount > 0
          ? 'partially_paid'
          : 'pending';

      await connection.execute(
        'UPDATE purchase_invoices SET paid_amount = ?, status = ? WHERE id = ?',
        [paidAmount, invoiceStatus, existing.purchase_invoice_id]
      );
    }

    await traceabilityService.logAction(
      userId,
      'update',
      'payment',
      Number(id),
      { status: existing.status },
      { status },
      connection
    );

    await commitTransaction(connection);

    res.json({
      success: true,
      message: status === 'realized'
        ? 'Payment marked as realized and posted to accounting'
        : 'Payment status updated',
      data: {
        id: Number(id),
        status,
        journalEntryId,
        invoiceStatus,
        paidAmount
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Update payment status error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while updating the payment status',
        status: 500
      }
    });
  }
};

export default {
  getSalesInvoices,
  getSalesInvoiceById,
  downloadSalesInvoicePdf,
  createSalesInvoice,
  getCollections,
  getCollectionById,
  createCollection,
  updateCollectionStatus,
  getPayments,
  getPaymentById,
  createPayment,
  updatePaymentStatus
};
