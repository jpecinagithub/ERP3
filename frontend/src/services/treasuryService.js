import api from './api';

export const treasuryService = {
  getSalesInvoices: async () => {
    const response = await api.get('/sales-invoices');
    return response.data;
  },

  getSalesInvoiceById: async (id) => {
    const response = await api.get(`/sales-invoices/${id}`);
    return response.data;
  },

  downloadSalesInvoicePdf: async (id) => {
    const response = await api.get(`/sales-invoices/${id}/pdf`, {
      responseType: 'blob'
    });
    return response.data;
  },

  createSalesInvoice: async (data) => {
    const response = await api.post('/sales-invoices', data);
    return response.data;
  },

  getCollections: async () => {
    const response = await api.get('/collections');
    return response.data;
  },

  getCollectionById: async (id) => {
    const response = await api.get(`/collections/${id}`);
    return response.data;
  },

  createCollection: async (data) => {
    const response = await api.post('/collections', data);
    return response.data;
  },

  updateCollectionStatus: async (id, status) => {
    const response = await api.put(`/collections/${id}/status`, { status });
    return response.data;
  },

  getPayments: async () => {
    const response = await api.get('/payments');
    return response.data;
  },

  getPaymentById: async (id) => {
    const response = await api.get(`/payments/${id}`);
    return response.data;
  },

  createPayment: async (data) => {
    const response = await api.post('/payments', data);
    return response.data;
  },

  updatePaymentStatus: async (id, status) => {
    const response = await api.put(`/payments/${id}/status`, { status });
    return response.data;
  }
};

export default treasuryService;
