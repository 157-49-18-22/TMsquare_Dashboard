import { useState, useEffect } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Typography, 
  Card, 
  CardContent, 
  CardActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tab,
  Tabs,
  styled
} from '@mui/material';
import { 
  People as PeopleIcon,
  Person as PersonIcon,
  PersonAdd as PersonAddIcon,
  SupervisorAccount as AdminIcon,
  Dashboard as DashboardIcon,
  Edit as EditIcon,
  LocalShipping as FastagIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getAllUsers, 
  getSubAdmins, 
  createOrUpdateUser,
  getUsersBySubAdmin 
} from '../api/firestoreApi';
// COMMENTED OUT: FastagAssignmentOverview import to reduce document reads
// import FastagAssignmentOverview from '../components/FastagAssignmentOverview';
// COMMENTED OUT: Firebase imports to reduce document reads
// import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';

// Styled components for enhanced visual design
const StatsCard = styled(Paper)(({ theme, bgcolor }) => ({
  padding: 16,
  borderRadius: 16,
  backgroundColor: bgcolor || theme.palette.primary.main,
  color: '#FFFFFF',
  height: 140,
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
  transition: 'transform 0.3s ease',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.15)',
  }
}));

const TabPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  height: '65vh',
  overflow: 'auto',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  '& .MuiTab-root': {
    borderRadius: '8px 8px 0 0',
    fontWeight: 500,
    '&.Mui-selected': {
      backgroundColor: 'rgba(0, 172, 193, 0.1)', 
      color: theme.palette.secondary.main,
    },
  }
}));

function AdminDashboard() {
  const { currentUser } = useAuth();
  // COMMENTED OUT: db variable to reduce document reads
  // const db = getFirestore();
  
  // State for users and sub-admins
  const [users, setUsers] = useState([]);
  const [subAdmins, setSubAdmins] = useState([]);
  const [fastags, setFastags] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI state
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedSubAdmin, setSelectedSubAdmin] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);
  
  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    displayName: '',
    password: '123456', // Default password
    role: 'subAdmin'
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all users
      const { success: usersSuccess, users: allUsers } = await getAllUsers();
      if (usersSuccess) {
        setUsers(allUsers);
      }
      
      // Fetch sub-admins
      const { success: adminsSuccess, subAdmins: admins } = await getSubAdmins();
      if (adminsSuccess) {
        setSubAdmins(admins);
      }
      
      // COMMENTED OUT: Fetch formLogs count where action is "register" and filter for successful registrations
      // This section is commented to reduce Firestore document reads and stay within daily 50k limit
      /*
      try {
        const formLogsRef = collection(db, 'formLogs');
        const q = query(
          formLogsRef,
          where('action', '==', 'register'),
          orderBy('timestamp', 'desc')
        );
        const formLogsSnapshot = await getDocs(q);
        const formLogsList = [];
        
        formLogsSnapshot.forEach((doc) => {
          const logData = doc.data();
          
          // Apply the same filtering logic as in FormRegistrationLogs
          // Check if formData.apiSuccess is true or registration was successful
          if (logData.formData?.apiSuccess === true || 
              (logData.formData?.registrationResponse?.response?.status === "success") ||
              (logData.status === "success" && logData.action === "register")) {
            
            formLogsList.push({ id: doc.id, ...logData });
          }
        });
        
        setFastags(formLogsList);
      } catch (error) {
        console.error('Error fetching formLogs:', error);
      }
      */
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  const handleSubAdminClick = async (subAdmin) => {
    setSelectedSubAdmin(subAdmin);
    
    try {
      setLoading(true);
      const { success, users } = await getUsersBySubAdmin(subAdmin.id);
      if (success) {
        setAssignedUsers(users);
      } else {
        setAssignedUsers([]);
      }
    } catch (error) {
      console.error('Error fetching assigned users:', error);
      setAssignedUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubAdmin = async () => {
    try {
      setLoading(true);
      
      // Basic validation
      if (!newUserForm.email || !newUserForm.displayName) {
        alert('Email and name are required');
        return;
      }
      
      // Create new user with subAdmin role in Firestore
      const { success, error } = await createOrUpdateUser('', {
        email: newUserForm.email,
        displayName: newUserForm.displayName,
        password: newUserForm.password,
        role: 'subAdmin',
        isAdmin: true,
        createdAt: new Date(),
        status: 'active'
      });
      
      if (success) {
        setCreateDialogOpen(false);
        fetchDashboardData();
        
        // Reset form
        setNewUserForm({
          email: '',
          displayName: '',
          password: '123456',
          role: 'subAdmin'
        });
      } else {
        alert('Error creating sub-admin: ' + error);
      }
    } catch (error) {
      console.error('Error creating sub-admin:', error);
      alert('Error creating sub-admin');
    } finally {
      setLoading(false);
    }
  };

  // Stats for the dashboard
  const totalUsers = users.filter(user => user.role !== 'admin' && user.role !== 'subAdmin').length;
  const totalSubAdmins = subAdmins.length;
  const activeUsers = users.filter(user => user.status === 'active' && user.role !== 'admin' && user.role !== 'subAdmin').length;
  const totalRegistrations = 0; // COMMENTED OUT: Set to 0 to reduce document reads (was: fastags.length)
  const assignedFastags = 0; // No longer relevant since we're not using FastTags

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: '#333333' }}>
        Admin Dashboard
      </Typography>
      
      {/* Stats at the top */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard bgcolor="#333333">
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium' }}>
                Total Users
              </Typography>
              <PeopleIcon sx={{ opacity: 0.7 }} />
            </Box>
            <Typography variant="h3" component="div" sx={{ mt: 'auto', fontWeight: 'bold' }}>
              {totalUsers}
            </Typography>
          </StatsCard>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard bgcolor="#E3F2FD">
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#333333', fontWeight: 'medium' }}>
                Sub-Admins
              </Typography>
              <AdminIcon sx={{ opacity: 0.7, color: '#333333' }} />
            </Box>
            <Typography variant="h3" component="div" sx={{ mt: 'auto', fontWeight: 'bold', color: '#333333' }}>
              {totalSubAdmins}
            </Typography>
          </StatsCard>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard bgcolor="#FFF8E1">
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#333333', fontWeight: 'medium' }}>
                Active Users
              </Typography>
              <PersonIcon sx={{ opacity: 0.7, color: '#333333' }} />
            </Box>
            <Typography variant="h3" component="div" sx={{ mt: 'auto', fontWeight: 'bold', color: '#333333' }}>
              {activeUsers}
            </Typography>
          </StatsCard>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard bgcolor="#E8F5E9">
            {/* <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#333333', fontWeight: 'medium' }}>
                Registrations
              </Typography>
              <FastagIcon sx={{ opacity: 0.7, color: '#333333' }} />
            </Box> */}
            {/* <Typography variant="h3" component="div" sx={{ mt: 'auto', fontWeight: 'bold', color: '#333333' }}>
              {totalRegistrations}
            </Typography> */}
            {/* <Typography variant="body2" component="div" sx={{ color: '#333333' }}>
              {totalRegistrations}
            </Typography> */}
          </StatsCard>
        </Grid>
        
      </Grid>
      
      {/* Tabs for dashboard content */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <StyledTabs 
          value={selectedTab} 
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Sub-Admin Management" sx={{ textTransform: 'none' }} />
          <Tab label="User Assignment Overview" sx={{ textTransform: 'none' }} />
          {/* COMMENTED OUT: FastTag Assignment Overview tab to reduce document reads */}
          {/* <Tab label="FastTag Assignment Overview" sx={{ textTransform: 'none' }} /> */}
        </StyledTabs>
      </Paper>
      
      {/* Tab content */}
      <Box sx={{ mt: 2 }}>
        {/* Sub-Admin Management Tab */}
        {selectedTab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 2, height: '65vh', overflow: 'auto', borderRadius: 2, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333333' }}>
                    Sub-Admins
                  </Typography>
                  <Button 
                    startIcon={<PersonAddIcon />} 
                    variant="contained" 
                    sx={{ bgcolor: '#333333', '&:hover': { bgcolor: '#555555' } }}
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    Add Sub-Admin
                  </Button>
                </Box>
                
                {loading ? (
                  <Typography>Loading...</Typography>
                ) : subAdmins.length === 0 ? (
                  <Typography>No sub-admins found.</Typography>
                ) : (
                  <List>
                    {subAdmins.map((admin) => (
                      <Box key={admin.id}>
                        <ListItem 
                          button
                          selected={selectedSubAdmin?.id === admin.id}
                          onClick={() => handleSubAdminClick(admin)}
                          sx={{ 
                            borderRadius: 1,
                            mb: 0.5,
                            '&.Mui-selected': {
                              bgcolor: 'rgba(0, 172, 193, 0.1)', 
                              color: '#00ACC1',
                            }
                          }}
                        >
                          <ListItemIcon>
                            <Avatar sx={{ bgcolor: '#333333' }}>
                              {admin.displayName?.[0] || admin.email?.[0] || <AdminIcon />}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText 
                            primary={admin.displayName || admin.email} 
                            secondary={admin.email} 
                          />
                        </ListItem>
                        <Divider variant="inset" component="li" />
                      </Box>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 2, height: '65vh', overflow: 'auto', borderRadius: 2, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)' }}>
                {selectedSubAdmin ? (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333333' }}>
                        {selectedSubAdmin.displayName || selectedSubAdmin.email} 
                      </Typography>
                      <Button 
                        startIcon={<EditIcon />} 
                        variant="outlined" 
                        color="primary"
                        onClick={() => navigate('/users')}
                      >
                        Edit
                      </Button>
                    </Box>
                    
                    <Divider sx={{ mb: 2 }} />
                    
                    <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 'medium', color: '#333333' }}>
                      Assigned Users ({assignedUsers.length})
                    </Typography>
                    
                    {assignedUsers.length === 0 ? (
                      <Typography>No users assigned to this sub-admin.</Typography>
                    ) : (
                      <Grid container spacing={2}>
                        {assignedUsers.map((user) => (
                          <Grid item xs={12} md={6} key={user.id}>
                            <Card 
                              variant="outlined"
                              sx={{ 
                                borderRadius: 2, 
                                overflow: 'visible',
                                transition: 'transform 0.2s ease',
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
                                }
                              }}
                            >
                              <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Avatar sx={{ mr: 2, bgcolor: user.status === 'active' ? '#E8F5E9' : '#FFEBEE', color: user.status === 'active' ? '#4CAF50' : '#D32F2F' }}>
                                    {user.displayName?.[0] || user.email?.[0] || <PersonIcon />}
                                  </Avatar>
                                  <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'medium', color: '#333333' }}>{user.displayName || user.email}</Typography>
                                    <Typography variant="body2" color="textSecondary">{user.email}</Typography>
                                  </Box>
                                </Box>
                              </CardContent>
                              <CardActions>
                                <Button 
                                  size="small" 
                                  onClick={() => navigate('/users')}
                                  sx={{ color: '#00ACC1' }}
                                >
                                  View Details
                                </Button>
                              </CardActions>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <AdminIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      Select a sub-admin to view details
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
        
        {/* User Assignment Overview Tab */}
        {selectedTab === 1 && (
          <Paper sx={{ p: 2, borderRadius: 2, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#333333' }}>
              User Assignment Overview
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Button 
                variant="contained" 
                sx={{ bgcolor: '#333333', '&:hover': { bgcolor: '#555555' } }}
                onClick={() => navigate('/users')}
              >
                Go to User Management
              </Button>
            </Box>
            
            <Grid container spacing={3}>
              {subAdmins.map((admin) => (
                <Grid item xs={12} md={4} key={admin.id}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      borderRadius: 2, 
                      overflow: 'visible',
                      transition: 'transform 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
                      }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ bgcolor: '#333333', mr: 2 }}>
                          {admin.displayName?.[0] || admin.email?.[0] || <AdminIcon />}
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 'medium', color: '#333333' }}>
                          {admin.displayName || admin.email}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        {admin.email}
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography>
                        <strong>Assigned Users:</strong> {
                          users.filter(user => user.assignedTo === admin.id).length
                        }
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button 
                        size="small" 
                        sx={{ color: '#00ACC1' }}
                        onClick={() => handleSubAdminClick(admin)}
                      >
                        View Assigned Users
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
              
              {subAdmins.length === 0 && (
                <Grid item xs={12}>
                  <Typography>No sub-admins have been created yet.</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        )}
        
        {/* COMMENTED OUT: FastTag Assignment Overview Tab to reduce document reads */}
        {/* {selectedTab === 2 && (
          <FastagAssignmentOverview />
        )} */}
      </Box>
      
      {/* Create Sub-Admin Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.15)',
          }
        }}
      >
        <DialogTitle sx={{ bgcolor: '#333333', color: 'white', fontWeight: 'bold' }}>
          Create New Sub-Admin
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, width: 400, maxWidth: '100%' }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={newUserForm.email}
              onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Name"
              fullWidth
              value={newUserForm.displayName}
              onChange={(e) => setNewUserForm({...newUserForm, displayName: e.target.value})}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Default Password"
              type="password"
              fullWidth
              value={newUserForm.password}
              onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
              helperText="Sub-admin can change this after first login"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setCreateDialogOpen(false)}
            sx={{ color: '#777777' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateSubAdmin} 
            variant="contained" 
            sx={{ bgcolor: '#333333', '&:hover': { bgcolor: '#555555' } }}
            disabled={loading}
          >
            Create Sub-Admin
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminDashboard; 