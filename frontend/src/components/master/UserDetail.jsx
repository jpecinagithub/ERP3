import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import masterService from '../../services/masterService';
import Button from '../common/Button';
import Alert from '../common/Alert';

const roleLabels = {
  administrador: 'Administrador',
  contabilidad: 'Contabilidad',
  tesoreria: 'Tesorería',
  ventas: 'Ventas',
  compras: 'Compras'
};

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await masterService.getUserById(id);
        setUser(response.data);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Error loading user');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
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
        <Alert type="error" message={error} onClose={() => navigate('/users')} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-slate-500">
        <p>Usuario no encontrado</p>
        <Button variant="secondary" onClick={() => navigate('/users')} className="mt-4">
          Volver a la lista
        </Button>
      </div>
    );
  }

  const getRoleBadgeColor = (role) => {
    const colors = {
      administrador: 'bg-purple-100 text-purple-700',
      contabilidad: 'bg-blue-100 text-blue-700',
      tesoreria: 'bg-green-100 text-green-700',
      ventas: 'bg-cyan-100 text-cyan-700',
      compras: 'bg-orange-100 text-orange-700'
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/users')} 
            className="w-10 h-10 rounded-xl glass flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{user.fullName}</h1>
            <p className="text-slate-500">Username: <span className="font-mono text-primary">{user.username}</span></p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate('/users')}>
          <span className="material-symbols-outlined">list</span>
          Lista
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">
            Información de Usuario
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Username</p>
              <p className="font-mono font-semibold text-primary">{user.username}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Nombre Completo</p>
              <p className="font-semibold text-slate-800">{user.fullName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Rol</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role)}`}>
                {roleLabels[user.role] || user.role}
              </span>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">
            Estado
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Estado</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {user.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">
            Fechas
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Fecha de Creación</p>
              <p className="text-slate-800">{new Date(user.createdAt).toLocaleDateString('es-ES')}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Última Actualización</p>
              <p className="text-slate-800">{new Date(user.updatedAt).toLocaleDateString('es-ES')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetail;
