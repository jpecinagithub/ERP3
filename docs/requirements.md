# Requirements Document

## Introduction

Este documento define los requisitos para un sistema ERP (Enterprise Resource Planning) completo orientado a la gestión contable, compras y tesorería. El sistema permitirá a una empresa gestionar el ciclo completo desde presupuestos hasta contabilización, con trazabilidad total y cumplimiento de las normas del Plan General Contable Español (PGCE).

El sistema está diseñado para una empresa que inicia operaciones el 1 de enero de 2025 sin saldos iniciales previos, y debe garantizar coherencia entre todos los módulos: libro diario, balance, pérdidas y ganancias, inventario y cuentas a cobrar/pagar.

## Glossary

- **ERP_System**: Sistema completo de planificación de recursos empresariales
- **Purchase_Module**: Módulo de gestión de compras (presupuestos, pedidos, facturas, inventario)
- **Accounting_Module**: Módulo de contabilidad (asientos, balance, PyG, informes)
- **Treasury_Module**: Módulo de tesorería (facturas de ventas, cobros, pagos)
- **Auth_System**: Sistema de autenticación y autorización de usuarios
- **PGCE**: Plan General Contable Español
- **Accounting_Entry**: Asiento contable con debe y haber
- **Budget**: Presupuesto de compra o venta
- **Purchase_Order**: Pedido de compra a proveedor
- **Purchase_Invoice**: Factura de compra recibida de proveedor
- **Sales_Invoice**: Factura de venta emitida a cliente
- **Inventory**: Inventario de artículos con entradas y salidas
- **Payment**: Pago realizado a proveedor
- **Collection**: Cobro recibido de cliente
- **Article**: Artículo o producto gestionado en el sistema
- **Customer**: Cliente de la empresa
- **Supplier**: Proveedor de la empresa
- **User**: Usuario del sistema con rol asignado
- **Account**: Cuenta contable del PGCE
- **Balance_Sheet**: Balance de situación (activo, pasivo, patrimonio neto)
- **PnL_Report**: Informe de pérdidas y ganancias
- **Traceability_Record**: Registro de trazabilidad con usuario, fecha y documento origen
- **Fiscal_Period**: Periodo contable que puede estar abierto o cerrado

## Requirements

### Requirement 1: Gestión de Presupuestos de Compra

**User Story:** Como usuario del rol compras, quiero gestionar presupuestos de compra, para poder planificar las adquisiciones de la empresa.

#### Acceptance Criteria

1. THE Purchase_Module SHALL allow creating a Budget with supplier, articles, quantities, unit prices, and total amount
2. THE Purchase_Module SHALL allow viewing all existing budgets with their status
3. THE Purchase_Module SHALL allow editing a Budget that has not been converted to a Purchase_Order
4. THE Purchase_Module SHALL allow deleting a Budget that has not been converted to a Purchase_Order
5. WHEN a Budget is created, THE ERP_System SHALL record the User and timestamp in the Traceability_Record

### Requirement 2: Gestión de Pedidos de Compra

**User Story:** Como usuario del rol compras, quiero gestionar pedidos de compra parciales o totales, para poder ejecutar las adquisiciones planificadas.

#### Acceptance Criteria

1. WHEN a Budget exists, THE Purchase_Module SHALL allow converting it to a Purchase_Order with partial or total quantities
2. THE Purchase_Module SHALL allow creating a Purchase_Order directly without a prior Budget
3. THE Purchase_Module SHALL track the status of each Purchase_Order (pending, partially received, fully received)
4. WHEN a Purchase_Order is created, THE ERP_System SHALL record the User and timestamp in the Traceability_Record
5. THE Purchase_Module SHALL maintain the link between Budget and Purchase_Order for traceability

### Requirement 3: Gestión de Facturas de Compra

**User Story:** Como usuario del rol compras, quiero gestionar facturas de compra con contabilización automática, para registrar las adquisiciones y su impacto contable.

#### Acceptance Criteria

1. WHEN a Purchase_Order exists, THE Purchase_Module SHALL allow creating a Purchase_Invoice linked to it
2. THE Purchase_Module SHALL allow creating a Purchase_Invoice directly without a prior Purchase_Order
3. WHEN a Purchase_Invoice is created, THE ERP_System SHALL automatically generate an Accounting_Entry with debit to expense or inventory account and credit to account 400 Proveedores
4. THE Purchase_Invoice SHALL include supplier, date, invoice number, articles, quantities, unit prices, and total amount
5. WHEN a Purchase_Invoice is created, THE ERP_System SHALL record the User and timestamp in the Traceability_Record
6. THE ERP_System SHALL calculate the payment due date as 60 days from the Purchase_Invoice date

### Requirement 4: Gestión de Inventario

**User Story:** Como usuario del rol compras, quiero gestionar el inventario con entradas y salidas de material, para mantener control del stock disponible.

#### Acceptance Criteria

1. WHEN a Purchase_Invoice is registered, THE Purchase_Module SHALL automatically create inventory entries for the received articles
2. THE Purchase_Module SHALL allow manual inventory adjustments with justification
3. THE Inventory SHALL track article code, description, quantity, unit cost, and total value
4. THE Purchase_Module SHALL prevent inventory quantities from becoming negative
5. WHEN an inventory movement occurs, THE ERP_System SHALL record the User and timestamp in the Traceability_Record
6. THE Inventory value SHALL equal the balance of account 300 Existencias

### Requirement 5: Gestión de Cuentas del Plan General Contable Español

**User Story:** Como usuario del rol administrador, quiero gestionar las cuentas del PGCE, para poder realizar la contabilización según normativa española.

#### Acceptance Criteria

1. THE Accounting_Module SHALL store accounts with code, name, and account type (asset, liability, equity, income, expense)
2. THE Accounting_Module SHALL allow the administrator to create, edit, and view accounts
3. THE Accounting_Module SHALL prevent deletion of accounts that have been used in accounting entries
4. THE Accounting_Module SHALL support the standard PGCE account structure with groups, subgroups, and individual accounts
5. THE ERP_System SHALL include predefined fundamental accounts (100, 129, 300, 400, 430, 570, 600, 700)

### Requirement 6: Gestión de Asientos Contables

**User Story:** Como usuario del rol contabilidad, quiero gestionar asientos contables, para registrar todas las operaciones económicas de la empresa.

#### Acceptance Criteria

1. THE Accounting_Module SHALL allow creating an Accounting_Entry with date, description, and multiple debit and credit lines
2. THE Accounting_Module SHALL validate that total debit equals total haber in every Accounting_Entry
3. THE Accounting_Module SHALL allow viewing all accounting entries with filtering by date range and account
4. WHEN an Accounting_Entry is created, THE ERP_System SHALL record the User and timestamp in the Traceability_Record
5. IF a Fiscal_Period is closed, THEN THE Accounting_Module SHALL prevent creating or modifying accounting entries in that period
6. THE Accounting_Module SHALL link each Accounting_Entry to its source document (Purchase_Invoice, Sales_Invoice, Payment, Collection)

### Requirement 7: Elaboración de Balance de Situación

**User Story:** Como usuario del rol contabilidad, quiero elaborar el balance de situación, para conocer la posición financiera de la empresa.

#### Acceptance Criteria

1. THE Accounting_Module SHALL generate a Balance_Sheet showing assets, liabilities, and equity
2. THE Balance_Sheet SHALL calculate totals ensuring that assets equal liabilities plus equity
3. THE Accounting_Module SHALL allow filtering the Balance_Sheet by date range
4. THE Balance_Sheet SHALL include all accounts from groups 1 (financing), 2 (fixed assets), 3 (inventory), 4 (creditors and debtors), and 5 (financial accounts)
5. THE Accounting_Module SHALL validate that account 430 Clientes balance equals total pending customer invoices
6. THE Accounting_Module SHALL validate that account 400 Proveedores balance equals total pending supplier invoices

### Requirement 8: Elaboración de Informe de Pérdidas y Ganancias

**User Story:** Como usuario del rol contabilidad, quiero elaborar el informe de pérdidas y ganancias, para conocer el resultado económico de la empresa.

#### Acceptance Criteria

1. THE Accounting_Module SHALL generate a PnL_Report showing income (group 7) and expenses (group 6)
2. THE PnL_Report SHALL calculate the result as income minus expenses
3. THE Accounting_Module SHALL allow filtering the PnL_Report by date range
4. THE PnL_Report SHALL transfer the calculated result to account 129 Resultado del ejercicio
5. THE Accounting_Module SHALL validate that the result in the PnL_Report matches the balance in account 129

### Requirement 9: Elaboración de Informes Personalizados

**User Story:** Como usuario del rol contabilidad, quiero elaborar informes personalizados, para analizar información contable específica según mis necesidades.

#### Acceptance Criteria

1. THE Accounting_Module SHALL allow creating custom reports by selecting specific accounts
2. THE Accounting_Module SHALL allow filtering custom reports by date range
3. THE Accounting_Module SHALL allow grouping custom reports by account, date, or document type
4. THE Accounting_Module SHALL allow exporting custom reports to CSV format
5. THE Accounting_Module SHALL display totals and subtotals in custom reports

### Requirement 10: Gestión de Facturas de Ventas

**User Story:** Como usuario del rol tesorería, quiero gestionar facturas de ventas con contabilización automática, para registrar los ingresos y su impacto contable.

#### Acceptance Criteria

1. THE Treasury_Module SHALL allow creating a Sales_Invoice with customer, date, invoice number, articles, quantities, unit prices, and total amount
2. WHEN a Sales_Invoice is created, THE ERP_System SHALL automatically generate an Accounting_Entry with debit to account 430 Clientes and credit to income account 700
3. THE ERP_System SHALL calculate the collection due date as 90 days from the Sales_Invoice date
4. WHEN a Sales_Invoice is created, THE ERP_System SHALL record the User and timestamp in the Traceability_Record
5. THE Treasury_Module SHALL allow viewing all sales invoices with their payment status

### Requirement 11: Gestión de Cobros

**User Story:** Como usuario del rol tesorería, quiero gestionar cobros de clientes, para registrar los ingresos recibidos y actualizar las cuentas a cobrar.

#### Acceptance Criteria

1. WHEN a Sales_Invoice exists and is unpaid, THE Treasury_Module SHALL allow registering a Collection linked to it
2. THE Treasury_Module SHALL prevent registering a Collection without a prior Sales_Invoice
3. WHEN a Collection is registered, THE ERP_System SHALL automatically generate an Accounting_Entry with debit to account 570 Caja and credit to account 430 Clientes
4. THE Collection SHALL reduce the balance of account 430 Clientes by the collected amount
5. WHEN a Collection is registered, THE ERP_System SHALL record the User and timestamp in the Traceability_Record
6. THE Treasury_Module SHALL update the Sales_Invoice status to paid when fully collected

### Requirement 12: Gestión de Pagos

**User Story:** Como usuario del rol tesorería, quiero gestionar pagos a proveedores, para registrar los pagos realizados y actualizar las cuentas a pagar.

#### Acceptance Criteria

1. WHEN a Purchase_Invoice exists and is unpaid, THE Treasury_Module SHALL allow registering a Payment linked to it
2. THE Treasury_Module SHALL prevent registering a Payment without a prior Purchase_Invoice
3. WHEN a Payment is registered, THE ERP_System SHALL automatically generate an Accounting_Entry with debit to account 400 Proveedores and credit to account 570 Caja
4. THE Payment SHALL reduce the balance of account 400 Proveedores by the paid amount
5. WHEN a Payment is registered, THE ERP_System SHALL record the User and timestamp in the Traceability_Record
6. THE Treasury_Module SHALL update the Purchase_Invoice status to paid when fully paid

### Requirement 13: Sistema de Autenticación

**User Story:** Como usuario del sistema, quiero autenticarme con usuario y contraseña, para acceder de forma segura al ERP.

#### Acceptance Criteria

1. THE Auth_System SHALL allow users to log in with username and password
2. WHEN login credentials are valid, THE Auth_System SHALL generate a JWT token for session management
3. WHEN login credentials are invalid, THE Auth_System SHALL return an authentication error
4. THE Auth_System SHALL store passwords without encryption (test environment only)
5. THE Auth_System SHALL allow passwords with any characters without restrictions
6. THE Auth_System SHALL allow users to log out and invalidate their session

### Requirement 14: Sistema de Roles y Autorización

**User Story:** Como administrador, quiero asignar roles a los usuarios, para controlar el acceso a los diferentes módulos del sistema.

#### Acceptance Criteria

1. THE Auth_System SHALL support four roles: compras, contabilidad, tesorería, and administrador
2. WHEN a User has role compras, THE ERP_System SHALL grant access only to the Purchase_Module
3. WHEN a User has role contabilidad, THE ERP_System SHALL grant access only to the Accounting_Module
4. WHEN a User has role tesorería, THE ERP_System SHALL grant access only to the Treasury_Module
5. WHEN a User has role administrador, THE ERP_System SHALL grant access to all modules and master data management
6. THE Auth_System SHALL prevent users from accessing modules not authorized for their role

### Requirement 15: Gestión de Datos Maestros - Artículos

**User Story:** Como usuario del rol administrador, quiero gestionar la tabla maestra de artículos, para evitar duplicación de datos en el sistema.

#### Acceptance Criteria

1. THE ERP_System SHALL allow the administrator to create articles with code, description, unit of measure, and standard cost
2. THE ERP_System SHALL allow the administrator to edit and view articles
3. THE ERP_System SHALL prevent deletion of articles that have been used in transactions
4. THE ERP_System SHALL ensure article codes are unique
5. THE ERP_System SHALL allow searching articles by code or description

### Requirement 16: Gestión de Datos Maestros - Clientes

**User Story:** Como usuario del rol administrador, quiero gestionar la tabla maestra de clientes, para centralizar la información de los clientes.

#### Acceptance Criteria

1. THE ERP_System SHALL allow the administrator to create customers with code, name, tax ID, address, and contact information
2. THE ERP_System SHALL allow the administrator to edit and view customers
3. THE ERP_System SHALL prevent deletion of customers that have associated transactions
4. THE ERP_System SHALL ensure customer codes are unique
5. THE ERP_System SHALL allow searching customers by code or name

### Requirement 17: Gestión de Datos Maestros - Proveedores

**User Story:** Como usuario del rol administrador, quiero gestionar la tabla maestra de proveedores, para centralizar la información de los proveedores.

#### Acceptance Criteria

1. THE ERP_System SHALL allow the administrator to create suppliers with code, name, tax ID, address, and contact information
2. THE ERP_System SHALL allow the administrator to edit and view suppliers
3. THE ERP_System SHALL prevent deletion of suppliers that have associated transactions
4. THE ERP_System SHALL ensure supplier codes are unique
5. THE ERP_System SHALL allow searching suppliers by code or name

### Requirement 18: Gestión de Datos Maestros - Usuarios

**User Story:** Como usuario del rol administrador, quiero gestionar la tabla maestra de usuarios, para controlar quién tiene acceso al sistema.

#### Acceptance Criteria

1. THE ERP_System SHALL allow the administrator to create users with username, password, full name, and assigned role
2. THE ERP_System SHALL allow the administrator to edit user information and change roles
3. THE ERP_System SHALL allow the administrator to deactivate users without deleting them
4. THE ERP_System SHALL ensure usernames are unique
5. THE ERP_System SHALL allow searching users by username or full name

### Requirement 19: Validación de Ecuación Contable Fundamental

**User Story:** Como usuario del rol contabilidad, quiero que el sistema valide la ecuación contable fundamental, para garantizar la coherencia del balance.

#### Acceptance Criteria

1. THE Accounting_Module SHALL validate that total assets equal total liabilities plus equity at all times
2. WHEN generating a Balance_Sheet, THE Accounting_Module SHALL display a warning if the fundamental equation is not balanced
3. THE Accounting_Module SHALL prevent closing a Fiscal_Period if the fundamental equation is not balanced
4. THE Accounting_Module SHALL calculate assets as the sum of debit balances in groups 1, 2, 3, 4, and 5 accounts with debit nature
5. THE Accounting_Module SHALL calculate liabilities plus equity as the sum of credit balances in groups 1, 4, and 5 accounts with credit nature

### Requirement 20: Validación de Inmovilizado y Amortización

**User Story:** Como usuario del rol contabilidad, quiero que el sistema valide el inmovilizado y su amortización, para garantizar valores correctos en el balance.

#### Acceptance Criteria

1. THE Accounting_Module SHALL validate that fixed asset accounts (group 2) never have negative balances
2. THE Accounting_Module SHALL validate that accumulated depreciation is less than or equal to the value of the corresponding fixed asset
3. WHEN a depreciation entry is created, THE Accounting_Module SHALL verify that it does not exceed the remaining depreciable value
4. THE Accounting_Module SHALL display a warning if accumulated depreciation exceeds fixed asset value

### Requirement 21: Trazabilidad Completa del Ciclo de Compra

**User Story:** Como usuario del sistema, quiero tener trazabilidad completa del ciclo de compra, para poder auditar todas las operaciones desde el presupuesto hasta el pago.

#### Acceptance Criteria

1. THE ERP_System SHALL maintain links between Budget, Purchase_Order, Purchase_Invoice, Accounting_Entry, Inventory entries, and Payment
2. THE ERP_System SHALL allow viewing the complete trace of a purchase operation from any point in the chain
3. WHEN viewing a Purchase_Invoice, THE ERP_System SHALL display the linked Budget, Purchase_Order, Accounting_Entry, Inventory entries, and Payment if they exist
4. THE Traceability_Record SHALL include user who performed the action, timestamp, and source document reference
5. THE ERP_System SHALL prevent deletion of documents that are part of a traceability chain

### Requirement 22: Trazabilidad Completa del Ciclo de Venta

**User Story:** Como usuario del sistema, quiero tener trazabilidad completa del ciclo de venta, para poder auditar todas las operaciones desde la factura hasta el cobro.

#### Acceptance Criteria

1. THE ERP_System SHALL maintain links between Sales_Invoice, Accounting_Entry, and Collection
2. THE ERP_System SHALL allow viewing the complete trace of a sales operation from any point in the chain
3. WHEN viewing a Sales_Invoice, THE ERP_System SHALL display the linked Accounting_Entry and Collection if they exist
4. THE Traceability_Record SHALL include user who performed the action, timestamp, and source document reference
5. THE ERP_System SHALL prevent deletion of documents that are part of a traceability chain

### Requirement 23: Coherencia entre Inventario y Contabilidad

**User Story:** Como usuario del rol contabilidad, quiero que el inventario físico coincida con la cuenta contable, para garantizar la coherencia del sistema.

#### Acceptance Criteria

1. THE ERP_System SHALL validate that the total Inventory value equals the balance of account 300 Existencias
2. WHEN an inventory movement occurs, THE ERP_System SHALL automatically update account 300 Existencias
3. THE Accounting_Module SHALL display a warning if there is a discrepancy between physical inventory and account 300
4. THE ERP_System SHALL generate a reconciliation report showing inventory value versus account 300 balance
5. THE ERP_System SHALL prevent closing a Fiscal_Period if inventory and account 300 are not reconciled

### Requirement 24: Coherencia entre Cuentas a Cobrar y Facturas Pendientes

**User Story:** Como usuario del rol tesorería, quiero que las cuentas a cobrar coincidan con las facturas pendientes, para tener control preciso de los cobros.

#### Acceptance Criteria

1. THE ERP_System SHALL validate that the balance of account 430 Clientes equals the sum of unpaid Sales_Invoice amounts
2. WHEN a Sales_Invoice is created or a Collection is registered, THE ERP_System SHALL automatically update account 430
3. THE Treasury_Module SHALL display a warning if there is a discrepancy between account 430 and pending invoices
4. THE ERP_System SHALL generate a reconciliation report showing account 430 balance versus pending invoices
5. THE ERP_System SHALL prevent closing a Fiscal_Period if account 430 and pending invoices are not reconciled

### Requirement 25: Coherencia entre Cuentas a Pagar y Facturas Pendientes

**User Story:** Como usuario del rol tesorería, quiero que las cuentas a pagar coincidan con las facturas pendientes, para tener control preciso de los pagos.

#### Acceptance Criteria

1. THE ERP_System SHALL validate that the balance of account 400 Proveedores equals the sum of unpaid Purchase_Invoice amounts
2. WHEN a Purchase_Invoice is created or a Payment is registered, THE ERP_System SHALL automatically update account 400
3. THE Treasury_Module SHALL display a warning if there is a discrepancy between account 400 and pending invoices
4. THE ERP_System SHALL generate a reconciliation report showing account 400 balance versus pending invoices
5. THE ERP_System SHALL prevent closing a Fiscal_Period if account 400 and pending invoices are not reconciled

### Requirement 26: Validación de Resultado del Ejercicio

**User Story:** Como usuario del rol contabilidad, quiero que el resultado del ejercicio se calcule correctamente, para reflejar el desempeño económico real.

#### Acceptance Criteria

1. THE Accounting_Module SHALL calculate the result as total income (group 7) minus total expenses (group 6)
2. THE Accounting_Module SHALL transfer the calculated result to account 129 Resultado del ejercicio
3. THE Accounting_Module SHALL validate that the result in the PnL_Report matches the balance in account 129
4. WHEN closing a Fiscal_Period, THE Accounting_Module SHALL automatically transfer the result to account 129
5. THE Accounting_Module SHALL include the result from account 129 in the equity section of the Balance_Sheet

### Requirement 27: Gestión de Periodos Contables

**User Story:** Como usuario del rol administrador, quiero gestionar periodos contables, para controlar en qué periodos se pueden realizar operaciones.

#### Acceptance Criteria

1. THE ERP_System SHALL allow the administrator to define fiscal periods with start date and end date
2. THE ERP_System SHALL allow the administrator to close a Fiscal_Period after validation
3. WHEN a Fiscal_Period is closed, THE ERP_System SHALL prevent creating or modifying transactions in that period
4. THE ERP_System SHALL allow the administrator to reopen a closed Fiscal_Period with justification
5. THE ERP_System SHALL validate all accounting rules before allowing a Fiscal_Period to be closed

### Requirement 28: Base de Datos y Datos de Prueba

**User Story:** Como desarrollador, quiero archivos SQL de creación y datos de prueba, para poder desplegar y probar el sistema rápidamente.

#### Acceptance Criteria

1. THE ERP_System SHALL provide a database creation SQL file with all necessary tables and relationships
2. THE ERP_System SHALL provide a seed SQL file with test data including articles, users, customers, suppliers, and fundamental PGCE accounts
3. THE seed data SHALL include at least one user for each role (compras, contabilidad, tesorería, administrador)
4. THE seed data SHALL include fundamental PGCE accounts: 100 Capital social, 129 Resultado del ejercicio, 300 Existencias, 400 Proveedores, 430 Clientes, 570 Caja, 600 Compras, 700 Ventas
5. THE database SHALL be configured for MySQL 8 compatibility

### Requirement 29: Interfaz de Usuario con React y TailwindCSS

**User Story:** Como usuario del sistema, quiero una interfaz web moderna y responsive, para poder trabajar cómodamente desde cualquier dispositivo.

#### Acceptance Criteria

1. THE ERP_System SHALL provide a web interface built with Vite, React, and TailwindCSS
2. THE interface SHALL use React Router for navigation between modules
3. THE interface SHALL be responsive and work on desktop, tablet, and mobile devices
4. THE interface SHALL display different navigation options based on the user's role
5. THE interface SHALL provide clear visual feedback for all user actions (success, error, loading states)

### Requirement 30: API REST con Node.js y Express

**User Story:** Como desarrollador frontend, quiero una API REST bien estructurada, para poder integrar el frontend con el backend de forma eficiente.

#### Acceptance Criteria

1. THE ERP_System SHALL provide a REST API built with Node.js and Express
2. THE API SHALL use JWT tokens for authentication and authorization
3. THE API SHALL validate user roles before allowing access to protected endpoints
4. THE API SHALL return appropriate HTTP status codes and error messages
5. THE API SHALL handle database transactions to ensure data consistency in multi-step operations
