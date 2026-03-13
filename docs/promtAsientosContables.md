Actúa como un experto contable especializado en el **Plan General Contable Español (PGC)** y en modelización de datos contables para **ERP**.

Necesito que generes un **archivo Excel con todos los asientos contables del ejercicio 2025**.

La empresa se crea el **1 de enero de 2025**, por lo que no existen saldos iniciales previos.

IMPORTANTE
Si alguno de los datos proporcionados no es contablemente coherente con el resto del modelo (balance, inventario, resultados, cuentas a cobrar o pagar), debes **priorizar siempre la coherencia contable global del sistema**.
En ese caso puedes **ajustar o ignorar alguno de los datos proporcionados**, explicando brevemente la decisión tomada.

El objetivo principal es que **todo el modelo contable sea consistente**.

---



---

CONDICIONES DE COBRO Y PAGO

Clientes
Cobro a **90 días desde fecha de factura**

Proveedores
Pago a **60 días desde fecha de factura**

Por tanto deben existir correctamente registradas:

cuentas a cobrar (430 Clientes)
cuentas a pagar (400 Proveedores)

con movimientos realistas distribuidos durante el año.

---

CUENTAS CONTABLES A UTILIZAR (PGC)

Utiliza al menos las siguientes cuentas del Plan General Contable Español:

100 Capital social
200 Inmovilizado
281 Amortización acumulada del inmovilizado
300 Existencias
400 Proveedores
430 Clientes
472 IVA soportado
477 IVA repercutido
570 Caja
572 Bancos
600 Compras
610 Variación de existencias
681 Amortización del inmovilizado
700 Ventas

Puedes añadir otras cuentas del PGC si ayudan a mejorar el modelo.

---

OPERACIONES QUE DEBEN APARECER EN LOS ASIENTOS

El libro diario debe reflejar correctamente:

facturas de venta
facturas de compra
movimientos de inventario
cobros de clientes
pagos a proveedores
amortización del inmovilizado
regularización de existencias
cierre del ejercicio

---

TRAZABILIDAD

Debe existir coherencia entre:

factura
asiento contable
movimiento de inventario
cobro o pago posterior

Por ejemplo:

Factura de venta → asiento contable → cuenta cliente → cobro a 90 días

Factura de compra → asiento contable → cuenta proveedor → pago a 60 días

Algunos movimientos deben generar **entradas y salidas de inventario**.

---

CIERRE CONTABLE

Al final del ejercicio deben generarse los asientos de:

amortización del inmovilizado
regularización de existencias
cierre de cuentas de gastos e ingresos
cálculo del resultado del ejercicio
traspaso a cuenta de pérdidas y ganancias

El modelo final debe permitir reconstruir:

Balance de Situación
Cuenta de Pérdidas y Ganancias

---

ARCHIVO EXCEL

El archivo Excel debe contener varias hojas:

HOJA 1 — LIBRO DIARIO

columnas:

fecha
numero_asiento
cuenta
descripcion
debe
haber
referencia_documento
usuario
tipo_operacion

---

HOJA 2 — FACTURAS CLIENTES

numero_factura
cliente
fecha_factura
importe
fecha_cobro_prevista
estado_cobro

---

HOJA 3 — FACTURAS PROVEEDORES

numero_factura
proveedor
fecha_factura
importe
fecha_pago_prevista
estado_pago

---

HOJA 4 — INVENTARIO

fecha
articulo
tipo_movimiento (entrada / salida)
cantidad
valor

---

HOJA 5 — BALANCE DE SITUACION

Activo
Pasivo
Patrimonio Neto

---

HOJA 6 — CUENTA DE PERDIDAS Y GANANCIAS

Ventas
Compras
Variación de existencias
Amortización
Resultado del ejercicio

---

REQUISITOS IMPORTANTES

Los asientos deben estar **ordenados cronológicamente**.

Debe existir coherencia entre:

Libro Diario
Balance de Situación
Cuenta de Pérdidas y Ganancias
Inventario
Cuentas a cobrar
Cuentas a pagar

Las existencias finales deben aproximarse a **150.000 EUR**.

El inmovilizado final debe aproximarse a **200.000 EUR**.

El gasto de amortización debe aproximarse a **25.000 EUR**.

Si alguno de estos valores genera incoherencias contables, debes **priorizar siempre la coherencia del modelo contable completo**.

---

OBJETIVO

El Excel debe estar listo para ser utilizado como **dataset de prueba para un ERP contable**, con suficiente detalle para simular un ejercicio real completo.
