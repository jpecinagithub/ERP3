const Button = ({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'primary', 
  disabled = false,
  className = '' 
}) => {
  const baseClasses = 'px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg';
  
  const variants = {
    primary: 'bg-gradient-to-r from-primary to-purple-600 text-white hover:from-primary/90 hover:to-purple-700 shadow-primary/20',
    secondary: 'glass text-slate-300 hover:text-white hover:bg-slate-800/50',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
