import { useState, useEffect } from 'react';
import masterService from '../../services/masterService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Alert from '../common/Alert';
import ConfirmDialog from '../common/ConfirmDialog';

const CustomerList = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [alert, setAlert] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: () => {}, variant: 'primary', confirmText: 'Confirmar' });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await masterService.getCustomers(search);
      setCustomers(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading customers' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const handleDelete = async (customer) => {
    setConfirmDialog({
      show: true,
      title: 'Eliminar cliente',
      message: `¿Desea eliminar el cliente ${customer.name}?`,
      variant: 'danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await masterService.deleteCustomer(customer.id);
          setAlert({ type: 'success', message: 'Customer deleted' });
          fetchCustomers();
        } catch (error) {
          setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Cannot delete customer' });
        }
      }
    });
  };

  const columns = [
    { key: 'code', header: 'Code', render: (val) => <span className="font-mono text-primary font-bold">{val}</span> },
    { key: 'name', header: 'Name', render: (val) => <span className="font-semibold">{val}</span> },
    { key: 'taxId', header: 'NIF/CIF' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); setEditingCustomer(row); setShowModal(true); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-red-500 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
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
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Clientes</h2>
          <p className="text-slate-400 mt-2 text-lg">Gestión centralizada de base de datos de clientes</p>
        </div>
        <Button onClick={() => { setEditingCustomer(null); setShowModal(true); }}>
          <span className="material-symbols-outlined">add_circle</span>
          Nuevo Cliente
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <div className="relative w-full md:w-1/3">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">search</span>
          <input
            className="w-full glass rounded-xl pl-12 pr-4 py-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none transition-all"
            placeholder="Buscar por nombre, NIF o email..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
        <Table columns={columns} data={customers} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}>
        <CustomerForm
          customer={editingCustomer}
          onSave={() => { setShowModal(false); fetchCustomers(); }}
          onCancel={() => setShowModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>
    </div>
  );
};

const CustomerForm = ({ customer, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    code: customer?.code || '',
    name: customer?.name || '',
    taxId: customer?.taxId || '',
    address: customer?.address || '',
    phone: customer?.phone || '',
    email: customer?.email || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (customer) {
        await masterService.updateCustomer(customer.id, formData);
      } else {
        await masterService.createCustomer(formData);
      }
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error saving customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input label="Código" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required />
      <Input label="Nombre" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      <Input label="NIF/CIF" value={formData.taxId} onChange={(e) => setFormData({ ...formData, taxId: e.target.value })} />
      <Input label="Dirección" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
      <Input label="Teléfono" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
      <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
      <div className="flex justify-end space-x-2 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
};

export default CustomerList;
