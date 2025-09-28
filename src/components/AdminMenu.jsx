import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  SupervisorAccount as AdminIcon,
  LocalShipping as FastagIcon,
  History as HistoryIcon,
  Assignment as AssignmentIcon,
  BarChart as AnalyticsIcon,
  Settings as SettingsIcon,
  ListAlt as RegistrationHistoryIcon,
  AccountBalanceWallet as WalletIcon,
  VpnKey as KeyIcon,
  FormatListBulleted as LogsIcon,
  Add as AddIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const AdminMenu = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData, isSuperAdmin } = useAuth();
  
  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      adminOnly: false
    },
    // {
    //   text: 'Users List',
    //   icon: <PeopleIcon />,
    //   path: '/users-list',
    //   adminOnly: false
    // },
    // {
    //   text: 'Wallet Top-ups',
    //   icon: <WalletIcon />,
    //   path: '/wallet-topups',
    //   adminOnly: true
    // },
    {
      text: 'Wallet Access Manager',
      icon: <KeyIcon />,
      path: '/wallet-access',
      adminOnly: true,
      superAdminOnly: true
    },
    {
      text: 'FastTag Allocation',
      icon: <FastagIcon />,
      path: '/fastag-management',
      adminOnly: false
    },
    
    // COMMENTED OUT: FasTag Registration History to reduce document reads
    // {
    //   text: 'FasTag Registration History',
    //   icon: <RegistrationHistoryIcon />,
    //   path: '/fastag-registration-history',
    //   adminOnly: true
    //     },
    // COMMENTED OUT: Form Registration Logs to reduce Firebase document reads
    {
      text: 'Successful Registrations',
      icon: <LogsIcon />,
      path: '/form-registration-logs',
      adminOnly: true
    },
    {
      text: 'Successful Registrations - RSA',
      icon: <LogsIcon />,
      path: '/form-registration-logs-agent-70062',
      adminOnly: true
    },
    {
      text: 'Add Manual Logs',
      icon: <AddIcon />,
      path: '/new-logs',
      adminOnly: true
    },
    {
      text: 'FasTag Registration LOGS - Last 2 Days',
      icon: <RegistrationHistoryIcon />,
      path: '/fastag-registration-history-last-2-days',
      adminOnly: true
    },
    // COMMENTED OUT: Assignment Logs to reduce document reads
    // {
    //   text: 'Assignment Logs',
    //   icon: <AssignmentIcon />,
    //   path: '/assignment-logs',
    //   adminOnly: true
    // },
    // COMMENTED OUT: Activity History to reduce document reads
    {
      text: 'Activity History',
      icon: <HistoryIcon />,
      path: '/activity-history',
      adminOnly: true
    },
    // {
    //   text: 'Analytics',
    //   icon: <AnalyticsIcon />,
    //   path: '/analytics',
    //   adminOnly: false
    // },
    {
      text: 'Settings',
      icon: <SettingsIcon />,
      path: '/settings',
      adminOnly: false
    },
    {
      text: 'Wallet Topup History',
      icon: <HistoryIcon />,
      path: '/successful-registrations',
      adminOnly: true
    },
    {
      text: 'FastTag Data',
      icon: <FastagIcon />,
      path: '/fastag-data',
      adminOnly: false
    },
    {
      text: 'Transactions',
      icon: <HistoryIcon />,
      path: '/transactions',
      adminOnly: false
    },
    {
      text: 'User Transactions',
      icon: <ReceiptIcon />,
      path: '/user-transactions',
      adminOnly: false
    },
    {
      text: 'User Management',
      icon: <PeopleIcon />,
      path: '/users',
      adminOnly: false
    },
    {
      text: 'Registration Pending Requests',
      icon: <PeopleIcon />,
      path: '/pending',
      adminOnly: false
    }
  ];
  
  const handleNavigation = (path) => {
    navigate(path);
  };
  
  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  return (
    <Box>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" color="primary">
          {isSuperAdmin ? 'Admin Dashboard' : 'Sub-Admin Dashboard'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {userData?.displayName || userData?.email || 'User'}
        </Typography>
      </Box>
      
      <Divider />
      
      <List component="nav">
        {menuItems.map((item) => {
          // Skip admin-only items for non-super-admins
          if (item.adminOnly && !isSuperAdmin) return null;
          
          // Skip super-admin-only items for non-super-admins
          if (item.superAdminOnly && !isSuperAdmin) return null;
          
          return (
            <ListItem
              key={item.text}
              onClick={() => handleNavigation(item.path)}
              selected={isActiveRoute(item.path)}
              sx={{
                borderRadius: 1,
                mx: 1,
                mb: 0.5,
                cursor: 'pointer',
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                  }
                }
              }}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default AdminMenu; 