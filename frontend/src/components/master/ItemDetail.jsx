import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import masterService from '../../services/masterService';
import Button from '../common/Button';
import Alert from '../common/Alert';

const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const response = await masterService.getItemById(id);
        setItem(response.data);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Error loading item');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
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
        <Alert type="error" message={error} onClose={() => navigate('/items')} />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-slate-500">
        <p>Artículo no encontrado</p>
        <Button variant="secondary" onClick={() => navigate('/items')} className="mt-4">
          Volver a la lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/items')} 
            className="w-10 h-10 rounded-xl glass flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{item.description}</h1>
            <p className="text-slate-500">Código: <span className="font-mono text-primary">{item.code}</span></p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/items')}>
            <span className="material-symbols-outlined">list</span>
            Lista
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">
            Información General
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Código</p>
              <p className="font-mono font-semibold text-primary">{item.code}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Descripción</p>
              <p className="font-semibold text-slate-800">{item.description}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Unidad de Medida</p>
              <p className="text-slate-800">{item.unitOfMeasure}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">
            Coste
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Coste Estándar</p>
              <p className="text-2xl font-bold text-green-600">
                €{parseFloat(item.standardCost).toFixed(2)}
              </p>
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
              <p className="text-slate-800">{new Date(item.createdAt).toLocaleDateString('es-ES')}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Última Actualización</p>
              <p className="text-slate-800">{new Date(item.updatedAt).toLocaleDateString('es-ES')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemDetail;
