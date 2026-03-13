import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import treasuryService from '../../services/treasuryService';
import Button from '../common/Button';
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

const CollectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const response = await treasuryService.getCollectionById(id);
        setCollection(response.data);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Error loading collection');
      } finally {
        setLoading(false);
      }
    };
    fetchCollection();
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
        <Alert type="error" message={error} onClose={() => navigate('/collections')} />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-slate-500">
        <p>Cobro no encontrado</p>
        <Button variant="secondary" onClick={() => navigate('/collections')} className="mt-4">
          Volver a la lista
        </Button>
      </div>
    );
  }

  const getMethodBadgeColor = (method) => {
    const colors = {
      cash: 'bg-green-100 text-green-700',
      bank_transfer: 'bg-blue-100 text-blue-700',
      check: 'bg-yellow-100 text-yellow-700',
      card: 'bg-purple-100 text-purple-700'
    };
    return colors[method] || 'bg-gray-100 text-gray-700';
  };

  const getMethodLabel = (method) => {
    const labels = {
      cash: 'Efectivo (legado)',
      bank_transfer: 'Banco 572',
      check: 'Cheque',
      card: 'Tarjeta'
    };
    return labels[method] || method;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/collections')} 
            className="w-10 h-10 rounded-xl glass flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{collection.collectionNumber}</h1>
            <p className="text-slate-500">Cobro a cliente</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate('/collections')}>
          <span className="material-symbols-outlined">list</span>
          Lista
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">
            Información del Cobro
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Número de Cobro</p>
              <p className="font-mono font-semibold text-primary">{collection.collectionNumber}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Fecha</p>
              <p className="text-white">{formatDate(collection.collectionDate)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Importe</p>
              <p className="text-2xl font-bold text-green-600">
                €{parseFloat(collection.amount).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Método de Pago</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getMethodBadgeColor(collection.paymentMethod)}`}>
                {getMethodLabel(collection.paymentMethod)}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Estado</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                collection.status === 'realized' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {collection.status === 'realized' ? 'Realizado' : 'Pendiente'}
              </span>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">
            Factura Relacionada
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Número de Factura</p>
              <p className="font-mono text-white">{collection.salesInvoice?.invoiceNumber}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">
            Cliente
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Nombre</p>
              <p className="font-semibold text-white">{collection.customer?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {collection.notes && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2 mb-4">
            Notas
          </h3>
          <p className="text-white">{collection.notes}</p>
        </div>
      )}
    </div>
  );
};

export default CollectionDetail;
