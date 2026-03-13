import api from './api';

export const purchaseService = {
  getBudgets: async () => {
    const response = await api.get('/budgets');
    return response.data;
  },

  getBudgetById: async (id) => {
    const response = await api.get(`/budgets/${id}`);
    return response.data;
  },

  createBudget: async (data) => {
    const response = await api.post('/budgets', data);
    return response.data;
  },

  updateBudget: async (id, data) => {
    const response = await api.put(`/budgets/${id}`, data);
    return response.data;
  },

  deleteBudget: async (id) => {
    const response = await api.delete(`/budgets/${id}`);
    return response.data;
  },

  convertBudget: async (id) => {
    const response = await api.post(`/budgets/${id}/convert`);
    return response.data;
  },

  getPurchaseOrders: async () => {
    const response = await api.get('/purchase-orders');
    return response.data;
  },

  getPurchaseOrderById: async (id) => {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data;
  },

  createPurchaseOrder: async (data) => {
    const response = await api.post('/purchase-orders', data);
    return response.data;
  },

  updatePurchaseOrderStatus: async (id, status) => {
    const response = await api.put(`/purchase-orders/${id}`, { status });
    return response.data;
  },

  getPurchaseInvoices: async () => {
    const response = await api.get('/purchase-invoices');
    return response.data;
  },

  getPurchaseInvoiceById: async (id) => {
    const response = await api.get(`/purchase-invoices/${id}`);
    return response.data;
  },

  createPurchaseInvoice: async (data) => {
    const response = await api.post('/purchase-invoices', data);
    return response.data;
  },

  getInventory: async () => {
    const response = await api.get('/inventory');
    return response.data;
  },

  getInventoryMovements: async (itemId, startDate, endDate) => {
    const params = new URLSearchParams();
    if (itemId) params.append('itemId', itemId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await api.get(`/inventory/movements?${params}`);
    return response.data;
  },

  createInventoryAdjustment: async (data) => {
    const response = await api.post('/inventory/adjust', data);
    return response.data;
  }
};

export default purchaseService;
