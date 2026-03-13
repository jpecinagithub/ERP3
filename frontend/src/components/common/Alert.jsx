const Alert = ({ type = 'info', message, onClose }) => {
  const types = {
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    info: 'bg-primary/10 border-primary/20 text-primary'
  };

  return (
    <div className={`border rounded-xl p-4 mb-4 ${types[type]}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm">{message}</span>
        {onClose && (
          <button onClick={onClose} className="font-bold ml-4 opacity-70 hover:opacity-100">
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
