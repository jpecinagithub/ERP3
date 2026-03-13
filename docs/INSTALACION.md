# Guía De Instalación ERP3

Esta guía está pensada para que cualquier persona pueda instalar el proyecto desde cero.

## 1) Requisitos previos

Necesitas tener instalado:

1. Node.js (recomendado: versión 20 o superior)
2. npm (viene con Node.js)
3. MySQL Server 8.x
4. Git (opcional si ya tienes el código descargado)

Comprobación rápida en terminal:

```bash
node --version
npm --version
mysql --version
```

## 2) Estructura del proyecto

Directorios principales:

1. `backend`: API REST (Express + MySQL)
2. `frontend`: aplicación web (React + Vite)
3. `database`: scripts SQL (`schema.sql`, `seed.sql`, `template2025.sql`)

## 3) Configurar variables de entorno

## Backend

1. Copia el archivo de ejemplo:

```bash
cp backend/.env.example backend/.env
```

En Windows PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
```

2. Edita `backend/.env` y ajusta:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT`
- `CORS_ORIGIN`
- `JWT_SECRET`

## Frontend

1. Copia el archivo de ejemplo:

```bash
cp frontend/.env.example frontend/.env
```

En Windows PowerShell:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

2. Ajusta `VITE_API_URL` si tu backend no está en `http://localhost:3000/api`.

## 4) Crear base de datos y cargar SQL

Los scripts deben ejecutarse en este orden:

1. `database/schema.sql`
2. `database/seed.sql`
3. Opcional: `database/template2025.sql` (ejercicio contable 2025 completo)

## Opción A: MySQL Workbench (recomendada para no técnicos)

1. Conéctate al servidor MySQL.
2. Abre y ejecuta `database/schema.sql`.
3. Abre y ejecuta `database/seed.sql`.
4. Opcional: abre y ejecuta `database/template2025.sql`.

## Opción B: Terminal (macOS/Linux)

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p erp_contable < database/seed.sql
mysql -u root -p erp_contable < database/template2025.sql
```

## Opción C: Terminal (Windows PowerShell)

PowerShell no usa la redirección `<` como bash/cmd. Usa `source`:

```powershell
mysql -u root -p -e "source database/schema.sql"
mysql -u root -p erp_contable -e "source database/seed.sql"
mysql -u root -p erp_contable -e "source database/template2025.sql"
```

## 5) Instalar dependencias

En una terminal:

```bash
cd backend
npm install
```

En otra terminal:

```bash
cd frontend
npm install
```

## 6) Levantar el sistema en desarrollo

## Backend

```bash
cd backend
npm run dev
```

Backend esperado:

- URL base: `http://localhost:3000`
- Health: `http://localhost:3000/health`

## Frontend

```bash
cd frontend
npm run dev
```

Frontend esperado:

- URL: `http://localhost:5173`

## 7) Primer acceso

Con los datos de `seed.sql`:

1. Usuario: `admin`
2. Contraseña: `admin123`

Usuarios adicionales:

1. `compras` / `compras123`
2. `contabilidad` / `contabilidad123`
3. `tesoreria` / `tesoreria123`
4. `ventas` / `ventas123` (si está presente por migración de compatibilidad del schema)

## 8) Verificación funcional mínima

1. `GET http://localhost:3000/health` debe devolver `status: ok`.
2. Abre `http://localhost:5173`.
3. Inicia sesión con `admin/admin123`.
4. Verifica que puedes navegar por módulos sin errores.

## 9) Comandos útiles

## Ejecutar tests backend

```bash
cd backend
npm test
```

## Build frontend

```bash
cd frontend
npm run build
```

## 10) Problemas frecuentes y solución

## Error: `ECONNREFUSED` o base de datos no disponible

1. Asegura que MySQL está arrancado.
2. Revisa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`.
3. Comprueba que existe la base `erp_contable`.

## Error de CORS en navegador

1. Ajusta `CORS_ORIGIN` en `backend/.env`.
2. Reinicia backend.

## Login da `Invalid username or password`

1. Verifica que ejecutaste `seed.sql`.
2. Revisa que no cambiaste contraseñas en tabla `users`.

## Puerto ocupado (`3000` o `5173`)

1. Cambia `PORT` en `backend/.env`.
2. Si cambias backend, actualiza `VITE_API_URL` en `frontend/.env`.

## 11) Reinstalación limpia

Si quieres reiniciar datos:

1. Ejecuta de nuevo `database/schema.sql` (elimina y crea tablas).
2. Ejecuta `database/seed.sql`.
3. Opcional: ejecuta `database/template2025.sql`.

## 12) Checklist final

1. MySQL activo
2. `backend/.env` correcto
3. `frontend/.env` correcto
4. `schema.sql` y `seed.sql` ejecutados
5. `npm install` en backend y frontend
6. `npm run dev` en backend y frontend
7. Login correcto con `admin/admin123`
