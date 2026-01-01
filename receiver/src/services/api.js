import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const api = {
  createPairingSession: async () => {
    const response = await apiClient.post('/api/pairing');
    return response.data;
  },

  healthCheck: async () => {
    const response = await apiClient.get('/api/health');
    return response.data;
  }
};

