import { createContext, useContext, useState } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

const getInitialUser = () => {
  const currentUser = authService.getCurrentUser();
  const token = authService.getToken();
  return currentUser && token ? currentUser : null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getInitialUser);
  const loading = false;

  const login = async (username, password) => {
    const response = await authService.login(username, password);
    if (response.success) {
      setUser(response.data.user);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
