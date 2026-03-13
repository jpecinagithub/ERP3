import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  closePool: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../controllers/salesFlowController.js', () => {
  const ok = (label) => (req, res) => res.json({ success: true, handler: label });
  return {
    getSalesBudgets: vi.fn(ok('getSalesBudgets')),
    getSalesBudgetById: vi.fn(ok('getSalesBudgetById')),
    createSalesBudget: vi.fn(ok('createSalesBudget')),
    convertSalesBudgetToOrder: vi.fn(ok('convertSalesBudgetToOrder')),
    getSalesOrders: vi.fn(ok('getSalesOrders')),
    getSalesOrderById: vi.fn(ok('getSalesOrderById')),
    createSalesOrder: vi.fn(ok('createSalesOrder')),
    confirmSalesOrder: vi.fn((req, res) => {
      res.json({
        success: true,
        message: 'sales-flow-connected'
      });
    })
  };
});

import { generateToken } from '../middleware/auth.js';
import app from '../app.js';

const getJson = async (baseUrl, pathValue, headers = {}) => {
  const response = await fetch(`${baseUrl}${pathValue}`, {
    method: 'GET',
    headers
  });
  const json = await response.json();
  return { response, json };
};

const postJson = async (baseUrl, pathValue, body = {}, headers = {}) => {
  const response = await fetch(`${baseUrl}${pathValue}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  return { response, json };
};

describe('API routes and connectivity', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test_secret_for_routes_api';
    process.env.JWT_EXPIRES_IN = '1h';

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('all route files are imported and mounted in app', () => {
    const appPath = path.resolve(process.cwd(), 'src', 'app.js');
    const routesDir = path.resolve(process.cwd(), 'src', 'routes');
    const appSource = readFileSync(appPath, 'utf8');

    const routeFiles = readdirSync(routesDir)
      .filter((fileName) => fileName.endsWith('Routes.js'))
      .sort();

    expect(routeFiles.length).toBeGreaterThan(0);

    for (const routeFile of routeFiles) {
      const routeModuleName = routeFile.replace('.js', '');
      expect(appSource).toContain(`from './routes/${routeFile}'`);
      expect(appSource).toMatch(new RegExp(`app\\.use\\([^\\n]*${routeModuleName}\\)`));
    }
  });

  it('GET /api responds with API metadata', async () => {
    const { response, json } = await getJson(baseUrl, '/api');

    expect(response.status).toBe(200);
    expect(json.message).toBe('ERP Contable API');
  });

  it('GET /api/items requires authentication', async () => {
    const { response, json } = await getJson(baseUrl, '/api/items');

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Access token is required');
  });

  it('GET /api/accounts blocks compras role (business model guard)', async () => {
    const comprasToken = generateToken({ id: 11, username: 'compras_user', role: 'compras' });

    const { response, json } = await getJson(baseUrl, '/api/accounts', {
      authorization: `Bearer ${comprasToken}`
    });

    expect(response.status).toBe(403);
    expect(json.error.message).toContain('Required role(s)');
  });

  it('GET /api/purchase-orders blocks contabilidad role (business model guard)', async () => {
    const token = generateToken({ id: 12, username: 'conta_user', role: 'contabilidad' });

    const { response, json } = await getJson(baseUrl, '/api/purchase-orders', {
      authorization: `Bearer ${token}`
    });

    expect(response.status).toBe(403);
    expect(json.error.message).toContain('Required role(s)');
  });

  it('POST /api/sales-flow/sales-orders/:id/confirm is connected and protected', async () => {
    const noAuth = await postJson(baseUrl, '/api/sales-flow/sales-orders/1/confirm');
    expect(noAuth.response.status).toBe(401);

    const comprasToken = generateToken({ id: 21, username: 'compras', role: 'compras' });
    const forbidden = await postJson(
      baseUrl,
      '/api/sales-flow/sales-orders/1/confirm',
      {},
      { authorization: `Bearer ${comprasToken}` }
    );
    expect(forbidden.response.status).toBe(403);

    const ventasToken = generateToken({ id: 22, username: 'ventas', role: 'ventas' });
    const allowed = await postJson(
      baseUrl,
      '/api/sales-flow/sales-orders/1/confirm',
      {},
      { authorization: `Bearer ${ventasToken}` }
    );
    expect(allowed.response.status).toBe(200);
    expect(allowed.json.message).toBe('sales-flow-connected');
  });
});
