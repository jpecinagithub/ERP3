import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import purchaseService from '../../services/purchaseService';
import treasuryService from '../../services/treasuryService';
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

const PaymentList = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [alert, setAlert] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: () => {}, variant: 'primary', confirmText: 'Confirmar' });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await purchaseService.getPurchaseInvoices();
      const pending = response.data.filter(inv => inv.pendingAmount > 0);
      setPurchaseInvoices(pending);
    } catch (error) { console.error(error); }
    try {
      const response = await treasuryService.getPayments();
      setPayments(response.data);
    } catch (error) {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleMarkAsRealized = async (payment) => {
    setConfirmDialog({
      show: true,
      title: 'Realizar pago',
      message: `¿Desea marcar el pago ${payment.paymentNumber} como realizado y contabilizarlo?`,
      variant: 'success',
      confirmText: 'Realizar',
      onConfirm: async () => {
        try {
          await treasuryService.updatePaymentStatus(payment.id, 'realized');
          setAlert({ type: 'success', message: 'Pago realizado y contabilizado' });
          fetchPayments();
        } catch (error) {
          setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Error updating payment status' });
        }
      }
    });
  };

  const columns = [
    { key: 'paymentNumber', header: 'Número', render: (val) => <span className="font-mono text-primary font-bold">{val}</span> },
    { key: 'paymentDate', header: 'Fecha', render: (val) => formatDate(val) },
    { 
      key: 'amount', 
      header: 'Importe',
      render: (val) => <span className="font-mono text-red-400">€{parseFloat(val).toFixed(2)}</span>
    },
    {
      key: 'status',
      header: 'Estado',
      render: (val) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          val === 'realized' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-300'
        }`}>
          {val === 'realized' ? 'Realizado' : 'Pendiente'}
        </span>
      )
    },
    { key: 'paymentMethod', header: 'Método', render: (val) => (
      <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-300 text-sm font-medium">
        {val === 'bank_transfer' ? 'Banco 572' : val === 'check' ? 'Cheque' : val}
      </span>
    )},
    { 
      key: 'purchaseInvoice', 
      header: 'Factura',
      render: (val) => <span className="font-semibold">{val?.invoiceNumber}</span>
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
          {row.status !== 'realized' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleMarkAsRealized(row); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-green-500 transition-colors"
              title="Marcar como realizado"
            >
              <span className="material-symbols-outlined text-lg">task_alt</span>
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
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Pagos</h2>
          <p className="text-slate-400 mt-2 text-lg">Registro de pagos a proveedores</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <span className="material-symbols-outlined">add_circle</span>
          Nuevo Pago
        </Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      <ConfirmDialog
        isOpen={confirmDialog.show}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, show: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
      />

      {loading ? (
        <div className="glass rounded-2xl p-12 text-center text-slate-500">Cargando...</div>
      ) : (
        <Table columns={columns} data={payments} onRowClick={(row) => navigate(`/payments/${row.id}`)} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Pago">
        <PaymentForm
          purchaseInvoices={purchaseInvoices}
          onSave={() => { setShowModal(false); fetchPayments(); }}
          onCancel={() => setShowModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>
    </div>
  );
};

const PaymentForm = ({ purchaseInvoices, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    purchaseInvoiceId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: 'bank_transfer',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await treasuryService.createPayment(formData);
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error creating payment');
    } finally {
      setLoading(false);
    }
  };

  const selectedInvoice = purchaseInvoices.find(inv => inv.id === parseInt(formData.purchaseInvoiceId));

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">Purchase Invoice</label>
        <select
          value={formData.purchaseInvoiceId}
          onChange={(e) => setFormData({ ...formData, purchaseInvoiceId: e.target.value, amount: '' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="">Select invoice</option>
          {purchaseInvoices.map(inv => (
            <option key={inv.id} value={inv.id}>
              {inv.invoiceNumber} - {inv.supplier?.name} (Pending: €{inv.pendingAmount.toFixed(2)})
            </option>
          ))}
        </select>
      </div>
      {selectedInvoice && (
        <p className="mb-4 text-sm text-gray-600">Pending amount: €{selectedInvoice.pendingAmount.toFixed(2)}</p>
      )}
      <Input label="Payment Date" type="date" value={formData.paymentDate} onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })} required />
      <Input label="Amount" type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">Payment Method</label>
        <select
          value={formData.paymentMethod}
          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="bank_transfer">Banco (572)</option>
          <option value="check">Check</option>
        </select>
      </div>
      <Input label="Notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
      
      <div className="flex justify-end space-x-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
};

export default PaymentList;
