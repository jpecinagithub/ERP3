# Services Layer

This directory contains business logic services for the ERP Contable Completo system.

## AccountingService

The `accountingService.js` module is the core of the automatic accounting system. It generates journal entries automatically when business documents (invoices, payments, collections) are created, ensuring proper double-entry bookkeeping according to Spanish PGCE standards.

### Features

- **Automatic Journal Entry Generation**: Creates accounting entries for business transactions
- **Double-Entry Bookkeeping**: Ensures every transaction has balanced debit and credit entries
- **PGCE Compliance**: Follows Spanish General Accounting Plan (Plan General Contable Español)
- **Financial Reporting**: Generates Balance Sheet and P&L reports

### Methods

#### `generatePurchaseInvoiceEntry(invoiceId, connection)`
Generates automatic journal entry for a purchase invoice.
- **Debit**: Account 600 (Compras/Purchases)
- **Credit**: Account 400 (Proveedores/Suppliers)

**Parameters:**
- `invoiceId` (number): Purchase invoice ID
- `connection` (object, optional): Database connection for transactions

**Returns:** Promise<number> - Created journal entry ID

**Example:**
```javascript
const journalEntryId = await accountingService.generatePurchaseInvoiceEntry(123);
```

#### `generateSalesInvoiceEntry(invoiceId, connection)`
Generates automatic journal entry for a sales invoice.
- **Debit**: Account 430 (Clientes/Customers)
- **Credit**: Account 700 (Ventas/Sales)

**Parameters:**
- `invoiceId` (number): Sales invoice ID
- `connection` (object, optional): Database connection for transactions

**Returns:** Promise<number> - Created journal entry ID

**Example:**
```javascript
const journalEntryId = await accountingService.generateSalesInvoiceEntry(456);
```

#### `generateCollectionEntry(collectionId, connection)`
Generates automatic journal entry for a customer payment collection.
- **Debit**: Account 572 (Bancos/Banks)
- **Credit**: Account 430 (Clientes/Customers)

**Parameters:**
- `collectionId` (number): Collection ID
- `connection` (object, optional): Database connection for transactions

**Returns:** Promise<number> - Created journal entry ID

**Example:**
```javascript
const journalEntryId = await accountingService.generateCollectionEntry(789);
```

#### `generatePaymentEntry(paymentId, connection)`
Generates automatic journal entry for a supplier payment.
- **Debit**: Account 400 (Proveedores/Suppliers)
- **Credit**: Account 572 (Bancos/Banks)

**Parameters:**
- `paymentId` (number): Payment ID
- `connection` (object, optional): Database connection for transactions

**Returns:** Promise<number> - Created journal entry ID

**Example:**
```javascript
const journalEntryId = await accountingService.generatePaymentEntry(321);
```

#### `validateEntryBalance(entryId)`
Validates that a journal entry is balanced (total debit = total credit).

**Parameters:**
- `entryId` (number): Journal entry ID

**Returns:** Promise<object> - Validation result
```javascript
{
  isBalanced: boolean,
  totalDebit: number,
  totalCredit: number,
  difference: number
}
```

**Example:**
```javascript
const validation = await accountingService.validateEntryBalance(100);
if (!validation.isBalanced) {
  console.error(`Entry is unbalanced by ${validation.difference}`);
}
```

#### `calculateBalanceSheet(startDate, endDate)`
Calculates the Balance Sheet (Balance de Situación) for a given period.

**Parameters:**
- `startDate` (string): Start date in YYYY-MM-DD format
- `endDate` (string): End date in YYYY-MM-DD format

**Returns:** Promise<object> - Balance sheet data
```javascript
{
  startDate: string,
  endDate: string,
  assets: Array<{code, name, balance}>,
  liabilities: Array<{code, name, balance}>,
  equity: Array<{code, name, balance}>,
  totalAssets: number,
  totalLiabilities: number,
  totalEquity: number,
  isBalanced: boolean,
  difference: number
}
```

**Example:**
```javascript
const balanceSheet = await accountingService.calculateBalanceSheet('2025-01-01', '2025-12-31');
console.log(`Total Assets: ${balanceSheet.totalAssets}`);
console.log(`Is Balanced: ${balanceSheet.isBalanced}`);
```

#### `calculatePnL(startDate, endDate)`
Calculates the Profit & Loss report (Pérdidas y Ganancias) for a given period.

**Parameters:**
- `startDate` (string): Start date in YYYY-MM-DD format
- `endDate` (string): End date in YYYY-MM-DD format

**Returns:** Promise<object> - P&L report data
```javascript
{
  startDate: string,
  endDate: string,
  income: Array<{code, name, amount}>,
  expenses: Array<{code, name, amount}>,
  totalIncome: number,
  totalExpenses: number,
  result: number,
  resultType: 'profit' | 'loss'
}
```

**Example:**
```javascript
const pnl = await accountingService.calculatePnL('2025-01-01', '2025-12-31');
console.log(`Total Income: ${pnl.totalIncome}`);
console.log(`Total Expenses: ${pnl.totalExpenses}`);
console.log(`Result: ${pnl.result} (${pnl.resultType})`);
```

### Usage in Controllers

The accounting service should be called automatically when business documents are created:

```javascript
import accountingService from '../services/accountingService.js';
import { beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';

// Example: Creating a purchase invoice with automatic accounting entry
async function createPurchaseInvoice(req, res) {
  const connection = await beginTransaction();
  
  try {
    // 1. Create the purchase invoice
    const [result] = await connection.execute(
      'INSERT INTO purchase_invoices (...) VALUES (...)',
      [...]
    );
    const invoiceId = result.insertId;
    
    // 2. Automatically generate the accounting entry
    const journalEntryId = await accountingService.generatePurchaseInvoiceEntry(
      invoiceId,
      connection
    );
    
    // 3. Commit the transaction
    await commitTransaction(connection);
    
    res.status(201).json({
      success: true,
      invoiceId,
      journalEntryId
    });
  } catch (error) {
    await rollbackTransaction(connection);
    res.status(500).json({ error: error.message });
  }
}
```

### Testing

Run the test suite:
```bash
node src/services/accountingService.test.js
```

The test suite covers:
- Purchase invoice entry generation
- Sales invoice entry generation
- Collection entry generation
- Payment entry generation
- Entry balance validation
- Balance sheet calculation
- P&L report calculation

### PGCE Account Codes

The service uses the following standard Spanish PGCE account codes:

| Code | Name | Type | Usage |
|------|------|------|-------|
| 100 | Capital social | Equity | Initial capital |
| 129 | Resultado del ejercicio | Equity | Period result |
| 300 | Existencias | Asset | Inventory |
| 400 | Proveedores | Liability | Suppliers payable |
| 430 | Clientes | Asset | Customers receivable |
| 570 | Caja | Asset | Cash |
| 572 | Bancos | Asset | Banks |
| 600 | Compras | Expense | Purchases |
| 700 | Ventas | Income | Sales |

### Error Handling

All methods throw errors if:
- Required documents are not found
- Database operations fail
- Data integrity constraints are violated

Always wrap service calls in try-catch blocks and use database transactions for multi-step operations.


## ValidationService

The `validationService.js` module implements 20 critical accounting validation rules that ensure data integrity across the entire ERP system. These validations must pass before closing fiscal periods and are essential for maintaining PGCE compliance.

### Features

- **Fundamental Equation Validation**: Ensures Assets = Liabilities + Equity
- **Coherence Validations**: Verifies consistency between modules (inventory, receivables, payables)
- **Integrity Checks**: Prevents impossible states (negative inventory, excessive depreciation)
- **Period Close Validation**: Comprehensive validation before fiscal period closure

### Methods

#### `validateFundamentalEquation()`
Validates the fundamental accounting equation: Assets = Liabilities + Equity.

**Returns:** Promise<object>
```javascript
{
  isValid: boolean,
  totalAssets: number,
  totalLiabilities: number,
  totalEquity: number,
  liabilitiesPlusEquity: number,
  difference: number,
  message: string
}
```

**Example:**
```javascript
const result = await validationService.validateFundamentalEquation();
if (!result.isValid) {
  console.error(result.message);
  console.error(`Difference: ${result.difference}`);
}
```

#### `validateInventoryCoherence()`
Validates that inventory value equals account 300 Existencias balance.

**Returns:** Promise<object>
```javascript
{
  isValid: boolean,
  inventoryValue: number,
  account300Balance: number,
  difference: number,
  message: string
}
```

**Example:**
```javascript
const result = await validationService.validateInventoryCoherence();
if (!result.isValid) {
  console.error(`Inventory mismatch: ${result.difference}`);
}
```

#### `validateReceivablesCoherence()`
Validates that account 430 Clientes equals pending sales invoices.

**Returns:** Promise<object>
```javascript
{
  isValid: boolean,
  pendingInvoices: number,
  account430Balance: number,
  difference: number,
  message: string
}
```

**Example:**
```javascript
const result = await validationService.validateReceivablesCoherence();
if (!result.isValid) {
  console.error(`Receivables mismatch: ${result.difference}`);
}
```

#### `validatePayablesCoherence()`
Validates that account 400 Proveedores equals pending purchase invoices.

**Returns:** Promise<object>
```javascript
{
  isValid: boolean,
  pendingInvoices: number,
  account400Balance: number,
  difference: number,
  message: string
}
```

**Example:**
```javascript
const result = await validationService.validatePayablesCoherence();
if (!result.isValid) {
  console.error(`Payables mismatch: ${result.difference}`);
}
```

#### `validatePnLResult()`
Validates that P&L result equals account 129 Resultado del ejercicio.

**Returns:** Promise<object>
```javascript
{
  isValid: boolean,
  totalIncome: number,
  totalExpenses: number,
  calculatedResult: number,
  account129Balance: number,
  difference: number,
  message: string
}
```

**Example:**
```javascript
const result = await validationService.validatePnLResult();
if (!result.isValid) {
  console.error(`P&L result mismatch: ${result.difference}`);
}
```

#### `validateNonNegativeInventory()`
Validates that inventory never has negative stock.

**Returns:** Promise<object>
```javascript
{
  isValid: boolean,
  negativeItemsCount: number,
  negativeItems: Array<{id, code, description, currentStock}>,
  message: string
}
```

**Example:**
```javascript
const result = await validationService.validateNonNegativeInventory();
if (!result.isValid) {
  console.error(`Found ${result.negativeItemsCount} items with negative stock`);
  result.negativeItems.forEach(item => {
    console.error(`${item.code}: ${item.currentStock}`);
  });
}
```

#### `validateNonNegativeFixedAssets()`
Validates that fixed assets (group 2) never have negative balances.

**Returns:** Promise<object>
```javascript
{
  isValid: boolean,
  negativeAccountsCount: number,
  negativeAccounts: Array<{id, code, name, balance}>,
  message: string
}
```

**Example:**
```javascript
const result = await validationService.validateNonNegativeFixedAssets();
if (!result.isValid) {
  console.error(`Found ${result.negativeAccountsCount} fixed assets with negative balance`);
}
```

#### `validateDepreciation()`
Validates that accumulated depreciation does not exceed fixed asset value.

**Returns:** Promise<object>
```javascript
{
  isValid: boolean,
  violationsCount: number,
  violations: Array<{assetCode, assetName, assetValue, depreciationCode, accumulatedDepreciation, excess}>,
  message: string
}
```

**Example:**
```javascript
const result = await validationService.validateDepreciation();
if (!result.isValid) {
  result.violations.forEach(v => {
    console.error(`${v.assetCode}: Depreciation ${v.accumulatedDepreciation} exceeds asset value ${v.assetValue}`);
  });
}
```

#### `validateAllRules()`
Runs all validation rules before period close. This is the master validation that must pass before closing a fiscal period.

**Returns:** Promise<object>
```javascript
{
  allValid: boolean,
  validationsCount: number,
  passedCount: number,
  failedCount: number,
  validations: {
    fundamentalEquation: object,
    inventoryCoherence: object,
    receivablesCoherence: object,
    payablesCoherence: object,
    pnlResult: object,
    nonNegativeInventory: object,
    nonNegativeFixedAssets: object,
    depreciation: object
  },
  failedValidations: Array<{rule, message}>,
  message: string
}
```

**Example:**
```javascript
const result = await validationService.validateAllRules();
if (!result.allValid) {
  console.error(`${result.failedCount} validation(s) failed:`);
  result.failedValidations.forEach(failure => {
    console.error(`- ${failure.rule}: ${failure.message}`);
  });
} else {
  console.log('All validations passed. Period can be closed.');
}
```

### Usage in Controllers

The validation service should be called before critical operations like period closure:

```javascript
import validationService from '../services/validationService.js';

// Example: Closing a fiscal period
async function closeFiscalPeriod(req, res) {
  try {
    const { periodId } = req.params;
    
    // 1. Run all validation rules
    const validationResult = await validationService.validateAllRules();
    
    // 2. Check if all validations passed
    if (!validationResult.allValid) {
      return res.status(400).json({
        success: false,
        message: 'Cannot close period. Validation failed.',
        failedValidations: validationResult.failedValidations
      });
    }
    
    // 3. Proceed with period closure
    await query(
      'UPDATE fiscal_periods SET status = ?, closed_by = ?, closed_at = NOW() WHERE id = ?',
      ['closed', req.user.id, periodId]
    );
    
    res.json({
      success: true,
      message: 'Period closed successfully',
      validationResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Validation Rules Summary

| Rule | Description | Requirements |
|------|-------------|--------------|
| Fundamental Equation | Assets = Liabilities + Equity | Req 19.1-19.5 |
| Inventory Coherence | Inventory value = Account 300 | Req 4.6, 23.1-23.5 |
| Receivables Coherence | Account 430 = Pending sales invoices | Req 7.5, 24.1-24.5 |
| Payables Coherence | Account 400 = Pending purchase invoices | Req 7.6, 25.1-25.5 |
| P&L Result | P&L result = Account 129 | Req 8.5, 26.1-26.5 |
| Non-Negative Inventory | Prevent negative stock | Req 4.4 |
| Non-Negative Fixed Assets | Prevent negative fixed assets | Req 20.1 |
| Depreciation | Depreciation ≤ Asset value | Req 20.2-20.4 |
| All Rules | Run all validations | Req 27.5 |

### Testing

Run the test suite:
```bash
npm test -- validationService.test.js --run
```

The test suite covers:
- Fundamental equation validation (balanced and imbalanced scenarios)
- Inventory coherence (matching and mismatched scenarios)
- Receivables coherence
- Payables coherence
- P&L result validation
- Non-negative inventory detection
- Non-negative fixed assets detection
- Depreciation validation
- Comprehensive all-rules validation

### Error Handling

All validation methods:
- Return structured results with `isValid` flag
- Never throw errors (validation failures are returned as results)
- Include detailed messages and diagnostic information
- Use 0.01 tolerance for floating-point comparisons

### Performance Considerations

- `validateAllRules()` runs all validations in parallel using `Promise.all()`
- Each validation is optimized with efficient SQL queries
- Results are cached within the same validation run
- Suitable for real-time validation during period closure


## InventoryService

The `inventoryService.js` module manages inventory based on movements (no direct stock field). Stock is always calculated as the sum of all movements (inbound - outbound), ensuring complete traceability and historical accuracy.

### Features

- **Movement-Based Inventory**: Stock calculated from movement history, never stored directly
- **Complete Traceability**: Every movement links to source document and user
- **Negative Stock Prevention**: Validates stock availability before outbound movements
- **Transaction Support**: All operations support database transactions for atomicity
- **Average Cost Calculation**: Automatic calculation of weighted average unit cost

### Core Principles

1. **No Direct Stock Field**: Stock is ALWAYS calculated as `SUM(quantity)` from movements
2. **Inbound Movements**: Positive quantities (purchases, adjustments in)
3. **Outbound Movements**: Negative quantities (sales, adjustments out)
4. **Historical Accuracy**: Complete movement history maintained forever
5. **Source Document Linking**: Every movement traces back to originating document

### Methods

#### `createInboundMovement(itemId, quantity, unitCost, sourceDocType, sourceDocId, userId, notes, connection)`
Creates an inbound inventory movement (entry) when receiving goods.

**Parameters:**
- `itemId` (number): Item ID
- `quantity` (number): Quantity received (must be positive)
- `unitCost` (number): Unit cost of the item
- `sourceDocType` (string): Source document type ('purchase_invoice', 'adjustment')
- `sourceDocId` (number): Source document ID
- `userId` (number): User creating the movement
- `notes` (string, optional): Additional notes
- `connection` (object, optional): Database connection for transactions

**Returns:** Promise<number> - Created movement ID

**Validations:**
- Quantity must be positive
- Unit cost cannot be negative
- Item must exist

**Example:**
```javascript
const movementId = await inventoryService.createInboundMovement(
  itemId,
  100,           // 100 units
  10.50,         // at 10.50 per unit
  'purchase_invoice',
  invoiceId,
  userId,
  'Received from supplier'
);
```

#### `createOutboundMovement(itemId, quantity, sourceDocType, sourceDocId, userId, notes, connection)`
Creates an outbound inventory movement (exit) when goods are sold or consumed.

**Parameters:**
- `itemId` (number): Item ID
- `quantity` (number): Quantity to exit (positive number, stored as negative)
- `sourceDocType` (string): Source document type ('sales_invoice', 'adjustment')
- `sourceDocId` (number): Source document ID
- `userId` (number): User creating the movement
- `notes` (string, optional): Additional notes
- `connection` (object, optional): Database connection for transactions

**Returns:** Promise<number> - Created movement ID

**Validations:**
- Quantity must be positive
- Current stock must be sufficient (prevents negative inventory)
- Item must exist

**Example:**
```javascript
const movementId = await inventoryService.createOutboundMovement(
  itemId,
  30,            // 30 units out
  'sales_invoice',
  salesInvoiceId,
  userId,
  'Sold to customer'
);
```

#### `calculateCurrentStock(itemId)`
Calculates current stock for a specific item by summing all movements.

**Parameters:**
- `itemId` (number): Item ID

**Returns:** Promise<number> - Current stock quantity

**Formula:** `Stock = SUM(quantity) WHERE item_id = itemId`

**Example:**
```javascript
const currentStock = await inventoryService.calculateCurrentStock(itemId);
console.log(`Current stock: ${currentStock} units`);
```

#### `calculateTotalInventoryValue()`
Calculates total inventory value across all items.

**Returns:** Promise<number> - Total inventory value

**Formula:** `Total Value = SUM(total_value) FROM all movements`

**Example:**
```javascript
const totalValue = await inventoryService.calculateTotalInventoryValue();
console.log(`Total inventory value: ${totalValue}`);
```

#### `getItemMovements(itemId, startDate, endDate)`
Retrieves movement history for a specific item with optional date filtering.

**Parameters:**
- `itemId` (number): Item ID
- `startDate` (string, optional): Start date (YYYY-MM-DD)
- `endDate` (string, optional): End date (YYYY-MM-DD)

**Returns:** Promise<Array> - Array of movement records
```javascript
[{
  id: number,
  itemId: number,
  itemCode: string,
  itemDescription: string,
  movementDate: string,
  movementType: 'inbound' | 'outbound' | 'adjustment',
  quantity: number,
  unitCost: number,
  totalValue: number,
  sourceDocumentType: string,
  sourceDocumentId: number,
  notes: string,
  createdBy: number,
  createdByUsername: string,
  createdByName: string,
  createdAt: timestamp
}]
```

**Example:**
```javascript
const movements = await inventoryService.getItemMovements(
  itemId,
  '2025-01-01',
  '2025-12-31'
);

movements.forEach(m => {
  console.log(`${m.movementDate}: ${m.movementType} ${m.quantity} units by ${m.createdByName}`);
});
```

#### `getAllInventoryStatus()`
Gets current inventory status for all items with stock.

**Returns:** Promise<Array> - Array of items with stock information
```javascript
[{
  id: number,
  code: string,
  description: string,
  unitOfMeasure: string,
  standardCost: number,
  currentStock: number,
  currentValue: number,
  averageUnitCost: number
}]
```

**Example:**
```javascript
const inventory = await inventoryService.getAllInventoryStatus();
inventory.forEach(item => {
  console.log(`${item.code}: ${item.currentStock} units @ ${item.averageUnitCost} = ${item.currentValue}`);
});
```

#### `createAdjustment(itemId, adjustmentQuantity, justification, userId, connection)`
Creates a manual inventory adjustment with required justification.

**Parameters:**
- `itemId` (number): Item ID
- `adjustmentQuantity` (number): Quantity to adjust (positive for increase, negative for decrease)
- `justification` (string): Required reason for adjustment
- `userId` (number): User creating the adjustment
- `connection` (object, optional): Database connection for transactions

**Returns:** Promise<number> - Created movement ID

**Validations:**
- Adjustment quantity cannot be zero
- Justification is required (non-empty)
- For negative adjustments, sufficient stock must exist

**Example:**
```javascript
// Positive adjustment (increase stock)
const movementId = await inventoryService.createAdjustment(
  itemId,
  50,
  'Physical inventory count adjustment - found additional units',
  userId
);

// Negative adjustment (decrease stock)
const movementId = await inventoryService.createAdjustment(
  itemId,
  -20,
  'Damaged goods write-off',
  userId
);
```

#### `calculateAverageUnitCost(itemId)`
Calculates weighted average unit cost for an item based on current inventory.

**Parameters:**
- `itemId` (number): Item ID

**Returns:** Promise<number> - Average unit cost

**Formula:** `Avg Cost = SUM(total_value) / SUM(quantity)`

**Example:**
```javascript
const avgCost = await inventoryService.calculateAverageUnitCost(itemId);
console.log(`Average unit cost: ${avgCost}`);
```

### Usage in Controllers

The inventory service should be called automatically when purchase invoices are created:

```javascript
import inventoryService from '../services/inventoryService.js';
import { beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';

// Example: Creating a purchase invoice with automatic inventory entry
async function createPurchaseInvoice(req, res) {
  const connection = await beginTransaction();
  
  try {
    // 1. Create the purchase invoice
    const [invoiceResult] = await connection.execute(
      'INSERT INTO purchase_invoices (...) VALUES (...)',
      [...]
    );
    const invoiceId = invoiceResult.insertId;
    
    // 2. Create invoice lines
    for (const line of req.body.lines) {
      await connection.execute(
        'INSERT INTO purchase_invoice_lines (...) VALUES (...)',
        [invoiceId, line.itemId, line.quantity, line.unitPrice, line.lineTotal]
      );
      
      // 3. Automatically create inventory inbound movement
      await inventoryService.createInboundMovement(
        line.itemId,
        line.quantity,
        line.unitPrice,
        'purchase_invoice',
        invoiceId,
        req.user.id,
        `Received via invoice ${req.body.invoiceNumber}`,
        connection
      );
    }
    
    // 4. Generate accounting entry
    await accountingService.generatePurchaseInvoiceEntry(invoiceId, connection);
    
    // 5. Commit the transaction
    await commitTransaction(connection);
    
    res.status(201).json({
      success: true,
      invoiceId
    });
  } catch (error) {
    await rollbackTransaction(connection);
    res.status(500).json({ error: error.message });
  }
}
```

### Movement Types

| Type | Description | Quantity Sign | Source Documents |
|------|-------------|---------------|------------------|
| inbound | Goods received | Positive (+) | purchase_invoice, adjustment |
| outbound | Goods sold/consumed | Negative (-) | sales_invoice, adjustment |
| adjustment | Manual correction | +/- | adjustment (with justification) |

### Requirements Mapping

| Requirement | Implementation |
|-------------|----------------|
| 4.1 - Automatic inventory entries from purchase invoices | `createInboundMovement()` called when invoice created |
| 4.2 - Manual inventory adjustments with justification | `createAdjustment()` with required justification |
| 4.3 - Track article details and total value | `getAllInventoryStatus()`, `getItemMovements()` |
| 4.4 - Prevent negative inventory | Validation in `createOutboundMovement()` |
| 4.5 - Record user and timestamp | All movements record `created_by` and `created_at` |
| 4.6 - Inventory value = Account 300 | `calculateTotalInventoryValue()` for validation |

### Testing

Run the test suite:
```bash
npm test -- inventoryService.test.js --run        # Integration tests (requires database)
npm test -- inventoryService.unit.test.js --run   # Unit tests (no database required)
```

The test suite covers:
- Inbound movement creation and validation
- Outbound movement creation and negative stock prevention
- Current stock calculation
- Total inventory value calculation
- Movement history retrieval with date filtering
- Inventory status for all items
- Manual adjustments (positive and negative)
- Transaction support and rollback
- Edge cases (zero cost, floating point precision, large values)

### Error Handling

All methods throw errors if:
- Validation fails (negative quantity, insufficient stock, etc.)
- Required items are not found
- Database operations fail
- Justification is missing for adjustments

Always wrap service calls in try-catch blocks and use database transactions for multi-step operations.

### Performance Considerations

- Stock calculation uses efficient `SUM()` aggregation
- Movement history queries are indexed by `item_id` and `movement_date`
- `getAllInventoryStatus()` uses single query with `GROUP BY`
- Transaction support ensures atomicity for complex operations
- Average cost calculation is optimized with single query


## TraceabilityService

The `traceabilityService.js` module maintains complete audit trail and document traceability throughout the ERP system. It implements Requirements 21 (Purchase Cycle Traceability) and 22 (Sales Cycle Traceability), ensuring all operations are traceable from origin to completion.

### Features

- **Document Linking**: Maintains chains between related documents (Budget → Order → Invoice → Payment)
- **Complete Audit Trail**: Records all user actions with timestamps and change history
- **Deletion Protection**: Prevents deletion of documents that are part of traceability chains
- **Bidirectional Tracing**: Retrieve ancestors (source documents) and descendants (derived documents)
- **Comprehensive Logging**: Tracks create, update, delete, and administrative actions

### Core Principles

1. **Complete Traceability**: Every document links to its source and derived documents
2. **Immutable History**: Audit log entries are never modified or deleted
3. **User Accountability**: All actions record the user who performed them
4. **Deletion Safety**: Documents in chains cannot be deleted to preserve history
5. **Compliance Ready**: Full audit trail for regulatory compliance and debugging

### Methods

#### `createDocumentLink(sourceType, targetType, sourceId, targetId, linkType, connection)`
Creates a link between two related documents to maintain the traceability chain.

**Parameters:**
- `sourceType` (string): Source document type ('budget', 'purchase_order', 'purchase_invoice', 'sales_invoice', 'payment', 'collection', 'journal_entry', 'inventory_movement')
- `targetType` (string): Target document type (same options as sourceType)
- `sourceId` (number): Source document ID
- `targetId` (number): Target document ID
- `linkType` (string): Type of link ('converted_to', 'generated', 'paid_by', 'collected_by', 'linked_to')
- `connection` (object, optional): Database connection for transactions

**Returns:** Promise<number> - Created link ID (or existing link ID if duplicate)

**Validations:**
- All parameters are required
- Document types must be valid
- Link type must be valid
- Prevents duplicate links (returns existing link ID)

**Example:**
```javascript
// Link budget to purchase order
const linkId = await traceabilityService.createDocumentLink(
  'budget',
  'purchase_order',
  budgetId,
  purchaseOrderId,
  'converted_to'
);

// Link purchase invoice to journal entry
const linkId = await traceabilityService.createDocumentLink(
  'purchase_invoice',
  'journal_entry',
  invoiceId,
  journalEntryId,
  'generated'
);

// Link purchase invoice to payment
const linkId = await traceabilityService.createDocumentLink(
  'purchase_invoice',
  'payment',
  invoiceId,
  paymentId,
  'paid_by'
);
```

#### `getTraceabilityChain(docType, docId)`
Retrieves the complete traceability chain for a document, including all ancestors and descendants.

**Parameters:**
- `docType` (string): Document type
- `docId` (number): Document ID

**Returns:** Promise<object> - Complete traceability chain
```javascript
{
  document: {
    type: string,
    id: number,
    details: object  // Full document details
  },
  ancestors: Array<{
    linkId: number,
    linkType: string,
    documentType: string,
    documentId: number,
    details: object,
    createdAt: string,
    parents: Array  // Recursive ancestors
  }>,
  descendants: Array<{
    linkId: number,
    linkType: string,
    documentType: string,
    documentId: number,
    details: object,
    createdAt: string,
    children: Array  // Recursive descendants
  }>,
  fullChain: Array<{
    type: string,
    id: number,
    linkType: string,
    details: object
  }>  // Linear representation of complete chain
}
```

**Example:**
```javascript
// Get complete chain for a purchase order
const chain = await traceabilityService.getTraceabilityChain('purchase_order', orderId);

console.log('Ancestors (source documents):');
chain.ancestors.forEach(ancestor => {
  console.log(`  ${ancestor.documentType} #${ancestor.documentId} (${ancestor.linkType})`);
});

console.log('Descendants (derived documents):');
chain.descendants.forEach(descendant => {
  console.log(`  ${descendant.documentType} #${descendant.documentId} (${descendant.linkType})`);
});

console.log('Full chain:');
chain.fullChain.forEach(doc => {
  console.log(`  ${doc.type} #${doc.id}`);
});
```

#### `logAction(userId, action, entityType, entityId, oldValues, newValues, connection)`
Logs a user action in the audit log for compliance and debugging.

**Parameters:**
- `userId` (number): User performing the action
- `action` (string): Action type ('create', 'update', 'delete', 'close_period', 'reopen_period', 'adjust', 'convert')
- `entityType` (string): Entity type being acted upon
- `entityId` (number): Entity ID
- `oldValues` (object, optional): Previous values (for updates/deletes)
- `newValues` (object, optional): New values (for creates/updates)
- `connection` (object, optional): Database connection for transactions

**Returns:** Promise<number> - Created audit log entry ID (or null if logging fails)

**Note:** Audit logging failures do not throw errors to prevent disrupting business operations. Failures are logged to console.

**Example:**
```javascript
// Log document creation
await traceabilityService.logAction(
  userId,
  'create',
  'budget',
  budgetId,
  null,
  { budget_number: 'BUD-001', total_amount: 1000, status: 'pending' }
);

// Log document update
await traceabilityService.logAction(
  userId,
  'update',
  'budget',
  budgetId,
  { status: 'pending' },
  { status: 'converted' }
);

// Log document deletion
await traceabilityService.logAction(
  userId,
  'delete',
  'budget',
  budgetId,
  { budget_number: 'BUD-001', status: 'pending' },
  null
);

// Log period closure
await traceabilityService.logAction(
  userId,
  'close_period',
  'fiscal_period',
  periodId,
  { status: 'open' },
  { status: 'closed' }
);
```

#### `canDeleteDocument(docType, docId)`
Checks if a document can be safely deleted without breaking traceability chains.

**Parameters:**
- `docType` (string): Document type
- `docId` (number): Document ID

**Returns:** Promise<object> - Deletion safety result
```javascript
{
  canDelete: boolean,
  reason: string,
  linkedDocumentsCount: number,  // If has links
  linkedDocuments: Array<{       // If has links
    type: string,
    id: number,
    linkType: string
  }>,
  paymentsCount: number,         // If purchase invoice with payments
  collectionsCount: number,      // If sales invoice with collections
  ordersCount: number            // If budget converted to orders
}
```

**Example:**
```javascript
// Check if budget can be deleted
const result = await traceabilityService.canDeleteDocument('budget', budgetId);

if (result.canDelete) {
  // Safe to delete
  await query('DELETE FROM budgets WHERE id = ?', [budgetId]);
} else {
  console.error(`Cannot delete: ${result.reason}`);
  if (result.linkedDocuments) {
    console.error('Linked documents:');
    result.linkedDocuments.forEach(doc => {
      console.error(`  ${doc.type} #${doc.id} (${doc.linkType})`);
    });
  }
}
```

#### `getAuditLog(entityType, entityId, limit)`
Retrieves audit log entries for a specific entity.

**Parameters:**
- `entityType` (string): Entity type
- `entityId` (number): Entity ID
- `limit` (number, optional): Maximum entries to return (default: 50)

**Returns:** Promise<Array> - Array of audit log entries
```javascript
[{
  id: number,
  userId: number,
  username: string,
  fullName: string,
  action: string,
  entityType: string,
  entityId: number,
  oldValues: object,
  newValues: object,
  createdAt: string
}]
```

**Example:**
```javascript
// Get audit history for a budget
const logs = await traceabilityService.getAuditLog('budget', budgetId, 10);

console.log(`Audit history for budget ${budgetId}:`);
logs.forEach(log => {
  console.log(`${log.createdAt} - ${log.fullName} (${log.username}): ${log.action}`);
  if (log.oldValues) console.log('  Old:', log.oldValues);
  if (log.newValues) console.log('  New:', log.newValues);
});
```

#### `getRecentAuditLog(limit, action, userId)`
Retrieves recent audit log entries across all entities with optional filtering.

**Parameters:**
- `limit` (number, optional): Maximum entries to return (default: 100)
- `action` (string, optional): Filter by action type
- `userId` (number, optional): Filter by user ID

**Returns:** Promise<Array> - Array of audit log entries (same structure as `getAuditLog`)

**Example:**
```javascript
// Get recent 50 audit entries
const recentLogs = await traceabilityService.getRecentAuditLog(50);

// Get recent delete actions
const deletions = await traceabilityService.getRecentAuditLog(20, 'delete');

// Get recent actions by specific user
const userActions = await traceabilityService.getRecentAuditLog(30, null, userId);

// Get recent updates by specific user
const userUpdates = await traceabilityService.getRecentAuditLog(25, 'update', userId);
```

### Document Link Types

| Link Type | Description | Example Usage |
|-----------|-------------|---------------|
| converted_to | Source document converted to target | Budget → Purchase Order |
| generated | Target document automatically generated from source | Purchase Invoice → Journal Entry |
| paid_by | Source document paid by target | Purchase Invoice → Payment |
| collected_by | Source document collected by target | Sales Invoice → Collection |
| linked_to | General association between documents | Any related documents |

### Traceability Chains

#### Purchase Cycle Chain
```
Budget → Purchase Order → Purchase Invoice → [Journal Entry + Inventory Movement] → Payment → [Journal Entry]
```

**Example:**
```javascript
// When creating purchase order from budget
await traceabilityService.createDocumentLink('budget', 'purchase_order', budgetId, orderId, 'converted_to');

// When creating purchase invoice from order
await traceabilityService.createDocumentLink('purchase_order', 'purchase_invoice', orderId, invoiceId, 'converted_to');

// When generating journal entry from invoice
await traceabilityService.createDocumentLink('purchase_invoice', 'journal_entry', invoiceId, journalEntryId, 'generated');

// When creating inventory movement from invoice
await traceabilityService.createDocumentLink('purchase_invoice', 'inventory_movement', invoiceId, movementId, 'generated');

// When paying invoice
await traceabilityService.createDocumentLink('purchase_invoice', 'payment', invoiceId, paymentId, 'paid_by');

// When generating journal entry from payment
await traceabilityService.createDocumentLink('payment', 'journal_entry', paymentId, journalEntryId, 'generated');
```

#### Sales Cycle Chain
```
Sales Invoice → [Journal Entry] → Collection → [Journal Entry]
```

**Example:**
```javascript
// When creating sales invoice
await traceabilityService.createDocumentLink('sales_invoice', 'journal_entry', invoiceId, journalEntryId, 'generated');

// When collecting payment
await traceabilityService.createDocumentLink('sales_invoice', 'collection', invoiceId, collectionId, 'collected_by');

// When generating journal entry from collection
await traceabilityService.createDocumentLink('collection', 'journal_entry', collectionId, journalEntryId, 'generated');
```

### Usage in Controllers

The traceability service should be called for all document operations:

```javascript
import traceabilityService from '../services/traceabilityService.js';
import { beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';

// Example: Converting budget to purchase order
async function convertBudgetToOrder(req, res) {
  const connection = await beginTransaction();
  
  try {
    const { budgetId } = req.params;
    
    // 1. Get budget details
    const [budget] = await connection.execute(
      'SELECT * FROM budgets WHERE id = ?',
      [budgetId]
    );
    
    // 2. Create purchase order
    const [orderResult] = await connection.execute(
      'INSERT INTO purchase_orders (...) VALUES (...)',
      [...]
    );
    const orderId = orderResult.insertId;
    
    // 3. Create document link for traceability
    await traceabilityService.createDocumentLink(
      'budget',
      'purchase_order',
      budgetId,
      orderId,
      'converted_to',
      connection
    );
    
    // 4. Update budget status
    await connection.execute(
      'UPDATE budgets SET status = ? WHERE id = ?',
      ['converted', budgetId]
    );
    
    // 5. Log the conversion action
    await traceabilityService.logAction(
      req.user.id,
      'convert',
      'budget',
      budgetId,
      { status: budget.status },
      { status: 'converted', converted_to_order: orderId },
      connection
    );
    
    // 6. Commit transaction
    await commitTransaction(connection);
    
    res.status(201).json({
      success: true,
      orderId,
      budgetId
    });
  } catch (error) {
    await rollbackTransaction(connection);
    res.status(500).json({ error: error.message });
  }
}

// Example: Deleting a document with safety check
async function deleteBudget(req, res) {
  try {
    const { budgetId } = req.params;
    
    // 1. Check if document can be deleted
    const deleteCheck = await traceabilityService.canDeleteDocument('budget', budgetId);
    
    if (!deleteCheck.canDelete) {
      return res.status(400).json({
        success: false,
        message: deleteCheck.reason,
        linkedDocuments: deleteCheck.linkedDocuments
      });
    }
    
    // 2. Get budget details for audit log
    const [budget] = await query('SELECT * FROM budgets WHERE id = ?', [budgetId]);
    
    // 3. Delete the budget
    await query('DELETE FROM budgets WHERE id = ?', [budgetId]);
    
    // 4. Log the deletion
    await traceabilityService.logAction(
      req.user.id,
      'delete',
      'budget',
      budgetId,
      budget,
      null
    );
    
    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Requirements Mapping

| Requirement | Implementation |
|-------------|----------------|
| 21.1 - Maintain links between purchase documents | `createDocumentLink()` for Budget → Order → Invoice → Payment |
| 21.2 - View complete purchase trace | `getTraceabilityChain()` returns full chain |
| 21.3 - Display linked documents | Chain includes all related documents with details |
| 21.4 - Record user and timestamp | All links and logs include user and timestamp |
| 21.5 - Prevent deletion of chain documents | `canDeleteDocument()` checks for links |
| 22.1 - Maintain links between sales documents | `createDocumentLink()` for Invoice → Collection |
| 22.2 - View complete sales trace | `getTraceabilityChain()` returns full chain |
| 22.3 - Display linked documents | Chain includes all related documents with details |
| 22.4 - Record user and timestamp | All links and logs include user and timestamp |
| 22.5 - Prevent deletion of chain documents | `canDeleteDocument()` checks for links |

### Testing

Run the test suite:
```bash
npm test -- traceabilityService.test.js --run        # Integration tests (requires database)
npm test -- traceabilityService.unit.test.js --run   # Unit tests (no database required)
```

The test suite covers:
- Document link creation and duplicate prevention
- Invalid document type and link type rejection
- Complete traceability chain retrieval (ancestors and descendants)
- Chain building from different positions (first, middle, last)
- Audit log creation for all action types
- Deletion safety checks for various scenarios
- Purchase invoice with payments prevention
- Sales invoice with collections prevention
- Budget conversion prevention
- Audit log retrieval with filtering
- Recent audit log with action and user filters

### Error Handling

Most methods throw errors if:
- Required parameters are missing
- Invalid document types or link types are provided
- Documents are not found
- Database operations fail

**Exception:** `logAction()` never throws errors. Audit logging failures are logged to console but do not disrupt business operations.

Always wrap service calls in try-catch blocks and use database transactions for multi-step operations.

### Performance Considerations

- Document link queries are indexed by `source_document_type`, `source_document_id`, `target_document_type`, `target_document_id`
- Audit log queries are indexed by `entity_type`, `entity_id`, `user_id`, `action`
- Recursive chain traversal uses visited set to prevent infinite loops
- Chain retrieval is optimized with efficient SQL queries
- Duplicate link prevention uses indexed lookup before insert

### Security and Compliance

- **Immutable Audit Trail**: Audit log entries are never modified or deleted
- **User Accountability**: All actions record the user who performed them
- **Timestamp Accuracy**: All entries use database timestamps for consistency
- **Change History**: Old and new values stored as JSON for complete history
- **Deletion Protection**: Prevents accidental deletion of critical documents
- **Compliance Ready**: Full audit trail meets regulatory requirements
