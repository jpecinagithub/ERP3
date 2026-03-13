import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import accountingRoutes from './routes/accountingRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import salesFlowRoutes from './routes/salesFlowRoutes.js';
import treasuryRoutes from './routes/treasuryRoutes.js';
import fixedAssetRoutes from './routes/fixedAssetRoutes.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (req, res) => {
  try {
    await testConnection(1, 1000);
    res.json({
      status: 'ok',
      message: 'ERP Contable API is running',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'ERP Contable API is running but database is unavailable',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api', (req, res) => {
  res.json({
    message: 'ERP Contable API',
    version: '1.0.0'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', masterRoutes);
app.use('/api', purchaseRoutes);
app.use('/api', salesRoutes);
app.use('/api/sales-flow', salesFlowRoutes);
app.use('/api', accountingRoutes);
app.use('/api', treasuryRoutes);
app.use('/api', fixedAssetRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404
    }
  });
});

export default app;
