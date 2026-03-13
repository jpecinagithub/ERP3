import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/auth/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';

import CustomerList from './components/master/CustomerList';
import SupplierList from './components/master/SupplierList';
import ItemList from './components/master/ItemList';
import UserList from './components/master/UserList';
import ItemDetail from './components/master/ItemDetail';
import CustomerDetail from './components/master/CustomerDetail';
import SupplierDetail from './components/master/SupplierDetail';
import UserDetail from './components/master/UserDetail';

import BudgetList from './components/purchase/BudgetList';
import PurchaseOrderList from './components/purchase/PurchaseOrderList';
import PurchaseInvoiceList from './components/purchase/PurchaseInvoiceList';
import InventoryView from './components/purchase/InventoryView';

import AccountList from './components/accounting/AccountList';
import AccountDetail from './components/accounting/AccountDetail';
import JournalEntryList from './components/accounting/JournalEntryList';
import BalanceSheet from './components/accounting/BalanceSheet';
import PnLReport from './components/accounting/PnLReport';
import ReportsHub from './components/accounting/ReportsHub';
import FiscalPeriodManager from './components/accounting/FiscalPeriodManager';

import SalesInvoiceList from './components/treasury/SalesInvoiceList';
import CollectionList from './components/treasury/CollectionList';
import CollectionDetail from './components/treasury/CollectionDetail';
import PaymentList from './components/treasury/PaymentList';
import PaymentDetail from './components/treasury/PaymentDetail';
import SalesBudgetList from './components/sales/SalesBudgetList';
import SalesOrderList from './components/sales/SalesOrderList';
import FixedAssetList from './components/assets/FixedAssetList';

import { useAuth as useAuthContext } from './context/AuthContext';
import accountingService from './services/accountingService';
import { useState, useEffect } from 'react';

const Dashboard = () => {
  const { user } = useAuthContext();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const startDate = `${currentYear}-01-01`;
        const endDate = `${currentYear}-12-31`;
        const response = await accountingService.getDashboardKPIs(startDate, endDate);
        setKpis(response.data);
      } catch (error) {
        console.error('Error fetching KPIs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchKPIs();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const kpisData = loading ? [
    { title: 'Total Ventas', value: '...', icon: 'trending_up', color: 'text-primary' },
    { title: 'Total Compras', value: '...', icon: 'shopping_bag', color: 'text-purple-500' },
    { title: 'Clientes Activos', value: '...', icon: 'group', color: 'text-emerald-500' },
    { title: 'Cobrar/Pagar', value: '...', icon: 'account_balance_wallet', color: 'text-amber-500' },
  ] : kpis ? [
    { title: 'Total Ventas', value: formatCurrency(kpis.totalSales), icon: 'trending_up', color: 'text-primary' },
    { title: 'Total Compras', value: formatCurrency(kpis.totalPurchases), icon: 'shopping_bag', color: 'text-purple-500' },
    { title: 'Clientes Activos', value: kpis.activeCustomers, icon: 'group', color: 'text-emerald-500' },
    { title: 'a Cobrar', value: formatCurrency(kpis.accountsReceivable), icon: 'account_balance_wallet', color: 'text-amber-500' },
  ] : [
    { title: 'Total Ventas', value: '€0', icon: 'trending_up', color: 'text-primary' },
    { title: 'Total Compras', value: '€0', icon: 'shopping_bag', color: 'text-purple-500' },
    { title: 'Clientes Activos', value: '0', icon: 'group', color: 'text-emerald-500' },
    { title: 'Cobrar/Pagar', value: '€0', icon: 'account_balance_wallet', color: 'text-amber-500' },
  ];

  const activities = kpis ? [
    { icon: 'receipt', title: `Facturas venta: ${formatCurrency(kpis.pendingSalesInvoices)} pendientes`, time: 'Cobro', color: 'bg-primary/20 text-primary' },
    { icon: 'shopping_cart', title: `Facturas compra: ${formatCurrency(kpis.pendingPurchaseInvoices)} pendientes`, time: 'Pago', color: 'bg-purple-500/20 text-purple-500' },
    { icon: 'group', title: `${kpis.activeCustomers} clientes activos`, time: 'Total', color: 'bg-emerald-500/20 text-emerald-500' },
    { icon: 'local_shipping', title: `${kpis.activeSuppliers} proveedores activos`, time: 'Total', color: 'bg-amber-500/20 text-amber-500' },
  ] : [];

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10"></div>
        <h2 className="text-4xl font-extrabold text-white tracking-tight">Dashboard</h2>
        <p className="text-slate-400 mt-2 text-lg">Bienvenido de nuevo, {user?.fullName || user?.username}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpisData.map((kpi, idx) => (
          <div key={idx} className="glass p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-6xl">{kpi.icon}</span>
            </div>
            <p className="text-slate-400 text-sm font-medium">{kpi.title}</p>
            <h3 className="text-3xl font-bold mt-2 text-white">{kpi.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass p-8 rounded-2xl">
          <h4 className="text-xl font-bold text-white mb-6">Monthly Sales Revenue</h4>
          <div className="relative h-80 flex items-end justify-between gap-4 px-2">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border-b border-slate-800/50 w-full h-px"></div>
              ))}
            </div>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((month) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-2 z-10">
                <div 
                  className="chart-bar w-full rounded-t-lg transition-all hover:brightness-125" 
                  style={{ height: `${Math.random() * 80 + 20}%` }}
                ></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">{month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-8 rounded-2xl flex flex-col">
          <h4 className="text-xl font-bold text-white mb-6">Resumen del Ejercicio</h4>
          <div className="flex-1 space-y-6">
            {activities.length > 0 ? activities.map((activity, idx) => (
              <div key={idx} className="flex gap-4">
                <div className={`size-10 rounded-full ${activity.color} flex items-center justify-center shrink-0`}>
                  <span className="material-symbols-outlined text-xl">{activity.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{activity.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{activity.time}</p>
                </div>
              </div>
            )) : (
              <p className="text-slate-400 text-sm">No hay actividad reciente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AppRoutes = () => {
  const { hasRole } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                
                {hasRole(['compras', 'administrador']) && (
                  <>
                    <Route path="/budgets" element={<BudgetList />} />
                    <Route path="/purchase-orders" element={<PurchaseOrderList />} />
                    <Route path="/inventory" element={<InventoryView />} />
                  </>
                )}

                {hasRole(['compras', 'tesoreria', 'administrador']) && (
                  <Route path="/purchase-invoices" element={<PurchaseInvoiceList />} />
                )}
                
                {hasRole(['contabilidad', 'administrador']) && (
                  <>
                    <Route path="/accounts" element={<AccountList />} />
                    <Route path="/accounts/:id" element={<AccountDetail />} />
                    <Route path="/journal-entries" element={<JournalEntryList />} />
                    <Route path="/reports" element={<ReportsHub />} />
                    <Route path="/reports/balance" element={<BalanceSheet />} />
                    <Route path="/reports/pnl" element={<PnLReport />} />
                    <Route path="/fiscal-periods" element={<FiscalPeriodManager />} />
                  </>
                )}
                
                {hasRole(['ventas', 'administrador']) && (
                  <>
                    <Route path="/sales-budgets" element={<SalesBudgetList />} />
                    <Route path="/sales-orders" element={<SalesOrderList />} />
                  </>
                )}

                {hasRole(['ventas', 'tesoreria', 'administrador']) && (
                  <>
                    <Route path="/sales-invoices" element={<SalesInvoiceList />} />
                    <Route path="/collections" element={<CollectionList />} />
                    <Route path="/collections/:id" element={<CollectionDetail />} />
                  </>
                )}

                {hasRole(['tesoreria', 'administrador']) && (
                  <>
                    <Route path="/payments" element={<PaymentList />} />
                    <Route path="/payments/:id" element={<PaymentDetail />} />
                  </>
                )}

                {hasRole(['compras', 'contabilidad', 'administrador']) && (
                  <Route path="/fixed-assets" element={<FixedAssetList />} />
                )}
                
                {hasRole('administrador') && (
                  <>
                    <Route path="/items" element={<ItemList />} />
                    <Route path="/items/:id" element={<ItemDetail />} />
                    <Route path="/customers" element={<CustomerList />} />
                    <Route path="/customers/:id" element={<CustomerDetail />} />
                    <Route path="/suppliers" element={<SupplierList />} />
                    <Route path="/suppliers/:id" element={<SupplierDetail />} />
                    <Route path="/users" element={<UserList />} />
                    <Route path="/users/:id" element={<UserDetail />} />
                  </>
                )}
                
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
