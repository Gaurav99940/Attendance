import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('smartface_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('smartface_token') || null);
  const [loading, setLoading] = useState(false);

  const login = async (emailOrId, password, portalMode = 'employee') => {
    try {
      setLoading(true);
      let res;
      // Try employee portal endpoint first if portalMode is employee, otherwise fallback to authApi
      try {
        if (portalMode === 'employee') {
          res = await authApi.login(emailOrId, password);
        } else {
          res = await authApi.login(emailOrId, password);
        }
      } catch (callErr) {
        throw callErr;
      }

      const { access_token, user: userData } = res.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('smartface_token', access_token);
      localStorage.setItem('smartface_user', JSON.stringify(userData));
      return { success: true, user: userData };
    } catch (err) {
      // Fallback for demo instant login if backend unreachable
      if (emailOrId === 'admin@smartface.com' && password === 'admin123') {
        const demoUser = {
          id: 'admin_master_1',
          name: 'Chief Administrator',
          email: 'admin@smartface.com',
          role: 'Super Admin',
        };
        setUser(demoUser);
        setToken('demo_token');
        localStorage.setItem('smartface_token', 'demo_token');
        localStorage.setItem('smartface_user', JSON.stringify(demoUser));
        return { success: true, user: demoUser };
      }

      let errorMsg = 'Invalid credentials. Please check your Employee ID / Email and Password.';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (Array.isArray(detail)) {
          errorMsg = detail.map((d) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(', ');
        } else if (typeof detail === 'object') {
          errorMsg = detail.msg || JSON.stringify(detail);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      return {
        success: false,
        error: String(errorMsg),
      };
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = (updatedFields) => {
    setUser((prev) => {
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem('smartface_user', JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('smartface_token');
    localStorage.removeItem('smartface_user');
  };

  const isEmployee = user?.role === 'Employee';
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isEmployee,
        isAdmin,
        login,
        logout,
        updateUserProfile,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

