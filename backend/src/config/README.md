# Database Configuration Module

## Overview

This module provides MySQL database connectivity for the ERP Contable backend application using connection pooling for efficient resource management and comprehensive error handling for robust operation.

## Features

- **Connection Pooling**: Efficient connection management with configurable pool size
- **Automatic Retry Logic**: Configurable retry mechanism for connection failures
- **Transaction Support**: Built-in transaction management with commit/rollback
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Graceful Shutdown**: Proper cleanup of database connections
- **Keep-Alive**: Maintains persistent connections to prevent timeouts

## Configuration

Database configuration is managed through environment variables in `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=erp_contable
```

## Connection Pool Settings

- **connectionLimit**: 10 connections (configurable)
- **waitForConnections**: true (queue requests when pool is full)
- **queueLimit**: 0 (unlimited queue)
- **enableKeepAlive**: true (prevent connection timeouts)

## API Reference

### Core Functions

#### `createPool()`
Creates a new MySQL connection pool.

```javascript
import { createPool } from './config/database.js';
const pool = createPool();
```

#### `getPool()`
Gets the existing connection pool or creates a new one.

```javascript
import { getPool } from './config/database.js';
const pool = getPool();
```

#### `testConnection(maxRetries, retryDelay)`
Tests database connection with retry logic.

**Parameters:**
- `maxRetries` (number): Maximum retry attempts (default: 5)
- `retryDelay` (number): Delay between retries in ms (default: 3000)

**Returns:** Promise<boolean>

```javascript
import { testConnection } from './config/database.js';

try {
  await testConnection(5, 3000);
  console.log('Database connected');
} catch (error) {
  console.error('Connection failed:', error.message);
}
```

#### `query(sql, params)`
Executes a SQL query with automatic connection handling.

**Parameters:**
- `sql` (string): SQL query string
- `params` (Array): Query parameters (default: [])

**Returns:** Promise<Array>

```javascript
import { query } from './config/database.js';

const users = await query('SELECT * FROM users WHERE role = ?', ['administrador']);
```

### Transaction Management

#### `beginTransaction()`
Begins a database transaction and returns a connection.

**Returns:** Promise<PoolConnection>

```javascript
import { beginTransaction, commitTransaction, rollbackTransaction } from './config/database.js';

const connection = await beginTransaction();

try {
  await connection.execute('INSERT INTO users (username) VALUES (?)', ['john']);
  await connection.execute('INSERT INTO audit_log (action) VALUES (?)', ['user_created']);
  await commitTransaction(connection);
} catch (error) {
  await rollbackTransaction(connection);
  throw error;
}
```

#### `commitTransaction(connection)`
Commits a transaction and releases the connection.

**Parameters:**
- `connection` (PoolConnection): Active transaction connection

#### `rollbackTransaction(connection)`
Rolls back a transaction and releases the connection.

**Parameters:**
- `connection` (PoolConnection): Active transaction connection

### Utility Functions

#### `closePool()`
Closes the connection pool gracefully.

```javascript
import { closePool } from './config/database.js';

await closePool();
```

#### `handleDatabaseError(error)`
Handles database errors and provides user-friendly messages.

**Parameters:**
- `error` (Error): Database error object

**Returns:** Object with formatted error response

```javascript
import { handleDatabaseError } from './config/database.js';

try {
  await query('INSERT INTO users ...');
} catch (error) {
  const errorResponse = handleDatabaseError(error);
  res.status(500).json(errorResponse);
}
```

## Error Handling

The module handles common MySQL errors and provides user-friendly messages:

| Error Code | User-Friendly Message |
|------------|----------------------|
| ECONNREFUSED | Unable to connect to database. Please check if the database server is running. |
| ER_ACCESS_DENIED_ERROR | Database access denied. Please check your credentials. |
| ER_BAD_DB_ERROR | Database does not exist. Please create the database first. |
| ER_DUP_ENTRY | Duplicate entry. This record already exists. |
| ER_NO_REFERENCED_ROW | Referenced record does not exist. |
| ER_ROW_IS_REFERENCED | Cannot delete record. It is referenced by other records. |
| PROTOCOL_CONNECTION_LOST | Database connection was lost. Please try again. |
| ER_LOCK_WAIT_TIMEOUT | Operation timeout. Please try again. |

## Usage Examples

### Simple Query
```javascript
import { query } from './config/database.js';

const items = await query('SELECT * FROM items WHERE code = ?', ['ITEM001']);
```

### Transaction Example
```javascript
import { beginTransaction, commitTransaction, rollbackTransaction } from './config/database.js';

async function createPurchaseInvoice(invoiceData) {
  const connection = await beginTransaction();
  
  try {
    // Insert invoice
    const [result] = await connection.execute(
      'INSERT INTO purchase_invoices (invoice_number, supplier_id, total_amount) VALUES (?, ?, ?)',
      [invoiceData.number, invoiceData.supplierId, invoiceData.total]
    );
    
    const invoiceId = result.insertId;
    
    // Insert invoice lines
    for (const line of invoiceData.lines) {
      await connection.execute(
        'INSERT INTO purchase_invoice_lines (purchase_invoice_id, item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [invoiceId, line.itemId, line.quantity, line.unitPrice]
      );
    }
    
    // Create accounting entry
    await connection.execute(
      'INSERT INTO journal_entries (entry_date, description, source_document_type, source_document_id) VALUES (?, ?, ?, ?)',
      [invoiceData.date, 'Factura de compra', 'purchase_invoice', invoiceId]
    );
    
    await commitTransaction(connection);
    return invoiceId;
  } catch (error) {
    await rollbackTransaction(connection);
    throw error;
  }
}
```

### Error Handling Example
```javascript
import { query, handleDatabaseError } from './config/database.js';

export const createUser = async (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;
    
    const result = await query(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
      [username, password, full_name, role]
    );
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      userId: result.insertId
    });
  } catch (error) {
    const errorResponse = handleDatabaseError(error);
    res.status(500).json(errorResponse);
  }
};
```

## Testing

Run the test file to verify the database connection:

```bash
node src/config/database.test.js
```

The test will:
1. Test connection with retry logic
2. Execute a simple query
3. Test error handling
4. Close the connection pool gracefully

## Integration with Server

The database module is integrated with the Express server in `server.js`:

- **Startup**: Tests database connection on server start
- **Health Check**: `/health` endpoint includes database status
- **Graceful Shutdown**: Closes database connections on SIGTERM/SIGINT

## Best Practices

1. **Always use parameterized queries** to prevent SQL injection
2. **Use transactions** for multi-step operations
3. **Handle errors properly** using `handleDatabaseError()`
4. **Release connections** after use (automatic with `query()`)
5. **Close pool** on application shutdown (handled by server.js)

## Requirements Validation

This module satisfies **Requirement 30.1** from the ERP Contable specification:

✓ REST API built with Node.js and Express  
✓ Database connection with MySQL  
✓ Connection pooling for efficient resource management  
✓ Error handling and retry logic  
✓ Transaction support for data consistency  
✓ Graceful shutdown handling
