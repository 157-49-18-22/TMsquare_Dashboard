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
  Badge
} from '@mui/material';
import { 
  People as PeopleIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUsersBySubAdmin } from '../api/firestoreApi';

function SubAdminDashboard() {
  const { userData } = useAuth();
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAssignedUsers();
  }, [userData]);

  const fetchAssignedUsers = async () => {
    if (!userData?.id) return;
    
    try {
      setLoading(true);
      const { success, users, error } = await getUsersBySubAdmin(userData.id);
      
      if (success) {
        setAssignedUsers(users);
        
        // Count active/inactive users
        const active = users.filter(user => user.status === 'active').length;
        const inactive = users.length - active;
        
        setActiveUsers(active);
        setInactiveUsers(inactive);
      } else {
        console.error('Error fetching assigned users:', error);
      }
    } catch (err) {
      console.error('Error fetching assigned users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
  };

  const handleEditUser = (user) => {
    // Navigate to users page with this user pre-selected for editing
    navigate('/users', { state: { editUserId: user.id } });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Sub-Admin Dashboard
      </Typography>
      
      {/* Stats at the top */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140, bgcolor: 'primary.light', color: 'white' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" gutterBottom>
                Assigned Users
              </Typography>
              <PeopleIcon fontSize="large" />
            </Box>
            <Typography variant="h3" component="div" sx={{ mt: 'auto' }}>
              {assignedUsers.length}
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140, bgcolor: 'success.light', color: 'white' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" gutterBottom>
                Active Users
              </Typography>
              <DashboardIcon fontSize="large" />
            </Box>
            <Typography variant="h3" component="div" sx={{ mt: 'auto' }}>
              {activeUsers}
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140, bgcolor: 'error.light', color: 'white' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6" gutterBottom>
                Inactive Users
              </Typography>
              <PersonIcon fontSize="large" />
            </Box>
            <Typography variant="h3" component="div" sx={{ mt: 'auto' }}>
              {inactiveUsers}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Main content */}
      <Grid container spacing={3}>
        {/* User list */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '65vh', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Your Assigned Users
            </Typography>
            {loading ? (
              <Typography>Loading...</Typography>
            ) : assignedUsers.length === 0 ? (
              <Typography>No users assigned to you yet.</Typography>
            ) : (
              <List>
                {assignedUsers.map((user) => (
                  <Box key={user.id}>
                    <ListItem 
                      button 
                      onClick={() => handleUserClick(user)}
                      selected={selectedUser?.id === user.id}
                      secondaryAction={
                        <Tooltip title="Edit user">
                          <IconButton edge="end" onClick={() => handleEditUser(user)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      }
                    >
                      <ListItemIcon>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: user.status === 'active' ? 'success.main' : 'error.main',
                                border: '2px solid white'
                              }}
                            />
                          }
                        >
                          <Avatar sx={{ bgcolor: user.status === 'active' ? 'primary.main' : 'text.disabled' }}>
                            {user.displayName?.[0] || user.email?.[0] || <PersonIcon />}
                          </Avatar>
                        </Badge>
                      </ListItemIcon>
                      <ListItemText 
                        primary={user.displayName || user.email} 
                        secondary={user.email} 
                      />
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        
        {/* User details */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, height: '65vh', overflow: 'auto' }}>
            {selectedUser ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    User Details
                  </Typography>
                  <Box>
                    <Button 
                      startIcon={<EditIcon />} 
                      variant="outlined" 
                      color="primary"
                      onClick={() => handleEditUser(selectedUser)}
                      sx={{ mr: 1 }}
                    >
                      Edit
                    </Button>
                  </Box>
                </Box>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Basic Information
                        </Typography>
                        <Typography><strong>Name:</strong> {selectedUser.displayName || 'N/A'}</Typography>
                        <Typography><strong>Email:</strong> {selectedUser.email}</Typography>
                        <Typography><strong>Phone:</strong> {selectedUser.phone || 'N/A'}</Typography>
                        <Typography><strong>Status:</strong> 
                          <Chip 
                            size="small" 
                            color={selectedUser.status === 'active' ? 'success' : 'error'} 
                            label={selectedUser.status || 'inactive'} 
                            sx={{ ml: 1 }}
                          />
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          ID Documents
                        </Typography>
                        <Typography><strong>Aadhar Card:</strong> {selectedUser.aadharCard || 'Not provided'}</Typography>
                        <Typography><strong>PAN Card:</strong> {selectedUser.panCard || 'Not provided'}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Address
                        </Typography>
                        <Typography>{selectedUser.address || 'No address provided'}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Account Information
                        </Typography>
                        <Typography><strong>Created:</strong> {selectedUser.createdAt ? new Date(selectedUser.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</Typography>
                        <Typography><strong>Last Login:</strong> {selectedUser.lastLogin ? new Date(selectedUser.lastLogin.seconds * 1000).toLocaleString() : 'N/A'}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <PersonIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Select a user to view details
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default SubAdminDashboard; 