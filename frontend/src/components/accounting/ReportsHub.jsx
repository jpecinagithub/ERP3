import { Link } from 'react-router-dom';

const REPORT_OPTIONS = [
  {
    title: 'Pérdidas y Ganancias',
    description: 'Genera la cuenta de resultados para analizar ingresos, gastos y beneficio del período.',
    path: '/reports/pnl',
    icon: 'trending_up',
    accent: 'text-emerald-400',
    cta: 'Generar PyG'
  },
  {
    title: 'Balance de Situación',
    description: 'Consulta activos, pasivos y patrimonio con verificación automática del balance.',
    path: '/reports/balance',
    icon: 'account_balance',
    accent: 'text-primary',
    cta: 'Generar Balance'
  }
];

const ReportsHub = () => {
  return (
    <div className="relative space-y-8">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>

      <div>
        <h2 className="text-4xl font-extrabold text-white tracking-tight">Reportes Financieros</h2>
        <p className="text-slate-400 mt-2 text-lg">
          Selecciona el reporte que deseas generar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {REPORT_OPTIONS.map((report) => (
          <article key={report.path} className="glass rounded-2xl p-6 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{report.title}</h3>
                <p className="text-slate-300 mt-2 leading-relaxed">{report.description}</p>
              </div>
              <span className={`material-symbols-outlined text-4xl ${report.accent}`}>{report.icon}</span>
            </div>

            <Link
              to={report.path}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">description</span>
              {report.cta}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
};

export default ReportsHub;
