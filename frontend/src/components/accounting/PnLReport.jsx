import { useState } from 'react';
import accountingService from '../../services/accountingService';
import Button from '../common/Button';
import Input from '../common/Input';
import Alert from '../common/Alert';

const PnLReport = () => {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await accountingService.getPnLReport(startDate, endDate);
      setReport(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading report' });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async (type) => {
    try {
      const blob = await accountingService.exportReportCSV(type, startDate, endDate);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setAlert({ type: 'error', message: 'Error exporting report' });
    }
  };

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Cuenta de Resultados</h2>
          <p className="text-slate-400 mt-2 text-lg">Ingresos y gastos del período</p>
        </div>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
        <div className="relative w-full md:w-auto">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">event</span>
          <input
            type="date"
            className="glass rounded-xl pl-12 pr-4 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none transition-all w-full md:w-48"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="relative w-full md:w-auto">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">event</span>
          <input
            type="date"
            className="glass rounded-xl pl-12 pr-4 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none transition-all w-full md:w-48"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button onClick={fetchReport} disabled={loading}>
          <span className="material-symbols-outlined">assessment</span>
          {loading ? 'Cargando...' : 'Generar'}
        </Button>
        {report && (
          <Button variant="secondary" onClick={() => exportCSV('pnl')}>
            <span className="material-symbols-outlined">download</span>
            Exportar CSV
          </Button>
        )}
      </div>

      {report && (
        <div className="space-y-6">
          {report.validation && !report.validation.isValid && (
            <Alert type="warning" message={report.validation.message} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 text-white">Ingresos</h2>
              {report.income?.map((item, idx) => (
                <div key={idx} className="flex justify-between py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">{item.code} - {item.name}</span>
                  <span className="font-mono text-green-400">€{item.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-green-500/30 flex justify-between font-bold">
                <span className="text-white">Total Ingresos</span>
                <span className="font-mono text-green-400 text-lg">€{report.totalIncome.toFixed(2)}</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 text-white">Gastos</h2>
              {report.expenses?.map((item, idx) => (
                <div key={idx} className="flex justify-between py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">{item.code} - {item.name}</span>
                  <span className="font-mono text-red-400">€{item.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-red-500/30 flex justify-between font-bold">
                <span className="text-white">Total Gastos</span>
                <span className="font-mono text-red-400 text-lg">€{report.totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-white">Resultado:</span>
              <span className={`text-xl font-bold ${report.result >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {report.resultType === 'profit' ? 'Beneficio' : 'Pérdida'}: €{Math.abs(report.result).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PnLReport;
