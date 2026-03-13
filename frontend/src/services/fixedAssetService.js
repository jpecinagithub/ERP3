import api from './api';

export const fixedAssetService = {
  getFixedAssets: async () => {
    const response = await api.get('/fixed-assets');
    return response.data;
  },

  getFixedAssetById: async (id) => {
    const response = await api.get(`/fixed-assets/${id}`);
    return response.data;
  },

  createFixedAsset: async (data) => {
    const response = await api.post('/fixed-assets', data);
    return response.data;
  },

  createDepreciation: async (id, data) => {
    const response = await api.post(`/fixed-assets/${id}/depreciations`, data);
    return response.data;
  }
};

export default fixedAssetService;
