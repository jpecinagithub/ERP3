import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const adminNavigationGroups = [
  {
    name: 'Datos Maestros',
    icon: 'dataset',
    items: [
      { name: 'Clientes', path: '/customers', icon: 'group' },
      { name: 'Proveedores', path: '/suppliers', icon: 'local_shipping' },
      { name: 'Usuarios', path: '/users', icon: 'manage_accounts' },
      { name: 'Items', path: '/items', icon: 'category' },
      { name: 'Cuentas Contables', path: '/accounts', icon: 'account_balance' }
    ]
  },
  {
    name: 'Compras',
    icon: 'shopping_cart',
    items: [
      { name: 'Presupuesto Compras', path: '/budgets', icon: 'request_quote' },
      { name: 'Pedido Compras', path: '/purchase-orders', icon: 'inventory_2' },
      { name: 'Factura Compras', path: '/purchase-invoices', icon: 'shopping_cart_checkout' },
      { name: 'Existencias', path: '/inventory', icon: 'warehouse' }
    ]
  },
  {
    name: 'Ventas',
    icon: 'sell',
    items: [
      { name: 'Presupuesto Ventas', path: '/sales-budgets', icon: 'request_quote' },
      { name: 'Pedido Ventas', path: '/sales-orders', icon: 'receipt' },
      { name: 'Facturas Ventas', path: '/sales-invoices', icon: 'receipt_long' }
    ]
  },
  {
    name: 'Tesorería',
    icon: 'payments',
    items: [
      { name: 'Cobros', path: '/collections', icon: 'payments' },
      { name: 'Pagos', path: '/payments', icon: 'credit_card' }
    ]
  },
  {
    name: 'Contabilidad',
    icon: 'menu_book',
    items: [
      { name: 'Asientos', path: '/journal-entries', icon: 'menu_book' },
      { name: 'Períodos Contables', path: '/fiscal-periods', icon: 'calendar_month' },
      { name: 'Informes', path: '/reports', icon: 'assessment' },
      { name: 'Inmovilizado', path: '/fixed-assets', icon: 'factory' }
    ]
  }
];

const Sidebar = () => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('administrador');
  const [openGroups, setOpenGroups] = useState(() => adminNavigationGroups.map((group) => group.name));

  const getFlatNavigation = () => {
    const nav = [];

    if (hasRole('compras')) {
      nav.push(
        { name: 'Presupuestos', path: '/budgets', icon: 'request_quote' },
        { name: 'Pedidos', path: '/purchase-orders', icon: 'inventory_2' },
        { name: 'Inventario', path: '/inventory', icon: 'warehouse' }
      );
    }

    if (hasRole(['compras', 'tesoreria'])) {
      nav.push(
        { name: 'Facturas Compra', path: '/purchase-invoices', icon: 'shopping_cart' }
      );
    }

    if (hasRole('contabilidad')) {
      nav.push(
        { name: 'Cuentas', path: '/accounts', icon: 'account_balance' },
        { name: 'Asientos', path: '/journal-entries', icon: 'menu_book' },
        { name: 'Reportes', path: '/reports', icon: 'assessment' },
        { name: 'Inmovilizado', path: '/fixed-assets', icon: 'factory' }
      );
    }

    if (hasRole('contabilidad')) {
      nav.push(
        { name: 'Períodos', path: '/fiscal-periods', icon: 'calendar_month' }
      );
    }

    if (hasRole('ventas')) {
      nav.push(
        { name: 'Presupuestos Venta', path: '/sales-budgets', icon: 'request_quote' },
        { name: 'Pedidos Venta', path: '/sales-orders', icon: 'sell' },
        { name: 'Facturas Venta', path: '/sales-invoices', icon: 'receipt_long' },
        { name: 'Cobros', path: '/collections', icon: 'payments' }
      );
    }

    if (hasRole('tesoreria')) {
      nav.push(
        { name: 'Facturas Venta', path: '/sales-invoices', icon: 'receipt_long' },
        { name: 'Cobros', path: '/collections', icon: 'payments' },
        { name: 'Pagos', path: '/payments', icon: 'credit_card' }
      );
    }

    return nav;
  };

  const toggleGroup = (groupName) => {
    setOpenGroups((prev) => (
      prev.includes(groupName)
        ? prev.filter((name) => name !== groupName)
        : [...prev, groupName]
    ));
  };

  const navigation = getFlatNavigation();
  const userInitials = user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U';

  return (
    <aside className="w-72 flex flex-col bg-slate-900/50 border-r border-slate-800/50 backdrop-blur-xl">
      <div className="p-6 flex items-center gap-3">
        <div className="size-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-white text-2xl">rocket_launch</span>
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">Premium ERP</h1>
          <p className="text-xs text-slate-500 font-medium">Enterprise Suite</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-3 ${
              isActive
                ? 'sidebar-active text-primary'
                : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
            }`
          }
        >
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-sm font-semibold">Dashboard</span>
        </NavLink>

        {isAdmin ? (
          <div className="space-y-3">
            {adminNavigationGroups.map((group) => {
              const isOpen = openGroups.includes(group.name);
              return (
                <div key={group.name}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-slate-200 hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-300">{group.icon}</span>
                      <span className="text-sm font-semibold">{group.name}</span>
                    </span>
                    <span className="material-symbols-outlined text-slate-400 text-lg">
                      {isOpen ? 'expand_more' : 'chevron_right'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mt-1 ml-3 pl-4 border-l border-slate-800/70 space-y-1">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                              isActive
                                ? 'sidebar-active text-primary'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                            }`
                          }
                        >
                          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                          <span className="text-sm font-medium">{item.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'sidebar-active text-primary'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                }`
              }
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-sm font-medium">{item.name}</span>
            </NavLink>
          ))
        )}
      </nav>

      <div className="p-4 border-t border-slate-800/50">
        <div className="glass p-3 rounded-xl flex items-center gap-3">
          <div className="size-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
            {userInitials}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{user?.fullName || user?.username}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
