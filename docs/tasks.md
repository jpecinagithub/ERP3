# Implementation Plan: ERP Contable Completo

## Overview

This implementation plan breaks down the ERP system into discrete coding tasks following a bottom-up approach: database setup, backend services and API, frontend components, and integration. The system implements a 3-layer architecture with React frontend, Node.js/Express backend, and MySQL database.

The implementation follows the principle of incremental validation, with checkpoints to ensure all tests pass before moving to the next phase.

## Tasks

- [ ] 1. Database setup and schema creation
  - [x] 1.1 Create database schema SQL file with all tables
    - Create `database/schema.sql` with all 20+ tables (users, items, customers, suppliers, accounts, journal_entries, journal_entry_lines, budgets, budget_lines, purchase_orders, purchase_order_lines, purchase_invoices, purchase_invoice_lines, inventory_movements, sales_invoices, sales_invoice_lines, payments, collections, document_links, audit_log, fiscal_periods)
    - Include all foreign key constraints and indexes
    - Add CHECK constraints for data validation
    - _Requirements: 28.1, 28.5_

  - [x] 1.2 Create seed data SQL file with test data
    - Create `database/seed.sql` with fundamental PGCE accounts (100, 129, 200, 280, 300, 400, 430, 570, 572, 600, 628, 640, 681, 700)
    - Add test users for each role (compras, contabilidad, tesorería, administrador)
    - Add sample items, customers, and suppliers
    - Add initial fiscal period (2025)
    - _Requirements: 28.2, 28.3, 28.4_

- [ ] 2. Backend project setup and core infrastructure
  - [x] 2.1 Initialize Node.js backend project
    - Create `backend/package.json` with dependencies (express, mysql2, jsonwebtoken, bcrypt, dotenv, cors)
    - Create `backend/.env.example` with configuration template
    - Create `backend/src/server.js` with Express app setup
    - _Requirements: 30.1_

  - [x] 2.2 Implement database connection module
    - Create `backend/src/config/database.js` with MySQL connection pool
    - Add connection error handling and retry logic
    - _Requirements: 30.1_

  - [x] 2.3 Implement authentication middleware
    - Create `backend/src/middleware/auth.js` with JWT token verification
    - Implement token generation and validation functions
    - _Requirements: 13.2, 30.2_

  - [x] 2.4 Implement role-based authorization middleware
    - Create `backend/src/middleware/roleCheck.js` with role validation
    - Implement role checking for compras, contabilidad, tesorería, administrador
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 30.3_

- [ ] 3. Backend services layer - Core business logic
  - [x] 3.1 Implement AccountingService for automatic journal entry generation
    - Create `backend/src/services/accountingService.js`
    - Implement `generatePurchaseInvoiceEntry()` - debit expense/inventory, credit account 400
    - Implement `generateSalesInvoiceEntry()` - debit account 430, credit income 700
    - Implement `generateCollectionEntry()` - debit account 570, credit account 430
    - Implement `generatePaymentEntry()` - debit account 400, credit account 570
    - Implement `validateEntryBalance()` - ensure debit = credit
    - Implement `calculateBalanceSheet()` - generate balance report
    - Implement `calculatePnL()` - generate P&L report
    - _Requirements: 3.3, 6.2, 7.1, 7.2, 8.1, 8.2, 10.2, 11.3, 12.3_

  - [x] 3.2 Implement ValidationService for accounting rules
    - Create `backend/src/services/validationService.js`
    - Implement `validateFundamentalEquation()` - assets = liabilities + equity
    - Implement `validateInventoryCoherence()` - inventory value = account 300
    - Implement `validateReceivablesCoherence()` - account 430 = pending sales invoices
    - Implement `validatePayablesCoherence()` - account 400 = pending purchase invoices
    - Implement `validatePnLResult()` - P&L result = account 129
    - Implement `validateNonNegativeInventory()` - prevent negative stock
    - Implement `validateNonNegativeFixedAssets()` - prevent negative fixed assets
    - Implement `validateDepreciation()` - depreciation <= fixed asset value
    - Implement `validateAllRules()` - run all validations before period close
    - _Requirements: 4.4, 7.5, 7.6, 8.5, 19.1, 19.2, 19.3, 20.1, 20.2, 20.3, 23.1, 23.3, 24.1, 24.3, 25.1, 25.3, 26.3, 27.5_

  - [x] 3.3 Implement InventoryService for stock management
    - Create `backend/src/services/inventoryService.js`
    - Implement `createInboundMovement()` - register inventory entry
    - Implement `createOutboundMovement()` - register inventory exit
    - Implement `calculateCurrentStock()` - sum of movements
    - Implement `calculateTotalInventoryValue()` - total inventory value
    - Implement `getItemMovements()` - retrieve movement history
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 3.4 Implement TraceabilityService for audit trail
    - Create `backend/src/services/traceabilityService.js`
    - Implement `createDocumentLink()` - link related documents
    - Implement `getTraceabilityChain()` - retrieve complete document chain
    - Implement `logAction()` - record user actions in audit log
    - Implement `canDeleteDocument()` - check if document can be deleted
    - _Requirements: 1.5, 2.4, 3.5, 4.5, 6.4, 10.4, 11.5, 12.5, 21.1, 21.2, 21.3, 21.4, 21.5, 22.1, 22.2, 22.3, 22.4, 22.5_

- [ ] 4. Checkpoint - Verify services layer
  - Ensure all service methods are implemented and follow consistent patterns. Ask the user if questions arise.

- [ ] 5. Backend API - Authentication endpoints
  - [x] 5.1 Implement authentication controller and routes
    - Create `backend/src/controllers/authController.js`
    - Implement POST `/api/auth/login` - validate credentials, generate JWT
    - Implement POST `/api/auth/logout` - invalidate session
    - Implement GET `/api/auth/me` - return current user info
    - Create `backend/src/routes/authRoutes.js` and register routes
    - _Requirements: 13.1, 13.2, 13.3, 13.6_

- [ ] 6. Backend API - Master data endpoints
  - [x] 6.1 Implement master data controller for items
    - Create `backend/src/controllers/masterController.js`
    - Implement GET `/api/items` - list all items
    - Implement POST `/api/items` - create item with unique code validation
    - Implement PUT `/api/items/:id` - update item
    - Implement DELETE `/api/items/:id` - delete if not used in transactions
    - Add search functionality by code or description
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 6.2 Implement master data endpoints for customers
    - Add GET `/api/customers` - list all customers
    - Add POST `/api/customers` - create customer with unique code validation
    - Add PUT `/api/customers/:id` - update customer
    - Add DELETE `/api/customers/:id` - delete if not used in transactions
    - Add search functionality by code or name
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 6.3 Implement master data endpoints for suppliers
    - Add GET `/api/suppliers` - list all suppliers
    - Add POST `/api/suppliers` - create supplier with unique code validation
    - Add PUT `/api/suppliers/:id` - update supplier
    - Add DELETE `/api/suppliers/:id` - delete if not used in transactions
    - Add search functionality by code or name
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 6.4 Implement master data endpoints for users
    - Add GET `/api/users` - list all users
    - Add POST `/api/users` - create user with unique username validation
    - Add PUT `/api/users/:id` - update user and change role
    - Add PUT `/api/users/:id/deactivate` - deactivate user
    - Add search functionality by username or full name
    - Create `backend/src/routes/masterRoutes.js` and register all master data routes
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 7. Backend API - Purchase module endpoints
  - [x] 7.1 Implement purchase controller for budgets
    - Create `backend/src/controllers/purchaseController.js`
    - Implement GET `/api/budgets` - list budgets with status
    - Implement POST `/api/budgets` - create budget, log to audit trail
    - Implement GET `/api/budgets/:id` - get budget details
    - Implement PUT `/api/budgets/:id` - update if not converted
    - Implement DELETE `/api/budgets/:id` - delete if not converted
    - Implement POST `/api/budgets/:id/convert` - convert to purchase order
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 7.2 Implement purchase order endpoints
    - Add GET `/api/purchase-orders` - list purchase orders
    - Add POST `/api/purchase-orders` - create order (from budget or direct), log to audit trail
    - Add GET `/api/purchase-orders/:id` - get order details
    - Add PUT `/api/purchase-orders/:id` - update order status
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 7.3 Implement purchase invoice endpoints with automatic accounting
    - Add GET `/api/purchase-invoices` - list purchase invoices
    - Add POST `/api/purchase-invoices` - create invoice, generate journal entry, create inventory movements, log to audit trail
    - Add GET `/api/purchase-invoices/:id` - get invoice details with linked documents
    - Calculate due date as invoice_date + 60 days
    - Use database transactions to ensure atomicity
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1_

  - [x] 7.4 Implement inventory endpoints
    - Add GET `/api/inventory` - view current stock for all items
    - Add POST `/api/inventory/adjust` - manual adjustment with justification
    - Add GET `/api/inventory/movements` - view movement history
    - Create `backend/src/routes/purchaseRoutes.js` and register all purchase routes
    - _Requirements: 4.2, 4.3_

- [ ] 8. Backend API - Accounting module endpoints
  - [x] 8.1 Implement accounting controller for accounts
    - Create `backend/src/controllers/accountingController.js`
    - Implement GET `/api/accounts` - list all accounts
    - Implement POST `/api/accounts` - create account
    - Implement GET `/api/accounts/:id` - get account details
    - Implement PUT `/api/accounts/:id` - update account
    - Prevent deletion of accounts used in entries
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 8.2 Implement journal entry endpoints
    - Add GET `/api/journal-entries` - list entries with filtering
    - Add POST `/api/journal-entries` - create entry, validate debit=credit, check period status, log to audit trail
    - Add GET `/api/journal-entries/:id` - get entry details with lines
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 8.3 Implement financial reports endpoints
    - Add GET `/api/reports/balance` - generate balance sheet, validate fundamental equation
    - Add GET `/api/reports/pnl` - generate P&L report, validate result vs account 129
    - Add POST `/api/reports/custom` - generate custom report with filters
    - Add GET `/api/reports/reconciliation` - generate reconciliation reports for inventory, receivables, payables
    - Create `backend/src/routes/accountingRoutes.js` and register all accounting routes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 23.4, 24.4, 25.4_

- [ ] 9. Backend API - Treasury module endpoints
  - [x] 9.1 Implement treasury controller for sales invoices
    - Create `backend/src/controllers/treasuryController.js`
    - Implement GET `/api/sales-invoices` - list sales invoices with payment status
    - Implement POST `/api/sales-invoices` - create invoice, generate journal entry, log to audit trail
    - Implement GET `/api/sales-invoices/:id` - get invoice details with linked documents
    - Calculate due date as invoice_date + 90 days
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 9.2 Implement collection endpoints
    - Add GET `/api/collections` - list collections
    - Add POST `/api/collections` - register collection, generate journal entry, update invoice status, log to audit trail
    - Add GET `/api/collections/:id` - get collection details
    - Prevent collection without prior sales invoice
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 9.3 Implement payment endpoints
    - Add GET `/api/payments` - list payments
    - Add POST `/api/payments` - register payment, generate journal entry, update invoice status, log to audit trail
    - Add GET `/api/payments/:id` - get payment details
    - Prevent payment without prior purchase invoice
    - Create `backend/src/routes/treasuryRoutes.js` and register all treasury routes
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ] 10. Backend API - Fiscal period management
  - [x] 10.1 Implement fiscal period endpoints
    - Add GET `/api/fiscal-periods` - list fiscal periods
    - Add POST `/api/fiscal-periods` - create fiscal period
    - Add PUT `/api/fiscal-periods/:id/close` - close period after validation, transfer result to account 129
    - Add PUT `/api/fiscal-periods/:id/reopen` - reopen period with justification
    - Add to `backend/src/routes/accountingRoutes.js`
    - _Requirements: 26.4, 27.1, 27.2, 27.3, 27.4, 27.5_

- [ ] 11. Checkpoint - Backend API complete
  - Ensure all endpoints are implemented, protected by authentication and role-based authorization. Ask the user if questions arise.

- [ ] 12. Frontend project setup and core infrastructure
  - [x] 12.1 Initialize React frontend project
    - Create frontend with Vite: `npm create vite@latest frontend -- --template react`
    - Install dependencies: `npm install react-router-dom tailwindcss postcss autoprefixer axios`
    - Configure TailwindCSS with `npx tailwindcss init -p`
    - _Requirements: 29.1, 29.2_

  - [x] 12.2 Implement authentication context and API service
    - Create `frontend/src/context/AuthContext.jsx` with login, logout, user state
    - Create `frontend/src/services/api.js` with axios instance and JWT interceptor
    - Create `frontend/src/services/authService.js` with login/logout functions
    - _Requirements: 13.1, 13.6_

  - [x] 12.3 Implement protected route component
    - Create `frontend/src/components/auth/Login.jsx` with login form
    - Create `frontend/src/components/auth/ProtectedRoute.jsx` with role-based access control
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 12.4 Implement layout components
    - Create `frontend/src/components/layout/Navbar.jsx` with user info and logout
    - Create `frontend/src/components/layout/Sidebar.jsx` with role-based navigation
    - Create `frontend/src/components/layout/Layout.jsx` combining navbar and sidebar
    - _Requirements: 29.4_

  - [x] 12.5 Implement common reusable components
    - Create `frontend/src/components/common/Table.jsx` for data tables
    - Create `frontend/src/components/common/Input.jsx` for form inputs
    - Create `frontend/src/components/common/Button.jsx` for buttons
    - Create `frontend/src/components/common/Modal.jsx` for dialogs
    - Create `frontend/src/components/common/Alert.jsx` for notifications
    - _Requirements: 29.3, 29.5_

- [ ] 13. Frontend - Master data management components
  - [x] 13.1 Implement item management components
    - Create `frontend/src/services/masterService.js` with API calls for all master data
    - Create `frontend/src/components/master/ItemList.jsx` with search and CRUD actions
    - Create `frontend/src/components/master/ItemForm.jsx` for create/edit
    - _Requirements: 15.1, 15.2, 15.5_

  - [x] 13.2 Implement customer management components
    - Create `frontend/src/components/master/CustomerList.jsx` with search and CRUD actions
    - Create `frontend/src/components/master/CustomerForm.jsx` for create/edit
    - _Requirements: 16.1, 16.2, 16.5_

  - [x] 13.3 Implement supplier management components
    - Create `frontend/src/components/master/SupplierList.jsx` with search and CRUD actions
    - Create `frontend/src/components/master/SupplierForm.jsx` for create/edit
    - _Requirements: 17.1, 17.2, 17.5_

  - [x] 13.4 Implement user management components
    - Create `frontend/src/components/master/UserList.jsx` with search and CRUD actions
    - Create `frontend/src/components/master/UserForm.jsx` for create/edit with role selection
    - _Requirements: 18.1, 18.2, 18.4, 18.5_

- [ ] 14. Frontend - Purchase module components
  - [x] 14.1 Implement budget management components
    - Create `frontend/src/services/purchaseService.js` with API calls for purchase module
    - Create `frontend/src/components/purchase/BudgetList.jsx` with status display and convert action
    - Create `frontend/src/components/purchase/BudgetForm.jsx` for create/edit with line items
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 14.2 Implement purchase order management components
    - Create `frontend/src/components/purchase/PurchaseOrderList.jsx` with status tracking
    - Create `frontend/src/components/purchase/PurchaseOrderForm.jsx` for create/edit with line items
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 14.3 Implement purchase invoice management components
    - Create `frontend/src/components/purchase/PurchaseInvoiceList.jsx` with payment status
    - Create `frontend/src/components/purchase/PurchaseInvoiceForm.jsx` for create with line items
    - Display linked documents (budget, order, journal entry, payments)
    - _Requirements: 3.1, 3.2, 3.4, 21.3_

  - [x] 14.4 Implement inventory view component
    - Create `frontend/src/components/purchase/InventoryView.jsx` showing current stock and movements
    - Add manual adjustment functionality
    - _Requirements: 4.2, 4.3_

- [ ] 15. Frontend - Accounting module components
  - [x] 15.1 Implement account management components
    - Create `frontend/src/services/accountingService.js` with API calls for accounting module
    - Create `frontend/src/components/accounting/AccountList.jsx` with hierarchical display
    - Create `frontend/src/components/accounting/AccountForm.jsx` for create/edit
    - _Requirements: 5.1, 5.2_

  - [x] 15.2 Implement journal entry management components
    - Create `frontend/src/components/accounting/JournalEntryList.jsx` with filtering
    - Create `frontend/src/components/accounting/JournalEntryForm.jsx` for create with multiple lines
    - Validate debit = credit before submission
    - Display linked source documents
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [x] 15.3 Implement financial reports components
    - Create `frontend/src/components/accounting/BalanceSheet.jsx` displaying assets, liabilities, equity
    - Create `frontend/src/components/accounting/PnLReport.jsx` displaying income and expenses
    - Create `frontend/src/components/accounting/CustomReport.jsx` with filters and export to CSV
    - Display validation warnings for accounting rules
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 19.2, 20.4, 23.3, 24.3, 25.3_

- [ ] 16. Frontend - Treasury module components
  - [x] 16.1 Implement sales invoice management components
    - Create `frontend/src/services/treasuryService.js` with API calls for treasury module
    - Create `frontend/src/components/treasury/SalesInvoiceList.jsx` with payment status
    - Create `frontend/src/components/treasury/SalesInvoiceForm.jsx` for create with line items
    - Display linked documents (journal entry, collections)
    - _Requirements: 10.1, 10.5, 22.3_

  - [x] 16.2 Implement collection management components
    - Create `frontend/src/components/treasury/CollectionList.jsx`
    - Create `frontend/src/components/treasury/CollectionForm.jsx` for registering collections
    - _Requirements: 11.1, 11.6_

  - [x] 16.3 Implement payment management components
    - Create `frontend/src/components/treasury/PaymentList.jsx`
    - Create `frontend/src/components/treasury/PaymentForm.jsx` for registering payments
    - _Requirements: 12.1, 12.6_

- [ ] 17. Frontend - Routing and navigation
  - [ ] 17.1 Implement main application routing
    - Create `frontend/src/App.jsx` with React Router configuration
    - Define routes for all modules with role-based protection
    - Configure routes: /login, /budgets, /purchase-orders, /purchase-invoices, /inventory, /accounts, /journal-entries, /reports/balance, /reports/pnl, /reports/custom, /sales-invoices, /collections, /payments, /items, /customers, /suppliers, /users, /fiscal-periods
    - _Requirements: 29.2, 29.4_

- [ ] 18. Checkpoint - Frontend complete
  - Ensure all components are implemented, responsive, and provide proper feedback. Ask the user if questions arise.

- [ ] 19. Integration and end-to-end flows
  - [ ] 19.1 Test complete purchase cycle
    - Verify budget → purchase order → purchase invoice → journal entry → inventory movement → payment flow
    - Verify traceability links are created correctly
    - Verify automatic accounting entries are generated
    - _Requirements: 21.1, 21.2, 21.3_

  - [ ] 19.2 Test complete sales cycle
    - Verify sales invoice → journal entry → collection flow
    - Verify traceability links are created correctly
    - Verify automatic accounting entries are generated
    - _Requirements: 22.1, 22.2, 22.3_

  - [ ] 19.3 Test accounting validations
    - Verify fundamental equation validation (assets = liabilities + equity)
    - Verify inventory coherence (inventory value = account 300)
    - Verify receivables coherence (account 430 = pending sales invoices)
    - Verify payables coherence (account 400 = pending purchase invoices)
    - Verify P&L result matches account 129
    - _Requirements: 19.1, 23.1, 24.1, 25.1, 26.3_

  - [ ] 19.4 Test fiscal period management
    - Verify period close validates all accounting rules
    - Verify period close prevents further transactions
    - Verify period reopen with justification
    - _Requirements: 27.2, 27.3, 27.4, 27.5_

  - [ ] 19.5 Test role-based access control
    - Verify compras role can only access purchase module
    - Verify contabilidad role can only access accounting module
    - Verify tesorería role can only access treasury module
    - Verify administrador role can access all modules
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 20. Final checkpoint and deployment preparation
  - [ ] 20.1 Create deployment documentation
    - Create `README.md` with setup instructions
    - Document environment variables required
    - Document database setup steps
    - Document how to run backend and frontend
    - _Requirements: 28.1, 28.2_

  - [ ] 20.2 Create database initialization scripts
    - Create `database/init.sh` script to run schema and seed files
    - Add instructions for MySQL 8 setup
    - _Requirements: 28.5_

  - [ ] 20.3 Final integration test
    - Run complete end-to-end test of all modules
    - Verify all accounting validations work correctly
    - Verify all traceability links are maintained
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks reference specific requirements for traceability
- Database transactions are used throughout to ensure data consistency
- Automatic journal entry generation is a core feature implemented in the services layer
- The system enforces 20 accounting validation rules to ensure data integrity
- Traceability is maintained through document_links and audit_log tables
- Role-based access control is enforced at both API and UI levels
- The implementation follows a bottom-up approach: database → services → API → UI
