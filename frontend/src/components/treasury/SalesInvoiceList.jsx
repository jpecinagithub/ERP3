import { useState, useEffect } from 'react';
import treasuryService from '../../services/treasuryService';
import salesService from '../../services/salesService';
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

const SalesInvoiceList = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [alert, setAlert] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await treasuryService.getSalesInvoices();
      setInvoices(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading invoices' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await salesService.getSalesCatalogCustomers();
      setCustomers(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchItems = async () => {
    try {
      const response = await salesService.getSalesCatalogItems();
      setItems(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchSalesOrders = async () => {
    try {
      const response = await salesService.getSalesOrders();
      const invoiceable = (response.data || []).filter(
        (order) => !['invoiced', 'cancelled'].includes(order.status)
      );
      setSalesOrders(invoiceable);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchItems();
    fetchSalesOrders();
  }, []);

  const handleViewDetails = async (invoice) => {
    try {
      const response = await treasuryService.getSalesInvoiceById(invoice.id);
      setSelectedInvoice(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading invoice details' });
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedInvoice?.id) return;

    setDownloadingPdf(true);
    try {
      const blob = await treasuryService.downloadSalesInvoicePdf(selectedInvoice.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedInvoice.invoiceNumber || `factura_${selectedInvoice.id}`}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error generating PDF invoice' });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const columns = [
    { key: 'invoiceNumber', header: 'Número', render: (val) => <span className="font-mono text-primary font-bold">{val}</span> },
    {
      key: 'salesOrderNumber',
      header: 'Pedido',
      render: (val) => val ? <span className="font-mono text-blue-400">{val}</span> : <span className="text-slate-500">Sin pedido</span>
    },
    { key: 'invoiceDate', header: 'Fecha', render: (val) => formatDate(val) },
    { key: 'dueDate', header: 'Vencimiento', render: (val) => formatDate(val) },
    { 
      key: 'status', 
      header: 'Estado',
      render: (val) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          val === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : val === 'partially_collected' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
        }`}>
          {val === 'pending' ? 'Pendiente' : val === 'partially_collected' ? 'Parcial' : 'Cobrado'}
        </span>
      )
    },
    { 
      key: 'totalAmount', 
      header: 'Total',
      render: (val) => <span className="font-mono">€{parseFloat(val).toFixed(2)}</span>
    },
    { 
      key: 'paidAmount', 
      header: 'Cobrado',
      render: (val) => <span className="font-mono text-green-400">€{parseFloat(val).toFixed(2)}</span>
    },
    { 
      key: 'pendingAmount', 
      header: 'Pendiente',
      render: (val) => (
        <span className={`font-mono font-bold ${val > 0 ? 'text-red-400' : 'text-green-400'}`}>
          €{parseFloat(val).toFixed(2)}
        </span>
      )
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
        </div>
      )
    }
  ];

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Facturas de Venta</h2>
          <p className="text-slate-400 mt-2 text-lg">Gestión de facturas a clientes</p>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Factura de Venta">
        <SalesInvoiceForm
          customers={customers}
          items={items}
          salesOrders={salesOrders}
          onSave={() => { setShowModal(false); fetchInvoices(); fetchSalesOrders(); }}
          onCancel={() => setShowModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>

      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`Factura ${selectedInvoice?.invoiceNumber}`}>
        {selectedInvoice && (
          <div>
            <p><strong>Fecha:</strong> {formatDate(selectedInvoice.invoiceDate)}</p>
            <p><strong>Pedido:</strong> {selectedInvoice.salesOrderNumber || 'Sin pedido'}</p>
            <p><strong>Vencimiento:</strong> {formatDate(selectedInvoice.dueDate)}</p>
            <p><strong>Estado:</strong> {selectedInvoice.status}</p>
            <p><strong>Cliente:</strong> {selectedInvoice.customer?.name}</p>
            <p><strong>NIF/CIF Cliente:</strong> {selectedInvoice.customer?.taxId || '-'}</p>
            <p><strong>Direccion Cliente:</strong> {selectedInvoice.customer?.address || '-'}</p>
            <p><strong>Telefono Cliente:</strong> {selectedInvoice.customer?.phone || '-'}</p>
            <p><strong>Email Cliente:</strong> {selectedInvoice.customer?.email || '-'}</p>
            <p><strong>Total:</strong> €{parseFloat(selectedInvoice.totalAmount).toFixed(2)}</p>

            <div className="mt-4 mb-4">
              <Button variant="secondary" onClick={handleDownloadPdf} disabled={downloadingPdf}>
                <span className="material-symbols-outlined">download</span>
                {downloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
              </Button>
            </div>

            <h3 className="font-bold mt-4 mb-2">Líneas</h3>
            <Table
              columns={[
                { key: 'itemCode', header: 'Código' },
                { key: 'itemDescription', header: 'Descripción' },
                { key: 'quantity', header: 'Cant.' },
                { key: 'unitPrice', header: 'Precio', render: (v) => `€${parseFloat(v).toFixed(2)}` },
                { key: 'lineTotal', header: 'Importe', render: (v) => `€${parseFloat(v).toFixed(2)}` }
              ]}
              data={selectedInvoice.lines || []}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

const SalesInvoiceForm = ({ customers, items, salesOrders, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    customerId: '',
    salesOrderId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    lines: [{ itemId: '', quantity: 1, unitPrice: 0 }]
  });
  const [loading, setLoading] = useState(false);

  const handleSalesOrderChange = async (orderIdValue) => {
    if (!orderIdValue) {
      setFormData((prev) => ({
        ...prev,
        salesOrderId: '',
        customerId: '',
        lines: [{ itemId: '', quantity: 1, unitPrice: 0 }]
      }));
      return;
    }

    try {
      const orderResponse = await salesService.getSalesOrderById(orderIdValue);
      const order = orderResponse.data;
      setFormData((prev) => ({
        ...prev,
        salesOrderId: order.id,
        customerId: order.customer?.id || '',
        lines: (order.lines || []).map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice
        }))
      }));
    } catch (error) {
      onError(error.response?.data?.error?.message || 'No se pudo cargar el pedido de venta');
    }
  };

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
      await treasuryService.createSalesInvoice({
        ...formData,
        customerId: Number(formData.customerId),
        salesOrderId: formData.salesOrderId ? Number(formData.salesOrderId) : null,
        lines: formData.lines.map((line) => ({
          itemId: Number(line.itemId),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice)
        }))
      });
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
        <label className="block text-gray-700 text-sm font-bold mb-2">Sales Order (optional)</label>
        <select
          value={formData.salesOrderId}
          onChange={(e) => handleSalesOrderChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Manual invoice</option>
          {salesOrders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.orderNumber} - {order.customer?.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">Customer</label>
        <select
          value={formData.customerId}
          onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
          disabled={!!formData.salesOrderId}
        >
          <option value="">Select customer</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <Input label="Invoice Number" value={formData.invoiceNumber} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} required />
      <Input label="Invoice Date" type="date" value={formData.invoiceDate} onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })} required />
      
      <h3 className="font-bold mb-2">Lines</h3>
      {formData.lines.map((line, index) => (
        <div key={index} className="flex gap-2 mb-2">
          <select
            value={line.itemId}
            onChange={(e) => updateLine(index, 'itemId', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            required
            disabled={!!formData.salesOrderId}
          >
            <option value="">Select item</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.code} - {i.description}</option>)}
          </select>
          <Input type="number" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} min="1" className="w-20" disabled={!!formData.salesOrderId} />
          <Input type="number" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(index, 'unitPrice', e.target.value)} className="w-24" disabled={!!formData.salesOrderId} />
          {!formData.salesOrderId && formData.lines.length > 1 && <Button type="button" variant="danger" onClick={() => removeLine(index)}>X</Button>}
        </div>
      ))}
      {!formData.salesOrderId && (
        <Button type="button" variant="secondary" onClick={addLine} className="mb-4">+ Add Line</Button>
      )}
      
      <div className="flex justify-end space-x-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
};

export default SalesInvoiceList;
