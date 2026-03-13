import Modal from './Modal';
import Button from './Button';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'primary' }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-slate-300 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={() => { onConfirm(); onClose(); }}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
