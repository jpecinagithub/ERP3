# Contexto del proyecto (ERP2)

## Resumen
ERP2 es un **MVP de ERP contable/operativo** con:
- **Base de datos**: MySQL 8 (docker-compose).
- **Backend**: Node.js + Express + JWT + MySQL (`mysql2/promise`).
- **Frontend**: React + Vite + React Router + TailwindCSS.

El objetivo visible del MVP es cubrir **auth**, **maestros** (clientes/proveedores/artículos/cuentas/usuarios), **libro diario**, **facturas** (venta/compra), **inventario** y **reportes** (balance / PyG).

## Estructura del repositorio
- `docker-compose.yml`: servicio MySQL para desarrollo.
- `backend/`: API REST (Express).
  - `src/index.js`: arranque y montaje de rutas bajo `/api/*`.
  - `src/db.js`: pool MySQL desde variables de entorno.
  - `src/middleware/auth.js`: autenticación JWT + autorización por roles.
  - `src/routes/*.js`: endpoints del dominio.
- `frontend/`: SPA (React/Vite).
  - `src/App.jsx`: rutas y protección por sesión.
  - `src/api/client.js`: cliente Axios con `Authorization: Bearer <token>`.
  - `src/context/AuthContext.jsx`: login/logout y persistencia en `localStorage`.
  - `src/pages/*`: pantallas (CRUD + módulos contables).
- `sql/`: bootstrap del esquema, seeds, triggers, utilidades y verificaciones.

## Stack técnico
### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Auth**: JWT (`jsonwebtoken`)
- **Hash**: `bcryptjs` (registro usa hash; login admite claro o bcrypt para compatibilidad con seeds)
- **DB**: MySQL vía `mysql2/promise`
- **Dev**: `nodemon`, tests con `jest` + `supertest`

### Frontend
- **React** (Vite, `@vitejs/plugin-react`)
- **Routing**: `react-router-dom`
- **UI**: TailwindCSS + componentes (`Modal`, `Toast`, `StatusBadge`, `Layout`)
- **HTTP**: Axios con interceptores (adjunta token; ante 401/403 limpia sesión y redirige a `/login`)
- **Export**: Excel (`xlsx`), PDFs (`jspdf`, `jspdf-autotable`)

## Servicios / infraestructura local
### MySQL (Docker)
`docker-compose.yml` levanta:
- **MySQL 8.0**
- **DB**: `ERP2`
- **Puertos**: `3306:3306`
- **Volumen**: `./mysql-data:/var/lib/mysql`

> Nota: El `docker-compose.yml` incluye credenciales de ejemplo (no para producción).

## Variables de entorno
### Backend (`backend/.env`)
Basado en `backend/.env.example`:
- **PORT**: puerto del servidor (default `3000`)
- **JWT_SECRET**: secret del token
- **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME**

### Frontend (`frontend/.env`)
Basado en `frontend/.env.example`:
- **VITE_API_BASE**: base URL de la API (por defecto `http://localhost:3000/api`)

## Cómo ejecutar (desarrollo)
### 1) Base de datos
- Levantar MySQL con Docker (en la raíz):
  - `docker compose up -d`
- Crear/actualizar esquema con los SQL en `sql/` (ver sección “SQL / esquema”).

### 2) Backend
En `backend/`:
- `npm install`
- `npm run dev` (o `npm start`)

El backend monta rutas bajo `http://localhost:<PORT>/api`.

### 3) Frontend
En `frontend/`:
- `npm install`
- `npm run dev`

La SPA usa `VITE_API_BASE` para hablar con el backend.

## Autenticación y autorización
### JWT
- El frontend guarda:
  - `erp_token`: JWT
  - `erp_user`: payload decodificado (id/username/role)

### Roles (detectados en backend)
En el registro se valida contra:
`admin`, `compras`, `contabilidad`, `tesoreria`, `superadmin` (si no coincide, por defecto `compras`).

### Middleware
- `authenticateToken`: valida `Authorization: Bearer <token>` y popula `req.user`.
- `authorize(roles)`: permite acceso si `req.user.role` está en la lista.

## API (mapa de endpoints)
Montaje en `backend/src/index.js`:
- **Auth**
  - `POST /api/auth/login`: devuelve `{ token }`
  - `POST /api/auth/register`: crea usuario (password bcrypt)
- **Usuarios** (`/api/users`) *protegido + superadmin*
  - `GET /`: listar
  - `GET /:id`: detalle
  - `POST /`: crear
  - `PUT /:id`: actualizar
  - `DELETE /:id`: borrar
  - `POST /:id/upgrade-password`: helper para migrar password a bcrypt (superadmin)
- **Maestros** (CRUD típico; creación/edición/borrado suele requerir `superadmin`)
  - `customers`: `/api/customers`
  - `suppliers`: `/api/suppliers`
  - `items`: `/api/items` (auto-resuelve `unit_id` si falta; requiere seeds de `units`)
  - `accounts`: `/api/accounts`
- **Libro diario** (`/api/journal`)
  - `GET /`: lista asientos
  - `GET /:id`: cabecera + líneas (join con cuentas)
  - `POST /`: crea asiento **balanceado** (debe==haber) y lo marca como `posteado`
    - Roles permitidos: `superadmin`, `contabilidad`
    - Post-proceso: intenta **generar facturas y movimientos de inventario** asociados según `transaction_type` y `entity_id`/`item_id` (se ejecuta tras el commit)
  - `PUT /:id`: actualiza cabecera y líneas (requiere balance)
  - `DELETE /:id`: borrado con “business cascade” (facturas/movimientos/links asociados)
- **Facturas**
  - Venta: `/api/sales_invoices`
    - `GET /`, `GET /:id`
    - `POST /`: crea factura y *intenta* crear asiento contable simple (no bloqueante)
    - `POST /:invoiceId/lines`: añade líneas
  - Compra: `/api/purchase_invoices`
    - `GET /`, `GET /:id`
    - `POST /`: transaccional; crea factura + asiento + link documental
    - `POST /:invoiceId/lines`: transaccional; añade línea y crea movimiento de inventario + link
    - `DELETE /:id`: transaccional; borra inventario y trazas contables ligadas por `source_document`
- **Inventario** (`/api/inventory`)
  - `GET /movements`: lista movimientos
  - `POST /movements`: crea movimiento (roles amplios: `superadmin`, `contabilidad`, `compras`, `tesoreria`)
- **Reportes** (`/api/reports`)
  - `GET /balance`: sumas por cuenta desde `journal_entry_lines` (la implementación actual usa una query “simple” sin filtros por fecha)
  - `GET /trial-balance`
  - `GET /income-statement`
- **Utilidad**
  - `GET /api/health`: `status: ok`
  - `GET /api/version`: versión/build

## Frontend (pantallas y flujo)
Rutas (SPA) definidas en `frontend/src/App.jsx`:
- Públicas: `/login`, `/register`
- Protegidas (requieren sesión): `/` (Dashboard) y módulos:
  - `/customers`, `/suppliers`, `/items`, `/accounts`, `/users`
  - `/sales-invoices`, `/purchase-invoices`
  - `/journal` (Libro Diario con plantillas + importación Excel + edición)
  - `/balance` (Balance y PDFs)
  - `/inventory` (Movimientos + resumen de stock)

Patrones UI:
- CRUD estándar en páginas como `Customers`/`Accounts` vía componente `CrudPage` (tabla + modal crear/editar + búsqueda + toast).
- Libro Diario (`JournalEntries.jsx`) incluye:
  - plantillas predefinidas (ventas/compras/gastos/cobros/pagos/capital/regularización),
  - importación Excel (valida columnas requeridas),
  - validación de equilibrio Debe/Haber antes de guardar.
- Balance (`Balance.jsx`) genera PDFs (Balance de Situación y PyG) con `jsPDF`.

## SQL / esquema
Documentación base en `sql/README.md`:
- `sql/01-schema.sql`: esquema principal (tablas contables, inventario, facturas, etc.)
- `sql/02-seed*.sql`: seeds idempotentes para datos de prueba
- `sql/03-triggers-auditoria.sql`: auditoría (opcional)
- `sql/04-utilidades.sql`: procedimientos/funciones (posting y balance)
- Scripts adicionales: verificaciones e idempotencia (`verify_integrity.sql`, `run_idempotence_tests.sql`), migraciones puntuales, variantes generadas (GPT/GEMINI)

## Notas y supuestos detectados (importantes para desarrollo)
- **Compatibilidad de contraseñas**: `login` intenta primero en claro y luego bcrypt (útil si seeds crean usuarios con password plano).
- **Permisos**: muchas operaciones de maestros están restringidas a `superadmin`; el frontend no esconde acciones por rol (la API aplica el control).
- **Generación automática** desde libro diario:
  - Si las líneas llevan `transaction_type` `venta`/`compra` y `entity_id`, se intentan crear facturas y movimientos de stock tras confirmar el asiento.
  - Si hay errores en inventario, se registran pero no hacen rollback del asiento.

