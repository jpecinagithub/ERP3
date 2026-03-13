-- ============================================================================
-- ERP Contable Completo - Seed Data
-- Test data for development and testing
-- ============================================================================

-- ============================================================================
-- USERS - One user per role
-- ============================================================================

INSERT INTO users (username, password, full_name, role, is_active) VALUES
('compras', 'compras123', 'Usuario Compras', 'compras', TRUE),
('contabilidad', 'contabilidad123', 'Usuario Contabilidad', 'contabilidad', TRUE),
('tesoreria', 'tesoreria123', 'Usuario Tesorería', 'tesoreria', TRUE),
('admin', 'admin123', 'Usuario Administrador', 'administrador', TRUE);

-- ============================================================================
-- ACCOUNTS - Fundamental PGCE accounts
-- ============================================================================

-- Grupo 1: Financiación básica

-- Grupo 6: Compras y gastos
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('600', 'Compras de mercaderías', 'expense', NULL, TRUE),
('610', 'Variación de existencias de mercaderías', 'expense', NULL, TRUE),
('621', 'Arrendamientos y cánones', 'expense', NULL, TRUE),
('622', 'Reparaciones y conservación', 'expense', NULL, TRUE),
('623', 'Servicios de profesionales independientes', 'expense', NULL, TRUE),
('624', 'Transportes', 'expense', NULL, TRUE),
('625', 'Primas de seguros', 'expense', NULL, TRUE),
('626', 'Servicios bancarios y similares', 'expense', NULL, TRUE),
('627', 'Publicidad, propaganda y relaciones públicas', 'expense', NULL, TRUE),
('628', 'Suministros', 'expense', NULL, TRUE),
('629', 'Otros servicios', 'expense', NULL, TRUE),
('640', 'Sueldos y salarios', 'expense', NULL, TRUE),
('642', 'Seguridad social a cargo de la empresa', 'expense', NULL, TRUE),
('681', 'Amortización del inmovilizado material', 'expense', NULL, TRUE),
('682', 'Amortización del inmovilizado intangible', 'expense', NULL, TRUE),
('694', 'Pérdidas por deterioro de créditos comerciales', 'expense', NULL, TRUE),
('695', 'Dotaciones a la provisión de operaciones comerciales', 'expense', NULL, TRUE);

-- Grupo 7: Ventas e ingresos
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('700', 'Ventas de mercaderías', 'income', NULL, TRUE),
('705', 'Prestaciones de servicios', 'income', NULL, TRUE),
('751', 'Subvenciones oficial a la explotación', 'income', NULL, TRUE),
('760', 'Ingresos de inversiones en crédito', 'income', NULL, TRUE),
('769', 'Otros ingresos financieros', 'income', NULL, TRUE);

-- Grupo 4: Acreedores y deudores - IVA
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('472', 'Hacienda pública IVA soportado', 'asset', NULL, TRUE),
('477', 'Hacienda pública IVA repercutido', 'liability', NULL, TRUE),
('478', 'Hacienda pública IVA revertido', 'asset', NULL, TRUE);

-- Grupo 4: Proveedores - cuentas principales
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('400', 'Proveedores', 'liability', NULL, TRUE),
('401', 'Proveedores efectos comerciales a pagar', 'liability', NULL, TRUE),
('410', 'Acreedores por prestaciones de servicios', 'liability', NULL, TRUE);

-- Grupo 4: Clientes - cuentas principales
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('430', 'Clientes', 'asset', NULL, TRUE),
('431', 'Clientes efectos comerciales a cobrar', 'asset', NULL, TRUE),
('435', 'Clientes operaciones de tráfico', 'asset', NULL, TRUE),
('436', 'Clientes de dudoso cobro', 'asset', NULL, TRUE);

-- Grupo 4: Personal
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('460', 'Remuneraciones pendientes de pago', 'liability', NULL, TRUE),
('465', 'Hacienda pública acreedora por retenciones practicadas', 'liability', NULL, TRUE);

-- Grupo 2: Inmovilizado - cuentas detalladas
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('210', 'Fondo de comercio', 'asset', NULL, TRUE),
('211', 'Aplicaciones informáticas', 'asset', NULL, TRUE),
('212', 'Propiedad industrial', 'asset', NULL, TRUE),
('213', 'Derechos sobre bienes en régimen de arrendamiento financiero', 'asset', NULL, TRUE),
('214', 'Anticipos para inmovilizaciones intangibles', 'asset', NULL, TRUE),
('215', 'Otro inmovilizado intangible', 'asset', NULL, TRUE),
('220', 'Inversiones en terrenos', 'asset', NULL, TRUE),
('221', 'Inversiones en construcciones', 'asset', NULL, TRUE),
('222', 'Instalaciones técnicas', 'asset', NULL, TRUE),
('223', 'Maquinaria', 'asset', NULL, TRUE),
('224', 'Utillaje', 'asset', NULL, TRUE),
('225', 'Otras instalaciones', 'asset', NULL, TRUE),
('226', 'Mobiliario', 'asset', NULL, TRUE),
('227', 'Equipos para procesos de información', 'asset', NULL, TRUE),
('228', 'Elementos de transporte', 'asset', NULL, TRUE),
('229', 'Otro inmovilizado material', 'asset', NULL, TRUE),
('230', 'Adaptación de terrenos', 'asset', NULL, TRUE),
('231', 'Construcciones en curso', 'asset', NULL, TRUE),
('232', 'Instalaciones técnicas en montaje', 'asset', NULL, TRUE),
('233', 'Maquinaria en montaje', 'asset', NULL, TRUE),
('239', 'Anticipos para inmovilizaciones materiales', 'asset', NULL, TRUE),
('280', 'Amortización acumulada del inmovilizado material', 'asset', NULL, TRUE),
('281', 'Amortización acumulada del inmovilizado intangible', 'asset', NULL, TRUE);

-- Grupo 3: Existencias
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('300', 'Mercaderías A', 'asset', NULL, TRUE),
('301', 'Mercaderías B', 'asset', NULL, TRUE),
('310', 'Materias primas A', 'asset', NULL, TRUE),
('311', 'Materias primas B', 'asset', NULL, TRUE),
('320', 'Elementos y conjuntos incorporables', 'asset', NULL, TRUE),
('321', 'Combustibles', 'asset', NULL, TRUE),
('322', 'Repuestos', 'asset', NULL, TRUE),
('325', 'Materiales diversos', 'asset', NULL, TRUE),
('326', 'Embalajes', 'asset', NULL, TRUE),
('327', 'Envases', 'asset', NULL, TRUE),
('328', 'Subproductos, residuos y materiales recovered', 'asset', NULL, TRUE),
('350', 'Productos en curso', 'asset', NULL, TRUE),
('351', 'Productos semiterminados', 'asset', NULL, TRUE),
('352', 'Productos terminados', 'asset', NULL, TRUE),
('353', 'Subproductos', 'asset', NULL, TRUE),
('360', 'Productos almacenados', 'asset', NULL, TRUE),
('390', 'Deterioro de valor de las mercaderías', 'asset', NULL, TRUE),
('391', 'Deterioro de valor de las materias primas', 'asset', NULL, TRUE),
('392', 'Deterioro de valor de otros aprovisionamientos', 'asset', NULL, TRUE);

-- Grupo 5: Cuentas financieras
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('570', 'Caja', 'asset', NULL, TRUE),
('572', 'Bancos', 'asset', NULL, TRUE);

-- Grupo 5: Cuentas financieras - depósitos
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('520', 'Deudas a corto plazo con entidades de crédito', 'liability', NULL, TRUE),
('521', 'Deudas a corto plazo', 'liability', NULL, TRUE),
('525', 'Efectos descontados a corto plazo', 'liability', NULL, TRUE),
('526', 'Dividendo a pagar', 'liability', NULL, TRUE),
('527', 'Nóminas a pagar', 'liability', NULL, TRUE),
('540', 'Inversiones financieras a corto plazo en instrumentos de patrimonio', 'asset', NULL, TRUE),
('541', 'Valores de deuda a corto plazo', 'asset', NULL, TRUE),
('542', 'Créditos a corto plazo', 'asset', NULL, TRUE),
('543', 'Créditos a corto plazo por enajenación de inmovilizado', 'asset', NULL, TRUE),
('544', 'Créditos a corto plazo al personal', 'asset', NULL, TRUE),
('545', 'Dividendo a cobrar', 'asset', NULL, TRUE),
('546', 'Intereses a corto plazo de créditos', 'asset', NULL, TRUE),
('548', 'Imposiciones a corto plazo', 'asset', NULL, TRUE),
('549', 'Desembolsos pendientes sobre acciones a corto plazo', 'asset', NULL, TRUE);

-- Grupo 1: Capital y reservas
INSERT INTO accounts (code, name, account_type, parent_id, is_active) VALUES
('100', 'Capital social', 'equity', NULL, TRUE),
('101', 'Fondo social', 'equity', NULL, TRUE),
('102', 'Capital', 'equity', NULL, TRUE),
('103', 'Socios por desembolsos no exigidos', 'equity', NULL, TRUE),
('104', 'Socios por aportaciones no dinerarias pendientes', 'equity', NULL, TRUE),
('105', 'Socios por mora en la emisión de acciones', 'equity', NULL, TRUE),
('108', 'Acciones o participaciones propias en situaciones especiales', 'equity', NULL, TRUE),
('109', 'Socios deshacer', 'equity', NULL, TRUE),
('110', 'Prima de emisión o asunción', 'equity', NULL, TRUE),
('111', 'Reserva por capital amortizado', 'equity', NULL, TRUE),
('112', 'Reserva legal', 'equity', NULL, TRUE),
('113', 'Reservas voluntarias', 'equity', NULL, TRUE),
('114', 'Reservas especiales', 'equity', NULL, TRUE),
('115', 'Reservas por diferencias de conversión', 'equity', NULL, TRUE),
('118', 'Aportaciones de socios', 'equity', NULL, TRUE),
('119', 'Dividendo activo a cuenta', 'equity', NULL, TRUE),
('120', 'Remanente', 'equity', NULL, TRUE),
('121', 'Resultados negativos de ejercicios anteriores', 'equity', NULL, TRUE),
('129', 'Resultado del ejercicio', 'equity', NULL, TRUE),
('130', 'Subvenciones oficiales de capital', 'equity', NULL, TRUE),
('131', 'Donaciones y legados de capital', 'equity', NULL, TRUE),
('132', 'Otras subvenciones, donac. y legados', 'equity', NULL, TRUE),
('133', 'Ajustes por valoración en activos financieros disponibles para la venta', 'equity', NULL, TRUE),
('134', 'Operaciones de cobertura', 'equity', NULL, TRUE),
('135', 'Diferencias de conversión', 'equity', NULL, TRUE),
('136', 'Ajustes por valoración en activos no corrientes mantenidos para vender', 'equity', NULL, TRUE),
('137', 'Ingresos fiscales a distribuir en ejercicios posteriores', 'equity', NULL, TRUE),
('138', 'Ingresos fiscales a distribuir en este ejercicio', 'equity', NULL, TRUE);

-- ============================================================================
-- ITEMS - Sample articles
-- ============================================================================

INSERT INTO items (code, description, unit_of_measure, standard_cost) VALUES
('ART001', 'Ordenador portátil HP', 'unidad', 650.00),
('ART002', 'Monitor LED 24 pulgadas', 'unidad', 180.00),
('ART003', 'Teclado inalámbrico', 'unidad', 35.00),
('ART004', 'Ratón óptico', 'unidad', 15.00),
('ART005', 'Impresora láser', 'unidad', 320.00),
('ART006', 'Papel A4 (paquete 500 hojas)', 'paquete', 4.50),
('ART007', 'Tóner impresora láser', 'unidad', 85.00),
('ART008', 'Silla de oficina ergonómica', 'unidad', 220.00),
('ART009', 'Mesa de oficina 120x80cm', 'unidad', 180.00),
('ART010', 'Archivador metálico 4 cajones', 'unidad', 290.00);

-- ============================================================================
-- CUSTOMERS - Sample customers
-- ============================================================================

INSERT INTO customers (code, name, tax_id, address, phone, email) VALUES
('CLI001', 'Comercial Martínez S.L.', 'B12345678', 'Calle Mayor 45, 28013 Madrid', '912345678', 'info@comercialmartinez.es'),
('CLI002', 'Distribuciones García S.A.', 'A87654321', 'Avenida Diagonal 123, 08015 Barcelona', '934567890', 'contacto@distgarcia.com'),
('CLI003', 'Tecnología Avanzada S.L.', 'B23456789', 'Calle Colón 78, 46004 Valencia', '963456789', 'ventas@tecnoavanzada.es'),
('CLI004', 'Suministros Industriales López', 'B34567890', 'Polígono Industrial Norte, 41015 Sevilla', '954567890', 'pedidos@suministroslopez.com'),
('CLI005', 'Oficinas Modernas S.L.', 'B45678901', 'Gran Vía 234, 48011 Bilbao', '944567890', 'info@oficinasmodernas.es');

-- ============================================================================
-- SUPPLIERS - Sample suppliers
-- ============================================================================

INSERT INTO suppliers (code, name, tax_id, address, phone, email) VALUES
('PRO001', 'Informática Global S.A.', 'A11223344', 'Calle Alcalá 567, 28027 Madrid', '917654321', 'ventas@infoglobal.es'),
('PRO002', 'Distribuidora TechWorld S.L.', 'B22334455', 'Paseo de Gracia 89, 08008 Barcelona', '932345678', 'pedidos@techworld.com'),
('PRO003', 'Papelería Central S.L.', 'B33445566', 'Calle San Vicente 12, 46002 Valencia', '961234567', 'info@papeleriacentral.es'),
('PRO004', 'Mobiliario de Oficina S.A.', 'A44556677', 'Avenida Andalucía 45, 41007 Sevilla', '955678901', 'comercial@moboficina.com'),
('PRO005', 'Suministros Empresariales Norte', 'B55667788', 'Calle Iparraguirre 23, 48009 Bilbao', '943456789', 'ventas@suministrosnorte.es');

-- ============================================================================
-- FISCAL PERIODS - Initial period for 2025
-- ============================================================================

INSERT INTO fiscal_periods (year, period_number, start_date, end_date, status) VALUES
(2025, 1, '2025-01-01', '2025-12-31', 'open');

-- ============================================================================
-- JOURNAL ENTRY TEMPLATES - 18 typical accounting entries
-- ============================================================================

-- 1. Factura de compra de mercaderías (con IVA)
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Factura de compra mercaderías con IVA', 'Compra de mercaderías a proveedor con IVA 21%', 'compra_mercaderias',
'{"lines": [{"account_code": "600", "debit": 1000.00, "credit": 0.00, "description": "Compra de mercaderías"}, {"account_code": "472", "debit": 210.00, "credit": 0.00, "description": "IVA soportado"}, {"account_code": "400", "debit": 0.00, "credit": 1210.00, "description": "Proveedor [NOMBRE_PROVEEDOR]"}]}');

-- 2. Factura de venta de mercaderías (con IVA)
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Factura de venta mercaderías con IVA', 'Venta de mercaderías a cliente con IVA 21%', 'venta_mercaderias',
'{"lines": [{"account_code": "430", "debit": 1815.00, "credit": 0.00, "description": "Cliente [NOMBRE_CLIENTE]"}, {"account_code": "700", "debit": 0.00, "credit": 1500.00, "description": "Venta de mercaderías"}, {"account_code": "477", "debit": 0.00, "credit": 315.00, "description": "IVA repercutido"}]}');

-- 3. Factura de compra de inmovilizado
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Factura de compra de inmovilizado', 'Compra de inmovilizado (maquinaria, equipo, etc.) con IVA', 'compra_inmovilizado',
'{"lines": [{"account_code": "223", "debit": 5000.00, "credit": 0.00, "description": "Inmovilizado material"}, {"account_code": "472", "debit": 1050.00, "credit": 0.00, "description": "IVA soportado"}, {"account_code": "400", "debit": 0.00, "credit": 6050.00, "description": "Proveedor [NOMBRE_PROVEEDOR]"}]}');

-- 6. Nómina
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Nómina mensual', 'Registro de nómina mensual de empleados', 'nomina',
'{"lines": [{"account_code": "640", "debit": 2500.00, "credit": 0.00, "description": "Sueldos y salarios"}, {"account_code": "642", "debit": 750.00, "credit": 0.00, "description": "Seguridad social a cargo empresa"}, {"account_code": "465", "debit": 0.00, "credit": 450.00, "description": "IRPF trabajadores"}, {"account_code": "460", "debit": 0.00, "credit": 2800.00, "description": "Remuneraciones pendientes"}]}');

-- 6.bis Pago de nómina
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Pago de nómina', 'Pago de remuneraciones pendientes al personal por banco', 'nomina',
'{"lines": [{"account_code": "460", "debit": 2800.00, "credit": 0.00, "description": "Remuneraciones pendientes de pago"}, {"account_code": "572", "debit": 0.00, "credit": 2800.00, "description": "Bancos c/c"}]}');

-- 7. Alquiler
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Recibo de alquiler', 'Pago de alquiler mensual de local/oficina', 'alquiler',
'{"lines": [{"account_code": "621", "debit": 1200.00, "credit": 0.00, "description": "Arrendamientos y cánones"}, {"account_code": "472", "debit": 252.00, "credit": 0.00, "description": "IVA soportado"}, {"account_code": "410", "debit": 0.00, "credit": 1452.00, "description": "Acreedor por servicios"}]}');

-- 8. Amortización inmovilizado
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Amortización inmovilizado', 'Dotación a la amortización del inmovilizado material', 'amortizacion',
'{"lines": [{"account_code": "681", "debit": 300.00, "credit": 0.00, "description": "Amortización inmovilizado material"}, {"account_code": "280", "debit": 0.00, "credit": 300.00, "description": "Amortización acumulada"}]}');

-- 9. Variación de existencias (regularización)
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Variación de existencias', 'Regularización de existencias finales de mercaderías', 'variacion_existencias',
'{"lines": [{"account_code": "300", "debit": 2000.00, "credit": 0.00, "description": "Existencias finales mercaderías"}, {"account_code": "610", "debit": 0.00, "credit": 2000.00, "description": "Variación de existencias"}]}');

-- 10. Aportación de socios
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Aportación de socios', 'Aportación de capital por parte de los socios', 'aportacion_socios',
'{"lines": [{"account_code": "572", "debit": 10000.00, "credit": 0.00, "description": "Bancos c/c"}, {"account_code": "118", "debit": 0.00, "credit": 10000.00, "description": "Aportaciones de socios"}]}');

-- 11. Cobro de cliente
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Cobro de cliente', 'Cobro de factura de cliente por banco', 'cobro_cliente',
'{"lines": [{"account_code": "572", "debit": 2500.00, "credit": 0.00, "description": "Bancos c/c"}, {"account_code": "430", "debit": 0.00, "credit": 2500.00, "description": "Cliente [NOMBRE_CLIENTE]"}]}');

-- 12. Pago a proveedor
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Pago a proveedor', 'Pago de factura de proveedor por banco', 'pago_proveedor',
'{"lines": [{"account_code": "400", "debit": 1800.00, "credit": 0.00, "description": "Proveedor [NOMBRE_PROVEEDOR]"}, {"account_code": "572", "debit": 0.00, "credit": 1800.00, "description": "Bancos c/c"}]}');

-- 13. Entrada de inventario
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Entrada de inventario', 'Entrada de mercaderías por compra', 'compra_mercaderias',
'{"lines": [{"account_code": "300", "debit": 1000.00, "credit": 0.00, "description": "Mercaderías"}, {"account_code": "600", "debit": 0.00, "credit": 1000.00, "description": "Compra de mercaderías"}]}');

-- 14. Salida de inventario
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Salida de inventario', 'Salida de mercaderías por venta', 'venta_mercaderias',
'{"lines": [{"account_code": "610", "debit": 850.00, "credit": 0.00, "description": "Variación de existencias"}, {"account_code": "300", "debit": 0.00, "credit": 850.00, "description": "Mercaderías"}]}');

-- 15. Recibo de alquiler (ingreso)
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Recibo de alquiler (ingreso)', 'Cobro de alquiler de propiedad por banco', 'alquiler',
'{"lines": [{"account_code": "572", "debit": 1452.00, "credit": 0.00, "description": "Bancos c/c"}, {"account_code": "705", "debit": 0.00, "credit": 1452.00, "description": "Prestaciones de servicios"}]}');

-- 16. Factura de gastos (con IVA)
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Factura de gastos con IVA', 'Registro de factura de gastos de proveedor con IVA 21%', 'gastos',
'{"lines": [{"account_code": "621", "debit": 500.00, "credit": 0.00, "description": "Gasto de explotación"}, {"account_code": "472", "debit": 105.00, "credit": 0.00, "description": "IVA soportado"}, {"account_code": "400", "debit": 0.00, "credit": 605.00, "description": "Proveedor [NOMBRE_PROVEEDOR]"}]}');

-- 17. Prestación de servicios
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Prestación de servicios', 'Facturación de servicios a cliente', 'venta_mercaderias',
'{"lines": [{"account_code": "430", "debit": 2420.00, "credit": 0.00, "description": "Cliente [NOMBRE_CLIENTE]"}, {"account_code": "705", "debit": 0.00, "credit": 2000.00, "description": "Prestaciones de servicios"}, {"account_code": "477", "debit": 0.00, "credit": 420.00, "description": "IVA repercutido"}]}');

-- 18. Cancelación de cliente (pago menor)
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Cancelación cliente menor', 'Cobro parcial de cliente con descuento', 'cobro_cliente',
'{"lines": [{"account_code": "572", "debit": 900.00, "credit": 0.00, "description": "Bancos c/c"}, {"account_code": "694", "debit": 100.00, "credit": 0.00, "description": "Pérdida deterioro"}, {"account_code": "430", "debit": 0.00, "credit": 1000.00, "description": "Cliente [NOMBRE_CLIENTE]"}]}');

-- 19. Cancelación de proveedor (pago mayor)
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Cancelación proveedor mayor', 'Pago a proveedor con descuento por pronto pago', 'pago_proveedor',
'{"lines": [{"account_code": "400", "debit": 1000.00, "credit": 0.00, "description": "Proveedor [NOMBRE_PROVEEDOR]"}, {"account_code": "572", "debit": 0.00, "credit": 950.00, "description": "Bancos c/c"}, {"account_code": "600", "debit": 0.00, "credit": 50.00, "description": "Descuento pronto pago"}]}');

-- 20. Regularización de gastos
INSERT INTO journal_entry_templates (name, description, category, template_data) VALUES
('Regularización resultado ejercicio', 'Cierre de cuentas de gastos al resultado del ejercicio', 'regularizacion',
'{"lines": [{"account_code": "129", "debit": 5000.00, "credit": 0.00, "description": "Resultado del ejercicio"}, {"account_code": "600", "debit": 0.00, "credit": 5000.00, "description": "Cierre cuentas gastos"}]}');

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
