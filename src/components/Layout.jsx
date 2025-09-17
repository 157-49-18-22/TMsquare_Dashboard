import React, { useState } from 'react';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Container, 
  Avatar, 
  Badge, 
  Menu, 
  MenuItem, 
  Paper,
  Divider,
  Tooltip,
  styled,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Home as HomeIcon,
  Group as GroupIcon,
  Dashboard as DashboardIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  LocalShipping as FastagIcon,
  ArrowBack as ArrowBackIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminMenu from './AdminMenu';

// Styled components to match HomeScreen.jsx style
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#FFFFFF',
  color: theme.palette.text.primary,
  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
}));

const BottomNavContainer = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: 85,
  zIndex: 1000,
  backgroundColor: 'transparent',
  boxShadow: 'none',
  borderRadius: 0,
}));

const BottomNav = styled(Paper)(({ theme }) => ({
  width: '92%',
  height: 75,
  backgroundColor: '#FFFFFF',
  borderRadius: 25,
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  paddingHorizontal: 15,
  boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.15)',
  marginBottom: 10,
}));

const NavItem = styled(Box)(({ theme, active }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
  height: '100%',
  flex: 1,
  color: active ? theme.palette.secondary.main : theme.palette.text.secondary,
}));

const NavIconContainer = styled(Box)(({ theme, active }) => ({
  width: 45,
  height: 45,
  borderRadius: 14,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 5,
  backgroundColor: active ? 'rgba(0, 172, 193, 0.1)' : 'transparent',
}));

const drawerWidth = 240;

function Layout({ children }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userData, logout } = useAuth();
  
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const notificationOpen = Boolean(notificationAnchorEl);
  
  // Get the title for the current page - PRESERVED FROM ORIGINAL
  const getPageTitle = () => {
    // Common paths
    if (location.pathname === '/admin') return 'Admin Dashboard';
    if (location.pathname === '/subadmin') return 'Sub-Admin Dashboard';
    if (location.pathname === '/dashboard') return 'Dashboard';
    if (location.pathname === '/users') return 'User ManaHey, Cortana. gement';
    if (location.pathname === '/users-list') return 'Users List';
    if (location.pathname === '/fastag-management') return 'FastTag Management';
    if (location.pathname === '/analytics') return 'Analytics';
    if (location.pathname === '/settings') return 'Settings';
    if (location.pathname === '/assignment-logs') return 'Assignment Logs';
    if (location.pathname === '/activity-history') return 'Activity History';
    if (location.pathname === '/fastag-registration-history') return 'FasTag Registration History';
    if (location.pathname === '/fastag-registration-history-last-2-days') return 'FasTag Registration History - Last 2 Days';
    if (location.pathname === '/wallet-topups') return 'Wallet Topup Requests';
    if (location.pathname === '/wallet-topup-history') return 'Wallet Topup History';
    if (location.pathname === '/form-registration-logs') return 'Form Registration Logs';
    if (location.pathname === '/form-registration-logs-agent-70062') return 'Form Registration Logs - Agent 70062';
    if (location.pathname === '/transactions') return 'Transactions';
    
    // Default fallback
    return 'Dashboard';
  };
  
  // Helper to check if a route is active
  const isActive = (path) => {
    if (path === '/admin' || path === '/subadmin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };
  
  // Bottom navigation items (for mobile)
  const bottomNavItems = [
    { 
      path: userData?.isSuperAdmin ? '/admin' : '/subadmin', 
      label: 'Dashboard', 
      icon: <DashboardIcon fontSize="medium" /> 
    },
    { path: '/users-list', label: 'Users', icon: <GroupIcon fontSize="medium" /> },
    { 
      path: '/fastag-management', 
      label: 'FasTag', 
      icon: <FastagIcon fontSize="medium" /> 
    },
    { path: '/transactions', label: 'Transactions', icon: <HistoryIcon fontSize="medium" /> },
    { path: '/settings', label: 'Settings', icon: <SettingsIcon fontSize="medium" /> },
  ];
  
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
  
  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleNotificationClick = (event) => {
    setNotificationAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleNotificationClose = () => {
    setNotificationAnchorEl(null);
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };
  
  // Navigate to a route and close drawer
  const navigateTo = (path) => {
    navigate(path);
    setMobileOpen(false);
  };
  
  const drawer = (
    <div>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2, bgcolor: '#333333' }}>
        <Avatar sx={{ width: 64, height: 64, bgcolor: '#FFFFFF', color: '#333333', mb: 1 }}>
          {userData?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || 'A'}
        </Avatar>
        <Typography variant="subtitle1" sx={{ color: '#FFFFFF', fontWeight: 'bold' }}>
          {userData?.displayName || currentUser?.email?.split('@')[0] || 'Admin'}
        </Typography>
        <Typography variant="body2" sx={{ color: '#CCCCCC' }}>
          {userData?.isSuperAdmin ? 'Super Admin' : userData?.role === 'subAdmin' ? 'Sub Admin' : 'Admin'}
        </Typography>
      </Box>
      <AdminMenu />
    </div>
  );
  
  return (
    <Box sx={{ display: 'flex' }}>
      <StyledAppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ flexGrow: 1, fontWeight: 'bold' }}
          >
            {getPageTitle()}
          </Typography>
          
          {/* Notification Icon */}
          <IconButton
            color="inherit"
            edge="end"
            onClick={handleNotificationClick}
            sx={{ mr: 2 }}
          >
            <Badge badgeContent={3} color="secondary">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          
          {/* User profile menu */}
          <Box>
            <Tooltip title={userData?.displayName || currentUser?.email || 'User'}>
              <IconButton
                onClick={handleMenu}
                color="inherit"
              >
                <Avatar 
                  sx={{ 
                    width: 36, 
                    height: 36, 
                    bgcolor: '#333333', 
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: 'bold',
                  }}
                >
                  {userData?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || <PersonIcon />}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  width: 200,
                  borderRadius: 2,
                  '&:before': {
                    content: '""',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    right: 14,
                    width: 10,
                    height: 10,
                    bgcolor: 'background.paper',
                    transform: 'translateY(-50%) rotate(45deg)',
                    zIndex: 0,
                  },
                },
              }}
            >
              <MenuItem disabled>
                <Typography variant="body2" color="textSecondary">
                  {userData?.role ? `Logged in as ${userData.role}` : 'Logged in'}
                </Typography>
              </MenuItem>
              <MenuItem onClick={() => {
                handleClose();
                navigate('/settings');
              }}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </StyledAppBar>
      
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRadius: 0
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRadius: 0,
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)'
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      {/* Notification Menu */}
      <Menu
        anchorEl={notificationAnchorEl}
        id="notification-menu"
        open={notificationOpen}
        onClose={handleNotificationClose}
        PaperProps={{
          sx: {
            mt: 1.5,
            width: 320,
            borderRadius: 2,
            maxHeight: 400,
            overflow: 'auto',
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1, bgcolor: '#F5F5F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold">Notifications</Typography>
          <Typography variant="body2" color="primary" sx={{ cursor: 'pointer' }}>Mark all as read</Typography>
        </Box>
        <MenuItem onClick={handleNotificationClose} sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body1">New user registration</Typography>
            <Typography variant="body2" color="text.secondary">User123 has registered</Typography>
            <Typography variant="caption" color="text.disabled">2 minutes ago</Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleNotificationClose} sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body1">Wallet topup request</Typography>
            <Typography variant="body2" color="text.secondary">New ₹500 topup request pending</Typography>
            <Typography variant="caption" color="text.disabled">10 minutes ago</Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleNotificationClose} sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body1">System alert</Typography>
            <Typography variant="body2" color="text.secondary">Low FasTag inventory warning</Typography>
            <Typography variant="caption" color="text.disabled">1 hour ago</Typography>
          </Box>
        </MenuItem>
        <Box sx={{ px: 2, py: 1, textAlign: 'center' }}>
          <Typography 
            variant="body2" 
            color="primary" 
            sx={{ cursor: 'pointer' }}
            onClick={() => {
              handleNotificationClose();
              navigate('/notifications');
            }}
          >
            View all notifications
          </Typography>
        </Box>
      </Menu>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
          bgcolor: '#F5F5F5'
        }}
      >
        {children}
      </Box>
      
      {/* Bottom Navigation for Mobile */}
      {isMobile && (
        <BottomNavContainer elevation={8}>
          <BottomNav>
            {bottomNavItems.map((item) => (
              <NavItem 
                key={item.path}
                active={isActive(item.path)}
                onClick={() => navigateTo(item.path)}
              >
                <NavIconContainer active={isActive(item.path)}>
                  {item.icon}
                </NavIconContainer>
                <Typography 
                  variant="caption"
                  fontWeight={isActive(item.path) ? 600 : 500}
                >
                  {item.label}
                </Typography>
              </NavItem>
            ))}
          </BottomNav>
        </BottomNavContainer>
      )}
    </Box>
  );
}

export default Layout; 