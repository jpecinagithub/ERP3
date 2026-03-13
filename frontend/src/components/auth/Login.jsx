import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LanguageSwitcher from '../common/LanguageSwitcher';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/');
      } else {
        setError('Credenciales inválidas');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-[#101622] to-slate-900"></div>
      <div className="fixed inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg text-white">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>hub</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">ERP Enterprise</h2>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[460px]">
          <div className="glass rounded-xl p-8 shadow-2xl border border-white/10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center size-16 mb-4 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-white text-3xl">token</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Bienvenido</h1>
              <p className="text-slate-400 text-sm">Accede a tu panel de gestión corporativa</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 block ml-1">Usuario</label>
                <div className="relative flex items-center group">
                  <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-primary transition-colors">person</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-600"
                    placeholder="Ingresa tu usuario"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 block ml-1">Contraseña</label>
                <div className="relative flex items-center group">
                  <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-600"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
                <p className="font-semibold mb-1">Acceso de prueba</p>
                <p>Usuario: <span className="font-mono">admin</span></p>
                <p>Contraseña: <span className="font-mono">admin123</span></p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/30 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-slate-500 text-xs leading-relaxed">
                Sistema de Planificación de Recursos Empresariales v4.2.0<br/>
                © 2024 ERP Enterprise Solutions
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
