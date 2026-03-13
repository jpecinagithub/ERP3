import { useEffect, useState } from 'react';
import fixedAssetService from '../../services/fixedAssetService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Alert from '../common/Alert';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const FixedAssetList = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDepreciationModal, setShowDepreciationModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [alert, setAlert] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const response = await fixedAssetService.getFixedAssets();
      setAssets(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error cargando inmovilizado' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleViewDetails = async (asset) => {
    try {
      const response = await fixedAssetService.getFixedAssetById(asset.id);
      setSelectedAsset(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error cargando detalle del activo' });
    }
  };

  const openDepreciationModal = async (asset) => {
    try {
      const response = await fixedAssetService.getFixedAssetById(asset.id);
      setSelectedAsset(response.data);
      setShowDepreciationModal(true);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error cargando activo para amortizar' });
    }
  };

  const columns = [
    {
      key: 'assetCode',
      header: 'Codigo',
      render: (value) => <span className="font-mono text-primary font-bold">{value}</span>
    },
    { key: 'description', header: 'Descripcion' },
    { key: 'acquisitionDate', header: 'Fecha alta', render: (value) => formatDate(value) },
    {
      key: 'acquisitionValue',
      header: 'Valor alta',
      render: (value) => <span className="font-mono">EUR {parseFloat(value).toFixed(2)}</span>
    },
    {
      key: 'netBookValue',
      header: 'Valor neto',
      render: (value) => <span className="font-mono">EUR {parseFloat(value).toFixed(2)}</span>
    },
    {
      key: 'status',
      header: 'Estado',
      render: (value) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          value === 'active' ? 'bg-green-500/20 text-green-400'
            : value === 'fully_depreciated' ? 'bg-slate-500/20 text-slate-300'
              : 'bg-amber-500/20 text-amber-400'
        }`}>
          {value === 'active' ? 'Activo' : value === 'fully_depreciated' ? 'Amortizado' : value}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); handleViewDetails(row); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
          {row.status === 'active' && (
            <button
              onClick={(e) => { e.stopPropagation(); openDepreciationModal(row); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-amber-400 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">calculate</span>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Inmovilizado</h2>
          <p className="text-slate-400 mt-2 text-lg">Registro de activos y amortizaciones</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <span className="material-symbols-outlined">add_circle</span>
          Nuevo Activo
        </Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {loading ? (
        <div className="glass rounded-2xl p-12 text-center text-slate-500">Cargando...</div>
      ) : (
        <Table columns={columns} data={assets} onRowClick={handleViewDetails} />
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo Activo de Inmovilizado">
        <FixedAssetForm
          onSave={() => {
            setShowCreateModal(false);
            fetchAssets();
            setAlert({ type: 'success', message: 'Activo creado correctamente' });
          }}
          onCancel={() => setShowCreateModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>

      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`Activo ${selectedAsset?.assetCode}`}>
        {selectedAsset && (
          <div>
            <p><strong>Descripcion:</strong> {selectedAsset.description}</p>
            <p><strong>Fecha alta:</strong> {formatDate(selectedAsset.acquisitionDate)}</p>
            <p><strong>Valor alta:</strong> EUR {parseFloat(selectedAsset.acquisitionValue).toFixed(2)}</p>
            <p><strong>Valor residual:</strong> EUR {parseFloat(selectedAsset.residualValue).toFixed(2)}</p>
            <p><strong>Vida util (meses):</strong> {selectedAsset.usefulLifeMonths}</p>
            <p><strong>Amortizacion acumulada:</strong> EUR {parseFloat(selectedAsset.accumulatedDepreciation).toFixed(2)}</p>
            <p><strong>Valor neto:</strong> EUR {parseFloat(selectedAsset.netBookValue).toFixed(2)}</p>
            <p><strong>Cuenta activo:</strong> {selectedAsset.assetAccountCode}</p>
            <p><strong>Cuenta gasto amortizacion:</strong> {selectedAsset.depreciationAccountCode}</p>
            <h3 className="font-bold mt-4 mb-2">Movimientos de amortizacion</h3>
            <Table
              columns={[
                { key: 'depreciationDate', header: 'Fecha', render: (value) => formatDate(value) },
                { key: 'amount', header: 'Importe', render: (value) => `EUR ${parseFloat(value).toFixed(2)}` },
                { key: 'journalEntryId', header: 'Asiento' }
              ]}
              data={selectedAsset.depreciations || []}
            />
          </div>
        )}
      </Modal>

      <Modal isOpen={showDepreciationModal} onClose={() => setShowDepreciationModal(false)} title={`Amortizar ${selectedAsset?.assetCode}`}>
        {selectedAsset && (
          <DepreciationForm
            asset={selectedAsset}
            onSave={() => {
              setShowDepreciationModal(false);
              fetchAssets();
              setAlert({ type: 'success', message: 'Amortizacion registrada correctamente' });
            }}
            onCancel={() => setShowDepreciationModal(false)}
            onError={(message) => setAlert({ type: 'error', message })}
          />
        )}
      </Modal>
    </div>
  );
};

const FixedAssetForm = ({ onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    description: '',
    acquisitionDate: new Date().toISOString().split('T')[0],
    acquisitionValue: '',
    residualValue: 0,
    usefulLifeMonths: 60,
    assetAccountCode: '223',
    depreciationAccountCode: '681',
    purchaseInvoiceId: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fixedAssetService.createFixedAsset({
        ...formData,
        acquisitionValue: Number(formData.acquisitionValue),
        residualValue: Number(formData.residualValue),
        usefulLifeMonths: Number(formData.usefulLifeMonths),
        purchaseInvoiceId: formData.purchaseInvoiceId ? Number(formData.purchaseInvoiceId) : null
      });
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error creando activo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input label="Descripcion" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} required />
      <Input label="Fecha alta" type="date" value={formData.acquisitionDate} onChange={(e) => setFormData((prev) => ({ ...prev, acquisitionDate: e.target.value }))} required />
      <Input label="Valor alta" type="number" step="0.01" value={formData.acquisitionValue} onChange={(e) => setFormData((prev) => ({ ...prev, acquisitionValue: e.target.value }))} required />
      <Input label="Valor residual" type="number" step="0.01" value={formData.residualValue} onChange={(e) => setFormData((prev) => ({ ...prev, residualValue: e.target.value }))} />
      <Input label="Vida util (meses)" type="number" value={formData.usefulLifeMonths} onChange={(e) => setFormData((prev) => ({ ...prev, usefulLifeMonths: e.target.value }))} required />
      <Input label="Cuenta de activo (2xx)" value={formData.assetAccountCode} onChange={(e) => setFormData((prev) => ({ ...prev, assetAccountCode: e.target.value }))} required />
      <Input label="Cuenta de amortizacion (6xx)" value={formData.depreciationAccountCode} onChange={(e) => setFormData((prev) => ({ ...prev, depreciationAccountCode: e.target.value }))} required />
      <Input label="Factura de compra (opcional)" type="number" value={formData.purchaseInvoiceId} onChange={(e) => setFormData((prev) => ({ ...prev, purchaseInvoiceId: e.target.value }))} />

      <div className="flex justify-end space-x-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
};

const DepreciationForm = ({ asset, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    depreciationDate: new Date().toISOString().split('T')[0],
    amount: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fixedAssetService.createDepreciation(asset.id, {
        depreciationDate: formData.depreciationDate,
        amount: formData.amount ? Number(formData.amount) : undefined
      });
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error registrando amortizacion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-slate-300 mb-4">
        Activo: <strong>{asset.assetCode}</strong> - {asset.description}
      </p>
      <Input label="Fecha amortizacion" type="date" value={formData.depreciationDate} onChange={(e) => setFormData((prev) => ({ ...prev, depreciationDate: e.target.value }))} required />
      <Input label="Importe (opcional, vacio = cuota automatica)" type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))} />

      <div className="flex justify-end space-x-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Procesando...' : 'Registrar amortizacion'}</Button>
      </div>
    </form>
  );
};

export default FixedAssetList;
