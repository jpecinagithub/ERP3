import { useState, useEffect } from 'react';
import salesService from '../../services/salesService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Alert from '../common/Alert';
import ConfirmDialog from '../common/ConfirmDialog';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const SalesBudgetList = () => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [alert, setAlert] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: () => {} });

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const response = await salesService.getSalesBudgets();
      setBudgets(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading sales budgets' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const [customersResponse, itemsResponse] = await Promise.all([
        salesService.getSalesCatalogCustomers(),
        salesService.getSalesCatalogItems()
      ]);
      setCustomers(customersResponse.data);
      setItems(itemsResponse.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading sales catalog' });
    }
  };

  useEffect(() => {
    fetchBudgets();
    fetchCatalog();
  }, []);

  const handleDelete = async (budget) => {
    setConfirmDialog({
      show: true,
      title: 'Eliminar Presupuesto de Venta',
      message: `¿Está seguro de que desea eliminar el presupuesto ${budget.budgetNumber}?`,
      onConfirm: async () => {
        try {
          await salesService.deleteSalesBudget(budget.id);
          setAlert({ type: 'success', message: 'Sales budget deleted' });
          fetchBudgets();
        } catch (error) {
          setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Cannot delete sales budget' });
        }
      }
    });
  };

  const handleConvert = async (budget) => {
    setConfirmDialog({
      show: true,
      title: 'Convertir a Pedido de Venta',
      message: `¿Está seguro de que desea convertir el presupuesto ${budget.budgetNumber} a pedido de venta?`,
      variant: 'success',
      onConfirm: async () => {
        try {
          await salesService.convertSalesBudget(budget.id);
          setAlert({ type: 'success', message: 'Sales budget converted to sales order' });
          fetchBudgets();
        } catch (error) {
          setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Cannot convert sales budget' });
        }
      }
    });
  };

  const handleViewDetails = async (budget) => {
    try {
      const response = await salesService.getSalesBudgetById(budget.id);
      setSelectedBudget(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading sales budget details' });
    }
  };

  const handleEdit = async (budget) => {
    try {
      const response = await salesService.getSalesBudgetById(budget.id);
      setEditingBudget(response.data);
      setShowModal(true);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading sales budget for edit' });
    }
  };

  const columns = [
    { key: 'budgetNumber', header: 'Número', render: (val) => <span className="font-mono text-primary font-bold">{val}</span> },
    { key: 'budgetDate', header: 'Fecha', render: (val) => formatDate(val) },
    {
      key: 'status',
      header: 'Estado',
      render: (val) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          val === 'pending' ? 'bg-slate-500/20 text-slate-400' : val === 'converted' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {val === 'pending' ? 'Pendiente' : val === 'converted' ? 'Convertido' : val}
        </span>
      )
    },
    {
      key: 'totalAmount',
      header: 'Importe',
      render: (val) => <span className="font-mono">€{parseFloat(val).toFixed(2)}</span>
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (val) => <span className="font-semibold">{val?.name}</span>
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
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-blue-500 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleConvert(row); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-green-500 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">swap_horiz</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-red-500 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </>
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
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Presupuestos de Venta</h2>
          <p className="text-slate-400 mt-2 text-lg">Gestión de ofertas y presupuestos a clientes</p>
        </div>
        <Button onClick={() => { setSelectedBudget(null); setShowModal(true); }}>
          <span className="material-symbols-outlined">add_circle</span>
          Nuevo Presupuesto
        </Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <ConfirmDialog
        isOpen={confirmDialog.show}
        onClose={() => setConfirmDialog({ ...confirmDialog, show: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />

      {loading ? (
        <div className="glass rounded-2xl p-12 text-center text-slate-500">Cargando...</div>
      ) : (
        <Table columns={columns} data={budgets} onRowClick={handleViewDetails} />
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingBudget(null); }} title={editingBudget ? 'Editar Presupuesto de Venta' : 'Nuevo Presupuesto de Venta'}>
        <SalesBudgetForm
          customers={customers}
          items={items}
          budget={editingBudget}
          onSave={() => { setShowModal(false); setEditingBudget(null); fetchBudgets(); }}
          onCancel={() => { setShowModal(false); setEditingBudget(null); }}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>

      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`Presupuesto ${selectedBudget?.budgetNumber}`}>
        {selectedBudget && (
          <div>
            <p><strong>Fecha:</strong> {formatDate(selectedBudget.budgetDate)}</p>
            <p><strong>Estado:</strong> {selectedBudget.status}</p>
            <p><strong>Cliente:</strong> {selectedBudget.customer?.name}</p>
            <p><strong>Total:</strong> €{parseFloat(selectedBudget.totalAmount).toFixed(2)}</p>
            <h3 className="font-bold mt-4 mb-2">Líneas</h3>
            <Table
              columns={[
                { key: 'itemCode', header: 'Código' },
                { key: 'itemDescription', header: 'Descripción' },
                { key: 'quantity', header: 'Cant.' },
                { key: 'unitPrice', header: 'Precio', render: (v) => `€${parseFloat(v).toFixed(2)}` },
                { key: 'lineTotal', header: 'Total', render: (v) => `€${parseFloat(v).toFixed(2)}` }
              ]}
              data={selectedBudget.lines || []}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

const SalesBudgetForm = ({ customers, items, budget, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    customerId: '',
    budgetDate: new Date().toISOString().split('T')[0],
    lines: [{ itemId: '', quantity: 1, unitPrice: 0 }]
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (budget) {
      const formatDateForInput = (dateStr) => {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toISOString().split('T')[0];
      };
      setFormData({
        customerId: budget.customer?.id || '',
        budgetDate: formatDateForInput(budget.budgetDate),
        lines: budget.lines?.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice
        })) || [{ itemId: '', quantity: 1, unitPrice: 0 }]
      });
    } else {
      setFormData({
        customerId: '',
        budgetDate: new Date().toISOString().split('T')[0],
        lines: [{ itemId: '', quantity: 1, unitPrice: 0 }]
      });
    }
  }, [budget]);

  const addLine = () => {
    setFormData({ ...formData, lines: [...formData.lines, { itemId: '', quantity: 1, unitPrice: 0 }] });
  };

  const removeLine = (index) => {
    setFormData({ ...formData, lines: formData.lines.filter((_, i) => i !== index) });
  };

  const updateLine = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index][field] = value;
    setFormData({ ...formData, lines: newLines });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const linesData = formData.lines.map((line) => ({
        itemId: parseInt(line.itemId, 10) || 0,
        quantity: parseFloat(line.quantity) || 0,
        unitPrice: parseFloat(line.unitPrice) || 0
      }));

      const dataToSend = {
        customerId: parseInt(formData.customerId, 10) || formData.customerId,
        budgetDate: formData.budgetDate,
        lines: linesData
      };

      if (budget) {
        await salesService.updateSalesBudget(budget.id, dataToSend);
      } else {
        await salesService.createSalesBudget(dataToSend);
      }
      onSave();
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Error al guardar el presupuesto de venta';
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const total = formData.lines.reduce((sum, line) => sum + (Number(line.quantity) * Number(line.unitPrice)), 0);

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-slate-300 text-sm font-bold mb-2">Cliente</label>
        <select
          value={formData.customerId}
          onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          required
        >
          <option value="">Seleccionar cliente</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
        </select>
      </div>
      <Input label="Fecha" type="date" value={formData.budgetDate} onChange={(e) => setFormData({ ...formData, budgetDate: e.target.value })} required />

      <h3 className="font-bold mb-2 text-slate-300">Líneas</h3>
      {formData.lines.map((line, index) => (
        <div key={index} className="flex gap-2 mb-2">
          <select
            value={line.itemId}
            onChange={(e) => updateLine(index, 'itemId', e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          >
            <option value="">Seleccionar artículo</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.code} - {i.description}</option>)}
          </select>
          <Input type="number" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} min="1" className="w-20" />
          <Input type="number" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(index, 'unitPrice', e.target.value)} className="w-24" />
          {formData.lines.length > 1 && <Button type="button" variant="danger" onClick={() => removeLine(index)}>X</Button>}
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addLine} className="mb-4">+ Añadir línea</Button>

      <p className="font-bold mb-4 text-slate-300">Total: €{total.toFixed(2)}</p>

      <div className="flex justify-end space-x-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
};

export default SalesBudgetList;

