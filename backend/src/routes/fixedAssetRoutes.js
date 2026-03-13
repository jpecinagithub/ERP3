import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import {
  getFixedAssets,
  getFixedAssetById,
  createFixedAsset,
  createFixedAssetDepreciation
} from '../controllers/fixedAssetController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/fixed-assets', requireRole(['compras', 'contabilidad', 'administrador']), getFixedAssets);
router.get('/fixed-assets/:id', requireRole(['compras', 'contabilidad', 'administrador']), getFixedAssetById);
router.post('/fixed-assets', requireRole(['compras', 'contabilidad', 'administrador']), createFixedAsset);
router.post('/fixed-assets/:id/depreciations', requireRole(['contabilidad', 'administrador']), createFixedAssetDepreciation);

export default router;
