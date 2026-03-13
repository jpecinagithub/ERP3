import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import accountingService from '../../services/accountingService';
import Table from '../common/Table';
import Button from '../common/Button';
import Alert from '../common/Alert';

const AccountDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const response = await accountingService.getAccountById(id);
        setAccount(response.data);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Error loading account');
      } finally {
        setLoading(false);
      }
    };
    fetchAccount();
  }, [id]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-slate-500">
        <span className="material-symbols-outlined text-4xl animate-spin">sync</span>
        <p className="mt-4">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <Alert type="error" message={error} onClose={() => navigate('/accounts')} />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-slate-500">
        <p>Cuenta no encontrada</p>
        <Button variant="secondary" onClick={() => navigate('/accounts')} className="mt-4">
          Volver a la lista
        </Button>
      </div>
    );
  }

  const getTypeBadgeColor = (type) => {
    const colors = {
      asset: 'bg-blue-100 text-blue-700',
      liability: 'bg-red-100 text-red-700',
      equity: 'bg-purple-100 text-purple-700',
      revenue: 'bg-green-100 text-green-700',
      expense: 'bg-orange-100 text-orange-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getTypeLabel = (type) => {
    const labels = {
      asset: 'Activo',
      liability: 'Pasivo',
      equity: 'Patrimonio',
      revenue: 'Ingreso',
      expense: 'Gasto'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/accounts')} 
            className="w-10 h-10 rounded-xl glass flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{account.name}</h1>
            <p className="text-slate-500">Código: <span className="font-mono text-primary">{account.code}</span></p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate('/accounts')}>
          <span className="material-symbols-outlined">list</span>
          Lista
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">
            Cuenta Contable
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Código</p>
              <p className="font-mono font-semibold text-primary text-xl">{account.code}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Nombre</p>
              <p className="font-semibold text-slate-800">{account.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Tipo</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getTypeBadgeColor(account.accountType)}`}>
                {getTypeLabel(account.accountType)}
              </span>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">
            Saldo
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Saldo Actual</p>
              <p className={`text-2xl font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{parseFloat(account.balance).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">
            Estado
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Activa</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${account.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {account.isActive ? 'Sí' : 'No'}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Permite Movimientos</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${account.allowMovements ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {account.allowMovements ? 'Sí' : 'No'}
              </span>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">
            Cuenta Padre
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">ID Padre</p>
              <p className="text-slate-800">{account.parentId || 'Sin padre'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountDetail;
