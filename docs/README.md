# ERP3

ERP modular con:
- Backend API en Node.js/Express
- Frontend en React/Vite
- Base de datos MySQL 8

## Instalación

Documentación recomendada:
- Guía completa: [docs/INSTALACION.md](docs/INSTALACION.md)

## Arranque rápido (resumen)

1. Configura variables de entorno:
   - Backend: copia `backend/.env.example` a `backend/.env`
   - Frontend: copia `frontend/.env.example` a `frontend/.env`
2. Crea base de datos y carga estructura + datos base:
   - `database/schema.sql`
   - `database/seed.sql`
3. Instala dependencias:
   - `cd backend && npm install`
   - `cd frontend && npm install`
4. Inicia servicios:
   - Backend: `npm run dev` (puerto `3000`)
   - Frontend: `npm run dev` (puerto `5173`)

## Acceso de prueba

- Usuario: `admin`
- Contraseña: `admin123`

## Comprobaciones rápidas

- API health: `http://localhost:3000/health`
- Frontend: `http://localhost:5173`
