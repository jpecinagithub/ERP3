import { useState, useEffect } from 'react';
import masterService from '../../services/masterService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Alert from '../common/Alert';
import ConfirmDialog from '../common/ConfirmDialog';
import { PageHeader, SearchBar } from '../common/PageHeader';

const ItemList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [alert, setAlert] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: () => {}, variant: 'primary', confirmText: 'Confirmar' });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await masterService.getItems(search);
      setItems(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading items' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [search]);

  const handleDelete = async (item) => {
    setConfirmDialog({
      show: true,
      title: 'Eliminar artículo',
      message: `¿Desea eliminar el artículo ${item.code}?`,
      variant: 'danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await masterService.deleteItem(item.id);
          setAlert({ type: 'success', message: 'Item deleted' });
          fetchItems();
        } catch (error) {
          setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Cannot delete item' });
        }
      }
    });
  };

  const columns = [
    { key: 'code', header: 'Code', render: (val) => <span className="font-mono text-primary font-bold">{val}</span> },
    { key: 'description', header: 'Description', render: (val) => <span className="font-semibold">{val}</span> },
    { key: 'unitOfMeasure', header: 'Unit' },
    { key: 'standardCost', header: 'Price', render: (val) => `€${parseFloat(val).toFixed(2)}` },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); setEditingItem(row); setShowModal(true); }}
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
        title="Artículos" 
        subtitle="Gestión de inventario de productos"
        icon="category"
        actions={
          <Button onClick={() => { setEditingItem(null); setShowModal(true); }}>
            <span className="material-symbols-outlined">add_circle</span>
            Nuevo Artículo
          </Button>
        }
      />

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por código o descripción..." />
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
        <Table columns={columns} data={items} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingItem ? 'Editar Artículo' : 'Nuevo Artículo'}>
        <ItemForm
          item={editingItem}
          onSave={() => { setShowModal(false); fetchItems(); }}
          onCancel={() => setShowModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>
    </div>
  );
};

const ItemForm = ({ item, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    code: item?.code || '',
    description: item?.description || '',
    unitOfMeasure: item?.unitOfMeasure || '',
    standardCost: item?.standardCost || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) {
        await masterService.updateItem(item.id, formData);
      } else {
        await masterService.createItem(formData);
      }
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error saving item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input label="Código" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required />
      <Input label="Descripción" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
      <Input label="Unidad de Medida" value={formData.unitOfMeasure} onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })} required />
      <Input label="Precio" type="number" step="0.01" value={formData.standardCost} onChange={(e) => setFormData({ ...formData, standardCost: e.target.value })} required />
      <div className="flex justify-end space-x-2 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
};

export default ItemList;
