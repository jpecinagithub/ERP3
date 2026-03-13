import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_contable',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Create connection pool
let pool = null;

/**
 * Creates and returns a MySQL connection pool
 * @returns {Promise<mysql.Pool>} MySQL connection pool
 */
export const createPool = () => {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    console.log('Database connection pool created');
  }
  return pool;
};

/**
 * Gets the existing connection pool or creates a new one
 * @returns {mysql.Pool} MySQL connection pool
 */
export const getPool = () => {
  if (!pool) {
    return createPool();
  }
  return pool;
};

/**
 * Tests database connection with retry logic
 * @param {number} maxRetries - Maximum number of retry attempts (default: 5)
 * @param {number} retryDelay - Delay between retries in milliseconds (default: 3000)
 * @returns {Promise<boolean>} True if connection successful
 */
export const testConnection = async (maxRetries = 5, retryDelay = 3000) => {
  const currentPool = getPool();
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await currentPool.getConnection();
      console.log(`Database connection successful (attempt ${attempt}/${maxRetries})`);
      connection.release();
      return true;
    } catch (error) {
      lastError = error;
      console.error(`Database connection failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error('Database connection failed after all retry attempts');
  throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${lastError.message}`);
};

/**
 * Executes a query with automatic connection handling and error recovery
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
export const query = async (sql, params = []) => {
  const currentPool = getPool();
  let connection = null;

  try {
    connection = await currentPool.getConnection();
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Query execution error:', error.message);
    console.error('SQL:', sql);
    
    // Handle specific MySQL errors
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      throw new Error('Database connection was lost. Please retry the operation.');
    } else if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
      throw new Error('Database lock timeout. Please retry the operation.');
    } else if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Duplicate entry detected. Please check your data.');
    }
    
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Begins a database transaction
 * @returns {Promise<mysql.PoolConnection>} Database connection with active transaction
 */
export const beginTransaction = async () => {
  const currentPool = getPool();
  const connection = await currentPool.getConnection();
  
  try {
    await connection.beginTransaction();
    return connection;
  } catch (error) {
    connection.release();
    throw error;
  }
};

/**
 * Commits a database transaction
 * @param {mysql.PoolConnection} connection - Database connection with active transaction
 */
export const commitTransaction = async (connection) => {
  try {
    await connection.commit();
  } finally {
    connection.release();
  }
};

/**
 * Rolls back a database transaction
 * @param {mysql.PoolConnection} connection - Database connection with active transaction
 */
export const rollbackTransaction = async (connection) => {
  try {
    await connection.rollback();
  } catch (error) {
    console.error('Rollback error:', error.message);
  } finally {
    connection.release();
  }
};

/**
 * Closes the connection pool gracefully
 * @returns {Promise<void>}
 */
export const closePool = async () => {
  if (pool) {
    try {
      await pool.end();
      console.log('Database connection pool closed');
      pool = null;
    } catch (error) {
      console.error('Error closing database pool:', error.message);
      throw error;
    }
  }
};

/**
 * Handles database errors and provides user-friendly messages
 * @param {Error} error - Database error object
 * @returns {Object} Formatted error response
 */
export const handleDatabaseError = (error) => {
  console.error('Database error:', error);

  const errorResponse = {
    success: false,
    message: 'Database error occurred',
    code: error.code || 'UNKNOWN_ERROR'
  };

  // Map common MySQL errors to user-friendly messages
  switch (error.code) {
    case 'ECONNREFUSED':
      errorResponse.message = 'Unable to connect to database. Please check if the database server is running.';
      break;
    case 'ER_ACCESS_DENIED_ERROR':
      errorResponse.message = 'Database access denied. Please check your credentials.';
      break;
    case 'ER_BAD_DB_ERROR':
      errorResponse.message = 'Database does not exist. Please create the database first.';
      break;
    case 'ER_DUP_ENTRY':
      errorResponse.message = 'Duplicate entry. This record already exists.';
      break;
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      errorResponse.message = 'Referenced record does not exist.';
      break;
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      errorResponse.message = 'Cannot delete record. It is referenced by other records.';
      break;
    case 'PROTOCOL_CONNECTION_LOST':
      errorResponse.message = 'Database connection was lost. Please try again.';
      break;
    case 'ER_LOCK_WAIT_TIMEOUT':
      errorResponse.message = 'Operation timeout. Please try again.';
      break;
    default:
      errorResponse.message = error.message || 'An unexpected database error occurred.';
  }

  return errorResponse;
};

// Export default pool getter
export default getPool;
