import { useState, useEffect } from 'react';
import accountingService from '../../services/accountingService';
import { useAuth } from '../../context/AuthContext';
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

const FiscalPeriodManager = () => {
  const { hasRole } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [alert, setAlert] = useState(null);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [reopenJustification, setReopenJustification] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: () => {}, variant: 'primary', confirmText: 'Confirmar' });

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const response = await accountingService.getFiscalPeriods();
      setPeriods(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading fiscal periods' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleClose = async (period) => {
    setConfirmDialog({
      show: true,
      title: 'Cerrar período',
      message: `¿Desea cerrar el período ${period.year}-${period.periodNumber}?`,
      variant: 'danger',
      confirmText: 'Cerrar',
      onConfirm: async () => {
        try {
          await accountingService.closeFiscalPeriod(period.id);
          setAlert({ type: 'success', message: 'Period closed successfully' });
          fetchPeriods();
        } catch (error) {
          setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Error closing period' });
        }
      }
    });
  };

  const handleReopen = (period) => {
    setSelectedPeriod(period);
    setShowReopenModal(true);
  };

  const confirmReopen = async () => {
    if (!reopenJustification) {
      setAlert({ type: 'error', message: 'Justification is required' });
      return;
    }
    try {
      await accountingService.reopenFiscalPeriod(selectedPeriod.id, reopenJustification);
      setAlert({ type: 'success', message: 'Period reopened successfully' });
      setShowReopenModal(false);
      setReopenJustification('');
      setSelectedPeriod(null);
      fetchPeriods();
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Error reopening period' });
    }
  };

  const columns = [
    { key: 'year', header: 'Año' },
    { key: 'periodNumber', header: 'Período' },
    { key: 'startDate', header: 'Fecha Inicio', render: (val) => formatDate(val) },
    { key: 'endDate', header: 'Fecha Fin', render: (val) => formatDate(val) },
    { 
      key: 'status', 
      header: 'Estado',
      render: (val) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          val === 'open' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {val === 'open' ? 'Abierto' : 'Cerrado'}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.status === 'open' && hasRole(['contabilidad', 'administrador']) && (
            <Button variant="secondary" onClick={() => handleClose(row)}>
              Cerrar
            </Button>
          )}
          {row.status === 'closed' && hasRole(['contabilidad', 'administrador']) && (
            <Button variant="primary" onClick={() => handleReopen(row)}>
              Reabrir
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Períodos Fiscales</h2>
          <p className="text-slate-400 mt-2">Gestión de períodos contables</p>
        </div>
        {hasRole(['contabilidad', 'administrador']) && (
          <Button onClick={() => setShowModal(true)}>
            <span className="material-symbols-outlined">add_circle</span>
            Nuevo Período
          </Button>
        )}
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
        <Table columns={columns} data={periods} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Período Fiscal">
        <FiscalPeriodForm
          onSave={() => { setShowModal(false); fetchPeriods(); }}
          onCancel={() => setShowModal(false)}
          onError={(message) => setAlert({ type: 'error', message })}
        />
      </Modal>

      <Modal isOpen={showReopenModal} onClose={() => setShowReopenModal(false)} title="Reabrir Período">
        <div className="space-y-4">
          <p className="text-slate-600">
            Período: {selectedPeriod?.year}-{selectedPeriod?.periodNumber}
          </p>
          <Input
            label="Justificación"
            value={reopenJustification}
            onChange={(e) => setReopenJustification(e.target.value)}
            placeholder="Motivo de la reapertura..."
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowReopenModal(false)}>Cancelar</Button>
            <Button onClick={confirmReopen}>Reabrir Período</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const FiscalPeriodForm = ({ onSave, onCancel, onError }) => {
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    periodNumber: 1,
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await accountingService.createFiscalPeriod(formData);
      onSave();
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error creating period');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input 
        label="Año" 
        type="number" 
        value={formData.year} 
        onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})} 
        required 
      />
      <Input 
        label="Número de Período" 
        type="number" 
        min="1" 
        max="12"
        value={formData.periodNumber} 
        onChange={(e) => setFormData({...formData, periodNumber: parseInt(e.target.value)})} 
        required 
      />
      <Input 
        label="Fecha de Inicio" 
        type="date" 
        value={formData.startDate} 
        onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
        required 
      />
      <Input 
        label="Fecha de Fin" 
        type="date" 
        value={formData.endDate} 
        onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
        required 
      />
      <div className="flex justify-end space-x-2 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
};

export default FiscalPeriodManager;
