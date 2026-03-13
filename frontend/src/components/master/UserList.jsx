import { useState, useEffect } from 'react';
import masterService from '../../services/masterService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Alert from '../common/Alert';
import ConfirmDialog from '../common/ConfirmDialog';

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [alert, setAlert] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: () => {}, variant: 'primary', confirmText: 'Confirmar' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await masterService.getUsers(search);
      setUsers(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleDeactivate = async (user) => {
    setConfirmDialog({
      show: true,
      title: 'Desactivar usuario',
      message: `¿Desea desactivar al usuario ${user.username}?`,
      variant: 'danger',
      confirmText: 'Desactivar',
      onConfirm: async () => {
        try {
          await masterService.deactivateUser(user.id);
          setAlert({ type: 'success', message: 'User deactivated' });
          fetchUsers();
        } catch (error) {
          setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Cannot deactivate user' });
        }
      }
    });
  };

  const columns = [
    { key: 'username', header: 'Usuario', render: (val) => <span className="font-mono text-primary font-bold">{val}</span> },
    { key: 'fullName', header: 'Nombre', render: (val) => <span className="font-semibold">{val}</span> },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Rol' },
    { 
      key: 'isActive', 
      header: 'Estado',
      render: (val) => val ? <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">Activo</span> : <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm font-medium">Inactivo</span>
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); setEditingUser(row); setShowModal(true); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
          {row.isActive && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeactivate(row); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-red-500 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">block</span>
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
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Usuarios</h2>
          <p className="text-slate-400 mt-2 text-lg">Gestión de usuarios y permisos del sistema</p>
        </div>
        <Button onClick={() => { setEditingUser(null); setShowModal(true); }}>
          <span className="material-symbols-outlined">add_circle</span>
          Nuevo Usuario
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <div className="relative w-full md:w-1/3">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">search</span>
          <input
            className="w-full glass rounded-xl pl-12 pr-4 py-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none transition-all"
            placeholder="Buscar por nombre de usuario..."
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
        <Table columns={columns} data={users} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <UserForm
          user={editingUser}
          onSave={() => { setShowModal(false); fetchUsers(); }}
          onCancel={() => setShowModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>
    </div>
  );
};

const UserForm = ({ user, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: '',
    fullName: user?.fullName || '',
    email: user?.email || '',
    role: user?.role || 'compras'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (user) {
        const { password, ...updateData } = formData;
        await masterService.updateUser(user.id, password ? formData : updateData);
      } else {
        await masterService.createUser(formData);
      }
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error saving user');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: 'compras', label: 'Compras' },
    { value: 'ventas', label: 'Ventas' },
    { value: 'contabilidad', label: 'Contabilidad' },
    { value: 'tesoreria', label: 'Tesorería' },
    { value: 'administrador', label: 'Administrador' }
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Input label="Username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required disabled={!!user} />
      {!user && <Input label="Password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />}
      <Input label="Full Name" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
      <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">Role</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="flex justify-end space-x-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
};

export default UserList;
