import React, { createContext, useContext, useState } from 'react';
import { logoutUser, UserProfile } from '../services/authApi';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  login: (userData?: UserProfile) => void;
  logout: () => Promise<void>;
  updateUserData: (userData: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  login: () => {},
  logout: async () => {},
  updateUserData: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  const login = (userData?: UserProfile) => {
    if (userData) {
      setUser(userData);
    }
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      if (user?.id) {
        await logoutUser(user.id);
      } else {
        await logoutUser();
      }
    } catch (e) {
      // Ignored
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUserData = (userData: Partial<UserProfile>) => {
    setUser(prev => (prev ? { ...prev, ...userData } : (userData as UserProfile)));
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        updateUserData,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
