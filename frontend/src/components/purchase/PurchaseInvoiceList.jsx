import { useState, useEffect } from 'react';
import purchaseService from '../../services/purchaseService';
import masterService from '../../services/masterService';
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

const PurchaseInvoiceList = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [alert, setAlert] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await purchaseService.getPurchaseInvoices();
      setInvoices(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading invoices' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await masterService.getSuppliers();
      setSuppliers(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchItems = async () => {
    try {
      const response = await masterService.getItems();
      setItems(response.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    fetchInvoices();
    fetchSuppliers();
    fetchItems();
  }, []);

  const handleViewDetails = async (invoice) => {
    try {
      const response = await purchaseService.getPurchaseInvoiceById(invoice.id);
      setSelectedInvoice(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading invoice details' });
    }
  };

  const columns = [
    { key: 'invoiceNumber', header: 'Número', render: (val) => <span className="font-mono text-primary font-bold">{val}</span> },
    { key: 'invoiceDate', header: 'Fecha', render: (val) => formatDate(val) },
    {
      key: 'invoiceType',
      header: 'Tipo',
      render: (val) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          val === 'mercaderia' ? 'bg-blue-500/20 text-blue-400'
            : val === 'inmovilizado' ? 'bg-purple-500/20 text-purple-400'
              : 'bg-amber-500/20 text-amber-400'
        }`}>
          {val === 'mercaderia' ? 'Mercadería' : val === 'inmovilizado' ? 'Inmovilizado' : 'Gasto'}
        </span>
      )
    },
    { key: 'dueDate', header: 'Vencimiento', render: (val) => formatDate(val) },
    { 
      key: 'status', 
      header: 'Estado',
      render: (val) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          val === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : val === 'partially_paid' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
        }`}>
          {val === 'pending' ? 'Pendiente' : val === 'partially_paid' ? 'Parcial' : 'Pagado'}
        </span>
      )
    },
    { 
      key: 'totalAmount', 
      header: 'Importe',
      render: (val) => <span className="font-mono">€{parseFloat(val).toFixed(2)}</span>
    },
    { 
      key: 'supplier', 
      header: 'Proveedor',
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
        </div>
      )
    }
  ];

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Facturas de Compra</h2>
          <p className="text-slate-400 mt-2 text-lg">Gestión de facturas de proveedores</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <span className="material-symbols-outlined">add_circle</span>
          Nueva Factura
        </Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {loading ? (
        <div className="glass rounded-2xl p-12 text-center text-slate-500">Cargando...</div>
      ) : (
        <Table columns={columns} data={invoices} onRowClick={handleViewDetails} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Factura de Compra">
        <PurchaseInvoiceForm
          suppliers={suppliers}
          items={items}
          onSave={() => { setShowModal(false); fetchInvoices(); }}
          onCancel={() => setShowModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>

      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`Factura ${selectedInvoice?.invoiceNumber}`}>
        {selectedInvoice && (
          <div>
            <p><strong>Fecha:</strong> {formatDate(selectedInvoice.invoiceDate)}</p>
            <p><strong>Tipo:</strong> {selectedInvoice.invoiceType || 'mercaderia'}</p>
            <p><strong>Vencimiento:</strong> {formatDate(selectedInvoice.dueDate)}</p>
            <p><strong>Estado:</strong> {selectedInvoice.status}</p>
            <p><strong>Proveedor:</strong> {selectedInvoice.supplier?.name}</p>
            <p><strong>Total:</strong> €{parseFloat(selectedInvoice.totalAmount).toFixed(2)}</p>
            <h3 className="font-bold mt-4 mb-2">Líneas</h3>
            <Table
              columns={[
                { key: 'itemCode', header: 'Código', render: (v) => v || '-' },
                { key: 'itemDescription', header: 'Descripción' },
                { key: 'quantity', header: 'Cant.' },
                { key: 'unitPrice', header: 'Precio', render: (v) => `€${parseFloat(v).toFixed(2)}` }
              ]}
              data={selectedInvoice.lines || []}
            />
            {(selectedInvoice.fixedAssets || []).length > 0 && (
              <>
                <h3 className="font-bold mt-4 mb-2">Activos generados</h3>
                <Table
                  columns={[
                    { key: 'assetCode', header: 'Código' },
                    { key: 'description', header: 'Descripción' },
                    { key: 'acquisitionValue', header: 'Valor', render: (v) => `€${parseFloat(v).toFixed(2)}` },
                    { key: 'status', header: 'Estado' }
                  ]}
                  data={selectedInvoice.fixedAssets}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const PurchaseInvoiceForm = ({ suppliers, items, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    supplierId: '',
    invoiceNumber: '',
    invoiceType: 'mercaderia',
    assetAccountCode: '223',
    expenseAccountCode: '621',
    usefulLifeMonths: 60,
    invoiceDate: new Date().toISOString().split('T')[0],
    lines: [{ itemId: '', lineDescription: '', quantity: 1, unitPrice: 0 }]
  });
  const [loading, setLoading] = useState(false);

  const addLine = () => {
    setFormData({ ...formData, lines: [...formData.lines, { itemId: '', lineDescription: '', quantity: 1, unitPrice: 0 }] });
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
    if (formData.invoiceType === 'inmovilizado') {
      const missingDescription = formData.lines.some((line) => !String(line.lineDescription || '').trim());
      if (missingDescription) {
        onError('En inmovilizado cada línea requiere una descripción manual.');
        return;
      }
    }
    setLoading(true);
    try {
      await purchaseService.createPurchaseInvoice(formData);
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error creating invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">Supplier</label>
        <select
          value={formData.supplierId}
          onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="">Select supplier</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <Input label="Invoice Number" value={formData.invoiceNumber} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} required />
      <Input label="Invoice Date" type="date" value={formData.invoiceDate} onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })} required />
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">Invoice Type</label>
        <select
          value={formData.invoiceType}
          onChange={(e) => setFormData({ ...formData, invoiceType: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="mercaderia">Mercaderia</option>
          <option value="inmovilizado">Inmovilizado</option>
          <option value="gasto">Gasto</option>
        </select>
      </div>
      {formData.invoiceType === 'inmovilizado' && (
        <>
          <Input
            label="Asset Account Code"
            value={formData.assetAccountCode}
            onChange={(e) => setFormData({ ...formData, assetAccountCode: e.target.value })}
            required
          />
          <Input
            label="Useful Life Months"
            type="number"
            min="1"
            value={formData.usefulLifeMonths}
            onChange={(e) => setFormData({ ...formData, usefulLifeMonths: e.target.value })}
            required
          />
        </>
      )}
      {formData.invoiceType === 'gasto' && (
        <Input
          label="Expense Account Code"
          value={formData.expenseAccountCode}
          onChange={(e) => setFormData({ ...formData, expenseAccountCode: e.target.value })}
          required
        />
      )}
      
      <h3 className="font-bold mb-2">Lines</h3>
      {formData.lines.map((line, index) => (
        <div key={index} className="flex gap-2 mb-2">
          {formData.invoiceType === 'inmovilizado' ? (
            <input
              type="text"
              value={line.lineDescription || ''}
              onChange={(e) => updateLine(index, 'lineDescription', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Descripción manual del activo"
              required
            />
          ) : (
            <select
              value={line.itemId}
              onChange={(e) => updateLine(index, 'itemId', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">Select item</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.code} - {i.description}</option>)}
            </select>
          )}
          <Input type="number" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} min="1" className="w-20" />
          <Input type="number" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(index, 'unitPrice', e.target.value)} className="w-24" />
          {formData.lines.length > 1 && <Button type="button" variant="danger" onClick={() => removeLine(index)}>X</Button>}
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addLine} className="mb-4">+ Add Line</Button>
      
      <div className="flex justify-end space-x-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
};

export default PurchaseInvoiceList;
