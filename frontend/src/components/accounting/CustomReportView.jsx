import { useState } from 'react';
import accountingService from '../../services/accountingService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
import Alert from '../common/Alert';

const CustomReportView = () => {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    accountCodes: '',
    groupBy: ''
  });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setReport(null);
    try {
      const data = {
        startDate: formData.startDate,
        endDate: formData.endDate,
        accountCodes: formData.accountCodes ? formData.accountCodes.split(',').map(c => c.trim()) : undefined,
        groupBy: formData.groupBy || undefined
      };
      const response = await accountingService.getCustomReport(data);
      setReport(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Error generating report' });
    } finally {
      setLoading(false);
    }
  };

  const columns = report?.[0]?.groupName ? [
    { key: 'groupName', header: 'Grupo' },
    { key: 'totalDebit', header: 'Débitos', render: (v) => `€${parseFloat(v).toFixed(2)}` },
    { key: 'totalCredit', header: 'Créditos', render: (v) => `€${parseFloat(v).toFixed(2)}` },
    { key: 'balance', header: 'Saldo', render: (v) => `€${parseFloat(v).toFixed(2)}` }
  ] : [
    { key: 'code', header: 'Código' },
    { key: 'name', header: 'Nombre' },
    { key: 'accountType', header: 'Tipo' },
    { key: 'totalDebit', header: 'Débitos', render: (v) => `€${parseFloat(v).toFixed(2)}` },
    { key: 'totalCredit', header: 'Créditos', render: (v) => `€${parseFloat(v).toFixed(2)}` },
    { key: 'balance', header: 'Saldo', render: (v) => `€${parseFloat(v).toFixed(2)}` }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Reporte Personalizado</h2>
        <p className="text-slate-400 mt-2">Genera reportes contables personalizados</p>
      </div>

      <div className="glass rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Fecha Inicio" 
              type="date" 
              value={formData.startDate} 
              onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
              required 
            />
            <Input 
              label="Fecha Fin" 
              type="date" 
              value={formData.endDate} 
              onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
              required 
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Códigos de Cuenta (opcional)</label>
              <input
                type="text"
                value={formData.accountCodes}
                onChange={(e) => setFormData({...formData, accountCodes: e.target.value})}
                placeholder="600, 400, 430 (separados por coma)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Agrupar Por</label>
              <select
                value={formData.groupBy}
                onChange={(e) => setFormData({...formData, groupBy: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="">Sin agrupar</option>
                <option value="type">Tipo de cuenta</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Generando...' : 'Generar Reporte'}
          </Button>
        </form>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {report && report.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Resultados</h3>
          <Table columns={columns} data={report} />
        </div>
      )}

      {report && report.length === 0 && (
        <div className="glass rounded-2xl p-6 text-center text-slate-500">
          No hay datos para el período seleccionado
        </div>
      )}
    </div>
  );
};

export default CustomReportView;
