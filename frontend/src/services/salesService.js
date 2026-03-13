import api from './api';

export const salesService = {
  getSalesCatalogCustomers: async () => {
    const response = await api.get('/sales-catalog/customers');
    return response.data;
  },

  getSalesCatalogItems: async () => {
    const response = await api.get('/sales-catalog/items');
    return response.data;
  },

  getSalesBudgets: async () => {
    const response = await api.get('/sales-budgets');
    return response.data;
  },

  getSalesBudgetById: async (id) => {
    const response = await api.get(`/sales-budgets/${id}`);
    return response.data;
  },

  createSalesBudget: async (data) => {
    const response = await api.post('/sales-budgets', data);
    return response.data;
  },

  updateSalesBudget: async (id, data) => {
    const response = await api.put(`/sales-budgets/${id}`, data);
    return response.data;
  },

  deleteSalesBudget: async (id) => {
    const response = await api.delete(`/sales-budgets/${id}`);
    return response.data;
  },

  convertSalesBudget: async (id) => {
    const response = await api.post(`/sales-budgets/${id}/convert`);
    return response.data;
  },

  getSalesOrders: async () => {
    const response = await api.get('/sales-orders');
    return response.data;
  },

  getSalesOrderById: async (id) => {
    const response = await api.get(`/sales-orders/${id}`);
    return response.data;
  },

  createSalesOrder: async (data) => {
    const response = await api.post('/sales-orders', data);
    return response.data;
  },

  updateSalesOrderStatus: async (id, status) => {
    const response = await api.put(`/sales-orders/${id}/status`, { status });
    return response.data;
  }
};

export default salesService;

