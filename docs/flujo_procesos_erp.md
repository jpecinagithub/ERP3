# Flujo de procesos operativos ERP (Compras, Ventas, Contabilidad y Tesoreria)

## 1) Objetivo
Definir como los usuarios de Compras, Ventas, Contabilidad y Tesoreria:
1. Acceden a la informacion.
2. Introducen la informacion.
3. Ejecutan un flujo consistente desde documento comercial hasta asiento y cobro/pago.

## 2) Roles y responsabilidades
| Rol | Introduce informacion | Consulta informacion | Restricciones clave |
|---|---|---|---|
| Compras | Presupuestos, pedidos de compra, recepciones, facturas de proveedor (si aplica) | Estado de pedidos, stock, facturas pendientes, pagos previstos | No confirmar factura sin proveedor y fecha fiscal validos |
| Ventas | Presupuestos, pedidos de venta, entregas/albaranes, facturas de cliente | Stock disponible, pedidos pendientes, cobros pendientes | No facturar mercaderia sin stock |
| Contabilidad | Asientos manuales de ajuste, validacion de asientos automaticos, cierres | Todos los documentos origen y trazabilidad | Debe = Haber, periodo abierto, cuentas correctas por tipo de operacion |
| Tesoreria | Cobros y pagos, conciliacion bancaria | Facturas vencidas, previsiones de tesoreria, cartera | No registrar cobro/pago sin factura asociada |

## 3) Flujo estandar de Compras
Flujo base:
1. Presupuesto de compra.
2. Pedido de compra.
3. Factura de compra.
4. Pago.

Flujo operativo recomendado (con control logistico):
1. Presupuesto compra (`draft`, `aceptado`, `rechazado`).
2. Pedido compra (`emitido`, `parcial`, `recibido`).
3. Recepcion mercaderia/inmovilizado (si aplica).
4. Factura proveedor (`registrada`, `contabilizada`, `pendiente_pago`, `pagada`).
5. Pago (tesoreria + conciliacion).

### 3.1 Variante A: Factura de mercaderias
1. Compras registra pedido.
2. Al recibir mercaderia, se registra entrada de inventario.
3. Se registra factura de proveedor.
4. Contabilidad genera asiento de compra de mercaderia:
   - Debe: cuenta de existencias/compra (segun politica contable).
   - Debe: `472 IVA soportado`.
   - Haber: `400 Proveedores`.
5. Tesoreria ejecuta pago:
   - Debe: `400 Proveedores`.
   - Haber: `572 Bancos` (o `570 Caja`).

Notas de control:
1. No se puede dejar inventario negativo.
2. Factura y movimiento de inventario deben quedar enlazados.
3. Si hay diferencia entre recepcion y factura (precio/cantidad), registrar ajuste.

### 3.2 Variante B: Factura de inmovilizado
1. Compras registra pedido de inmovilizado.
2. Se recepciona el bien y se crea ficha de activo fijo.
3. Se registra factura.
4. Contabilidad genera asiento de alta:
   - Debe: cuenta de inmovilizado (`2xx`).
   - Debe: `472 IVA soportado`.
   - Haber: `400 Proveedores` (o `523` segun vencimiento).
5. Se activa plan de amortizacion (mensual/anual):
   - Debe: `681 Amortizacion del inmovilizado`.
   - Haber: `281 Amortizacion acumulada`.
6. Tesoreria registra pago.

Notas de control:
1. No permitir activo sin ficha (fecha alta, vida util, metodo).
2. No permitir amortizacion acumulada > valor del activo.

### 3.3 Variante C: Factura de gastos
1. Compras/administracion registra factura de gasto.
2. Contabilidad genera asiento:
   - Debe: cuenta de gasto (`62x/6xx`).
   - Debe: `472 IVA soportado` (si corresponde).
   - Haber: `400 Proveedores` o `410 Acreedores`.
3. Tesoreria registra pago.

Notas de control:
1. Tipo de gasto obligatorio (servicios, suministros, alquiler, etc.).
2. Centros de coste/proyecto obligatorios si hay analitica.

## 4) Flujo estandar de Ventas
Flujo base:
1. Presupuesto de venta.
2. Pedido de venta.
3. Factura de venta.
4. Cobro.

Flujo operativo recomendado (con control logistico):
1. Presupuesto venta (`draft`, `aceptado`, `rechazado`).
2. Pedido venta (`confirmado`, `pendiente_stock`, `listo_entrega`).
3. Entrega/albaran (si aplica).
4. Factura cliente (`emitida`, `contabilizada`, `pendiente_cobro`, `cobrada`).
5. Cobro (tesoreria + conciliacion).

### 4.1 Regla obligatoria para mercaderias en ventas
No se puede facturar una linea de mercaderia si:
1. No existe stock disponible.
2. No existe salida/reserva de inventario asociada.

### 4.2 Regla de aprovisionamiento automatico en pedido de venta
Al confirmar pedido de venta:
1. Validar stock disponible por linea.
2. Si hay stock suficiente:
   - Reservar stock.
   - Continuar a preparacion/entrega.
3. Si no hay stock:
   - Crear automaticamente pedido de compra vinculado al pedido de venta.
   - Marcar pedido de venta como `pendiente_stock`.
   - Bloquear facturacion hasta recepcion de compra y disponibilidad real.

### 4.3 Asientos contables en ventas
Asiento de factura de venta:
1. Debe: `430 Clientes`.
2. Haber: `700 Ventas`.
3. Haber: `477 IVA repercutido`.

Asiento de salida de mercaderia (si inventario permanente):
1. Debe: cuenta de coste/variacion de existencias (segun plan).
2. Haber: `300 Existencias`.

Asiento de cobro:
1. Debe: `572 Bancos` (o `570 Caja`).
2. Haber: `430 Clientes`.

## 5) Intervencion de Contabilidad (tratamiento particular)
Contabilidad no solo "revisa": define y controla el impacto contable por tipo de documento.

### 5.1 Tipos de asiento que deben tratarse distinto
1. Compra de mercaderias.
2. Compra de inmovilizado.
3. Compra de gasto.
4. Venta de mercaderias (ingreso + posible salida de existencias).
5. Cobro/pago.
6. Amortizacion.
7. Regularizaciones y cierre.

### 5.2 Reglas contables minimas del motor
1. `Debe == Haber` en cada asiento.
2. No contabilizar en periodos cerrados.
3. Cuenta contable obligatoria por tipo de linea.
4. Conciliacion:
   - Pendiente clientes = saldo `430`.
   - Pendiente proveedores = saldo `400`.
5. Inventario:
   - No inventario negativo.
   - Valor inventario coherente con movimientos.
6. Trazabilidad obligatoria:
   - Documento negocio -> asiento -> movimiento inventario -> cobro/pago.

## 6) Intervencion de Tesoreria
Tesoreria se centra en cobros y pagos, pero debe estar integrada con cartera y contabilidad.

### 6.1 Cobros
1. Seleccionar factura(s) de cliente pendientes.
2. Registrar cobro (fecha, importe, metodo, banco).
3. Permitir cobros parciales.
4. Actualizar estado de factura y cartera.
5. Generar asiento de cobro y conciliacion bancaria.

### 6.2 Pagos
1. Seleccionar factura(s) de proveedor pendientes.
2. Registrar pago (fecha, importe, metodo, banco).
3. Permitir pagos parciales.
4. Actualizar estado de factura y cartera.
5. Generar asiento de pago y conciliacion bancaria.

## 7) Flujo integral resumido (de extremo a extremo)
### 7.1 Compra mercaderia
1. Presupuesto compra -> Pedido compra -> Recepcion -> Factura proveedor -> Asiento compra -> Pago -> Asiento pago.

### 7.2 Compra inmovilizado
1. Presupuesto compra -> Pedido compra -> Recepcion activo -> Alta inmovilizado -> Factura -> Asiento alta -> Pago -> Amortizaciones periodicas.

### 7.3 Compra gasto
1. Solicitud/pedido -> Factura gasto -> Asiento gasto -> Pago.

### 7.4 Venta mercaderia
1. Presupuesto venta -> Pedido venta.
2. Verificar stock:
   - Si hay stock: reservar y entregar.
   - Si no hay stock: crear pedido de compra automatico y esperar recepcion.
3. Facturar solo con stock disponible.
4. Asiento factura venta.
5. Asiento salida existencias (si aplica).
6. Cobro y asiento de cobro.

### 7.5 Venta servicio/gasto repercutible (sin stock)
1. Presupuesto venta -> Pedido venta -> Factura venta -> Cobro.

## 8) Datos minimos obligatorios al introducir informacion
1. Documento: fecha, serie/numero, tercero (cliente/proveedor), moneda, estado.
2. Lineas: producto/servicio, cantidad, precio, impuestos, cuenta contable.
3. Trazabilidad: documento origen y destino.
4. Auditoria: usuario creador, fecha/hora, usuario modificador.
5. Contabilidad: periodo, diario, plantilla de asiento, centro de coste (si aplica).
6. Tesoreria: vencimiento, metodo de cobro/pago, cuenta bancaria.

## 9) Controles de consistencia recomendados
1. Bloquear facturacion de venta de mercaderia sin stock.
2. Bloquear cobro/pago sin factura contabilizada.
3. Bloquear eliminacion de documentos con movimientos posteriores enlazados.
4. Exigir conciliacion de diferencias entre recepcion y factura.
5. Alertar descuadres entre cartera y mayor (`430/400`).
6. Mantener enlaces de trazabilidad obligatorios en cada salto del flujo.

