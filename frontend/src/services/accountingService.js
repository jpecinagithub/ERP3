import api from './api';

export const accountingService = {
  getAccounts: async (search = '', accountType = '') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (accountType) params.append('accountType', accountType);
    const response = await api.get(`/accounts?${params}`);
    return response.data;
  },

  getAccountById: async (id) => {
    const response = await api.get(`/accounts/${id}`);
    return response.data;
  },

  getAccountingReferenceData: async () => {
    const response = await api.get('/accounts/reference-data');
    return response.data;
  },

  createAccount: async (data) => {
    const response = await api.post('/accounts', data);
    return response.data;
  },

  updateAccount: async (id, data) => {
    const response = await api.put(`/accounts/${id}`, data);
    return response.data;
  },

  deleteAccount: async (id) => {
    const response = await api.delete(`/accounts/${id}`);
    return response.data;
  },

  getJournalEntries: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.append(key, val);
    });
    const response = await api.get(`/journal-entries?${params}`);
    return response.data;
  },

  getJournalEntryById: async (id) => {
    const response = await api.get(`/journal-entries/${id}`);
    return response.data;
  },

  createJournalEntry: async (data) => {
    const response = await api.post('/journal-entries', data);
    return response.data;
  },

  getBalanceSheet: async (startDate, endDate) => {
    const response = await api.get(`/reports/balance?startDate=${startDate}&endDate=${endDate}`);
    return response.data;
  },

  getPnLReport: async (startDate, endDate) => {
    const response = await api.get(`/reports/pnl?startDate=${startDate}&endDate=${endDate}`);
    return response.data;
  },

  getCustomReport: async (data) => {
    const response = await api.post('/reports/custom', data);
    return response.data;
  },

  getReconciliationReport: async (type, startDate, endDate) => {
    const params = new URLSearchParams({ type });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await api.get(`/reports/reconciliation?${params}`);
    return response.data;
  },

  getFiscalPeriods: async () => {
    const response = await api.get('/fiscal-periods');
    return response.data;
  },

  createFiscalPeriod: async (data) => {
    const response = await api.post('/fiscal-periods', data);
    return response.data;
  },

  closeFiscalPeriod: async (id) => {
    const response = await api.put(`/fiscal-periods/${id}/close`);
    return response.data;
  },

  reopenFiscalPeriod: async (id, justification) => {
    const response = await api.put(`/fiscal-periods/${id}/reopen`, { justification });
    return response.data;
  },

  getJournalEntryTemplates: async (category = '') => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    const response = await api.get(`/journal-entry-templates?${params}`);
    return response.data;
  },

  getJournalEntryTemplateById: async (id) => {
    const response = await api.get(`/journal-entry-templates/${id}`);
    return response.data;
  },

  getDashboardKPIs: async (startDate, endDate) => {
    const params = new URLSearchParams({ startDate, endDate });
    const response = await api.get(`/dashboard/kpis?${params}`);
    return response.data;
  },

  closeFiscalPeriodYear: async (id) => {
    const response = await api.post(`/fiscal-periods/${id}/close-year`);
    return response.data;
  },

  exportReportCSV: async (type, startDate, endDate) => {
    const params = new URLSearchParams({ type, startDate, endDate });
    const response = await api.get(`/reports/export/csv?${params}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default accountingService;
