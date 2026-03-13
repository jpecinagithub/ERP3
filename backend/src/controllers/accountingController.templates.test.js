import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  beginTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  rollbackTransaction: vi.fn()
}));

vi.mock('../services/accountingService.js', () => ({ default: {} }));
vi.mock('../services/validationService.js', () => ({ default: {} }));
vi.mock('../services/traceabilityService.js', () => ({ default: {} }));

import { query } from '../config/database.js';
import { getJournalEntryTemplates, getJournalEntryTemplateById } from './accountingController.js';

const mockedQuery = vi.mocked(query);

describe('AccountingController - journal templates deprecations', () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { query: {}, params: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  it('getJournalEntryTemplates excludes deprecated mercaderias templates', async () => {
    mockedQuery.mockResolvedValue([
      {
        id: 1,
        name: 'Factura de compra de mercaderías',
        description: 'Compra sin IVA',
        category: 'compra_mercaderias',
        template_data: '{"lines":[]}'
      },
      {
        id: 2,
        name: 'Factura de compra mercaderías con IVA',
        description: 'Compra con IVA',
        category: 'compra_mercaderias',
        template_data: '{"lines":[]}'
      }
    ]);

    await getJournalEntryTemplates(req, res);

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('name NOT IN (?, ?)'),
      expect.arrayContaining([
        'Factura de compra de mercaderías',
        'Factura de venta de mercaderías'
      ])
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        expect.objectContaining({
          id: 2,
          name: 'Factura de compra mercaderías con IVA'
        })
      ]
    });
  });

  it('getJournalEntryTemplateById returns 404 for removed templates', async () => {
    req.params.id = '1';
    mockedQuery.mockResolvedValue([]);

    await getJournalEntryTemplateById(req, res);

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('name NOT IN (?, ?)'),
      ['1', 'Factura de compra de mercaderías', 'Factura de venta de mercaderías']
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'Template not found',
        status: 404
      }
    });
  });

  it('getJournalEntryTemplateById returns active template with mapped accounts', async () => {
    req.params.id = '2';
    mockedQuery
      .mockResolvedValueOnce([
        {
          id: 2,
          name: 'Factura de venta mercaderías con IVA',
          description: 'Venta con IVA',
          category: 'venta_mercaderias',
          template_data: JSON.stringify({
            lines: [
              { account_code: '430', debit: 1815, credit: 0, description: 'Cliente' },
              { account_code: '700', debit: 0, credit: 1500, description: 'Venta' },
              { account_code: '477', debit: 0, credit: 315, description: 'IVA repercutido' }
            ]
          })
        }
      ])
      .mockResolvedValueOnce([
        { id: 10, code: '430', name: 'Clientes' },
        { id: 11, code: '700', name: 'Ventas de mercaderías' },
        { id: 12, code: '477', name: 'Hacienda Pública, IVA repercutido' }
      ]);

    await getJournalEntryTemplateById(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        id: 2,
        name: 'Factura de venta mercaderías con IVA',
        description: 'Venta con IVA',
        category: 'venta_mercaderias',
        templateData: {
          lines: expect.arrayContaining([
            expect.objectContaining({ accountId: 10, accountCode: '430' }),
            expect.objectContaining({ accountId: 11, accountCode: '700' }),
            expect.objectContaining({ accountId: 12, accountCode: '477' })
          ])
        }
      }
    });
  });
});
