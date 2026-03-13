-- ============================================================================
-- ERP Contable Completo - Database Schema
-- MySQL 8 Compatible
-- Plan General Contable Español (PGCE)
-- ============================================================================

-- Create and select database
-- NOTE: This should match backend/.env -> DB_NAME
CREATE DATABASE IF NOT EXISTS erp_contable
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE erp_contable;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS document_links;
DROP TABLE IF EXISTS fixed_asset_depreciations;
DROP TABLE IF EXISTS fixed_assets;
DROP TABLE IF EXISTS collections;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS sales_invoice_lines;
DROP TABLE IF EXISTS sales_invoices;
DROP TABLE IF EXISTS sales_order_lines;
DROP TABLE IF EXISTS sales_orders;
DROP TABLE IF EXISTS sales_budget_lines;
DROP TABLE IF EXISTS sales_budgets;
DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS purchase_invoice_lines;
DROP TABLE IF EXISTS purchase_invoices;
DROP TABLE IF EXISTS purchase_order_lines;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS budget_lines;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS journal_entry_lines;
DROP TABLE IF EXISTS journal_entries;
DROP TABLE IF EXISTS fiscal_periods;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS users;

-- ============================================================================
-- MASTER DATA TABLES
-- ============================================================================

-- Users table with role-based access control
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role ENUM('compras', 'ventas', 'contabilidad', 'tesoreria', 'administrador') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Items/Articles master table
CREATE TABLE items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255) NOT NULL,
  unit_of_measure VARCHAR(20) NOT NULL,
  standard_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_description (description),
  CHECK (standard_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers master table
CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  tax_id VARCHAR(20) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_name (name),
  INDEX idx_tax_id (tax_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Suppliers master table
CREATE TABLE suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  tax_id VARCHAR(20) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_name (name),
  INDEX idx_tax_id (tax_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ACCOUNTING MODULE TABLES
-- ============================================================================

-- Chart of accounts (Plan General Contable Español)
CREATE TABLE accounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  account_type ENUM('asset', 'liability', 'equity', 'income', 'expense') NOT NULL,
  parent_id INT,
  allow_movements BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES accounts(id),
  INDEX idx_code (code),
  INDEX idx_type (account_type),
  INDEX idx_active (is_active),
  INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal entries header
CREATE TABLE journal_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entry_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  source_document_type VARCHAR(50),
  source_document_id INT,
  status ENUM('draft', 'posted', 'deleted') DEFAULT 'posted',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_entry_date (entry_date),
  INDEX idx_source (source_document_type, source_document_id),
  INDEX idx_created_by (created_by),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal entry lines (debit and credit lines)
CREATE TABLE journal_entry_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  journal_entry_id INT NOT NULL,
  account_id INT NOT NULL,
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  description VARCHAR(255),
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  INDEX idx_journal_entry (journal_entry_id),
  INDEX idx_account (account_id),
  CHECK (debit >= 0),
  CHECK (credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0)),
  CHECK (debit > 0 OR credit > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fiscal periods for accounting control
CREATE TABLE fiscal_periods (
  id INT PRIMARY KEY AUTO_INCREMENT,
  year INT NOT NULL,
  period_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('open', 'closed') DEFAULT 'open',
  closed_by INT,
  closed_at TIMESTAMP,
  reopened_at TIMESTAMP,
  reopen_justification TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (closed_by) REFERENCES users(id),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_status (status),
  INDEX idx_year_period (year, period_number),
  UNIQUE KEY uq_fiscal_period (year, period_number),
  CHECK (end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PURCHASE MODULE TABLES
-- ============================================================================

-- Purchase budgets header
CREATE TABLE budgets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  budget_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INT NOT NULL,
  budget_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'converted', 'cancelled') DEFAULT 'pending',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_budget_number (budget_number),
  INDEX idx_supplier (supplier_id),
  INDEX idx_budget_date (budget_date),
  INDEX idx_status (status),
  CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase budget lines
CREATE TABLE budget_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  budget_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_budget (budget_id),
  INDEX idx_item (item_id),
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  CHECK (line_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase orders header
CREATE TABLE purchase_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INT NOT NULL,
  order_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'partially_received', 'fully_received') DEFAULT 'pending',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_order_number (order_number),
  INDEX idx_supplier (supplier_id),
  INDEX idx_order_date (order_date),
  INDEX idx_status (status),
  CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase order lines
CREATE TABLE purchase_order_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  received_quantity DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_purchase_order (purchase_order_id),
  INDEX idx_item (item_id),
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  CHECK (line_total >= 0),
  CHECK (received_quantity >= 0),
  CHECK (received_quantity <= quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase invoices header
CREATE TABLE purchase_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INT NOT NULL,
  invoice_type ENUM('mercaderia', 'inmovilizado', 'gasto') DEFAULT 'mercaderia',
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  status ENUM('pending', 'partially_paid', 'paid') DEFAULT 'pending',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_supplier (supplier_id),
  INDEX idx_invoice_type (invoice_type),
  INDEX idx_invoice_date (invoice_date),
  INDEX idx_due_date (due_date),
  INDEX idx_status (status),
  CHECK (total_amount >= 0),
  CHECK (paid_amount >= 0),
  CHECK (paid_amount <= total_amount),
  CHECK (due_date >= invoice_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase invoice lines
CREATE TABLE purchase_invoice_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_invoice_id INT NOT NULL,
  item_id INT,
  line_description VARCHAR(255),
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_purchase_invoice (purchase_invoice_id),
  INDEX idx_item (item_id),
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  CHECK (line_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SALES OPERATIONS TABLES
-- ============================================================================

-- Sales budgets header
CREATE TABLE sales_budgets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  budget_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT NOT NULL,
  budget_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'converted', 'cancelled') DEFAULT 'pending',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_sales_budget_number (budget_number),
  INDEX idx_sales_budget_customer (customer_id),
  INDEX idx_sales_budget_date (budget_date),
  INDEX idx_sales_budget_status (status),
  CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales budget lines
CREATE TABLE sales_budget_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sales_budget_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (sales_budget_id) REFERENCES sales_budgets(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_sales_budget_line_budget (sales_budget_id),
  INDEX idx_sales_budget_line_item (item_id),
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  CHECK (line_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales orders header
CREATE TABLE sales_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT NOT NULL,
  sales_budget_id INT,
  order_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status ENUM('draft', 'pending_stock', 'ready_to_invoice', 'invoiced', 'cancelled') DEFAULT 'draft',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (sales_budget_id) REFERENCES sales_budgets(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_sales_order_number (order_number),
  INDEX idx_sales_order_customer (customer_id),
  INDEX idx_sales_order_budget (sales_budget_id),
  INDEX idx_sales_order_date (order_date),
  INDEX idx_sales_order_status (status),
  CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales order lines
CREATE TABLE sales_order_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sales_order_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  supplied_quantity DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_sales_order_line_order (sales_order_id),
  INDEX idx_sales_order_line_item (item_id),
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  CHECK (line_total >= 0),
  CHECK (supplied_quantity >= 0),
  CHECK (supplied_quantity <= quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INVENTORY MODULE TABLES
-- ============================================================================

-- Inventory movements (no stock field, calculated from movements)
CREATE TABLE inventory_movements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  movement_date DATE NOT NULL,
  movement_type ENUM('inbound', 'outbound', 'adjustment') NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_value DECIMAL(12,2) NOT NULL,
  source_document_type VARCHAR(50),
  source_document_id INT,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_item (item_id),
  INDEX idx_movement_date (movement_date),
  INDEX idx_movement_type (movement_type),
  INDEX idx_source (source_document_type, source_document_id),
  CHECK (unit_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TREASURY MODULE TABLES
-- ============================================================================

-- Sales invoices header
CREATE TABLE sales_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT NOT NULL,
  sales_order_id INT,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  collected_amount DECIMAL(12,2) DEFAULT 0,
  status ENUM('pending', 'partially_collected', 'collected') DEFAULT 'pending',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_customer (customer_id),
  INDEX idx_sales_order_id (sales_order_id),
  INDEX idx_invoice_date (invoice_date),
  INDEX idx_due_date (due_date),
  INDEX idx_status (status),
  CHECK (total_amount >= 0),
  CHECK (collected_amount >= 0),
  CHECK (collected_amount <= total_amount),
  CHECK (due_date >= invoice_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales invoice lines
CREATE TABLE sales_invoice_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sales_invoice_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_sales_invoice (sales_invoice_id),
  INDEX idx_item (item_id),
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  CHECK (line_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments to suppliers
CREATE TABLE payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  purchase_invoice_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'realized') DEFAULT 'pending',
  payment_method ENUM('bank_transfer', 'check') NOT NULL,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_payment_number (payment_number),
  INDEX idx_purchase_invoice (purchase_invoice_id),
  INDEX idx_payment_date (payment_date),
  INDEX idx_status (status),
  INDEX idx_payment_method (payment_method),
  CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Collections from customers
CREATE TABLE collections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  collection_number VARCHAR(50) UNIQUE NOT NULL,
  sales_invoice_id INT NOT NULL,
  collection_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'realized') DEFAULT 'pending',
  payment_method ENUM('bank_transfer', 'check', 'card') NOT NULL,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_collection_number (collection_number),
  INDEX idx_sales_invoice (sales_invoice_id),
  INDEX idx_collection_date (collection_date),
  INDEX idx_status (status),
  INDEX idx_payment_method (payment_method),
  CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- FIXED ASSETS TABLES
-- ============================================================================

CREATE TABLE fixed_assets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  asset_code VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255) NOT NULL,
  purchase_invoice_id INT,
  acquisition_date DATE NOT NULL,
  acquisition_value DECIMAL(12,2) NOT NULL,
  residual_value DECIMAL(12,2) DEFAULT 0,
  useful_life_months INT NOT NULL,
  depreciation_method ENUM('linear') DEFAULT 'linear',
  asset_account_code VARCHAR(10) NOT NULL,
  depreciation_account_code VARCHAR(10) DEFAULT '681',
  accumulated_depreciation DECIMAL(12,2) DEFAULT 0,
  status ENUM('active', 'fully_depreciated', 'disposed') DEFAULT 'active',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_fixed_asset_code (asset_code),
  INDEX idx_fixed_asset_invoice (purchase_invoice_id),
  INDEX idx_fixed_asset_status (status),
  CHECK (acquisition_value >= 0),
  CHECK (residual_value >= 0),
  CHECK (useful_life_months > 0),
  CHECK (accumulated_depreciation >= 0),
  CHECK (accumulated_depreciation <= acquisition_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fixed_asset_depreciations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  fixed_asset_id INT NOT NULL,
  depreciation_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  journal_entry_id INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fixed_asset_id) REFERENCES fixed_assets(id) ON DELETE CASCADE,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_fixed_asset_depreciation_asset (fixed_asset_id),
  INDEX idx_fixed_asset_depreciation_date (depreciation_date),
  CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TRACEABILITY TABLES
-- ============================================================================

-- Document links for traceability
CREATE TABLE document_links (
  id INT PRIMARY KEY AUTO_INCREMENT,
  source_document_type VARCHAR(50) NOT NULL,
  source_document_id INT NOT NULL,
  target_document_type VARCHAR(50) NOT NULL,
  target_document_id INT NOT NULL,
  link_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source (source_document_type, source_document_id),
  INDEX idx_target (target_document_type, target_document_id),
  INDEX idx_link_type (link_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit log for all operations
CREATE TABLE audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  old_values JSON,
  new_values JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal entry templates for common operations
CREATE TABLE journal_entry_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  category ENUM(
    'compra_mercaderias',
    'venta_mercaderias',
    'compra_inmovilizado',
    'nomina',
    'alquiler',
    'amortizacion',
    'variacion_existencias',
    'aportacion_socios',
    'cobro_cliente',
    'pago_proveedor',
    'gastos',
    'regularizacion'
  ) NOT NULL,
  template_data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- ============================================================================
-- Compatibility migration for existing databases (idempotent)
-- Added to support role "ventas" and ensure default sales user exists
-- ============================================================================

ALTER TABLE users
  MODIFY COLUMN role ENUM('compras', 'ventas', 'contabilidad', 'tesoreria', 'administrador') NOT NULL;

INSERT INTO users (username, password, full_name, role, is_active)
SELECT 'ventas', 'ventas123', 'Usuario Ventas', 'ventas', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE username = 'ventas'
);

DELETE FROM journal_entry_templates
WHERE name IN (
  'Factura de compra de mercaderías',
  'Factura de venta de mercaderías'
);
