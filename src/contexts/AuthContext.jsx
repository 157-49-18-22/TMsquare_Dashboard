import { createContext, useContext, useState, useEffect } from 'react';
import { loginWithEmailAndPassword, logout, onAuthStateChange } from '../api/firebaseAuth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('🔄 Setting up auth state listener');
    const unsubscribe = onAuthStateChange(({ currentUser, isAdmin, userData }) => {
      console.log('📊 Auth state updated:', { 
        isAuthenticated: !!currentUser,
        isAdmin,
        hasUserData: !!userData
      });
      
      setCurrentUser(currentUser);
      setUserData(userData);
      setIsAdmin(isAdmin);
      
      // Set more specific role flags
      setIsSuperAdmin(userData?.isSuperAdmin === true);
      setIsSubAdmin(userData?.role === 'subAdmin');
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    console.log('🔑 Login attempt in AuthContext');
    try {
      setError('');
      setLoading(true);
      
      const { success, user, error } = await loginWithEmailAndPassword(email, password);
      
      if (success) {
        console.log('✅ Login successful in AuthContext');
        
        // Set user data immediately for admin login
        setCurrentUser(user);
        setIsAdmin(true);
        
        // Set role-specific flags
        if (user.isSuperAdmin) {
          setIsSuperAdmin(true);
          setIsSubAdmin(false);
        } else if (user.role === 'subAdmin') {
          setIsSuperAdmin(false);
          setIsSubAdmin(true);
        } else {
          setIsSuperAdmin(false);
          setIsSubAdmin(false);
        }
        
        // Set user data for admin
        setUserData({
          ...user,
          isSuperAdmin: user.isSuperAdmin,
          role: user.role || 'admin'
        });
        
        return { success: true };
      } else {
        console.error('❌ Login failed in AuthContext:', error);
        setError(error);
        return { success: false, error };
      }
    } catch (error) {
      console.error('❌ Unexpected error in AuthContext login:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    console.log('🚪 Logout attempt in AuthContext');
    try {
      // For admin users, we don't need to call Firebase logout
      // Just clear the local state
      if (currentUser && currentUser.uid === 'admin-user-id') {
        console.log('✅ Admin logout successful in AuthContext');
        setCurrentUser(null);
        setUserData(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsSubAdmin(false);
        return { success: true };
      }
      
      // For sub-admin users, use Firebase logout
      const { success, error } = await logout();
      if (success) {
        console.log('✅ Sub-admin logout successful in AuthContext');
        setCurrentUser(null);
        setUserData(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsSubAdmin(false);
      } else {
        console.error('❌ Logout failed in AuthContext:', error);
        setError(error);
      }
      return { success, error };
    } catch (error) {
      console.error('❌ Unexpected error in AuthContext logout:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  };

  const value = {
    currentUser,
    userData,
    isAdmin,
    isSuperAdmin,
    isSubAdmin,
    loading,
    error,
    login,
    logout: logoutUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 