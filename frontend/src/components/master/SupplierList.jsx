import { useState, useEffect } from 'react';
import masterService from '../../services/masterService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Alert from '../common/Alert';
import ConfirmDialog from '../common/ConfirmDialog';
import { PageHeader, SearchBar } from '../common/PageHeader';

const SupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [alert, setAlert] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: () => {}, variant: 'primary', confirmText: 'Confirmar' });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const response = await masterService.getSuppliers(search);
      setSuppliers(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading suppliers' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [search]);

  const handleDelete = async (supplier) => {
    setConfirmDialog({
      show: true,
      title: 'Eliminar proveedor',
      message: `¿Desea eliminar el proveedor ${supplier.name}?`,
      variant: 'danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await masterService.deleteSupplier(supplier.id);
          setAlert({ type: 'success', message: 'Supplier deleted' });
          fetchSuppliers();
        } catch (error) {
          setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Cannot delete supplier' });
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
            onClick={(e) => { e.stopPropagation(); setEditingSupplier(row); setShowModal(true); }}
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
      <PageHeader 
        title="Proveedores" 
        subtitle="Gestión de proveedores y distribuidores"
        icon="local_shipping"
        actions={
          <Button onClick={() => { setEditingSupplier(null); setShowModal(true); }}>
            <span className="material-symbols-outlined">add_circle</span>
            Nuevo Proveedor
          </Button>
        }
      />

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por código o nombre..." />
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
        <Table columns={columns} data={suppliers} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}>
        <SupplierForm
          supplier={editingSupplier}
          onSave={() => { setShowModal(false); fetchSuppliers(); }}
          onCancel={() => setShowModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>
    </div>
  );
};

const SupplierForm = ({ supplier, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    code: supplier?.code || '',
    name: supplier?.name || '',
    taxId: supplier?.taxId || '',
    address: supplier?.address || '',
    phone: supplier?.phone || '',
    email: supplier?.email || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (supplier) {
        await masterService.updateSupplier(supplier.id, formData);
      } else {
        await masterService.createSupplier(formData);
      }
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error saving supplier');
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

export default SupplierList;
