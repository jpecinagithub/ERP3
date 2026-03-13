# Design Document - ERP Contable Completo

## Overview

Este documento describe el diseño técnico de un sistema ERP completo orientado a la gestión contable, compras y tesorería para empresas que operan bajo el Plan General Contable Español (PGCE).

El sistema implementa una arquitectura de 3 capas con separación clara entre:
- **Frontend**: Interfaz web moderna con React, Vite y TailwindCSS
- **Backend**: API REST con Node.js y Express
- **Base de datos**: MySQL 8 con modelo relacional normalizado

### Principios de Diseño Fundamentales

1. **Separación entre documentos de negocio y contabilidad**: Los documentos comerciales (presupuestos, pedidos, facturas) son entidades independientes que generan automáticamente asientos contables, pero nunca se mezclan con la contabilidad.

2. **Trazabilidad completa**: Cada operación registra usuario, timestamp y enlaces a documentos relacionados, permitiendo auditoría completa del ciclo de vida.

3. **Coherencia contable garantizada**: El sistema valida 20 reglas contables críticas que aseguran que DEBE = HABER, ACTIVO = PASIVO + PATRIMONIO NETO, y coherencia entre módulos.

4. **Inventario basado en movimientos**: No existe un campo "stock" directo. El inventario se calcula siempre como suma de movimientos (entradas - salidas), garantizando trazabilidad histórica.

5. **Generación automática de asientos**: Las operaciones de negocio (facturas, cobros, pagos) generan automáticamente sus asientos contables correspondientes.

6. **Control de acceso por roles**: Cuatro roles (compras, contabilidad, tesorería, administrador) con acceso estrictamente controlado a sus módulos respectivos.

## Architecture

### Arquitectura de 3 Capas

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                          │
│  React + Vite + TailwindCSS + React Router                  │
│  - Componentes por módulo (Purchase, Accounting, Treasury)  │
│  - Rutas protegidas por rol                                 │
│  - Estado global con Context API                            │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTP/REST + JWT
                            │
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND LAYER                           │
│  Node.js + Express + JWT Authentication                     │
│  - Middleware de autenticación y autorización               │
│  - Controladores por módulo                                 │
│  - Servicios de negocio con validaciones                    │
│  - Generación automática de asientos contables              │
└─────────────────────────────────────────────────────────────┘
                            │
                      MySQL Driver
                            │
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                          │
│  MySQL 8                                                    │
│  - Tablas maestras (users, items, customers, suppliers)     │
│  - Contabilidad (accounts, journal_entries, lines)          │
│  - Documentos (budgets, orders, invoices)                   │
│  - Inventario (inventory_movements)                         │
│  - Tesorería (payments, collections)                        │
│  - Trazabilidad (document_links, audit_log)                 │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos Principal

#### Ciclo de Compra
```
Presupuesto → Pedido → Factura Compra → [Asiento Contable + Movimiento Inventario] → Pago → [Asiento Contable]
```

#### Ciclo de Venta
```
Factura Venta → [Asiento Contable] → Cobro → [Asiento Contable]
```

### Módulos del Sistema

#### 1. Auth_System
- Autenticación con JWT
- Gestión de roles: compras, contabilidad, tesorería, administrador
- Middleware de autorización por endpoint

#### 2. Purchase_Module
- Gestión de presupuestos de compra
- Gestión de pedidos de compra
- Gestión de facturas de compra
- Gestión de inventario (movimientos)
- Generación automática de asientos contables

#### 3. Accounting_Module
- Gestión de cuentas del PGCE
- Gestión de asientos contables
- Generación de Balance de Situación
- Generación de Pérdidas y Ganancias
- Informes personalizados
- Validación de 20 reglas contables

#### 4. Treasury_Module
- Gestión de facturas de venta
- Gestión de cobros
- Gestión de pagos
- Generación automática de asientos contables

#### 5. Master_Data_Module
- Gestión de artículos
- Gestión de clientes
- Gestión de proveedores
- Gestión de usuarios

## Components and Interfaces

### Frontend Components

#### Estructura de Componentes React

```
src/
├── components/
│   ├── auth/
│   │   ├── Login.jsx
│   │   └── ProtectedRoute.jsx
│   ├── layout/
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx
│   │   └── Layout.jsx
│   ├── purchase/
│   │   ├── BudgetList.jsx
│   │   ├── BudgetForm.jsx
│   │   ├── PurchaseOrderList.jsx
│   │   ├── PurchaseOrderForm.jsx
│   │   ├── PurchaseInvoiceList.jsx
│   │   ├── PurchaseInvoiceForm.jsx
│   │   └── InventoryView.jsx
│   ├── accounting/
│   │   ├── AccountList.jsx
│   │   ├── AccountForm.jsx
│   │   ├── JournalEntryList.jsx
│   │   ├── JournalEntryForm.jsx
│   │   ├── BalanceSheet.jsx
│   │   ├── PnLReport.jsx
│   │   └── CustomReport.jsx
│   ├── treasury/
│   │   ├── SalesInvoiceList.jsx
│   │   ├── SalesInvoiceForm.jsx
│   │   ├── CollectionList.jsx
│   │   ├── CollectionForm.jsx
│   │   ├── PaymentList.jsx
│   │   └── PaymentForm.jsx
│   ├── master/
│   │   ├── ItemList.jsx
│   │   ├── ItemForm.jsx
│   │   ├── CustomerList.jsx
│   │   ├── CustomerForm.jsx
│   │   ├── SupplierList.jsx
│   │   ├── SupplierForm.jsx
│   │   ├── UserList.jsx
│   │   └── UserForm.jsx
│   └── common/
│       ├── Table.jsx
│       ├── Form.jsx
│       ├── Button.jsx
│       ├── Modal.jsx
│       └── Alert.jsx
├── context/
│   └── AuthContext.jsx
├── services/
│   ├── api.js
│   ├── authService.js
│   ├── purchaseService.js
│   ├── accountingService.js
│   ├── treasuryService.js
│   └── masterService.js
└── App.jsx
```

### Backend API Structure

#### Estructura de Directorios

```
backend/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── roleCheck.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── purchaseController.js
│   │   ├── accountingController.js
│   │   ├── treasuryController.js
│   │   └── masterController.js
│   ├── services/
│   │   ├── accountingService.js
│   │   ├── inventoryService.js
│   │   ├── validationService.js
│   │   └── traceabilityService.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── purchaseRoutes.js
│   │   ├── accountingRoutes.js
│   │   ├── treasuryRoutes.js
│   │   └── masterRoutes.js
│   └── server.js
└── package.json
```

### API Endpoints

#### Authentication Endpoints
```
POST   /api/auth/login          - Autenticación de usuario
POST   /api/auth/logout         - Cierre de sesión
GET    /api/auth/me             - Información del usuario actual
```

#### Purchase Module Endpoints (Rol: compras)
```
GET    /api/budgets             - Listar presupuestos
POST   /api/budgets             - Crear presupuesto
GET    /api/budgets/:id         - Obtener presupuesto
PUT    /api/budgets/:id         - Actualizar presupuesto
DELETE /api/budgets/:id         - Eliminar presupuesto
POST   /api/budgets/:id/convert - Convertir a pedido

GET    /api/purchase-orders     - Listar pedidos
POST   /api/purchase-orders     - Crear pedido
GET    /api/purchase-orders/:id - Obtener pedido
PUT    /api/purchase-orders/:id - Actualizar pedido

GET    /api/purchase-invoices   - Listar facturas compra
POST   /api/purchase-invoices   - Crear factura compra
GET    /api/purchase-invoices/:id - Obtener factura compra

GET    /api/inventory           - Ver inventario
POST   /api/inventory/adjust    - Ajuste manual de inventario
GET    /api/inventory/movements - Ver movimientos
```

#### Accounting Module Endpoints (Rol: contabilidad)
```
GET    /api/accounts            - Listar cuentas
POST   /api/accounts            - Crear cuenta
GET    /api/accounts/:id        - Obtener cuenta
PUT    /api/accounts/:id        - Actualizar cuenta

GET    /api/journal-entries     - Listar asientos
POST   /api/journal-entries     - Crear asiento
GET    /api/journal-entries/:id - Obtener asiento

GET    /api/reports/balance     - Balance de situación
GET    /api/reports/pnl         - Pérdidas y ganancias
POST   /api/reports/custom      - Informe personalizado
GET    /api/reports/reconciliation - Informes de conciliación
```

#### Treasury Module Endpoints (Rol: tesorería)
```
GET    /api/sales-invoices      - Listar facturas venta
POST   /api/sales-invoices      - Crear factura venta
GET    /api/sales-invoices/:id  - Obtener factura venta

GET    /api/collections         - Listar cobros
POST   /api/collections         - Registrar cobro
GET    /api/collections/:id     - Obtener cobro

GET    /api/payments            - Listar pagos
POST   /api/payments            - Registrar pago
GET    /api/payments/:id        - Obtener pago
```

#### Master Data Endpoints (Rol: administrador)
```
GET    /api/items               - Listar artículos
POST   /api/items               - Crear artículo
PUT    /api/items/:id           - Actualizar artículo
DELETE /api/items/:id           - Eliminar artículo

GET    /api/customers           - Listar clientes
POST   /api/customers           - Crear cliente
PUT    /api/customers/:id       - Actualizar cliente
DELETE /api/customers/:id       - Eliminar cliente

GET    /api/suppliers           - Listar proveedores
POST   /api/suppliers           - Crear proveedor
PUT    /api/suppliers/:id       - Actualizar proveedor
DELETE /api/suppliers/:id       - Eliminar proveedor

GET    /api/users               - Listar usuarios
POST   /api/users               - Crear usuario
PUT    /api/users/:id           - Actualizar usuario
PUT    /api/users/:id/deactivate - Desactivar usuario

GET    /api/fiscal-periods      - Listar periodos
POST   /api/fiscal-periods      - Crear periodo
PUT    /api/fiscal-periods/:id/close - Cerrar periodo
PUT    /api/fiscal-periods/:id/reopen - Reabrir periodo
```

### Service Layer Interfaces

#### AccountingService
```javascript
class AccountingService {
  // Genera asiento contable automático para factura de compra
  async generatePurchaseInvoiceEntry(invoiceId, connection)
  
  // Genera asiento contable automático para factura de venta
  async generateSalesInvoiceEntry(invoiceId, connection)
  
  // Genera asiento contable automático para cobro
  async generateCollectionEntry(collectionId, connection)
  
  // Genera asiento contable automático para pago
  async generatePaymentEntry(paymentId, connection)
  
  // Valida que debe = haber en un asiento
  async validateEntryBalance(entryId)
  
  // Calcula balance de situación
  async calculateBalanceSheet(startDate, endDate)
  
  // Calcula pérdidas y ganancias
  async calculatePnL(startDate, endDate)
}
```

#### ValidationService
```javascript
class ValidationService {
  // Valida ecuación contable fundamental: Activo = Pasivo + Patrimonio
  async validateFundamentalEquation()
  
  // Valida coherencia inventario físico vs cuenta 300
  async validateInventoryCoherence()
  
  // Valida coherencia cuenta 430 vs facturas pendientes
  async validateReceivablesCoherence()
  
  // Valida coherencia cuenta 400 vs facturas pendientes
  async validatePayablesCoherence()
  
  // Valida que resultado PyG = cuenta 129
  async validatePnLResult()
  
  // Valida todas las reglas antes de cerrar periodo
  async validateAllRules()
  
  // Valida que inventario no sea negativo
  async validateNonNegativeInventory()
  
  // Valida que inmovilizado no sea negativo
  async validateNonNegativeFixedAssets()
  
  // Valida que amortización <= valor inmovilizado
  async validateDepreciation()
}
```

#### InventoryService
```javascript
class InventoryService {
  // Crea movimiento de entrada de inventario
  async createInboundMovement(itemId, quantity, unitCost, sourceDoc, connection)
  
  // Crea movimiento de salida de inventario
  async createOutboundMovement(itemId, quantity, sourceDoc, connection)
  
  // Calcula stock actual de un artículo
  async calculateCurrentStock(itemId)
  
  // Calcula valor total del inventario
  async calculateTotalInventoryValue()
  
  // Obtiene movimientos de un artículo
  async getItemMovements(itemId, startDate, endDate)
}
```

#### TraceabilityService
```javascript
class TraceabilityService {
  // Registra enlace entre documentos
  async createDocumentLink(sourceType, sourceId, targetType, targetId, connection)
  
  // Obtiene cadena completa de trazabilidad
  async getTraceabilityChain(docType, docId)
  
  // Registra acción en log de auditoría
  async logAction(userId, action, entityType, entityId, connection)
  
  // Verifica si un documento puede ser eliminado
  async canDeleteDocument(docType, docId)
}
```


## Data Models

### Tablas Maestras

#### users
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role ENUM('compras', 'contabilidad', 'tesoreria', 'administrador') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### items
```sql
CREATE TABLE items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255) NOT NULL,
  unit_of_measure VARCHAR(20) NOT NULL,
  standard_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### customers
```sql
CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  tax_id VARCHAR(20) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### suppliers
```sql
CREATE TABLE suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  tax_id VARCHAR(20) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Contabilidad (Corazón del Sistema)

#### accounts
```sql
CREATE TABLE accounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  account_type ENUM('asset', 'liability', 'equity', 'income', 'expense') NOT NULL,
  parent_account_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_account_id) REFERENCES accounts(id)
);
```

#### journal_entries (Cabecera de asientos)
```sql
CREATE TABLE journal_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entry_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  source_document_type VARCHAR(50),  -- 'purchase_invoice', 'sales_invoice', 'payment', 'collection', 'manual'
  source_document_id INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### journal_entry_lines (Líneas de asientos)
```sql
CREATE TABLE journal_entry_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  journal_entry_id INT NOT NULL,
  account_id INT NOT NULL,
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  description VARCHAR(255),
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))  -- Una línea no puede tener debe y haber simultáneamente
);
```

### Documentos de Negocio - Compras

#### budgets
```sql
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
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### budget_lines
```sql
CREATE TABLE budget_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  budget_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);
```

#### purchase_orders
```sql
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
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### purchase_order_lines
```sql
CREATE TABLE purchase_order_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  received_quantity DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);
```

#### purchase_invoices
```sql
CREATE TABLE purchase_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,  -- Calculado como invoice_date + 60 días
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  status ENUM('pending', 'partially_paid', 'paid') DEFAULT 'pending',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### purchase_invoice_lines
```sql
CREATE TABLE purchase_invoice_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_invoice_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);
```

### Inventario (Basado en Movimientos)

#### inventory_movements
```sql
CREATE TABLE inventory_movements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  movement_date DATE NOT NULL,
  movement_type ENUM('inbound', 'outbound', 'adjustment') NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,  -- Positivo para entradas, negativo para salidas
  unit_cost DECIMAL(10,2) NOT NULL,
  total_value DECIMAL(12,2) NOT NULL,
  source_document_type VARCHAR(50),  -- 'purchase_invoice', 'adjustment'
  source_document_id INT,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Nota importante**: El stock actual de un artículo se calcula como:
```sql
SELECT SUM(quantity) as current_stock
FROM inventory_movements
WHERE item_id = ?
```

### Documentos de Negocio - Ventas

#### sales_invoices
```sql
CREATE TABLE sales_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,  -- Calculado como invoice_date + 90 días
  total_amount DECIMAL(12,2) NOT NULL,
  collected_amount DECIMAL(12,2) DEFAULT 0,
  status ENUM('pending', 'partially_collected', 'collected') DEFAULT 'pending',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### sales_invoice_lines
```sql
CREATE TABLE sales_invoice_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sales_invoice_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);
```

### Tesorería - Cobros y Pagos

#### payments
```sql
CREATE TABLE payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  purchase_invoice_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method ENUM('cash', 'bank_transfer', 'check') NOT NULL,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

#### collections
```sql
CREATE TABLE collections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  collection_number VARCHAR(50) UNIQUE NOT NULL,
  sales_invoice_id INT NOT NULL,
  collection_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  collection_method ENUM('cash', 'bank_transfer', 'check') NOT NULL,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### Trazabilidad

#### document_links
```sql
CREATE TABLE document_links (
  id INT PRIMARY KEY AUTO_INCREMENT,
  source_document_type VARCHAR(50) NOT NULL,
  source_document_id INT NOT NULL,
  target_document_type VARCHAR(50) NOT NULL,
  target_document_id INT NOT NULL,
  link_type VARCHAR(50) NOT NULL,  -- 'converted_to', 'generated', 'paid_by', 'collected_by'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source (source_document_type, source_document_id),
  INDEX idx_target (target_document_type, target_document_id)
);
```

#### audit_log
```sql
CREATE TABLE audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,  -- 'create', 'update', 'delete', 'close_period'
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  old_values JSON,
  new_values JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Periodos Contables

#### fiscal_periods
```sql
CREATE TABLE fiscal_periods (
  id INT PRIMARY KEY AUTO_INCREMENT,
  period_name VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('open', 'closed') DEFAULT 'open',
  closed_by INT,
  closed_at TIMESTAMP,
  reopen_justification TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (closed_by) REFERENCES users(id)
);
```

### Relaciones Clave del Modelo

```
Budget (1) ──→ (N) Budget_Lines
Budget (1) ──→ (N) Purchase_Orders [via document_links]

Purchase_Order (1) ──→ (N) Purchase_Order_Lines
Purchase_Order (1) ──→ (N) Purchase_Invoices [via document_links]

Purchase_Invoice (1) ──→ (N) Purchase_Invoice_Lines
Purchase_Invoice (1) ──→ (1) Journal_Entry [via source_document]
Purchase_Invoice (1) ──→ (N) Inventory_Movements [via source_document]
Purchase_Invoice (1) ──→ (N) Payments

Sales_Invoice (1) ──→ (N) Sales_Invoice_Lines
Sales_Invoice (1) ──→ (1) Journal_Entry [via source_document]
Sales_Invoice (1) ──→ (N) Collections

Payment (1) ──→ (1) Journal_Entry [via source_document]
Collection (1) ──→ (1) Journal_Entry [via source_document]

Journal_Entry (1) ──→ (N) Journal_Entry_Lines
```

### Cuentas Fundamentales del PGCE (Datos Semilla)

```sql
-- Grupo 1: Financiación básica
100 - Capital social (Equity)
129 - Resultado del ejercicio (Equity)

-- Grupo 2: Inmovilizado
200 - Inmovilizado material (Asset)
280 - Amortización acumulada del inmovilizado material (Asset - contra cuenta)

-- Grupo 3: Existencias
300 - Existencias (Asset)

-- Grupo 4: Acreedores y deudores
400 - Proveedores (Liability)
430 - Clientes (Asset)

-- Grupo 5: Cuentas financieras
570 - Caja (Asset)
572 - Bancos (Asset)

-- Grupo 6: Compras y gastos
600 - Compras de mercaderías (Expense)
628 - Suministros (Expense)
640 - Sueldos y salarios (Expense)
681 - Amortización del inmovilizado material (Expense)

-- Grupo 7: Ventas e ingresos
700 - Ventas de mercaderías (Income)
```

