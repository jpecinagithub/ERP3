import { useState, useEffect } from 'react';
import accountingService from '../../services/accountingService';
import Table from '../common/Table';
import Button from '../common/Button';
import Input from '../common/Input';
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

const addDays = (dateStr, days) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const CATEGORY_LABELS = {
  'compra_mercaderias': 'Compra de Mercaderías',
  'venta_mercaderias': 'Venta de Mercaderías',
  'compra_inmovilizado': 'Compra de Inmovilizado',
  'nomina': 'Nómina',
  'alquiler': 'Alquiler',
  'amortizacion': 'Amortización',
  'variacion_existencias': 'Variación de Existencias',
  'aportacion_socios': 'Aportación de Socios',
  'cobro_cliente': 'Cobro a Cliente',
  'pago_proveedor': 'Pago a Proveedor',
  'gastos': 'Gastos',
  'regularizacion': 'Regularización'
};

const DEPRECATED_TEMPLATE_NAMES = new Set([
  'Factura de compra de mercaderías',
  'Factura de venta de mercaderías'
]);

const isDeprecatedTemplate = (template) =>
  DEPRECATED_TEMPLATE_NAMES.has(template?.name);

const JournalEntryList = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [referenceData, setReferenceData] = useState({ suppliers: [], customers: [], items: [] });
  const [alert, setAlert] = useState(null);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const response = await accountingService.getJournalEntries(filters);
      setEntries(response.data);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading entries' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await accountingService.getAccounts('', '');
      setAccounts(response.data);
    } catch (error) {
      console.error('Error loading accounts');
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await accountingService.getJournalEntryTemplates();
      const activeTemplates = (response.data || []).filter((template) => !isDeprecatedTemplate(template));
      setTemplates(activeTemplates);
    } catch (error) {
      console.error('Error loading templates', error);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const response = await accountingService.getAccountingReferenceData();
      setReferenceData({
        suppliers: response?.data?.suppliers || [],
        customers: response?.data?.customers || [],
        items: response?.data?.items || []
      });
    } catch (error) {
      console.error('Error loading accounting reference data', error);
    }
  };

  const handleSelectTemplate = async (template) => {
    try {
      if (isDeprecatedTemplate(template)) {
        setAlert({ type: 'warning', message: 'Esta plantilla ya no está disponible.' });
        return;
      }
      console.log('Fetching template:', template.id);
      const response = await accountingService.getJournalEntryTemplateById(template.id);
      console.log('Template response:', response);
      setSelectedTemplate(response.data || null);
      setShowTemplatesModal(false);
      setShowModal(true);
    } catch (error) {
      console.error('Error loading template details:', error);
      setAlert({ type: 'error', message: 'Error loading template details: ' + (error.message || error.response?.data?.error?.message || 'Unknown error') });
    }
  };

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
  }, [filters]);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const handleViewDetails = async (entry) => {
    try {
      const response = await accountingService.getJournalEntryById(entry.id);
      setSelectedEntry(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      setAlert({ type: 'error', message: 'Error loading entry details' });
    }
  };

  const columns = [
    { key: 'id', header: 'ID', render: (val) => <span className="font-mono text-primary">#{val}</span> },
    { key: 'entryDate', header: 'Fecha', render: (val) => formatDate(val) },
    { key: 'description', header: 'Descripción' },
    { key: 'sourceDocumentType', header: 'Origen' },
    { 
      key: 'totalDebit', 
      header: 'Debe',
      render: (val) => <span className="font-mono">€{parseFloat(val).toFixed(2)}</span>
    },
    { 
      key: 'totalCredit', 
      header: 'Haber',
      render: (val) => <span className="font-mono">€{parseFloat(val).toFixed(2)}</span>
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
        </div>
      )
    }
  ];

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">Asientos Contables</h2>
          <p className="text-slate-400 mt-2 text-lg">Registro de movimientos contables</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => { fetchTemplates(); setShowTemplatesModal(true); }}>
            <span className="material-symbols-outlined">description</span>
            Plantillas
          </Button>
          <Button onClick={() => { setSelectedTemplate(null); setShowModal(true); }}>
            <span className="material-symbols-outlined">add_circle</span>
            Nuevo Asiento
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
        <div className="relative w-full md:w-auto">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">event</span>
          <input
            type="date"
            className="glass rounded-xl pl-12 pr-4 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none transition-all w-full md:w-48"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>
        <div className="relative w-full md:w-auto">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">event</span>
          <input
            type="date"
            className="glass rounded-xl pl-12 pr-4 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none transition-all w-full md:w-48"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>
        <Button variant="secondary" onClick={fetchEntries}>
          <span className="material-symbols-outlined">filter_list</span>
          Filtrar
        </Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {loading ? (
        <div className="glass rounded-2xl p-12 text-center text-slate-500">Cargando...</div>
      ) : (
        <Table columns={columns} data={entries} onRowClick={handleViewDetails} />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo Asiento Contable" size="full">
        <JournalEntryForm
          accounts={accounts}
          suppliers={referenceData.suppliers}
          customers={referenceData.customers}
          items={referenceData.items}
          initialTemplate={selectedTemplate}
          onSave={(message) => {
            setShowModal(false);
            setSelectedTemplate(null);
            fetchEntries();
            if (message) {
              setAlert({ type: 'success', message });
            }
          }}
          onCancel={() => { setShowModal(false); setSelectedTemplate(null); }}
          onError={(message, type = 'error') => setAlert({ type, message })}
        />
      </Modal>

      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`Asiento #${selectedEntry?.id}`} size="xl">
        {selectedEntry && (
          <div className="text-white">
            <p><strong>Fecha:</strong> {formatDate(selectedEntry.entryDate)}</p>
            <p><strong>Descripción:</strong> {selectedEntry.description}</p>
            <p><strong>Total Debe:</strong> €{parseFloat(selectedEntry.totalDebit).toFixed(2)}</p>
            <p><strong>Total Haber:</strong> €{parseFloat(selectedEntry.totalCredit).toFixed(2)}</p>
            <h3 className="font-bold mt-4 mb-2">Líneas</h3>
            <Table
              columns={[
                { key: 'accountCode', header: 'Cuenta', render: (v) => <span className="font-mono text-primary">{v}</span> },
                { key: 'accountName', header: 'Nombre', render: (v) => <span className="text-white">{v}</span> },
                { key: 'debit', header: 'Debe', render: (v) => v ? <span className="text-white">€{parseFloat(v).toFixed(2)}</span> : '' },
                { key: 'credit', header: 'Haber', render: (v) => v ? <span className="text-white">€{parseFloat(v).toFixed(2)}</span> : '' },
                { key: 'description', header: 'Descripción', render: (v) => <span className="text-white">{v || '-'}</span> }
              ]}
              data={selectedEntry.lines || []}
            />
          </div>
        )}
      </Modal>

      <Modal isOpen={showTemplatesModal} onClose={() => setShowTemplatesModal(false)} title="Plantillas de Asientos" size="lg">
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {templates.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No hay plantillas disponibles. Asegúrate de que la base de datos esté actualizada.</p>
          ) : (
            Object.entries(CATEGORY_LABELS).map(([category, label]) => {
              const categoryTemplates = templates.filter(t => t.category === category);
              if (categoryTemplates.length === 0) return null;
              return (
                <div key={category} className="mb-4">
                  <h3 className="text-primary font-bold text-sm mb-2 uppercase tracking-wide">{label}</h3>
                  <div className="space-y-2">
                    {categoryTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className="w-full text-left glass rounded-xl p-4 cursor-pointer hover:bg-primary/30 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 border border-slate-700 hover:border-primary"
                      >
                        <p className="text-white font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-slate-400 text-sm mt-1">{template.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
};

const getInitialSourceDocumentType = (template) => {
  if (!template) return '';
  if (template.category === 'compra_inmovilizado') return 'compra_inmovilizado';
  if (template.category === 'compra_mercaderias' && /factura/i.test(template.name || '')) return 'compra_mercaderias';
  if (template.category === 'venta_mercaderias' && /factura/i.test(template.name || '')) return 'venta_mercaderias';
  return 'manual';
};

const JournalEntryForm = ({ accounts, suppliers = [], customers = [], items = [], onSave, onCancel, initialTemplate = null, onError }) => {
  const [formData, setFormData] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    const defaultFixedAssetFlow = {
      supplierId: '',
      itemDescription: '',
      quantity: 1,
      invoiceNumber: '',
      invoiceDate: today,
      dueDate: addDays(today, 60),
      paymentDate: addDays(today, 60),
      paymentMethod: 'bank_transfer',
      fixedAssetDescription: '',
      usefulLifeMonths: 60,
      residualValue: 0,
      assetAccountCode: '223',
      depreciationAccountCode: '681'
    };
    const defaultPurchaseMerchandiseFlow = {
      supplierId: '',
      invoiceNumber: '',
      invoiceDate: today,
      dueDate: addDays(today, 60),
      paymentDate: addDays(today, 60),
      paymentMethod: 'bank_transfer',
      vatRate: 21,
      lines: [{ itemId: '', quantity: 1, unitPrice: 0, lineDescription: '' }]
    };
    const defaultSalesMerchandiseFlow = {
      customerId: '',
      invoiceNumber: '',
      invoiceDate: today,
      dueDate: addDays(today, 90),
      collectionDate: addDays(today, 90),
      collectionMethod: 'bank_transfer',
      vatRate: 21,
      lines: [{ itemId: '', quantity: 1, unitPrice: 0 }]
    };

    if (initialTemplate && initialTemplate.templateData) {
      const templateLines = initialTemplate.templateData.lines.map(line => {
        let debitValue = 0;
        let creditValue = 0;
        
        const debitStr = String(line.debit || '0');
        const creditStr = String(line.credit || '0');
        
        if (debitStr.includes('IMPORTE')) {
          debitValue = debitStr;
        } else {
          debitValue = parseFloat(debitStr) || 0;
        }
        
        if (creditStr.includes('IMPORTE')) {
          creditValue = creditStr;
        } else {
          creditValue = parseFloat(creditStr) || 0;
        }
        
        return {
          accountId: line.accountId || '',
          debit: debitValue,
          credit: creditValue,
          description: line.description || ''
        };
      });
      return {
        entryDate: today,
        description: initialTemplate.name,
        sourceDocumentType: getInitialSourceDocumentType(initialTemplate),
        lines: templateLines.length > 0 ? templateLines : [{ accountId: '', debit: 0, credit: 0, description: '' }],
        fixedAssetFlow: {
          ...defaultFixedAssetFlow,
          itemDescription: initialTemplate.name,
          fixedAssetDescription: initialTemplate.name
        },
        purchaseMerchandiseFlow: defaultPurchaseMerchandiseFlow,
        salesMerchandiseFlow: defaultSalesMerchandiseFlow
      };
    }
    return {
      entryDate: today,
      description: '',
      sourceDocumentType: '',
      lines: [{ accountId: '', debit: 0, credit: 0, description: '' }],
      fixedAssetFlow: defaultFixedAssetFlow,
      purchaseMerchandiseFlow: defaultPurchaseMerchandiseFlow,
      salesMerchandiseFlow: defaultSalesMerchandiseFlow
    };
  });
  const [loading, setLoading] = useState(false);

  const addLine = () => {
    setFormData({ 
      ...formData, 
      lines: [...formData.lines, { accountId: '', debit: 0, credit: 0, description: '' }] 
    });
  };

  const removeLine = (index) => {
    setFormData({ 
      ...formData, 
      lines: formData.lines.filter((_, i) => i !== index) 
    });
  };

  const updateLine = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index][field] = value;
    setFormData({ ...formData, lines: newLines });
  };

  const updateFixedAssetFlow = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      fixedAssetFlow: {
        ...prev.fixedAssetFlow,
        [field]: value
      }
    }));
  };

  const updatePurchaseMerchandiseFlow = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      purchaseMerchandiseFlow: {
        ...prev.purchaseMerchandiseFlow,
        [field]: value
      }
    }));
  };

  const updateSalesMerchandiseFlow = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      salesMerchandiseFlow: {
        ...prev.salesMerchandiseFlow,
        [field]: value
      }
    }));
  };

  const addPurchaseLine = () => {
    setFormData((prev) => ({
      ...prev,
      purchaseMerchandiseFlow: {
        ...prev.purchaseMerchandiseFlow,
        lines: [...prev.purchaseMerchandiseFlow.lines, { itemId: '', quantity: 1, unitPrice: 0, lineDescription: '' }]
      }
    }));
  };

  const removePurchaseLine = (index) => {
    setFormData((prev) => ({
      ...prev,
      purchaseMerchandiseFlow: {
        ...prev.purchaseMerchandiseFlow,
        lines: prev.purchaseMerchandiseFlow.lines.filter((_, i) => i !== index)
      }
    }));
  };

  const updatePurchaseLine = (index, field, value) => {
    setFormData((prev) => {
      const nextLines = [...prev.purchaseMerchandiseFlow.lines];
      const updatedLine = { ...nextLines[index], [field]: value };
      if (field === 'itemId' && (Number(updatedLine.unitPrice) || 0) <= 0) {
        const selectedItem = items.find((item) => String(item.id) === String(value));
        if (selectedItem && Number.isFinite(Number(selectedItem.standardCost))) {
          updatedLine.unitPrice = Number(selectedItem.standardCost);
        }
      }
      nextLines[index] = updatedLine;
      return {
        ...prev,
        purchaseMerchandiseFlow: {
          ...prev.purchaseMerchandiseFlow,
          lines: nextLines
        }
      };
    });
  };

  const addSalesLine = () => {
    setFormData((prev) => ({
      ...prev,
      salesMerchandiseFlow: {
        ...prev.salesMerchandiseFlow,
        lines: [...prev.salesMerchandiseFlow.lines, { itemId: '', quantity: 1, unitPrice: 0 }]
      }
    }));
  };

  const removeSalesLine = (index) => {
    setFormData((prev) => ({
      ...prev,
      salesMerchandiseFlow: {
        ...prev.salesMerchandiseFlow,
        lines: prev.salesMerchandiseFlow.lines.filter((_, i) => i !== index)
      }
    }));
  };

  const updateSalesLine = (index, field, value) => {
    setFormData((prev) => {
      const nextLines = [...prev.salesMerchandiseFlow.lines];
      const updatedLine = { ...nextLines[index], [field]: value };
      if (field === 'itemId' && (Number(updatedLine.unitPrice) || 0) <= 0) {
        const selectedItem = items.find((item) => String(item.id) === String(value));
        if (selectedItem && Number.isFinite(Number(selectedItem.standardCost))) {
          updatedLine.unitPrice = Number(selectedItem.standardCost);
        }
      }
      nextLines[index] = updatedLine;
      return {
        ...prev,
        salesMerchandiseFlow: {
          ...prev.salesMerchandiseFlow,
          lines: nextLines
        }
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const hasImporte = formData.lines.some(line => 
      String(line.debit).includes('IMPORTE') || String(line.credit).includes('IMPORTE')
    );
    
    if (hasImporte) {
      onError('Por favor, reemplaza "IMPORTE" por los valores correspondientes en las líneas del asiento.', 'warning');
      return;
    }
    
    const totalDebit = formData.lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = formData.lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      onError(`El asiento no balancea. Debe: €${totalDebit.toFixed(2)}, Haber: €${totalCredit.toFixed(2)}`, 'warning');
      return;
    }

    if (formData.sourceDocumentType === 'compra_inmovilizado') {
      if (!formData.fixedAssetFlow.supplierId || !formData.fixedAssetFlow.itemDescription.trim()) {
        onError('Para compra de inmovilizado debes indicar proveedor y descripción del artículo.', 'warning');
        return;
      }

      const quantity = Number(formData.fixedAssetFlow.quantity);
      const usefulLifeMonths = Number(formData.fixedAssetFlow.usefulLifeMonths);
      const residualValue = Number(formData.fixedAssetFlow.residualValue || 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        onError('La cantidad debe ser mayor que 0.', 'warning');
        return;
      }

      if (!Number.isFinite(usefulLifeMonths) || usefulLifeMonths <= 0) {
        onError('La vida útil debe ser mayor que 0.', 'warning');
        return;
      }

      if (!Number.isFinite(residualValue) || residualValue < 0) {
        onError('El valor residual no puede ser negativo.', 'warning');
        return;
      }
    }

    if (formData.sourceDocumentType === 'compra_mercaderias') {
      const purchaseFlow = formData.purchaseMerchandiseFlow;
      if (!purchaseFlow.supplierId) {
        onError('Para factura de compra de mercaderías debes seleccionar proveedor.', 'warning');
        return;
      }

      if (!Array.isArray(purchaseFlow.lines) || purchaseFlow.lines.length === 0) {
        onError('Debes añadir al menos una línea de artículo en la factura de compra.', 'warning');
        return;
      }

      const invalidLine = purchaseFlow.lines.find((line) => {
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        return !line.itemId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0;
      });

      if (invalidLine) {
        onError('Cada línea de compra requiere artículo, cantidad > 0 y precio >= 0.', 'warning');
        return;
      }
    }

    if (formData.sourceDocumentType === 'venta_mercaderias') {
      const salesFlow = formData.salesMerchandiseFlow;
      if (!salesFlow.customerId) {
        onError('Para factura de venta de mercaderías debes seleccionar cliente.', 'warning');
        return;
      }

      if (!Array.isArray(salesFlow.lines) || salesFlow.lines.length === 0) {
        onError('Debes añadir al menos una línea de artículo en la factura de venta.', 'warning');
        return;
      }

      const invalidLine = salesFlow.lines.find((line) => {
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        return !line.itemId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0;
      });

      if (invalidLine) {
        onError('Cada línea de venta requiere artículo, cantidad > 0 y precio >= 0.', 'warning');
        return;
      }
    }

    setLoading(true);
    try {
      const dataToSubmit = {
        ...formData,
        lines: formData.lines.map(line => ({
          ...line,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0
        })),
        integrationData: formData.sourceDocumentType === 'compra_inmovilizado'
          ? {
            supplierId: Number(formData.fixedAssetFlow.supplierId),
            itemDescription: formData.fixedAssetFlow.itemDescription.trim(),
            quantity: Number(formData.fixedAssetFlow.quantity),
            invoiceNumber: formData.fixedAssetFlow.invoiceNumber || undefined,
            invoiceDate: formData.fixedAssetFlow.invoiceDate,
            dueDate: formData.fixedAssetFlow.dueDate,
            paymentDate: formData.fixedAssetFlow.paymentDate,
            paymentMethod: formData.fixedAssetFlow.paymentMethod,
            fixedAssetDescription: formData.fixedAssetFlow.fixedAssetDescription || formData.description,
            usefulLifeMonths: Number(formData.fixedAssetFlow.usefulLifeMonths),
            residualValue: Number(formData.fixedAssetFlow.residualValue || 0),
            assetAccountCode: formData.fixedAssetFlow.assetAccountCode || undefined,
            depreciationAccountCode: formData.fixedAssetFlow.depreciationAccountCode || undefined
          }
          : formData.sourceDocumentType === 'compra_mercaderias'
            ? {
              supplierId: Number(formData.purchaseMerchandiseFlow.supplierId),
              invoiceNumber: formData.purchaseMerchandiseFlow.invoiceNumber || undefined,
              invoiceDate: formData.purchaseMerchandiseFlow.invoiceDate,
              dueDate: formData.purchaseMerchandiseFlow.dueDate,
              paymentDate: formData.purchaseMerchandiseFlow.paymentDate,
              paymentMethod: formData.purchaseMerchandiseFlow.paymentMethod,
              vatRate: Number(formData.purchaseMerchandiseFlow.vatRate || 0),
              lines: formData.purchaseMerchandiseFlow.lines.map((line) => ({
                itemId: Number(line.itemId),
                quantity: Number(line.quantity),
                unitPrice: Number(line.unitPrice),
                lineDescription: line.lineDescription || undefined
              }))
            }
            : formData.sourceDocumentType === 'venta_mercaderias'
              ? {
                customerId: Number(formData.salesMerchandiseFlow.customerId),
                invoiceNumber: formData.salesMerchandiseFlow.invoiceNumber || undefined,
                invoiceDate: formData.salesMerchandiseFlow.invoiceDate,
                dueDate: formData.salesMerchandiseFlow.dueDate,
                collectionDate: formData.salesMerchandiseFlow.collectionDate,
                collectionMethod: formData.salesMerchandiseFlow.collectionMethod,
                vatRate: Number(formData.salesMerchandiseFlow.vatRate || 0),
                lines: formData.salesMerchandiseFlow.lines.map((line) => ({
                  itemId: Number(line.itemId),
                  quantity: Number(line.quantity),
                  unitPrice: Number(line.unitPrice)
                }))
              }
              : undefined
      };
      const response = await accountingService.createJournalEntry(dataToSubmit);
      onSave(response?.message || 'Asiento creado correctamente');
    } catch (error) {
      onError(error.response?.data?.error?.message || 'Error creating entry');
    } finally {
      setLoading(false);
    }
  };

  const totalDebit = formData.lines.reduce((sum, line) => {
    const val = String(line.debit);
    if (val.includes('IMPORTE')) return sum;
    return sum + (parseFloat(line.debit) || 0);
  }, 0);
  const totalCredit = formData.lines.reduce((sum, line) => {
    const val = String(line.credit);
    if (val.includes('IMPORTE')) return sum;
    return sum + (parseFloat(line.credit) || 0);
  }, 0);
  const purchaseBaseAmount = (formData.purchaseMerchandiseFlow.lines || []).reduce(
    (sum, line) => sum + ((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0)),
    0
  );
  const salesBaseAmount = (formData.salesMerchandiseFlow.lines || []).reduce(
    (sum, line) => sum + ((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0)),
    0
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-4 gap-3">
        <Input 
          label="Fecha" 
          type="date" 
          value={formData.entryDate} 
          onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })} 
          required 
        />
        <div className="mb-3">
          <label className="block text-slate-300 text-xs font-medium mb-1">Tipo de documento</label>
          <select
            value={formData.sourceDocumentType}
            onChange={(e) => setFormData({ ...formData, sourceDocumentType: e.target.value })}
            className="w-full glass rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-sm"
          >
            <option value="">Seleccionar...</option>
            <option value="invoice">Factura</option>
            <option value="receipt">Recibo</option>
            <option value="payment">Pago</option>
            <option value="compra_mercaderias">Compra mercaderías</option>
            <option value="venta_mercaderias">Venta mercaderías</option>
            <option value="compra_inmovilizado">Compra inmovilizado</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div className="col-span-2">
          <Input 
            label="Descripción" 
            value={formData.description} 
            onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
            required 
          />
        </div>
      </div>
      
      <h3 className="text-white font-bold mt-4 mb-2">Líneas del asiento</h3>
      
      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
        {formData.lines.map((line, index) => (
          <div key={index} className="glass rounded-lg p-3">
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <label className="block text-slate-400 text-xs mb-1">Cuenta</label>
                <select
                  value={line.accountId}
                  onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                  className="w-full glass rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-xs"
                  required
                >
                  <option value="">Seleccionar cuenta...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Debe</label>
                <input
                  type="text"
                  value={line.debit}
                  onChange={(e) => updateLine(index, 'debit', e.target.value)}
                  className="w-full glass rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-xs"
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Haber</label>
                <input
                  type="text"
                  value={line.credit}
                  onChange={(e) => updateLine(index, 'credit', e.target.value)}
                  className="w-full glass rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-xs"
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Descripción</label>
                <input
                  type="text"
                  value={line.description}
                  onChange={(e) => updateLine(index, 'description', e.target.value)}
                  className="w-full glass rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-xs"
                  placeholder="Opcional"
                />
              </div>
              <div className="col-span-1">
                {formData.lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-red-500 transition-colors mt-4"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLine}
        className="mt-3 w-full py-2 rounded-lg border-2 border-dashed border-slate-600 text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        Añadir línea
      </button>

      {formData.sourceDocumentType === 'compra_mercaderias' && (
        <div className="mt-4 glass rounded-xl p-4">
          <h4 className="text-white font-semibold mb-3">Datos de factura de compra de mercaderías</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1">Proveedor *</label>
              <select
                value={formData.purchaseMerchandiseFlow.supplierId}
                onChange={(e) => updatePurchaseMerchandiseFlow('supplierId', e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-sm"
                required
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} - {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Nº Factura (opcional)"
              value={formData.purchaseMerchandiseFlow.invoiceNumber}
              onChange={(e) => updatePurchaseMerchandiseFlow('invoiceNumber', e.target.value)}
              className="mb-0"
            />
            <Input
              label="IVA (%)"
              type="number"
              min="0"
              step="0.01"
              value={formData.purchaseMerchandiseFlow.vatRate}
              onChange={(e) => updatePurchaseMerchandiseFlow('vatRate', e.target.value)}
              className="mb-0"
            />
            <Input
              label="Fecha factura"
              type="date"
              value={formData.purchaseMerchandiseFlow.invoiceDate}
              onChange={(e) => updatePurchaseMerchandiseFlow('invoiceDate', e.target.value)}
              className="mb-0"
              required
            />
            <Input
              label="Fecha vencimiento"
              type="date"
              value={formData.purchaseMerchandiseFlow.dueDate}
              onChange={(e) => updatePurchaseMerchandiseFlow('dueDate', e.target.value)}
              className="mb-0"
              required
            />
            <Input
              label="Fecha pago pendiente"
              type="date"
              value={formData.purchaseMerchandiseFlow.paymentDate}
              onChange={(e) => updatePurchaseMerchandiseFlow('paymentDate', e.target.value)}
              className="mb-0"
              required
            />
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1">Medio de pago</label>
              <select
                value={formData.purchaseMerchandiseFlow.paymentMethod}
                onChange={(e) => updatePurchaseMerchandiseFlow('paymentMethod', e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-sm"
              >
                <option value="bank_transfer">Transferencia</option>
                <option value="check">Cheque</option>
              </select>
            </div>
          </div>

          <h5 className="text-white font-medium mt-4 mb-2">Líneas de la factura de compra</h5>
          <div className="space-y-2">
            {formData.purchaseMerchandiseFlow.lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <label className="block text-slate-400 text-xs mb-1">Artículo</label>
                  <select
                    value={line.itemId}
                    onChange={(e) => updatePurchaseLine(index, 'itemId', e.target.value)}
                    className="w-full glass rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-xs"
                    required
                  >
                    <option value="">Seleccionar artículo...</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} - {item.description}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Cantidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={line.quantity}
                  onChange={(e) => updatePurchaseLine(index, 'quantity', e.target.value)}
                  className="mb-0 col-span-2"
                  required
                />
                <Input
                  label="Precio unit."
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(e) => updatePurchaseLine(index, 'unitPrice', e.target.value)}
                  className="mb-0 col-span-2"
                  required
                />
                <Input
                  label="Descripción línea"
                  value={line.lineDescription || ''}
                  onChange={(e) => updatePurchaseLine(index, 'lineDescription', e.target.value)}
                  className="mb-0 col-span-3"
                />
                <div className="col-span-1">
                  {formData.purchaseMerchandiseFlow.lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePurchaseLine(index)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPurchaseLine}
            className="mt-3 py-2 px-3 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:border-primary hover:text-primary transition-colors text-sm"
          >
            Añadir línea de compra
          </button>
          <p className="text-slate-300 text-sm mt-2">
            Base factura compra: <span className="font-mono">€{purchaseBaseAmount.toFixed(2)}</span>
          </p>
        </div>
      )}

      {formData.sourceDocumentType === 'venta_mercaderias' && (
        <div className="mt-4 glass rounded-xl p-4">
          <h4 className="text-white font-semibold mb-3">Datos de factura de venta de mercaderías</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1">Cliente *</label>
              <select
                value={formData.salesMerchandiseFlow.customerId}
                onChange={(e) => updateSalesMerchandiseFlow('customerId', e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-sm"
                required
              >
                <option value="">Seleccionar cliente...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} - {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Nº Factura (opcional)"
              value={formData.salesMerchandiseFlow.invoiceNumber}
              onChange={(e) => updateSalesMerchandiseFlow('invoiceNumber', e.target.value)}
              className="mb-0"
            />
            <Input
              label="IVA (%)"
              type="number"
              min="0"
              step="0.01"
              value={formData.salesMerchandiseFlow.vatRate}
              onChange={(e) => updateSalesMerchandiseFlow('vatRate', e.target.value)}
              className="mb-0"
            />
            <Input
              label="Fecha factura"
              type="date"
              value={formData.salesMerchandiseFlow.invoiceDate}
              onChange={(e) => updateSalesMerchandiseFlow('invoiceDate', e.target.value)}
              className="mb-0"
              required
            />
            <Input
              label="Fecha vencimiento"
              type="date"
              value={formData.salesMerchandiseFlow.dueDate}
              onChange={(e) => updateSalesMerchandiseFlow('dueDate', e.target.value)}
              className="mb-0"
              required
            />
            <Input
              label="Fecha cobro pendiente"
              type="date"
              value={formData.salesMerchandiseFlow.collectionDate}
              onChange={(e) => updateSalesMerchandiseFlow('collectionDate', e.target.value)}
              className="mb-0"
              required
            />
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1">Medio de cobro</label>
              <select
                value={formData.salesMerchandiseFlow.collectionMethod}
                onChange={(e) => updateSalesMerchandiseFlow('collectionMethod', e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-sm"
              >
                <option value="bank_transfer">Transferencia</option>
                <option value="check">Cheque</option>
                <option value="card">Tarjeta</option>
              </select>
            </div>
          </div>

          <h5 className="text-white font-medium mt-4 mb-2">Líneas de la factura de venta</h5>
          <div className="space-y-2">
            {formData.salesMerchandiseFlow.lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <label className="block text-slate-400 text-xs mb-1">Artículo</label>
                  <select
                    value={line.itemId}
                    onChange={(e) => updateSalesLine(index, 'itemId', e.target.value)}
                    className="w-full glass rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-xs"
                    required
                  >
                    <option value="">Seleccionar artículo...</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} - {item.description}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Cantidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={line.quantity}
                  onChange={(e) => updateSalesLine(index, 'quantity', e.target.value)}
                  className="mb-0 col-span-2"
                  required
                />
                <Input
                  label="Precio unit."
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(e) => updateSalesLine(index, 'unitPrice', e.target.value)}
                  className="mb-0 col-span-3"
                  required
                />
                <div className="col-span-1">
                  {formData.salesMerchandiseFlow.lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSalesLine(index)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center glass text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addSalesLine}
            className="mt-3 py-2 px-3 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:border-primary hover:text-primary transition-colors text-sm"
          >
            Añadir línea de venta
          </button>
          <p className="text-slate-300 text-sm mt-2">
            Base factura venta: <span className="font-mono">€{salesBaseAmount.toFixed(2)}</span>
          </p>
        </div>
      )}

      {formData.sourceDocumentType === 'compra_inmovilizado' && (
        <div className="mt-4 glass rounded-xl p-4">
          <h4 className="text-white font-semibold mb-3">Datos de factura y alta de inmovilizado</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1">Proveedor *</label>
              <select
                value={formData.fixedAssetFlow.supplierId}
                onChange={(e) => updateFixedAssetFlow('supplierId', e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-sm"
                required
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} - {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Descripción artículo *"
              value={formData.fixedAssetFlow.itemDescription}
              onChange={(e) => updateFixedAssetFlow('itemDescription', e.target.value)}
              className="mb-0"
              required
            />
            <Input
              label="Cantidad"
              type="number"
              min="0.01"
              step="0.01"
              value={formData.fixedAssetFlow.quantity}
              onChange={(e) => updateFixedAssetFlow('quantity', e.target.value)}
              className="mb-0"
              required
            />
            <Input
              label="Nº Factura (opcional)"
              value={formData.fixedAssetFlow.invoiceNumber}
              onChange={(e) => updateFixedAssetFlow('invoiceNumber', e.target.value)}
              className="mb-0"
            />
            <Input
              label="Fecha factura"
              type="date"
              value={formData.fixedAssetFlow.invoiceDate}
              onChange={(e) => updateFixedAssetFlow('invoiceDate', e.target.value)}
              className="mb-0"
              required
            />
            <Input
              label="Fecha vencimiento"
              type="date"
              value={formData.fixedAssetFlow.dueDate}
              onChange={(e) => updateFixedAssetFlow('dueDate', e.target.value)}
              className="mb-0"
              required
            />
            <Input
              label="Fecha pago pendiente"
              type="date"
              value={formData.fixedAssetFlow.paymentDate}
              onChange={(e) => updateFixedAssetFlow('paymentDate', e.target.value)}
              className="mb-0"
              required
            />
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1">Medio de pago</label>
              <select
                value={formData.fixedAssetFlow.paymentMethod}
                onChange={(e) => updateFixedAssetFlow('paymentMethod', e.target.value)}
                className="w-full glass rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 border-none text-sm"
              >
                <option value="bank_transfer">Transferencia</option>
                <option value="check">Cheque</option>
              </select>
            </div>
            <Input
              label="Descripción activo"
              value={formData.fixedAssetFlow.fixedAssetDescription}
              onChange={(e) => updateFixedAssetFlow('fixedAssetDescription', e.target.value)}
              className="mb-0 md:col-span-2"
            />
            <Input
              label="Vida útil (meses)"
              type="number"
              min="1"
              value={formData.fixedAssetFlow.usefulLifeMonths}
              onChange={(e) => updateFixedAssetFlow('usefulLifeMonths', e.target.value)}
              className="mb-0"
              required
            />
            <Input
              label="Valor residual"
              type="number"
              min="0"
              step="0.01"
              value={formData.fixedAssetFlow.residualValue}
              onChange={(e) => updateFixedAssetFlow('residualValue', e.target.value)}
              className="mb-0"
            />
            <Input
              label="Cuenta activo (2xx)"
              value={formData.fixedAssetFlow.assetAccountCode}
              onChange={(e) => updateFixedAssetFlow('assetAccountCode', e.target.value)}
              className="mb-0"
            />
            <Input
              label="Cuenta amortización (6xx)"
              value={formData.fixedAssetFlow.depreciationAccountCode}
              onChange={(e) => updateFixedAssetFlow('depreciationAccountCode', e.target.value)}
              className="mb-0"
            />
          </div>
        </div>
      )}
      
      {(() => {
        const hasImporte = formData.lines.some(line => 
          String(line.debit).includes('IMPORTE') || String(line.credit).includes('IMPORTE')
        );
        const getBalanceClass = () => {
          if (hasImporte) return 'bg-yellow-500/20 text-yellow-400';
          if (Math.abs(totalDebit - totalCredit) < 0.01) return 'bg-green-500/20 text-green-400';
          return 'bg-red-500/20 text-red-400';
        };
        return (
          <div className={`mt-3 p-2 rounded-lg flex justify-between font-bold text-sm ${getBalanceClass()}`}>
            <span>Total Debe: €{hasImporte ? '---' : totalDebit.toFixed(2)}</span>
            <span>Total Haber: €{hasImporte ? '---' : totalCredit.toFixed(2)}</span>
          </div>
        );
      })()}
      
      <div className="flex justify-end space-x-2 mt-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading || Math.abs(totalDebit - totalCredit) > 0.01}>
          {loading ? 'Guardando...' : 'Guardar Asiento'}
        </Button>
      </div>
    </form>
  );
};

export default JournalEntryList;
