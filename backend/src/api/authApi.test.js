import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  closePool: vi.fn().mockResolvedValue(undefined)
}));

import { query } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import app from '../app.js';

const mockedQuery = vi.mocked(query);

const postJson = async (baseUrl, path, body, headers = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
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

const getJson = async (baseUrl, path, headers = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers
  });
  const json = await response.json();
  return { response, json };
};

describe('Auth API', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test_secret_for_auth_api';
    process.env.JWT_EXPIRES_IN = '1h';

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/auth/login returns 400 when username/password are missing', async () => {
    const { response, json } = await postJson(baseUrl, '/api/auth/login', { username: '' });

    expect(response.status).toBe(400);
    expect(json.error.message).toBe('Username and password are required');
  });

  it('POST /api/auth/login returns 401 on invalid credentials', async () => {
    mockedQuery.mockResolvedValue([]);

    const { response, json } = await postJson(baseUrl, '/api/auth/login', {
      username: 'invalido',
      password: 'incorrecto'
    });

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Invalid username or password');
  });

  it('POST /api/auth/login returns token and user on success', async () => {
    mockedQuery.mockResolvedValue([{
      id: 1,
      username: 'admin',
      password: 'admin123',
      full_name: 'Administrador ERP',
      role: 'administrador',
      is_active: true
    }]);

    const { response, json } = await postJson(baseUrl, '/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.user.username).toBe('admin');
    expect(typeof json.data.token).toBe('string');
    expect(json.data.token.length).toBeGreaterThan(20);
  });

  it('GET /api/auth/me returns 401 without bearer token', async () => {
    const { response, json } = await getJson(baseUrl, '/api/auth/me');

    expect(response.status).toBe(401);
    expect(json.error.message).toBe('Access token is required');
  });

  it('GET /api/auth/me returns user with valid token', async () => {
    mockedQuery.mockResolvedValue([{
      id: 1,
      username: 'admin',
      full_name: 'Administrador ERP',
      role: 'administrador',
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    }]);

    const token = generateToken({
      id: 1,
      username: 'admin',
      role: 'administrador'
    });

    const { response, json } = await getJson(baseUrl, '/api/auth/me', {
      authorization: `Bearer ${token}`
    });

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.username).toBe('admin');
    expect(json.data.role).toBe('administrador');
  });
});
