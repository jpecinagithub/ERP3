const Input = ({ label, type = 'text', value, onChange, required = false, error, placeholder, className = '', ...props }) => {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-slate-300 block mb-2">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-4 py-3 bg-slate-900/50 border rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${
          error 
            ? 'border-red-500 focus:ring-red-500/50' 
            : 'border-slate-700 focus:border-primary focus:ring-primary/50'
        }`}
        {...props}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default Input;
