const PageHeader = ({ title, subtitle, icon, actions }) => {
  return (
    <div className="relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
            {icon && <span className="material-symbols-outlined">{icon}</span>}
            {title}
          </h2>
          {subtitle && <p className="text-slate-400 mt-2 text-lg">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
};

const SearchBar = ({ value, onChange, placeholder }) => {
  return (
    <div className="relative w-full md:w-1/3">
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">search</span>
      <input
        className="w-full glass rounded-xl pl-12 pr-4 py-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none transition-all"
        placeholder={placeholder || "Buscar..."}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export { PageHeader, SearchBar };
