import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { logoutUser, restoreSession, UserProfile } from '../services/authApi';
import { cancelVoteReminder, setNotificationName, syncVoteReminder } from '../native/notifications';

interface AuthContextType {
  isAuthenticated: boolean;
  initializing: boolean; // true until the saved session has been checked
  user: UserProfile | null;
  // Set after a login/sign-up on this screen (not on restore); used for the one-time lock prompt
  freshLogin: boolean;
  clearFreshLogin: () => void;
  login: (userData?: UserProfile) => void;
  logout: () => Promise<void>;
  updateUserData: (userData: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  initializing: true,
  user: null,
  freshLogin: false,
  clearFreshLogin: () => {},
  login: () => {},
  logout: async () => {},
  updateUserData: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [freshLogin, setFreshLogin] = useState<boolean>(false);
  const restoredRef = useRef(false);

  // First event = saved session (restore it). Later sign-ins come through login() after the
  // mobile check; later sign-outs (logout, failed checks) end the session here.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (!restoredRef.current) {
        restoredRef.current = true;
        if (fbUser) {
          try {
            const r = await restoreSession(fbUser);
            if (r.status === 'ok') {
              setUser(r.user);
              setIsAuthenticated(true);
            }
          } catch (e: any) {
            console.warn('Session restore failed:', e?.message);
          }
        }
        setInitializing(false);
        return;
      }
      if (!fbUser) {
        setUser(null);
        setIsAuthenticated(false);
      }
    });
    return unsub;
  }, []);

  // Keep the 8 AM notification's name in sync: login, session restore, profile name edits, and
  // cleared on sign-out ("Good morning! ☀️")
  const displayName = user?.name || '';
  useEffect(() => {
    setNotificationName(displayName);
  }, [displayName]);

  // Hourly colour-vote reminder (from 1 AM until today's vote) while signed in; off after sign-out
  const signedInUid = isAuthenticated ? user?.id || '' : '';
  useEffect(() => {
    if (signedInUid) syncVoteReminder(signedInUid);
    else if (!initializing) cancelVoteReminder();
  }, [signedInUid, initializing]);

  const login = (userData?: UserProfile) => {
    if (userData) {
      setUser(userData);
    }
    setFreshLogin(true);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.log('Logout error:', e);
    } finally {
      setUser(null);
      setFreshLogin(false);
      setIsAuthenticated(false);
    }
  };

  const updateUserData = (userData: Partial<UserProfile>) => {
    setUser(prev =>
      prev ? { ...prev, ...userData } : (userData as UserProfile)
    );
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        initializing,
        user,
        freshLogin,
        clearFreshLogin: () => setFreshLogin(false),
        login,
        logout,
        updateUserData,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
