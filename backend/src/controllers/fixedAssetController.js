import { query, beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';
import accountingService from '../services/accountingService.js';
import traceabilityService from '../services/traceabilityService.js';

const getUserId = (req) => (req.user?.id || null);

const buildTempAssetCode = () => (
  `FA-TMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
);

const buildAssetCode = (dateValue, id) => {
  const year = new Date(dateValue || new Date()).getFullYear();
  return `FA-${year}-${String(id).padStart(5, '0')}`;
};

export const getFixedAssets = async (req, res) => {
  try {
    const assets = await query(
      `SELECT
         fa.*,
         pi.invoice_number
       FROM fixed_assets fa
       LEFT JOIN purchase_invoices pi ON pi.id = fa.purchase_invoice_id
       ORDER BY fa.acquisition_date DESC, fa.id DESC`
    );

    res.json({
      success: true,
      data: assets.map((asset) => {
        const acquisitionValue = parseFloat(asset.acquisition_value) || 0;
        const accumulated = parseFloat(asset.accumulated_depreciation) || 0;
        const residual = parseFloat(asset.residual_value) || 0;
        const netBookValue = Math.max(acquisitionValue - accumulated, residual);

        return {
          id: asset.id,
          assetCode: asset.asset_code,
          description: asset.description,
          purchaseInvoiceId: asset.purchase_invoice_id,
          purchaseInvoiceNumber: asset.invoice_number || null,
          acquisitionDate: asset.acquisition_date,
          acquisitionValue,
          residualValue: residual,
          usefulLifeMonths: asset.useful_life_months,
          assetAccountCode: asset.asset_account_code,
          depreciationAccountCode: asset.depreciation_account_code,
          accumulatedDepreciation: accumulated,
          netBookValue,
          status: asset.status
        };
      })
    });
  } catch (error) {
    console.error('Get fixed assets error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching fixed assets',
        status: 500
      }
    });
  }
};

export const getFixedAssetById = async (req, res) => {
  try {
    const { id } = req.params;

    const [asset] = await query(
      `SELECT
         fa.*,
         pi.invoice_number
       FROM fixed_assets fa
       LEFT JOIN purchase_invoices pi ON pi.id = fa.purchase_invoice_id
       WHERE fa.id = ?`,
      [id]
    );

    if (!asset) {
      return res.status(404).json({
        error: {
          message: 'Fixed asset not found',
          status: 404
        }
      });
    }

    const depreciations = await query(
      `SELECT fad.*
       FROM fixed_asset_depreciations fad
       WHERE fad.fixed_asset_id = ?
       ORDER BY fad.depreciation_date DESC, fad.id DESC`,
      [id]
    );

    const acquisitionValue = parseFloat(asset.acquisition_value) || 0;
    const accumulated = parseFloat(asset.accumulated_depreciation) || 0;
    const residual = parseFloat(asset.residual_value) || 0;

    res.json({
      success: true,
      data: {
        id: asset.id,
        assetCode: asset.asset_code,
        description: asset.description,
        purchaseInvoiceId: asset.purchase_invoice_id,
        purchaseInvoiceNumber: asset.invoice_number || null,
        acquisitionDate: asset.acquisition_date,
        acquisitionValue,
        residualValue: residual,
        usefulLifeMonths: asset.useful_life_months,
        assetAccountCode: asset.asset_account_code,
        depreciationAccountCode: asset.depreciation_account_code,
        accumulatedDepreciation: accumulated,
        netBookValue: Math.max(acquisitionValue - accumulated, residual),
        status: asset.status,
        depreciations: depreciations.map((d) => ({
          id: d.id,
          depreciationDate: d.depreciation_date,
          amount: parseFloat(d.amount),
          journalEntryId: d.journal_entry_id
        }))
      }
    });
  } catch (error) {
    console.error('Get fixed asset by id error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while fetching the fixed asset',
        status: 500
      }
    });
  }
};

export const createFixedAsset = async (req, res) => {
  let connection = null;

  try {
    const {
      description,
      purchaseInvoiceId,
      acquisitionDate,
      acquisitionValue,
      residualValue,
      usefulLifeMonths,
      assetAccountCode,
      depreciationAccountCode
    } = req.body;
    const userId = getUserId(req);

    if (!description || !acquisitionDate || acquisitionValue === undefined || !usefulLifeMonths || !assetAccountCode) {
      return res.status(400).json({
        error: {
          message: 'Description, acquisitionDate, acquisitionValue, usefulLifeMonths and assetAccountCode are required',
          status: 400
        }
      });
    }

    const parsedAcquisition = Number(acquisitionValue);
    const parsedResidual = Number(residualValue || 0);
    const parsedUsefulLifeMonths = Number(usefulLifeMonths);

    if (parsedAcquisition < 0 || parsedResidual < 0 || parsedUsefulLifeMonths <= 0) {
      return res.status(400).json({
        error: {
          message: 'Invalid fixed asset values',
          status: 400
        }
      });
    }

    connection = await beginTransaction();

    const temporaryAssetCode = buildTempAssetCode();
    const insertResult = await connection.execute(
      `INSERT INTO fixed_assets
         (asset_code, description, purchase_invoice_id, acquisition_date, acquisition_value, residual_value,
          useful_life_months, asset_account_code, depreciation_account_code, accumulated_depreciation, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?)`,
      [
        temporaryAssetCode,
        description,
        purchaseInvoiceId || null,
        acquisitionDate,
        parsedAcquisition,
        parsedResidual,
        parsedUsefulLifeMonths,
        assetAccountCode,
        depreciationAccountCode || '681',
        userId
      ]
    ).then(([result]) => result);

    const fixedAssetId = insertResult.insertId;
    const assetCode = buildAssetCode(acquisitionDate, fixedAssetId);

    await connection.execute(
      `UPDATE fixed_assets SET asset_code = ? WHERE id = ?`,
      [assetCode, fixedAssetId]
    );

    await traceabilityService.logAction(
      userId,
      'create',
      'fixed_asset',
      fixedAssetId,
      null,
      { assetCode, description, acquisitionDate, acquisitionValue: parsedAcquisition },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Fixed asset created successfully',
      data: {
        id: fixedAssetId,
        assetCode,
        description
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create fixed asset error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while creating the fixed asset',
        status: 500
      }
    });
  }
};

export const createFixedAssetDepreciation = async (req, res) => {
  let connection = null;

  try {
    const { id } = req.params;
    const { depreciationDate, amount } = req.body;
    const userId = getUserId(req);
    const effectiveDate = depreciationDate || new Date().toISOString().split('T')[0];

    connection = await beginTransaction();

    const [asset] = await connection.execute(
      `SELECT * FROM fixed_assets WHERE id = ? FOR UPDATE`,
      [id]
    ).then(([rows]) => rows);

    if (!asset) {
      await rollbackTransaction(connection);
      return res.status(404).json({
        error: {
          message: 'Fixed asset not found',
          status: 404
        }
      });
    }

    if (asset.status !== 'active') {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: `Fixed asset status '${asset.status}' does not allow depreciation`,
          status: 409
        }
      });
    }

    const acquisitionValue = parseFloat(asset.acquisition_value) || 0;
    const residualValue = parseFloat(asset.residual_value) || 0;
    const accumulated = parseFloat(asset.accumulated_depreciation) || 0;
    const depreciableBase = Math.max(acquisitionValue - residualValue, 0);
    const remainingDepreciable = Math.max(depreciableBase - accumulated, 0);

    if (remainingDepreciable <= 0.01) {
      await rollbackTransaction(connection);
      return res.status(409).json({
        error: {
          message: 'No remaining depreciable amount for this fixed asset',
          status: 409
        }
      });
    }

    const monthlyAmount = asset.useful_life_months > 0
      ? (depreciableBase / Number(asset.useful_life_months))
      : remainingDepreciable;
    const depreciationAmount = amount === undefined || amount === null
      ? monthlyAmount
      : Number(amount);

    if (!Number.isFinite(depreciationAmount) || depreciationAmount <= 0) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: 'Depreciation amount must be greater than zero',
          status: 400
        }
      });
    }

    if (depreciationAmount > remainingDepreciable + 0.01) {
      await rollbackTransaction(connection);
      return res.status(400).json({
        error: {
          message: `Depreciation amount exceeds remaining depreciable amount (${remainingDepreciable.toFixed(2)})`,
          status: 400
        }
      });
    }

    const journalEntryId = await accountingService.generateFixedAssetDepreciationEntry(
      Number(id),
      effectiveDate,
      depreciationAmount,
      userId,
      connection
    );

    await connection.execute(
      `INSERT INTO fixed_asset_depreciations
         (fixed_asset_id, depreciation_date, amount, journal_entry_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, effectiveDate, depreciationAmount, journalEntryId, userId]
    );

    const nextAccumulated = accumulated + depreciationAmount;
    const nextStatus = nextAccumulated >= depreciableBase - 0.01
      ? 'fully_depreciated'
      : 'active';

    await connection.execute(
      `UPDATE fixed_assets
       SET accumulated_depreciation = ?, status = ?
       WHERE id = ?`,
      [nextAccumulated, nextStatus, id]
    );

    await traceabilityService.createDocumentLink(
      'fixed_asset',
      'journal_entry',
      Number(id),
      journalEntryId,
      'generated',
      connection
    );

    await traceabilityService.logAction(
      userId,
      'depreciate',
      'fixed_asset',
      Number(id),
      { accumulatedDepreciation: accumulated, status: asset.status },
      { accumulatedDepreciation: nextAccumulated, status: nextStatus, depreciationAmount },
      connection
    );

    await commitTransaction(connection);

    res.status(201).json({
      success: true,
      message: 'Fixed asset depreciation posted successfully',
      data: {
        fixedAssetId: Number(id),
        depreciationDate: effectiveDate,
        amount: depreciationAmount,
        journalEntryId,
        accumulatedDepreciation: nextAccumulated,
        status: nextStatus
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('Create fixed asset depreciation error:', error);
    res.status(500).json({
      error: {
        message: 'An error occurred while posting fixed asset depreciation',
        status: 500
      }
    });
  }
};

export default {
  getFixedAssets,
  getFixedAssetById,
  createFixedAsset,
  createFixedAssetDepreciation
};
