import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-[#101622] to-slate-900">
        <Navbar />
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
