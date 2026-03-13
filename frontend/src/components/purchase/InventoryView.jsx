import { useState, useEffect } from 'react';
import purchaseService from '../../services/purchaseService';
import masterService from '../../services/masterService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Alert from '../common/Alert';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const buildMovementReference = (movement) => {
  if (!movement?.sourceDocumentType) return '-';
  const id = movement.sourceDocumentId ? ` #${movement.sourceDocumentId}` : '';
  const labels = {
    purchase_invoice: 'Factura compra',
    sales_invoice: 'Factura venta',
    adjustment: 'Ajuste',
    purchase_order: 'Pedido compra',
    sales_order: 'Pedido venta'
  };
  return `${labels[movement.sourceDocumentType] || movement.sourceDocumentType}${id}`;
};

const InventoryView = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [items, setItems] = useState([]);
  const [movementFilters, setMovementFilters] = useState({
    itemId: '',
    startDate: '',
    endDate: ''
  });
  const [alert, setAlert] = useState(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await purchaseService.getInventory();
      setInventory(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading inventory' });
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await masterService.getItems();
      setItems(response.data || []);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading items' });
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchItems();
  }, []);

  const fetchMovements = async (itemId, startDate = '', endDate = '') => {
    setLoadingMovements(true);
    try {
      const response = await purchaseService.getInventoryMovements(itemId, startDate || undefined, endDate || undefined);
      setMovements(response.data || []);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading movement history' });
    } finally {
      setLoadingMovements(false);
    }
  };

  const handleViewMovements = async (item) => {
    setSelectedItem(item);
    setMovementFilters({
      itemId: String(item.id),
      startDate: '',
      endDate: ''
    });
    setShowMovementsModal(true);
    await fetchMovements(item.id);
  };

  const handleOpenHistory = () => {
    setSelectedItem(null);
    setMovementFilters({ itemId: '', startDate: '', endDate: '' });
    setShowMovementsModal(true);
    void fetchMovements(undefined);
  };

  const handleFilterMovements = async () => {
    const itemId = movementFilters.itemId ? Number(movementFilters.itemId) : undefined;
    const item = items.find((it) => it.id === itemId) || inventory.find((inv) => inv.id === itemId) || null;
    setSelectedItem(item);
    await fetchMovements(itemId, movementFilters.startDate, movementFilters.endDate);
  };

  const columns = [
    { key: 'code', header: 'Código', render: (val) => <span className="font-mono text-slate-100 font-bold">{val}</span> },
    { key: 'description', header: 'Descripción', render: (val) => <span className="font-semibold text-slate-100">{val}</span> },
    { key: 'unitOfMeasure', header: 'Unidad' },
    { 
      key: 'currentStock', 
      header: 'Stock',
      render: (val) => (
        <span className={`font-mono font-bold ${val < 10 ? 'text-red-400' : ''}`}>
          {val}
        </span>
      )
    },
    { 
      key: 'averageUnitCost', 
      header: 'Coste Medio',
      render: (val) => <span className="font-mono">€{parseFloat(val || 0).toFixed(2)}</span>
    },
    { 
      key: 'currentValue', 
      header: 'Valor',
      render: (val) => <span className="font-mono">€{parseFloat(val || 0).toFixed(2)}</span>
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); handleViewMovements(row); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">history</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setSelectedItem(row); setShowAdjustModal(true); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-blue-500 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Inventario</h2>
          <p className="text-slate-400 mt-2 text-lg">Control de stock y movimientos de inventario</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleOpenHistory}>
            <span className="material-symbols-outlined">history</span>
            Histórico movimientos
          </Button>
          <Button onClick={fetchInventory}>
            <span className="material-symbols-outlined">refresh</span>
            Actualizar
          </Button>
        </div>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {loading ? (
        <div className="glass rounded-2xl p-12 text-center text-slate-500">Cargando...</div>
      ) : (
        <Table columns={columns} data={inventory} />
      )}

      <Modal isOpen={showAdjustModal} onClose={() => setShowAdjustModal(false)} title={`Ajustar Stock: ${selectedItem?.code || ''}`}>
        <InventoryAdjustmentForm
          item={selectedItem}
          onSave={() => { setShowAdjustModal(false); fetchInventory(); }}
          onCancel={() => setShowAdjustModal(false)}
          onError={(message, type = 'error') => setAlert({ type, message })}
        />
      </Modal>

      <Modal
        isOpen={showMovementsModal}
        onClose={() => setShowMovementsModal(false)}
        title={`Histórico de movimientos${selectedItem ? `: ${selectedItem.code}` : ''}`}
        size="full"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-300 block mb-2">Artículo</label>
              <select
                value={movementFilters.itemId}
                onChange={(e) => setMovementFilters((prev) => ({ ...prev, itemId: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Seleccionar artículo</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.description}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Desde"
              type="date"
              value={movementFilters.startDate}
              onChange={(e) => setMovementFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="mb-0"
            />
            <Input
              label="Hasta"
              type="date"
              value={movementFilters.endDate}
              onChange={(e) => setMovementFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="mb-0"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleFilterMovements}>
              <span className="material-symbols-outlined">search</span>
              Consultar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setMovementFilters({ itemId: '', startDate: '', endDate: '' });
                setSelectedItem(null);
                void fetchMovements(undefined);
              }}
            >
              Limpiar
            </Button>
          </div>

          {loadingMovements ? (
            <div className="glass rounded-2xl p-8 text-center text-slate-500">Cargando movimientos...</div>
          ) : (
            <Table
              columns={[
                { key: 'movementDate', header: 'Fecha', render: (v) => formatDate(v) },
                {
                  key: 'movementType',
                  header: 'Tipo',
                  render: (v) => (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${v === 'inbound' ? 'bg-green-500/20 text-green-400' : v === 'outbound' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-300'}`}>
                      {v === 'inbound' ? 'Entrada' : v === 'outbound' ? 'Salida' : 'Ajuste'}
                    </span>
                  )
                },
                {
                  key: 'quantity',
                  header: 'Cant.',
                  render: (v) => <span className={`font-mono ${parseFloat(v) >= 0 ? 'text-green-300' : 'text-red-300'}`}>{parseFloat(v)}</span>
                },
                { key: 'unitCost', header: 'Coste', render: (v) => v !== null && v !== undefined ? `€${parseFloat(v).toFixed(2)}` : '-' },
                { key: 'totalValue', header: 'Valor', render: (v) => v !== null && v !== undefined ? `€${parseFloat(v).toFixed(2)}` : '-' },
                { key: 'reference', header: 'Referencia', render: (_, row) => buildMovementReference(row) },
                { key: 'notes', header: 'Observaciones', render: (v) => v || '-' }
              ]}
              data={movements}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

const InventoryAdjustmentForm = ({ item, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    itemId: item?.id,
    adjustmentQuantity: 0,
    justification: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData(prev => ({ ...prev, itemId: item?.id }));
  }, [item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(formData.adjustmentQuantity) === 0) {
      onError('Adjustment quantity cannot be 0', 'warning');
      return;
    }
    setLoading(true);
    try {
      await purchaseService.createInventoryAdjustment(formData);
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error creating adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-4"><strong>Current Stock:</strong> {item?.currentStock}</p>
      <Input
        label="Adjustment Quantity"
        type="number"
        value={formData.adjustmentQuantity}
        onChange={(e) => setFormData({ ...formData, adjustmentQuantity: Number(e.target.value) })}
        hint="Positive to add, negative to subtract"
        required
      />
      <Input
        label="Justification"
        value={formData.justification}
        onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
        required
      />
      <div className="flex justify-end space-x-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
};

export default InventoryView;
