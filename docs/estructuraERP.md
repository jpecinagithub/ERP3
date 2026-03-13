1. La regla de oro de los ERP

Los ERP profesionales separan siempre:

DOCUMENTOS DE NEGOCIO
de
ASIENTOS CONTABLES

Ejemplo:

Documento negocio	Asiento contable
Factura venta	asiento contable
Pedido compra	ninguno todavía
Recepción mercancía	inventario
Cobro cliente	asiento banco

Esto permite trazabilidad total.

2. Tablas maestras fundamentales

Estas tablas solo existen una vez en todo el sistema.

usuarios
users
campo	tipo
id	PK
name	varchar
email	varchar
password	varchar
role	enum
created_at	datetime
artículos
items
campo	tipo
id	PK
sku	varchar
name	varchar
description	text
unit_price	decimal
created_at	datetime
clientes
customers
campo	tipo
id	PK
name	varchar
tax_id	varchar
address	text
email	varchar
proveedores
suppliers
campo	tipo
id	PK
name	varchar
tax_id	varchar
address	text
email	varchar
cuentas contables
accounts
campo	tipo
id	PK
code	varchar
name	varchar
type	enum (activo/pasivo/gasto/ingreso)
parent_account	FK

Ejemplo:

code	name
430	Clientes
400	Proveedores
700	Ventas
600	Compras
3. El corazón contable del ERP

Aquí está la clave que usan todos los ERP.

Nunca guardes un asiento en una sola tabla.

Se separa en cabecera y líneas.

tabla asientos contables
journal_entries
campo	tipo
id	PK
date	date
description	text
created_by	FK users
source_document	varchar
created_at	datetime
lineas de asiento
journal_entry_lines
campo	tipo
id	PK
journal_entry_id	FK
account_id	FK
debit	decimal
credit	decimal
customer_id	FK
supplier_id	FK
description	text

Esto permite:

✔ conciliación
✔ informes
✔ balance automático

4. Documentos de negocio

Ahora vienen los documentos que generan contabilidad.

facturas clientes
sales_invoices
campo	tipo
id	PK
invoice_number	varchar
customer_id	FK
invoice_date	date
total_amount	decimal
status	enum
created_by	FK
líneas de factura
sales_invoice_lines
campo	tipo
id	PK
invoice_id	FK
item_id	FK
quantity	decimal
unit_price	decimal
total	decimal
5. Facturas proveedores
purchase_invoices
6. Inventario (clave en ERP)

Inventario nunca se guarda como stock directo.

Siempre como movimientos.

movimientos inventario
inventory_movements
campo	tipo
id	PK
item_id	FK
movement_type	enum
quantity	decimal
unit_cost	decimal
reference_document	varchar
created_by	FK
date	datetime

Tipos:

purchase
sale
adjustment
production
return

El stock se calcula:

SUM(entradas) - SUM(salidas)
7. Cobros y pagos
pagos
payments
campo	tipo
id	PK
payment_date	date
amount	decimal
method	enum
reference	varchar
relación con facturas
invoice_payments
campo	tipo
id	PK
invoice_id	FK
payment_id	FK
amount	decimal
8. La tabla secreta que usan los ERP

Para trazabilidad total.

document_links
campo	tipo
id	PK
source_document	varchar
source_id	int
target_document	varchar
target_id	int

Ejemplo:

presupuesto → pedido
pedido → recepción
recepción → factura
factura → asiento contable
factura → cobro

Esto te permite seguir todo el flujo del ERP.

9. Cómo se genera la contabilidad

Ejemplo venta:

Factura:

430 Clientes        1210
      700 Ventas          1000
      477 IVA repercutido 210

Cobro:

572 Banco      1210
      430 Clientes 1210
10. Cómo se calcula el Balance

Se calcula directamente desde:

journal_entry_lines

Agrupando por cuenta.

11. Cómo se calcula PyG

Sumando cuentas tipo:

ingresos
gastos
12. Ventajas de este modelo

✔ trazabilidad completa
✔ conciliación automática
✔ reporting fácil
✔ compatible con auditoría

13. Estructura final de tu ERP

Te recomiendo esta estructura.

Base de datos
users
accounts
customers
suppliers
items

journal_entries
journal_entry_lines

sales_invoices
sales_invoice_lines

purchase_invoices
purchase_invoice_lines

inventory_movements

payments
invoice_payments

document_links