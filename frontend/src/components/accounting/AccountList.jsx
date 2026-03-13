import { useState, useEffect } from 'react';
import accountingService from '../../services/accountingService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Alert from '../common/Alert';
import ConfirmDialog from '../common/ConfirmDialog';

const AccountList = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [alert, setAlert] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: () => {}, variant: 'primary', confirmText: 'Confirmar' });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await accountingService.getAccounts(search);
      setAccounts(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading accounts' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [search]);

  const handleDelete = async (account) => {
    setConfirmDialog({
      show: true,
      title: 'Eliminar cuenta',
      message: `¿Desea eliminar la cuenta ${account.code}?`,
      variant: 'danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await accountingService.deleteAccount(account.id);
          setAlert({ type: 'success', message: 'Account deleted' });
          fetchAccounts();
        } catch (error) {
          setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Cannot delete account' });
        }
      }
    });
  };

  const columns = [
    { key: 'code', header: 'Código', render: (val) => <span className="font-mono text-primary font-bold">{val}</span> },
    { key: 'name', header: 'Nombre', render: (val) => <span className="font-semibold">{val}</span> },
    { key: 'accountType', header: 'Tipo' },
    { 
      key: 'balance', 
      header: 'Saldo',
      render: (val) => <span className="font-mono">€{parseFloat(val || 0).toFixed(2)}</span>
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); setEditingAccount(row); setShowModal(true); }}
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
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Plan de Cuentas</h2>
          <p className="text-slate-400 mt-2 text-lg">Catálogo de cuentas contables</p>
        </div>
        <Button onClick={() => { setEditingAccount(null); setShowModal(true); }}>
          <span className="material-symbols-outlined">add_circle</span>
          Nueva Cuenta
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <div className="relative w-full md:w-1/3">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">search</span>
          <input
            className="w-full glass rounded-xl pl-12 pr-4 py-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none transition-all"
            placeholder="Buscar por código o nombre..."
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
        <Table columns={columns} data={accounts} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}>
        <AccountForm
          account={editingAccount}
          onSave={() => { setShowModal(false); fetchAccounts(); }}
          onCancel={() => setShowModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>
    </div>
  );
};

const AccountForm = ({ account, onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    code: account?.code || '',
    name: account?.name || '',
    accountType: account?.accountType || 'asset',
    allowMovements: account?.allowMovements !== false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (account) {
        await accountingService.updateAccount(account.id, formData);
      } else {
        await accountingService.createAccount(formData);
      }
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error saving account');
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { value: 'asset', label: 'Asset' },
    { value: 'liability', label: 'Liability' },
    { value: 'equity', label: 'Equity' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'expense', label: 'Expense' }
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Input label="Code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required disabled={!!account} />
      <Input label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">Account Type</label>
        <select
          value={formData.accountType}
          onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.allowMovements}
            onChange={(e) => setFormData({ ...formData, allowMovements: e.target.checked })}
            className="mr-2"
          />
          Allow Movements
        </label>
      </div>
      <div className="flex justify-end space-x-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
};

export default AccountList;
