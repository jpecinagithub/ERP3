const Modal = ({ isOpen, onClose, title, children, size = 'lg' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
        
        <div className={`relative bg-[#161b2a] rounded-2xl shadow-2xl w-full ${sizeClasses[size] || sizeClasses.lg} p-6 z-10 border border-slate-700/50 text-white`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="text-white">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
