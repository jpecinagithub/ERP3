-- ============================================================================
-- TEMPLATE 2025 - EJERCICIO CONTABLE COMPLETO Y CONSISTENTE
-- Requiere: database/schema.sql + database/seed.sql ya ejecutados.
-- Motor: MySQL 8
-- ============================================================================

USE erp_contable;

START TRANSACTION;

-- ============================================================================
-- 0) VARIABLES MAESTRAS (sin IDs hardcodeados)
-- ============================================================================

SET @u_admin = COALESCE(
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
  (SELECT id FROM users WHERE role = 'administrador' LIMIT 1),
  (SELECT id FROM users ORDER BY id LIMIT 1)
);
SET @u_compras = COALESCE((SELECT id FROM users WHERE username = 'compras' LIMIT 1), @u_admin);
SET @u_ventas = COALESCE((SELECT id FROM users WHERE username = 'ventas' LIMIT 1), @u_admin);
SET @u_conta = COALESCE((SELECT id FROM users WHERE username = 'contabilidad' LIMIT 1), @u_admin);
SET @u_teso = COALESCE((SELECT id FROM users WHERE username = 'tesoreria' LIMIT 1), @u_admin);

SET @sup1 = (SELECT id FROM suppliers WHERE code = 'PRO001' LIMIT 1);
SET @sup2 = (SELECT id FROM suppliers WHERE code = 'PRO002' LIMIT 1);
SET @sup3 = (SELECT id FROM suppliers WHERE code = 'PRO003' LIMIT 1);
SET @sup4 = (SELECT id FROM suppliers WHERE code = 'PRO004' LIMIT 1);
SET @sup5 = (SELECT id FROM suppliers WHERE code = 'PRO005' LIMIT 1);

SET @cli1 = (SELECT id FROM customers WHERE code = 'CLI001' LIMIT 1);
SET @cli2 = (SELECT id FROM customers WHERE code = 'CLI002' LIMIT 1);
SET @cli3 = (SELECT id FROM customers WHERE code = 'CLI003' LIMIT 1);

SET @it1 = (SELECT id FROM items WHERE code = 'ART001' LIMIT 1);
SET @it2 = (SELECT id FROM items WHERE code = 'ART002' LIMIT 1);
SET @it3 = (SELECT id FROM items WHERE code = 'ART003' LIMIT 1);
SET @it4 = (SELECT id FROM items WHERE code = 'ART004' LIMIT 1);

SET @acc100 = (SELECT id FROM accounts WHERE code = '100' LIMIT 1);
SET @acc223 = (SELECT id FROM accounts WHERE code = '223' LIMIT 1);
SET @acc280 = (SELECT id FROM accounts WHERE code = '280' LIMIT 1);
SET @acc300 = (SELECT id FROM accounts WHERE code = '300' LIMIT 1);
SET @acc400 = (SELECT id FROM accounts WHERE code = '400' LIMIT 1);
SET @acc430 = (SELECT id FROM accounts WHERE code = '430' LIMIT 1);
SET @acc460 = (SELECT id FROM accounts WHERE code = '460' LIMIT 1);
SET @acc465 = (SELECT id FROM accounts WHERE code = '465' LIMIT 1);
SET @acc472 = (SELECT id FROM accounts WHERE code = '472' LIMIT 1);
SET @acc477 = (SELECT id FROM accounts WHERE code = '477' LIMIT 1);
SET @acc572 = (SELECT id FROM accounts WHERE code = '572' LIMIT 1);
SET @acc600 = (SELECT id FROM accounts WHERE code = '600' LIMIT 1);
SET @acc610 = (SELECT id FROM accounts WHERE code = '610' LIMIT 1);
SET @acc621 = (SELECT id FROM accounts WHERE code = '621' LIMIT 1);
SET @acc628 = (SELECT id FROM accounts WHERE code = '628' LIMIT 1);
SET @acc640 = (SELECT id FROM accounts WHERE code = '640' LIMIT 1);
SET @acc642 = (SELECT id FROM accounts WHERE code = '642' LIMIT 1);
SET @acc681 = (SELECT id FROM accounts WHERE code = '681' LIMIT 1);
SET @acc700 = (SELECT id FROM accounts WHERE code = '700' LIMIT 1);

-- ============================================================================
-- 1) FINANCIACION INICIAL
-- ============================================================================

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-01-02', 'Aportacion inicial de capital a banco', 'capital_contribution', NULL, 'posted', @u_conta);
SET @je_capital = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_capital, @acc572, 100000.00, 0.00, 'Ingreso en cuenta bancaria'),
  (@je_capital, @acc100, 0.00, 100000.00, 'Capital social suscrito y desembolsado');

-- ============================================================================
-- 2) COMPRAS MERCADERIA (PO -> PI -> ALMACEN -> ASIENTO -> PAGO PENDIENTE)
-- ============================================================================

-- PO-1
INSERT INTO purchase_orders
  (order_number, supplier_id, order_date, total_amount, status, notes, created_by)
VALUES
  ('PO-T25-0001', @sup1, '2025-01-05', 18400.00, 'pending', 'Pedido inicial de stock', @u_compras);
SET @po1 = LAST_INSERT_ID();

INSERT INTO purchase_order_lines
  (purchase_order_id, item_id, quantity, unit_price, line_total, received_quantity)
VALUES
  (@po1, @it1, 20.00, 650.00, 13000.00, 0.00),
  (@po1, @it2, 30.00, 180.00, 5400.00, 0.00);

-- PI-1 Mercaderia (base 18.400, IVA 3.864, total 22.264)
INSERT INTO purchase_invoices
  (invoice_number, supplier_id, invoice_type, invoice_date, due_date, total_amount, paid_amount, status, notes, created_by)
VALUES
  ('PI-T25-0001', @sup1, 'mercaderia', '2025-01-08', '2025-03-09', 22264.00, 0.00, 'pending',
   'Compra de mercaderia con IVA 21%', @u_compras);
SET @pi1 = LAST_INSERT_ID();

INSERT INTO purchase_invoice_lines
  (purchase_invoice_id, item_id, line_description, quantity, unit_price, line_total)
VALUES
  (@pi1, @it1, NULL, 20.00, 650.00, 13000.00),
  (@pi1, @it2, NULL, 30.00, 180.00, 5400.00);

INSERT INTO inventory_movements
  (item_id, movement_date, movement_type, quantity, unit_cost, total_value, source_document_type, source_document_id, notes, created_by)
VALUES
  (@it1, '2025-01-08', 'inbound', 20.00, 650.00, 13000.00, 'purchase_invoice', @pi1, 'Entrada por PI-T25-0001', @u_compras),
  (@it2, '2025-01-08', 'inbound', 30.00, 180.00, 5400.00, 'purchase_invoice', @pi1, 'Entrada por PI-T25-0001', @u_compras);

UPDATE purchase_orders SET status = 'fully_received' WHERE id = @po1;
UPDATE purchase_order_lines SET received_quantity = quantity WHERE purchase_order_id = @po1;

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_order', @po1, 'purchase_invoice', @pi1, 'generated');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-01-08', 'Factura compra PI-T25-0001', 'purchase_invoice', @pi1, 'posted', @u_conta);
SET @je_pi1 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_pi1, @acc600, 18400.00, 0.00, 'Compra de mercaderias'),
  (@je_pi1, @acc472, 3864.00, 0.00, 'IVA soportado 21%'),
  (@je_pi1, @acc400, 0.00, 22264.00, 'Proveedor PRO001');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_invoice', @pi1, 'journal_entry', @je_pi1, 'generated');

INSERT INTO payments
  (payment_number, purchase_invoice_id, payment_date, amount, status, payment_method, notes, created_by)
VALUES
  ('PAG-T25-0001', @pi1, '2025-02-10', 22264.00, 'pending', 'bank_transfer', 'Pago programado PI-T25-0001', @u_teso);
SET @pay1 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_invoice', @pi1, 'payment', @pay1, 'generated');

-- ============================================================================
-- 3) VENTA 1 (SO -> SV -> SALIDA STOCK -> ASIENTOS -> COBRO)
-- ============================================================================

INSERT INTO sales_orders
  (order_number, customer_id, sales_budget_id, order_date, total_amount, status, notes, created_by)
VALUES
  ('SO-T25-0001', @cli1, NULL, '2025-01-15', 7220.00, 'ready_to_invoice', 'Pedido cliente con stock disponible', @u_ventas);
SET @so1 = LAST_INSERT_ID();

INSERT INTO sales_order_lines
  (sales_order_id, item_id, quantity, unit_price, line_total, supplied_quantity)
VALUES
  (@so1, @it1, 5.00, 980.00, 4900.00, 0.00),
  (@so1, @it2, 8.00, 290.00, 2320.00, 0.00);

-- SV-1 (base 7.220, IVA 1.516,20, total 8.736,20)
INSERT INTO sales_invoices
  (invoice_number, customer_id, sales_order_id, invoice_date, due_date, total_amount, collected_amount, status, notes, created_by)
VALUES
  ('SV-T25-0001', @cli1, @so1, '2025-01-20', '2025-04-20', 8736.20, 0.00, 'pending',
   'Venta con IVA 21%', @u_ventas);
SET @sv1 = LAST_INSERT_ID();

INSERT INTO sales_invoice_lines
  (sales_invoice_id, item_id, quantity, unit_price, line_total)
VALUES
  (@sv1, @it1, 5.00, 980.00, 4900.00),
  (@sv1, @it2, 8.00, 290.00, 2320.00);

INSERT INTO inventory_movements
  (item_id, movement_date, movement_type, quantity, unit_cost, total_value, source_document_type, source_document_id, notes, created_by)
VALUES
  (@it1, '2025-01-20', 'outbound', -5.00, 650.00, -3250.00, 'sales_invoice', @sv1, 'Salida por SV-T25-0001', @u_ventas),
  (@it2, '2025-01-20', 'outbound', -8.00, 180.00, -1440.00, 'sales_invoice', @sv1, 'Salida por SV-T25-0001', @u_ventas);

UPDATE sales_orders SET status = 'invoiced' WHERE id = @so1;
UPDATE sales_order_lines SET supplied_quantity = quantity WHERE sales_order_id = @so1;

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_order', @so1, 'sales_invoice', @sv1, 'generated');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-01-20', 'Factura venta SV-T25-0001', 'sales_invoice', @sv1, 'posted', @u_conta);
SET @je_sv1 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_sv1, @acc430, 8736.20, 0.00, 'Cliente CLI001'),
  (@je_sv1, @acc700, 0.00, 7220.00, 'Venta mercaderias'),
  (@je_sv1, @acc477, 0.00, 1516.20, 'IVA repercutido 21%');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-01-20', 'Coste salida stock SV-T25-0001', 'sales_invoice_inventory', @sv1, 'posted', @u_conta);
SET @je_sv1_stock = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_sv1_stock, @acc610, 4690.00, 0.00, 'Coste de salida de existencias'),
  (@je_sv1_stock, @acc300, 0.00, 4690.00, 'Baja de stock');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_invoice', @sv1, 'journal_entry', @je_sv1, 'generated'),
  ('sales_invoice', @sv1, 'journal_entry', @je_sv1_stock, 'generated');

INSERT INTO collections
  (collection_number, sales_invoice_id, collection_date, amount, status, payment_method, notes, created_by)
VALUES
  ('COB-T25-0001', @sv1, '2025-02-25', 4000.00, 'pending', 'bank_transfer', 'Cobro parcial SV-T25-0001', @u_teso);
SET @cob1 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_invoice', @sv1, 'collection', @cob1, 'linked_to');

-- ============================================================================
-- 4) INMOVILIZADO (FACTURA + ACTIVO + PAGO + AMORTIZACION)
-- ============================================================================

-- PI-3 Inmovilizado (base 12.000, IVA 2.520, total 14.520)
INSERT INTO purchase_invoices
  (invoice_number, supplier_id, invoice_type, invoice_date, due_date, total_amount, paid_amount, status, notes, created_by)
VALUES
  ('PI-T25-0003', @sup4, 'inmovilizado', '2025-02-03', '2025-04-04', 14520.00, 0.00, 'pending',
   'Compra servidor oficina con IVA 21%', @u_compras);
SET @pi3 = LAST_INSERT_ID();

INSERT INTO purchase_invoice_lines
  (purchase_invoice_id, item_id, line_description, quantity, unit_price, line_total)
VALUES
  (@pi3, NULL, 'Servidor de oficina y puesta en marcha', 1.00, 12000.00, 12000.00);

INSERT INTO fixed_assets
  (asset_code, description, purchase_invoice_id, acquisition_date, acquisition_value, residual_value, useful_life_months,
   depreciation_method, asset_account_code, depreciation_account_code, accumulated_depreciation, status, created_by)
VALUES
  ('FA-T25-0001', 'Servidor de oficina', @pi3, '2025-02-03', 12000.00, 2000.00, 60,
   'linear', '223', '681', 0.00, 'active', @u_compras);
SET @fa1 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_invoice', @pi3, 'fixed_asset', @fa1, 'generated');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-02-03', 'Factura inmovilizado PI-T25-0003', 'purchase_invoice', @pi3, 'posted', @u_conta);
SET @je_pi3 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_pi3, @acc223, 12000.00, 0.00, 'Alta inmovilizado material'),
  (@je_pi3, @acc472, 2520.00, 0.00, 'IVA soportado 21%'),
  (@je_pi3, @acc400, 0.00, 14520.00, 'Proveedor PRO004');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_invoice', @pi3, 'journal_entry', @je_pi3, 'generated');

INSERT INTO payments
  (payment_number, purchase_invoice_id, payment_date, amount, status, payment_method, notes, created_by)
VALUES
  ('PAG-T25-0003', @pi3, '2025-04-10', 14520.00, 'pending', 'bank_transfer', 'Pago programado PI-T25-0003', @u_teso);
SET @pay3 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_invoice', @pi3, 'payment', @pay3, 'generated');

-- ============================================================================
-- 5) TESORERIA Q1/Q2 (REALIZACION DE PAGO/COBRO YA FACTURADOS)
-- ============================================================================

-- Realizacion pago PI-1
UPDATE payments SET status = 'realized' WHERE id = @pay1;

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-02-10', 'Pago PAG-T25-0001 factura PI-T25-0001', 'payment', @pay1, 'posted', @u_teso);
SET @je_pay1 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_pay1, @acc400, 22264.00, 0.00, 'Cancelacion proveedor PRO001'),
  (@je_pay1, @acc572, 0.00, 22264.00, 'Salida bancaria');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('payment', @pay1, 'journal_entry', @je_pay1, 'generated');

UPDATE purchase_invoices
SET paid_amount = 22264.00, status = 'paid'
WHERE id = @pi1;

-- Realizacion cobro parcial SV-1
UPDATE collections SET status = 'realized' WHERE id = @cob1;

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-02-25', 'Cobro COB-T25-0001 factura SV-T25-0001', 'collection', @cob1, 'posted', @u_teso);
SET @je_cob1 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_cob1, @acc572, 4000.00, 0.00, 'Entrada bancaria cobro cliente'),
  (@je_cob1, @acc430, 0.00, 4000.00, 'Cancelacion parcial cliente CLI001');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('collection', @cob1, 'journal_entry', @je_cob1, 'generated');

UPDATE sales_invoices
SET collected_amount = 4000.00, status = 'partially_collected'
WHERE id = @sv1;

-- ============================================================================
-- 6) FACTURA ARRENDAMIENTO + FACTURA GASTO
-- ============================================================================

-- PI-5 Arrendamiento (base 1.500, IVA 315, total 1.815)
INSERT INTO purchase_invoices
  (invoice_number, supplier_id, invoice_type, invoice_date, due_date, total_amount, paid_amount, status, notes, created_by)
VALUES
  ('PI-T25-0005', @sup5, 'gasto', '2025-03-01', '2025-04-30', 1815.00, 0.00, 'pending',
   'Factura arrendamiento oficina marzo 2025', @u_compras);
SET @pi5 = LAST_INSERT_ID();

INSERT INTO purchase_invoice_lines
  (purchase_invoice_id, item_id, line_description, quantity, unit_price, line_total)
VALUES
  (@pi5, NULL, 'Arrendamiento oficina marzo 2025', 1.00, 1500.00, 1500.00);

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-03-01', 'Factura arrendamiento PI-T25-0005', 'purchase_invoice', @pi5, 'posted', @u_conta);
SET @je_pi5 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_pi5, @acc621, 1500.00, 0.00, 'Arrendamientos y canones'),
  (@je_pi5, @acc472, 315.00, 0.00, 'IVA soportado 21%'),
  (@je_pi5, @acc400, 0.00, 1815.00, 'Proveedor PRO005');

INSERT INTO payments
  (payment_number, purchase_invoice_id, payment_date, amount, status, payment_method, notes, created_by)
VALUES
  ('PAG-T25-0005', @pi5, '2025-04-30', 1815.00, 'pending', 'bank_transfer', 'Pago programado PI-T25-0005', @u_teso);
SET @pay5 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_invoice', @pi5, 'journal_entry', @je_pi5, 'generated'),
  ('purchase_invoice', @pi5, 'payment', @pay5, 'generated');

-- PO-2 + PI-2 Mercaderia (base 12.500, IVA 2.625, total 15.125)
INSERT INTO purchase_orders
  (order_number, supplier_id, order_date, total_amount, status, notes, created_by)
VALUES
  ('PO-T25-0002', @sup2, '2025-03-10', 12500.00, 'pending', 'Reposicion de stock para Q2', @u_compras);
SET @po2 = LAST_INSERT_ID();

INSERT INTO purchase_order_lines
  (purchase_order_id, item_id, quantity, unit_price, line_total, received_quantity)
VALUES
  (@po2, @it1, 10.00, 640.00, 6400.00, 0.00),
  (@po2, @it3, 100.00, 33.00, 3300.00, 0.00),
  (@po2, @it4, 200.00, 14.00, 2800.00, 0.00);

INSERT INTO purchase_invoices
  (invoice_number, supplier_id, invoice_type, invoice_date, due_date, total_amount, paid_amount, status, notes, created_by)
VALUES
  ('PI-T25-0002', @sup2, 'mercaderia', '2025-03-15', '2025-05-14', 15125.00, 0.00, 'pending',
   'Compra mercaderia para Q2 con IVA 21%', @u_compras);
SET @pi2 = LAST_INSERT_ID();

INSERT INTO purchase_invoice_lines
  (purchase_invoice_id, item_id, line_description, quantity, unit_price, line_total)
VALUES
  (@pi2, @it1, NULL, 10.00, 640.00, 6400.00),
  (@pi2, @it3, NULL, 100.00, 33.00, 3300.00),
  (@pi2, @it4, NULL, 200.00, 14.00, 2800.00);

INSERT INTO inventory_movements
  (item_id, movement_date, movement_type, quantity, unit_cost, total_value, source_document_type, source_document_id, notes, created_by)
VALUES
  (@it1, '2025-03-15', 'inbound', 10.00, 640.00, 6400.00, 'purchase_invoice', @pi2, 'Entrada por PI-T25-0002', @u_compras),
  (@it3, '2025-03-15', 'inbound', 100.00, 33.00, 3300.00, 'purchase_invoice', @pi2, 'Entrada por PI-T25-0002', @u_compras),
  (@it4, '2025-03-15', 'inbound', 200.00, 14.00, 2800.00, 'purchase_invoice', @pi2, 'Entrada por PI-T25-0002', @u_compras);

UPDATE purchase_orders SET status = 'fully_received' WHERE id = @po2;
UPDATE purchase_order_lines SET received_quantity = quantity WHERE purchase_order_id = @po2;

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_order', @po2, 'purchase_invoice', @pi2, 'generated');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-03-15', 'Factura compra PI-T25-0002', 'purchase_invoice', @pi2, 'posted', @u_conta);
SET @je_pi2 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_pi2, @acc600, 12500.00, 0.00, 'Compra de mercaderias'),
  (@je_pi2, @acc472, 2625.00, 0.00, 'IVA soportado 21%'),
  (@je_pi2, @acc400, 0.00, 15125.00, 'Proveedor PRO002');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_invoice', @pi2, 'journal_entry', @je_pi2, 'generated');

INSERT INTO payments
  (payment_number, purchase_invoice_id, payment_date, amount, status, payment_method, notes, created_by)
VALUES
  ('PAG-T25-0002A', @pi2, '2025-06-20', 8000.00, 'pending', 'bank_transfer', 'Pago parcial 1 PI-T25-0002', @u_teso),
  ('PAG-T25-0002B', @pi2, '2025-12-20', 7125.00, 'pending', 'bank_transfer', 'Pago parcial 2 PI-T25-0002', @u_teso);
SET @pay2a = LAST_INSERT_ID();
SET @pay2b = @pay2a + 1;

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_invoice', @pi2, 'payment', @pay2a, 'generated'),
  ('purchase_invoice', @pi2, 'payment', @pay2b, 'generated');

-- PI-4 Gasto general (base 900, IVA 189, total 1.089)
INSERT INTO purchase_invoices
  (invoice_number, supplier_id, invoice_type, invoice_date, due_date, total_amount, paid_amount, status, notes, created_by)
VALUES
  ('PI-T25-0004', @sup3, 'gasto', '2025-04-02', '2025-06-01', 1089.00, 0.00, 'pending',
   'Factura suministros oficina Q2', @u_compras);
SET @pi4 = LAST_INSERT_ID();

INSERT INTO purchase_invoice_lines
  (purchase_invoice_id, item_id, line_description, quantity, unit_price, line_total)
VALUES
  (@pi4, NULL, 'Suministros oficina Q2', 1.00, 900.00, 900.00);

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-04-02', 'Factura gasto PI-T25-0004', 'purchase_invoice', @pi4, 'posted', @u_conta);
SET @je_pi4 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_pi4, @acc628, 900.00, 0.00, 'Suministros y servicios'),
  (@je_pi4, @acc472, 189.00, 0.00, 'IVA soportado 21%'),
  (@je_pi4, @acc400, 0.00, 1089.00, 'Proveedor PRO003');

INSERT INTO payments
  (payment_number, purchase_invoice_id, payment_date, amount, status, payment_method, notes, created_by)
VALUES
  ('PAG-T25-0004', @pi4, '2025-12-31', 1089.00, 'pending', 'bank_transfer', 'Pago pendiente al cierre PI-T25-0004', @u_teso);
SET @pay4 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('purchase_invoice', @pi4, 'journal_entry', @je_pi4, 'generated'),
  ('purchase_invoice', @pi4, 'payment', @pay4, 'generated');

-- ============================================================================
-- 7) TESORERIA Q2/Q3
-- ============================================================================

-- Realizacion pago PI-3 (inmovilizado)
UPDATE payments SET status = 'realized' WHERE id = @pay3;

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-04-10', 'Pago PAG-T25-0003 factura PI-T25-0003', 'payment', @pay3, 'posted', @u_teso);
SET @je_pay3 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_pay3, @acc400, 14520.00, 0.00, 'Cancelacion proveedor PRO004'),
  (@je_pay3, @acc572, 0.00, 14520.00, 'Salida bancaria');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('payment', @pay3, 'journal_entry', @je_pay3, 'generated');

UPDATE purchase_invoices
SET paid_amount = 14520.00, status = 'paid'
WHERE id = @pi3;

-- Cobro final SV-1
INSERT INTO collections
  (collection_number, sales_invoice_id, collection_date, amount, status, payment_method, notes, created_by)
VALUES
  ('COB-T25-0002', @sv1, '2025-04-25', 4736.20, 'pending', 'bank_transfer', 'Cobro final SV-T25-0001', @u_teso);
SET @cob2 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_invoice', @sv1, 'collection', @cob2, 'linked_to');

UPDATE collections SET status = 'realized' WHERE id = @cob2;

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-04-25', 'Cobro COB-T25-0002 factura SV-T25-0001', 'collection', @cob2, 'posted', @u_teso);
SET @je_cob2 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_cob2, @acc572, 4736.20, 0.00, 'Entrada bancaria cobro cliente'),
  (@je_cob2, @acc430, 0.00, 4736.20, 'Cancelacion cliente CLI001');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('collection', @cob2, 'journal_entry', @je_cob2, 'generated');

UPDATE sales_invoices
SET collected_amount = 8736.20, status = 'collected'
WHERE id = @sv1;

-- Realizacion pago arrendamiento PI-5
UPDATE payments SET status = 'realized' WHERE id = @pay5;

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-04-30', 'Pago PAG-T25-0005 factura PI-T25-0005', 'payment', @pay5, 'posted', @u_teso);
SET @je_pay5 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_pay5, @acc400, 1815.00, 0.00, 'Cancelacion proveedor PRO005'),
  (@je_pay5, @acc572, 0.00, 1815.00, 'Salida bancaria');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('payment', @pay5, 'journal_entry', @je_pay5, 'generated');

UPDATE purchase_invoices
SET paid_amount = 1815.00, status = 'paid'
WHERE id = @pi5;

-- ============================================================================
-- 8) VENTA 2 (con stock ya disponible por PI-1 y PI-2)
-- ============================================================================

INSERT INTO sales_orders
  (order_number, customer_id, sales_budget_id, order_date, total_amount, status, notes, created_by)
VALUES
  ('SO-T25-0002', @cli2, NULL, '2025-04-30', 7040.00, 'ready_to_invoice', 'Pedido Q2', @u_ventas);
SET @so2 = LAST_INSERT_ID();

INSERT INTO sales_order_lines
  (sales_order_id, item_id, quantity, unit_price, line_total, supplied_quantity)
VALUES
  (@so2, @it1, 6.00, 990.00, 5940.00, 0.00),
  (@so2, @it3, 20.00, 55.00, 1100.00, 0.00);

INSERT INTO sales_invoices
  (invoice_number, customer_id, sales_order_id, invoice_date, due_date, total_amount, collected_amount, status, notes, created_by)
VALUES
  ('SV-T25-0002', @cli2, @so2, '2025-05-05', '2025-08-03', 8518.40, 0.00, 'pending',
   'Venta con IVA 21%', @u_ventas);
SET @sv2 = LAST_INSERT_ID();

INSERT INTO sales_invoice_lines
  (sales_invoice_id, item_id, quantity, unit_price, line_total)
VALUES
  (@sv2, @it1, 6.00, 990.00, 5940.00),
  (@sv2, @it3, 20.00, 55.00, 1100.00);

-- Costes medios en fecha de salida: ART001=646, ART003=33
INSERT INTO inventory_movements
  (item_id, movement_date, movement_type, quantity, unit_cost, total_value, source_document_type, source_document_id, notes, created_by)
VALUES
  (@it1, '2025-05-05', 'outbound', -6.00, 646.00, -3876.00, 'sales_invoice', @sv2, 'Salida por SV-T25-0002', @u_ventas),
  (@it3, '2025-05-05', 'outbound', -20.00, 33.00, -660.00, 'sales_invoice', @sv2, 'Salida por SV-T25-0002', @u_ventas);

UPDATE sales_orders SET status = 'invoiced' WHERE id = @so2;
UPDATE sales_order_lines SET supplied_quantity = quantity WHERE sales_order_id = @so2;

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_order', @so2, 'sales_invoice', @sv2, 'generated');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-05-05', 'Factura venta SV-T25-0002', 'sales_invoice', @sv2, 'posted', @u_conta);
SET @je_sv2 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_sv2, @acc430, 8518.40, 0.00, 'Cliente CLI002'),
  (@je_sv2, @acc700, 0.00, 7040.00, 'Venta mercaderias'),
  (@je_sv2, @acc477, 0.00, 1478.40, 'IVA repercutido 21%');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-05-05', 'Coste salida stock SV-T25-0002', 'sales_invoice_inventory', @sv2, 'posted', @u_conta);
SET @je_sv2_stock = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_sv2_stock, @acc610, 4536.00, 0.00, 'Coste de salida de existencias'),
  (@je_sv2_stock, @acc300, 0.00, 4536.00, 'Baja de stock');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_invoice', @sv2, 'journal_entry', @je_sv2, 'generated'),
  ('sales_invoice', @sv2, 'journal_entry', @je_sv2_stock, 'generated');

INSERT INTO collections
  (collection_number, sales_invoice_id, collection_date, amount, status, payment_method, notes, created_by)
VALUES
  ('COB-T25-0003', @sv2, '2025-06-15', 5000.00, 'pending', 'bank_transfer', 'Cobro parcial SV-T25-0002', @u_teso);
SET @cob3 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_invoice', @sv2, 'collection', @cob3, 'linked_to');

UPDATE collections SET status = 'realized' WHERE id = @cob3;

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-06-15', 'Cobro COB-T25-0003 factura SV-T25-0002', 'collection', @cob3, 'posted', @u_teso);
SET @je_cob3 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_cob3, @acc572, 5000.00, 0.00, 'Entrada bancaria cobro cliente'),
  (@je_cob3, @acc430, 0.00, 5000.00, 'Cancelacion parcial cliente CLI002');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('collection', @cob3, 'journal_entry', @je_cob3, 'generated');

UPDATE sales_invoices
SET collected_amount = 5000.00, status = 'partially_collected'
WHERE id = @sv2;

-- Realizacion de pago parcial PI-2
UPDATE payments SET status = 'realized' WHERE id = @pay2a;

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-06-20', 'Pago parcial PAG-T25-0002A factura PI-T25-0002', 'payment', @pay2a, 'posted', @u_teso);
SET @je_pay2a = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_pay2a, @acc400, 8000.00, 0.00, 'Cancelacion parcial proveedor PRO002'),
  (@je_pay2a, @acc572, 0.00, 8000.00, 'Salida bancaria');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('payment', @pay2a, 'journal_entry', @je_pay2a, 'generated');

UPDATE purchase_invoices
SET paid_amount = 8000.00, status = 'partially_paid'
WHERE id = @pi2;

-- ============================================================================
-- 9) VENTA 3 (Q3/Q4)
-- ============================================================================

INSERT INTO sales_orders
  (order_number, customer_id, sales_budget_id, order_date, total_amount, status, notes, created_by)
VALUES
  ('SO-T25-0003', @cli3, NULL, '2025-09-10', 4350.00, 'ready_to_invoice', 'Pedido Q3', @u_ventas);
SET @so3 = LAST_INSERT_ID();

INSERT INTO sales_order_lines
  (sales_order_id, item_id, quantity, unit_price, line_total, supplied_quantity)
VALUES
  (@so3, @it4, 50.00, 28.00, 1400.00, 0.00),
  (@so3, @it2, 10.00, 295.00, 2950.00, 0.00);

INSERT INTO sales_invoices
  (invoice_number, customer_id, sales_order_id, invoice_date, due_date, total_amount, collected_amount, status, notes, created_by)
VALUES
  ('SV-T25-0003', @cli3, @so3, '2025-09-15', '2025-12-14', 5263.50, 0.00, 'pending',
   'Venta con IVA 21%', @u_ventas);
SET @sv3 = LAST_INSERT_ID();

INSERT INTO sales_invoice_lines
  (sales_invoice_id, item_id, quantity, unit_price, line_total)
VALUES
  (@sv3, @it4, 50.00, 28.00, 1400.00),
  (@sv3, @it2, 10.00, 295.00, 2950.00);

INSERT INTO inventory_movements
  (item_id, movement_date, movement_type, quantity, unit_cost, total_value, source_document_type, source_document_id, notes, created_by)
VALUES
  (@it4, '2025-09-15', 'outbound', -50.00, 14.00, -700.00, 'sales_invoice', @sv3, 'Salida por SV-T25-0003', @u_ventas),
  (@it2, '2025-09-15', 'outbound', -10.00, 180.00, -1800.00, 'sales_invoice', @sv3, 'Salida por SV-T25-0003', @u_ventas);

UPDATE sales_orders SET status = 'invoiced' WHERE id = @so3;
UPDATE sales_order_lines SET supplied_quantity = quantity WHERE sales_order_id = @so3;

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_order', @so3, 'sales_invoice', @sv3, 'generated');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-09-15', 'Factura venta SV-T25-0003', 'sales_invoice', @sv3, 'posted', @u_conta);
SET @je_sv3 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_sv3, @acc430, 5263.50, 0.00, 'Cliente CLI003'),
  (@je_sv3, @acc700, 0.00, 4350.00, 'Venta mercaderias'),
  (@je_sv3, @acc477, 0.00, 913.50, 'IVA repercutido 21%');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-09-15', 'Coste salida stock SV-T25-0003', 'sales_invoice_inventory', @sv3, 'posted', @u_conta);
SET @je_sv3_stock = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_sv3_stock, @acc610, 2500.00, 0.00, 'Coste de salida de existencias'),
  (@je_sv3_stock, @acc300, 0.00, 2500.00, 'Baja de stock');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_invoice', @sv3, 'journal_entry', @je_sv3, 'generated'),
  ('sales_invoice', @sv3, 'journal_entry', @je_sv3_stock, 'generated');

INSERT INTO collections
  (collection_number, sales_invoice_id, collection_date, amount, status, payment_method, notes, created_by)
VALUES
  ('COB-T25-0004', @sv3, '2025-09-25', 5263.50, 'pending', 'bank_transfer', 'Cobro total SV-T25-0003', @u_teso);
SET @cob4 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_invoice', @sv3, 'collection', @cob4, 'linked_to');

UPDATE collections SET status = 'realized' WHERE id = @cob4;

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-09-25', 'Cobro COB-T25-0004 factura SV-T25-0003', 'collection', @cob4, 'posted', @u_teso);
SET @je_cob4 = LAST_INSERT_ID();

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_cob4, @acc572, 5263.50, 0.00, 'Entrada bancaria cobro cliente'),
  (@je_cob4, @acc430, 0.00, 5263.50, 'Cancelacion cliente CLI003');

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('collection', @cob4, 'journal_entry', @je_cob4, 'generated');

UPDATE sales_invoices
SET collected_amount = 5263.50, status = 'collected'
WHERE id = @sv3;

-- Cobro pendiente remanente SV-2 (sin realizar en 2025)
INSERT INTO collections
  (collection_number, sales_invoice_id, collection_date, amount, status, payment_method, notes, created_by)
VALUES
  ('COB-T25-0005', @sv2, '2025-12-20', 3518.40, 'pending', 'bank_transfer',
   'Cobro pendiente al cierre SV-T25-0002', @u_teso);
SET @cob5 = LAST_INSERT_ID();

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('sales_invoice', @sv2, 'collection', @cob5, 'linked_to');

-- ============================================================================
-- 10) AMORTIZACION 2025 DEL INMOVILIZADO FA-T25-0001
-- Base amortizable: 12.000 - 2.000 = 10.000 / 60 meses = 166,67 aprox.
-- Dotacion 2025 (mar-dic): 1.666,67
-- ============================================================================

-- Marzo
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-03-31', 'Amortizacion mensual FA-T25-0001 (03/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_03 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_03, @acc681, 166.67, 0.00, 'Dotacion amortizacion 03/2025'),
  (@je_dep_03, @acc280, 0.00, 166.67, 'Amortizacion acumulada 03/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-03-31', 166.67, @je_dep_03, @u_conta);

-- Abril
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-04-30', 'Amortizacion mensual FA-T25-0001 (04/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_04 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_04, @acc681, 166.67, 0.00, 'Dotacion amortizacion 04/2025'),
  (@je_dep_04, @acc280, 0.00, 166.67, 'Amortizacion acumulada 04/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-04-30', 166.67, @je_dep_04, @u_conta);

-- Mayo
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-05-31', 'Amortizacion mensual FA-T25-0001 (05/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_05 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_05, @acc681, 166.67, 0.00, 'Dotacion amortizacion 05/2025'),
  (@je_dep_05, @acc280, 0.00, 166.67, 'Amortizacion acumulada 05/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-05-31', 166.67, @je_dep_05, @u_conta);

-- Junio
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-06-30', 'Amortizacion mensual FA-T25-0001 (06/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_06 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_06, @acc681, 166.67, 0.00, 'Dotacion amortizacion 06/2025'),
  (@je_dep_06, @acc280, 0.00, 166.67, 'Amortizacion acumulada 06/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-06-30', 166.67, @je_dep_06, @u_conta);

-- Julio
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-07-31', 'Amortizacion mensual FA-T25-0001 (07/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_07 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_07, @acc681, 166.67, 0.00, 'Dotacion amortizacion 07/2025'),
  (@je_dep_07, @acc280, 0.00, 166.67, 'Amortizacion acumulada 07/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-07-31', 166.67, @je_dep_07, @u_conta);

-- Agosto
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-08-31', 'Amortizacion mensual FA-T25-0001 (08/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_08 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_08, @acc681, 166.67, 0.00, 'Dotacion amortizacion 08/2025'),
  (@je_dep_08, @acc280, 0.00, 166.67, 'Amortizacion acumulada 08/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-08-31', 166.67, @je_dep_08, @u_conta);

-- Septiembre
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-09-30', 'Amortizacion mensual FA-T25-0001 (09/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_09 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_09, @acc681, 166.67, 0.00, 'Dotacion amortizacion 09/2025'),
  (@je_dep_09, @acc280, 0.00, 166.67, 'Amortizacion acumulada 09/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-09-30', 166.67, @je_dep_09, @u_conta);

-- Octubre
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-10-31', 'Amortizacion mensual FA-T25-0001 (10/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_10 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_10, @acc681, 166.67, 0.00, 'Dotacion amortizacion 10/2025'),
  (@je_dep_10, @acc280, 0.00, 166.67, 'Amortizacion acumulada 10/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-10-31', 166.67, @je_dep_10, @u_conta);

-- Noviembre
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-11-30', 'Amortizacion mensual FA-T25-0001 (11/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_11 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_11, @acc681, 166.67, 0.00, 'Dotacion amortizacion 11/2025'),
  (@je_dep_11, @acc280, 0.00, 166.67, 'Amortizacion acumulada 11/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-11-30', 166.67, @je_dep_11, @u_conta);

-- Diciembre (ajuste centimos)
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-12-31', 'Amortizacion mensual FA-T25-0001 (12/2025)', 'fixed_asset_depreciation', @fa1, 'posted', @u_conta);
SET @je_dep_12 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_dep_12, @acc681, 166.64, 0.00, 'Dotacion amortizacion 12/2025'),
  (@je_dep_12, @acc280, 0.00, 166.64, 'Amortizacion acumulada 12/2025');
INSERT INTO fixed_asset_depreciations (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
VALUES (@fa1, '2025-12-31', 166.64, @je_dep_12, @u_conta);

UPDATE fixed_assets
SET accumulated_depreciation = 1666.67, status = 'active'
WHERE id = @fa1;

INSERT INTO document_links
  (source_document_type, source_document_id, target_document_type, target_document_id, link_type)
VALUES
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_03, 'generated'),
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_04, 'generated'),
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_05, 'generated'),
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_06, 'generated'),
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_07, 'generated'),
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_08, 'generated'),
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_09, 'generated'),
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_10, 'generated'),
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_11, 'generated'),
  ('fixed_asset', @fa1, 'journal_entry', @je_dep_12, 'generated');

-- ============================================================================
-- 11) NOMINA 2025 (TRIMESTRAL): DEVENGO + PAGO NETO + PAGO RETENCIONES
-- ============================================================================

-- Q1
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-03-31', 'Nomina Q1 2025 - devengo', 'payroll', NULL, 'posted', @u_conta);
SET @je_nom_q1 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q1, @acc640, 15000.00, 0.00, 'Sueldos y salarios Q1'),
  (@je_nom_q1, @acc642, 4500.00, 0.00, 'Seguridad social empresa Q1'),
  (@je_nom_q1, @acc460, 0.00, 15000.00, 'Remuneraciones pendientes Q1'),
  (@je_nom_q1, @acc465, 0.00, 4500.00, 'Retenciones y seguridad social Q1');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-04-05', 'Nomina Q1 2025 - pago neto', 'payroll_payment', NULL, 'posted', @u_teso);
SET @je_nom_q1_pay = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q1_pay, @acc460, 15000.00, 0.00, 'Pago neto nomina Q1'),
  (@je_nom_q1_pay, @acc572, 0.00, 15000.00, 'Salida bancaria nomina Q1');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-04-20', 'Nomina Q1 2025 - pago retenciones', 'payroll_tax_payment', NULL, 'posted', @u_teso);
SET @je_nom_q1_tax = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q1_tax, @acc465, 4500.00, 0.00, 'Pago retenciones Q1'),
  (@je_nom_q1_tax, @acc572, 0.00, 4500.00, 'Salida bancaria retenciones Q1');

-- Q2
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-06-30', 'Nomina Q2 2025 - devengo', 'payroll', NULL, 'posted', @u_conta);
SET @je_nom_q2 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q2, @acc640, 15000.00, 0.00, 'Sueldos y salarios Q2'),
  (@je_nom_q2, @acc642, 4500.00, 0.00, 'Seguridad social empresa Q2'),
  (@je_nom_q2, @acc460, 0.00, 15000.00, 'Remuneraciones pendientes Q2'),
  (@je_nom_q2, @acc465, 0.00, 4500.00, 'Retenciones y seguridad social Q2');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-07-05', 'Nomina Q2 2025 - pago neto', 'payroll_payment', NULL, 'posted', @u_teso);
SET @je_nom_q2_pay = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q2_pay, @acc460, 15000.00, 0.00, 'Pago neto nomina Q2'),
  (@je_nom_q2_pay, @acc572, 0.00, 15000.00, 'Salida bancaria nomina Q2');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-07-20', 'Nomina Q2 2025 - pago retenciones', 'payroll_tax_payment', NULL, 'posted', @u_teso);
SET @je_nom_q2_tax = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q2_tax, @acc465, 4500.00, 0.00, 'Pago retenciones Q2'),
  (@je_nom_q2_tax, @acc572, 0.00, 4500.00, 'Salida bancaria retenciones Q2');

-- Q3
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-09-30', 'Nomina Q3 2025 - devengo', 'payroll', NULL, 'posted', @u_conta);
SET @je_nom_q3 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q3, @acc640, 15000.00, 0.00, 'Sueldos y salarios Q3'),
  (@je_nom_q3, @acc642, 4500.00, 0.00, 'Seguridad social empresa Q3'),
  (@je_nom_q3, @acc460, 0.00, 15000.00, 'Remuneraciones pendientes Q3'),
  (@je_nom_q3, @acc465, 0.00, 4500.00, 'Retenciones y seguridad social Q3');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-10-05', 'Nomina Q3 2025 - pago neto', 'payroll_payment', NULL, 'posted', @u_teso);
SET @je_nom_q3_pay = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q3_pay, @acc460, 15000.00, 0.00, 'Pago neto nomina Q3'),
  (@je_nom_q3_pay, @acc572, 0.00, 15000.00, 'Salida bancaria nomina Q3');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-10-20', 'Nomina Q3 2025 - pago retenciones', 'payroll_tax_payment', NULL, 'posted', @u_teso);
SET @je_nom_q3_tax = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q3_tax, @acc465, 4500.00, 0.00, 'Pago retenciones Q3'),
  (@je_nom_q3_tax, @acc572, 0.00, 4500.00, 'Salida bancaria retenciones Q3');

-- Q4
INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-12-31', 'Nomina Q4 2025 - devengo', 'payroll', NULL, 'posted', @u_conta);
SET @je_nom_q4 = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q4, @acc640, 15000.00, 0.00, 'Sueldos y salarios Q4'),
  (@je_nom_q4, @acc642, 4500.00, 0.00, 'Seguridad social empresa Q4'),
  (@je_nom_q4, @acc460, 0.00, 15000.00, 'Remuneraciones pendientes Q4'),
  (@je_nom_q4, @acc465, 0.00, 4500.00, 'Retenciones y seguridad social Q4');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-12-31', 'Nomina Q4 2025 - pago neto', 'payroll_payment', NULL, 'posted', @u_teso);
SET @je_nom_q4_pay = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q4_pay, @acc460, 15000.00, 0.00, 'Pago neto nomina Q4'),
  (@je_nom_q4_pay, @acc572, 0.00, 15000.00, 'Salida bancaria nomina Q4');

INSERT INTO journal_entries
  (entry_date, description, source_document_type, source_document_id, status, created_by)
VALUES
  ('2025-12-31', 'Nomina Q4 2025 - pago retenciones', 'payroll_tax_payment', NULL, 'posted', @u_teso);
SET @je_nom_q4_tax = LAST_INSERT_ID();
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description) VALUES
  (@je_nom_q4_tax, @acc465, 4500.00, 0.00, 'Pago retenciones Q4'),
  (@je_nom_q4_tax, @acc572, 0.00, 4500.00, 'Salida bancaria retenciones Q4');

-- ============================================================================
-- 12) ESTADOS DE CIERRE DE COBROS/PAGOS PENDIENTES EN 2025
-- ============================================================================

-- PI-2 queda parcialmente pagada (8.000 pagado, 7.125 pendiente)
-- PI-4 queda pendiente total (1.089)
-- SV-2 queda parcialmente cobrada (5.000 cobrado, 3.518,40 pendiente)

-- Ya estan en estado correcto por actualizaciones anteriores.

COMMIT;

-- ============================================================================
-- 13) CONTROLES DE CONSISTENCIA (consulta)
-- ============================================================================

-- 13.1 Asientos descuadrados 2025 (debe devolver 0 filas)
SELECT
  je.id,
  je.entry_date,
  je.description,
  ROUND(SUM(jel.debit), 2) AS total_debit,
  ROUND(SUM(jel.credit), 2) AS total_credit,
  ROUND(SUM(jel.debit) - SUM(jel.credit), 2) AS diff
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.entry_date BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY je.id, je.entry_date, je.description
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01;

-- 13.2 Stock negativo (debe devolver 0 filas)
SELECT
  i.code,
  i.description,
  ROUND(SUM(im.quantity), 2) AS stock_qty
FROM items i
LEFT JOIN inventory_movements im ON im.item_id = i.id
GROUP BY i.id, i.code, i.description
HAVING ROUND(COALESCE(SUM(im.quantity), 0), 2) < 0;

-- 13.3 Resumen facturas compra y estado de pago
SELECT
  invoice_number,
  invoice_type,
  total_amount,
  paid_amount,
  status
FROM purchase_invoices
WHERE invoice_number LIKE 'PI-T25-%'
ORDER BY invoice_date, id;

-- 13.4 Resumen facturas venta y estado de cobro
SELECT
  invoice_number,
  total_amount,
  collected_amount,
  status
FROM sales_invoices
WHERE invoice_number LIKE 'SV-T25-%'
ORDER BY invoice_date, id;
