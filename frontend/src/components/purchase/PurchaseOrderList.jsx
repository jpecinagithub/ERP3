import { useState, useEffect } from 'react';
import purchaseService from '../../services/purchaseService';
import Table from '../common/Table';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Alert from '../common/Alert';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const PurchaseOrderList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [alert, setAlert] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await purchaseService.getPurchaseOrders();
      setOrders(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading purchase orders' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleViewDetails = async (order) => {
    try {
      const response = await purchaseService.getPurchaseOrderById(order.id);
      setSelectedOrder(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading order details' });
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    try {
      const response = await purchaseService.updatePurchaseOrderStatus(order.id, newStatus);
      if (newStatus === 'fully_received' && response.data?.generated) {
        const g = response.data.generated;
        setAlert({ 
          type: 'success', 
          message: `Pedido recibido. Se generó: Factura ${g.invoiceNumber}, Asiento #${g.journalEntryId}, Pago #${g.paymentNumber}` 
        });
      } else {
        setAlert({ type: 'success', message: 'Estado actualizado' });
      }
      fetchOrders();
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error?.message || 'Error updating status' });
    }
  };

  const columns = [
    { key: 'orderNumber', header: 'Número', render: (val) => <span className="font-mono text-primary font-bold">{val}</span> },
    { key: 'orderDate', header: 'Fecha', render: (val) => formatDate(val) },
    { 
      key: 'status', 
      header: 'Estado',
      render: (val) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          val === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : val === 'partially_received' ? 'bg-blue-500/20 text-blue-400' : val === 'fully_received' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {val === 'pending' ? 'Pendiente' : val === 'partially_received' ? 'Parcialmente recibido' : val === 'fully_received' ? 'Recibido' : val}
        </span>
      )
    },
    { 
      key: 'totalAmount', 
      header: 'Importe',
      render: (val) => <span className="font-mono">€{parseFloat(val).toFixed(2)}</span>
    },
    { 
      key: 'supplier', 
      header: 'Proveedor',
      render: (val) => <span className="font-semibold">{val?.name}</span>
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); handleViewDetails(row); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
          {row.status === 'pending' && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleStatusChange(row, 'partially_received'); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-green-500 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </button>
          )}
          {row.status === 'partially_received' && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleStatusChange(row, 'fully_received'); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-blue-500 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">inventory</span>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Pedidos de Compra</h2>
          <p className="text-slate-400 mt-2 text-lg">Gestión de pedidos a proveedores</p>
        </div>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {loading ? (
        <div className="glass rounded-2xl p-12 text-center text-slate-500">Cargando...</div>
      ) : (
        <Table columns={columns} data={orders} onRowClick={handleViewDetails} />
      )}

      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`Pedido ${selectedOrder?.orderNumber}`}>
        {selectedOrder && (
          <div>
            <p><strong>Fecha:</strong> {formatDate(selectedOrder.orderDate)}</p>
            <p><strong>Estado:</strong> {selectedOrder.status}</p>
            <p><strong>Proveedor:</strong> {selectedOrder.supplier?.name}</p>
            <p><strong>Total:</strong> €{parseFloat(selectedOrder.totalAmount).toFixed(2)}</p>
            <h3 className="font-bold mt-4 mb-2">Líneas</h3>
            <Table
              columns={[
                { key: 'itemCode', header: 'Código' },
                { key: 'itemDescription', header: 'Descripción' },
                { key: 'quantity', header: 'Cant.' },
                { key: 'unitPrice', header: 'Precio', render: (v) => `€${parseFloat(v).toFixed(2)}` },
                { key: 'lineTotal', header: 'Total', render: (v) => `€${parseFloat(v).toFixed(2)}` }
              ]}
              data={selectedOrder.lines || []}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PurchaseOrderList;
