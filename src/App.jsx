import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UsersList from './pages/UsersList';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import SubAdminDashboard from './pages/SubAdminDashboard';
import FastagManagement from './pages/FastagManagement';
import FastagData from './pages/FastagData';
import AssignmentLogs from './components/AssignmentLogs';
import ActivityHistory from './components/ActivityHistory';
import FastagRegistrationHistory from './pages/FastagRegistrationHistory';
import FastagRegistrationHistoryLast2Days from './pages/FastagRegistrationHistoryLast2Days';
import WalletTopupRequests from './pages/WalletTopupRequests';
import WalletTopupHistory from './pages/WalletTopupHistory';
import WalletAccessManager from './pages/WalletAccessManager';
import FormRegistrationLogs from './pages/FormRegistrationLogs';
import FormRegistrationLogsAgent70062 from './pages/FormRegistrationLogsAgent70062';
import SuccessfulRegistrations from './pages/SuccessfulRegistrations';
import Transactions from './pages/Transactions';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#333333',
      light: '#555555',
      dark: '#1E1E1E',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#00ACC1',
      light: '#4DD0E1',
      dark: '#007A8C',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#333333',
      secondary: '#777777',
    },
    error: {
      main: '#D32F2F',
      light: '#FFEBEE',
    },
    warning: {
      main: '#FFA000',
      light: '#FFF8E1',
    },
    info: {
      main: '#2196F3',
      light: '#E3F2FD',
    },
    success: {
      main: '#4CAF50',
      light: '#E8F5E9',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    button: {
      textTransform: 'none',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

// Protected Route component that checks for admin role
function AdminRoute({ children }) {
  const auth = useAuth();
  
  // Handle loading state
  if (!auth || auth.loading) {
    return <div>Loading...</div>;
  }

  // Destructure after checking auth exists
  const { currentUser, userData, isAdmin, isSuperAdmin } = auth;
  
  console.log('🔒 Admin Route Check:', { 
    isAuthenticated: !!currentUser, 
    isAdmin: isAdmin,
    isSuperAdmin: isSuperAdmin,
    userDataIsAdmin: userData?.isAdmin,
    userDataIsSuperAdmin: userData?.isSuperAdmin,
    isLoading: auth.loading 
  });

  // Check if user is authenticated and is an admin
  if (!currentUser || (!isAdmin && !userData?.isAdmin)) {
    console.log('🚫 Access denied, redirecting to login');
    return <Navigate to="/login" />;
  }
  
  // Only super admins can access admin-only routes
  if (!isSuperAdmin && userData?.isSuperAdmin !== true) {
    console.log('🚫 Access denied for non-super admin, redirecting to dashboard');
    return <Navigate to="/dashboard" />;
  }

  return children;
}

// Protected Route for any admin (super or sub)
function AdminOrSubAdminRoute({ children }) {
  const auth = useAuth();
  
  // Handle loading state
  if (!auth || auth.loading) {
    return <div>Loading...</div>;
  }

  // Destructure after checking auth exists
  const { currentUser, userData, isAdmin } = auth;
  
  console.log('🔒 Admin/SubAdmin Route Check:', { 
    isAuthenticated: !!currentUser, 
    isAdmin: isAdmin,
    userDataIsAdmin: userData?.isAdmin,
    isLoading: auth.loading 
  });

  if (!currentUser || (!isAdmin && !userData?.isAdmin)) {
    console.log('🚫 Access denied, redirecting to login');
    return <Navigate to="/login" />;
  }

  return children;
}

// Route that protects the dashboard and redirects based on role
function DashboardRedirect() {
  const auth = useAuth();
  
  // Handle loading state
  if (!auth || auth.loading) {
    return <div>Loading...</div>;
  }

  // Destructure after checking auth exists
  const { userData, isSuperAdmin } = auth;
  
  // Super admin should never see the regular dashboard
  if (isSuperAdmin || userData?.isSuperAdmin === true) {
    console.log('Super admin accessing /dashboard - redirecting to /admin');
    return <Navigate to="/admin" replace />;
  }
  
  // Sub-admin should use their specific dashboard
  if (userData?.role === 'subAdmin') {
    console.log('Sub-admin accessing /dashboard - redirecting to /subadmin');
    return <Navigate to="/subadmin" replace />;
  }
  
  // Regular users see the standard dashboard
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}

// Index path component that redirects to the proper route based on user role
function IndexRedirect() {
  const auth = useAuth();
  
  // Handle loading state
  if (!auth || auth.loading) {
    return <div>Loading...</div>;
  }

  // Destructure after checking auth exists
  const { userData, isSuperAdmin } = auth;
  
  // Redirect to the appropriate dashboard based on role
  if (isSuperAdmin || userData?.isSuperAdmin === true) {
    console.log('Redirecting super admin to /admin');
    return <Navigate to="/admin" replace />;
  }
  
  if (userData?.role === 'subAdmin') {
    console.log('Redirecting sub-admin to /subadmin');
    return <Navigate to="/subadmin" replace />;
  }
  
  // Default route for normal users
  console.log('Redirecting user to /dashboard');
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Root path decides where to redirect based on role */}
      <Route
        path="/"
        element={
          <AdminOrSubAdminRoute>
            <IndexRedirect />
          </AdminOrSubAdminRoute>
        }
      />
      
      {/* Dashboard - redirects based on role */}
      <Route
        path="/dashboard"
        element={
          <AdminOrSubAdminRoute>
            <DashboardRedirect />
          </AdminOrSubAdminRoute>
        }
      />
      
      {/* Admin-specific routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Layout>
              <AdminDashboard />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* Wallet Access Manager - Super Admin Only */}
      <Route
        path="/wallet-access"
        element={
          <AdminRoute>
            <Layout>
              <WalletAccessManager />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* Form Registration Logs - Super Admin Only */}
      <Route
        path="/form-registration-logs"
        element={
          <AdminRoute>
            <Layout>
              <FormRegistrationLogs />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* Form Registration Logs Agent 70062 - Super Admin Only */}
      <Route
        path="/form-registration-logs-agent-70062"
        element={
          <AdminRoute>
            <Layout>
              <FormRegistrationLogsAgent70062 />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* Successful Registrations - Super Admin Only */}
      <Route
        path="/successful-registrations"
        element={
          <AdminRoute>
            <Layout>
              <SuccessfulRegistrations />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* Sub-admin dashboard */}
      <Route
        path="/subadmin"
        element={
          <AdminOrSubAdminRoute>
            <Layout>
              <SubAdminDashboard />
            </Layout>
          </AdminOrSubAdminRoute>
        }
      />
      
      {/* User management - accessible by any admin */}
      <Route
        path="/users"
        element={
          <AdminOrSubAdminRoute>
            <Layout>
              <Users />
            </Layout>
          </AdminOrSubAdminRoute>
        }
      />
      
      {/* Users List - simplified view for better performance */}
      <Route
        path="/users-list"
        element={
          <AdminOrSubAdminRoute>
            <Layout>
              <UsersList />
            </Layout>
          </AdminOrSubAdminRoute>
        }
      />
      
      <Route
        path="/analytics"
        element={
          <AdminOrSubAdminRoute>
            <Layout>
              <Analytics />
            </Layout>
          </AdminOrSubAdminRoute>
        }
      />
      
      {/* Wallet top-up requests - accessible by super admin */}
      <Route
        path="/wallet-topups"
        element={
          <AdminRoute>
            <Layout>
              <WalletTopupRequests />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* Wallet Topup History - Super Admin Only */}
      <Route
        path="/wallet-topup-history"
        element={
          <AdminRoute>
            <Layout>
              <WalletTopupHistory />
            </Layout>
          </AdminRoute>
        }
      />
      
      <Route
        path="/settings"
        element={
          <AdminOrSubAdminRoute>
            <Layout>
              <Settings />
            </Layout>
          </AdminOrSubAdminRoute>
        }
      />
      
      {/* Fastag Management */}
      <Route
        path="/fastag-management"
        element={
          <AdminOrSubAdminRoute>
            <Layout>
              <FastagManagement />
            </Layout>
          </AdminOrSubAdminRoute>
        }
      />
      
      {/* Fastag Data Management */}
      <Route
        path="/fastag-data"
        element={
          <AdminOrSubAdminRoute>
            <Layout>
              <FastagData />
            </Layout>
          </AdminOrSubAdminRoute>
        }
      />
      
      {/* Transactions - accessible by any admin */}
      <Route
        path="/transactions"
        element={
          <AdminOrSubAdminRoute>
            <Layout>
              <Transactions />
            </Layout>
          </AdminOrSubAdminRoute>
        }
      />
      
      {/* FasTag Registration History - Super Admin Only */}
      <Route
        path="/fastag-registration-history"
        element={
          <AdminRoute>
            <Layout>
              <FastagRegistrationHistory />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* FasTag Registration History Last 2 Days - Super Admin Only */}
      <Route
        path="/fastag-registration-history-last-2-days"
        element={
          <AdminRoute>
            <Layout>
              <FastagRegistrationHistoryLast2Days />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* Assignment Logs - Super Admin Only */}
      <Route
        path="/assignment-logs"
        element={
          <AdminRoute>
            <Layout>
              <AssignmentLogs />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* Activity History - Super Admin Only */}
      <Route
        path="/activity-history"
        element={
          <AdminRoute>
            <Layout>
              <ActivityHistory />
            </Layout>
          </AdminRoute>
        }
      />
      
      {/* Catch-all redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
