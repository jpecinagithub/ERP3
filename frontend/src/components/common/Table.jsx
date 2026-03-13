const Table = ({ columns, data, onRowClick }) => {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-800/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick?.(row)}
                className="hover:bg-primary/5 transition-colors group"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-5 text-sm text-slate-300">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {data.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          No hay datos disponibles
        </div>
      )}
    </div>
  );
};

export default Table;
