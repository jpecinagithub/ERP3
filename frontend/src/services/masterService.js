import api from './api';

export const masterService = {
  getItems: async (search = '') => {
    const response = await api.get(`/items${search ? `?search=${search}` : ''}`);
    return response.data;
  },

  getItemById: async (id) => {
    const response = await api.get(`/items/${id}`);
    return response.data;
  },

  createItem: async (data) => {
    const response = await api.post('/items', data);
    return response.data;
  },

  updateItem: async (id, data) => {
    const response = await api.put(`/items/${id}`, data);
    return response.data;
  },

  deleteItem: async (id) => {
    const response = await api.delete(`/items/${id}`);
    return response.data;
  },

  getCustomers: async (search = '') => {
    const response = await api.get(`/customers${search ? `?search=${search}` : ''}`);
    return response.data;
  },

  getCustomerById: async (id) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  createCustomer: async (data) => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  updateCustomer: async (id, data) => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  deleteCustomer: async (id) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  getSuppliers: async (search = '') => {
    const response = await api.get(`/suppliers${search ? `?search=${search}` : ''}`);
    return response.data;
  },

  getSupplierById: async (id) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  createSupplier: async (data) => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },

  updateSupplier: async (id, data) => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  },

  deleteSupplier: async (id) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },

  getUsers: async (search = '') => {
    const response = await api.get(`/users${search ? `?search=${search}` : ''}`);
    return response.data;
  },

  getUserById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (data) => {
    const response = await api.post('/users', data);
    return response.data;
  },

  updateUser: async (id, data) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  deactivateUser: async (id) => {
    const response = await api.put(`/users/${id}/deactivate`);
    return response.data;
  }
};

export default masterService;
