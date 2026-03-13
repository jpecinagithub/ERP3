import { useState } from 'react';
import accountingService from '../../services/accountingService';
import Button from '../common/Button';
import Alert from '../common/Alert';

const ReconciliationView = () => {
  const [reportType, setReportType] = useState('inventory');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setReport(null);
    try {
      const response = await accountingService.getReconciliationReport(reportType, startDate, endDate);
      setReport(response.data.data);
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Error generating report' });
    } finally {
      setLoading(false);
    }
  };

  const getTypeInfo = (type) => {
    const types = {
      inventory: {
        title: 'Conciliación de Inventario',
        description: 'Compara el valor del inventario con la cuenta contable 300',
        icon: 'inventory_2'
      },
      receivables: {
        title: 'Conciliación de Cuentas por Cobrar',
        description: 'Compara las facturas pendientes con la cuenta 430 Clientes',
        icon: 'receipt_long'
      },
      payables: {
        title: 'Conciliación de Cuentas por Pagar',
        description: 'Compara las facturas pendientes con la cuenta 400 Proveedores',
        icon: 'payments'
      }
    };
    return types[type];
  };

  const getBadgeColor = (isValid) => {
    return isValid 
      ? 'bg-green-100 text-green-700 border-green-200' 
      : 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Reportes de Conciliación</h2>
        <p className="text-slate-400 mt-2">Valida la coherencia entre módulos y contabilidad</p>
      </div>

      <div className="glass rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Conciliación</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="inventory">Inventario</option>
                <option value="receivables">Cuentas por Cobrar</option>
                <option value="payables">Cuentas por Pagar</option>
              </select>
            </div>
            <Input 
              label="Fecha Inicio" 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
            <Input 
              label="Fecha Fin" 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Generando...' : 'Generar Conciliación'}
          </Button>
        </form>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {report && (
        <div className="glass rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-primary">
                {getTypeInfo(reportType).icon}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-white">{getTypeInfo(reportType).title}</h3>
                <p className="text-slate-500">{getTypeInfo(reportType).description}</p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-lg border font-semibold ${getBadgeColor(report.isValid)}`}>
              {report.isValid ? 'CONCILIADO' : 'DIFERENCIA'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {report.inventoryValue !== undefined && (
              <>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Valor del Inventario</p>
                  <p className="text-2xl font-bold text-white">€{parseFloat(report.inventoryValue).toFixed(2)}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Cuenta 300 (Contabilidad)</p>
                  <p className="text-2xl font-bold text-white">€{parseFloat(report.account300Balance).toFixed(2)}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Diferencia</p>
                  <p className={`text-2xl font-bold ${Math.abs(report.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                    €{parseFloat(report.difference).toFixed(2)}
                  </p>
                </div>
              </>
            )}

            {report.pendingInvoices !== undefined && reportType === 'receivables' && (
              <>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Facturas Pendientes</p>
                  <p className="text-2xl font-bold text-white">€{parseFloat(report.pendingInvoices).toFixed(2)}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Cuenta 430 (Contabilidad)</p>
                  <p className="text-2xl font-bold text-white">€{parseFloat(report.account430Balance).toFixed(2)}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Diferencia</p>
                  <p className={`text-2xl font-bold ${Math.abs(report.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                    €{parseFloat(report.difference).toFixed(2)}
                  </p>
                </div>
              </>
            )}

            {report.pendingInvoices !== undefined && reportType === 'payables' && (
              <>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Facturas Pendientes</p>
                  <p className="text-2xl font-bold text-white">€{parseFloat(report.pendingInvoices).toFixed(2)}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Cuenta 400 (Contabilidad)</p>
                  <p className="text-2xl font-bold text-white">€{parseFloat(report.account400Balance).toFixed(2)}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Diferencia</p>
                  <p className={`text-2xl font-bold ${Math.abs(report.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                    €{parseFloat(report.difference).toFixed(2)}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-500">Mensaje</p>
            <p className="text-white">{report.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReconciliationView;
