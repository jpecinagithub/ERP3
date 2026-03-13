quiero que me generes un plan de trabajo detallado para generar un ERP online. quiero que tenga un 


modulo de compras 
gestion de presupuestos
gestion de pedidos (parcial o total)
gestion de facturas de compras + contabilización 
gestion de inventario (salidas y entradas de material)

modulo de contabildad
utilizando las cuentas del PCGE Plan contable general espanol
gestion de asientos contables
eleboracion de informe de perdidas y ganancias
elaboracion de informe de balance de situacion
elooracion de informes personalizados

modulo de tesoreria
gestion de facturas de ventas  + contabilizan
gestion de cobros y pagos

Quiero que se pueda seguir toda la trazabilidad de los pedidos con toda la informacion relevante.

Quiero que haya un sistema de autenticacion completo con distintos roles: compras (solo tendra acceso al modulo de compras), contabililidad (solo tendra acceso a contabildiad) , tesoreria (solo tendra acceso a tesoreria). Habra tambien un rol de administrador que tendra aceso a todos los modulos, definicion de articulos, definicion de clientees y proveedores, definicion de cuentas del plan contable.
Es muy importante deteneres en la elaboracion de la bbdd para evitar trabajo duplicado. Tiene que haber una table de articulos, clientes, proveedores, usuarios, cuentas del plan GCE.

El stack sera Vite-react en el front y node con mysql en el back. Genera el archivo sql de elaboracion de bbdd y tambien seed.sql con articulos, usuarios, clientes y proveedores asi como las cuentas fundamentales del PGC. Presta mucha atencion a la trazabilidad, quiero poder hacer un seguiminedo desde el presupuesto, la compra, la facturacion, el cobro/pago y la contabilzacion sabiendo que usuario ha hecho cada paso.
El sistema de autenticacion no quiero que tenga encriptado en el passport de los usuarios. Estamos en una prueba y quiero conocer las claves. Tampoco quiero restricciones de numero de caracteres, tipo de caracteres…