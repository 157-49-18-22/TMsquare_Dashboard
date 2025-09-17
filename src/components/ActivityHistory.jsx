import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Grid,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  Info as InfoIcon,
  LocalShipping as FastagIcon,
  Login as LoginIcon,
  SupervisorAccount as AssignmentIcon,
  Edit as EditIcon,
  FileDownload as DownloadIcon
} from '@mui/icons-material';
import { getFirestore, collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { exportToExcel, formatDataForExport } from '../utils/excelExport';

const ActivityHistory = () => {
  const db = getFirestore();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filter, setFilter] = useState({
    type: '',
    searchText: ''
  });
  const [detailDialog, setDetailDialog] = useState({
    open: false,
    activity: null
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      const usersList = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        usersList.push({
          id: doc.id,
          displayName: userData.displayName || userData.email || 'Unknown User',
          email: userData.email,
          role: userData.role || 'user',
          activityCount: (userData.activityHistory || []).length
        });
      });
      
      // Sort by users with most activity first
      usersList.sort((a, b) => b.activityCount - a.activityCount);
      
      setUsers(usersList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setLoading(false);
    }
  };

  const fetchFastagRegistrationsForUser = async (userId) => {
    try {
      const fastagRef = collection(db, 'fastagRegistrations');
      const q = query(fastagRef, where('user.uid', '==', userId));
      const snapshot = await getDocs(q);
      
      const fastagActivities = [];
      
      snapshot.forEach(doc => {
        const registration = doc.data();
        
        // Extract activities from each registration stage
        if (registration.stages) {
          Object.entries(registration.stages).forEach(([stageName, stageData]) => {
            // Convert stage name to display name
            let stageDisplayName = stageName;
            switch (stageName) {
              case 'validate-customer':
                stageDisplayName = 'Customer Validation';
                break;
              case 'validate-otp':
                stageDisplayName = 'OTP Validation';
                break;
              case 'document-upload':
                stageDisplayName = 'Document Upload';
                break;
              case 'manual-activation':
                stageDisplayName = 'Manual Activation';
                break;
              case 'fastag-registration':
                stageDisplayName = 'FasTag Registration';
                break;
            }
            
            // Create activity object
            fastagActivities.push({
              id: `${doc.id}-${stageName}`,
              type: 'fastag_registration',
              description: `Completed ${stageDisplayName} for vehicle ${registration.vehicleNo || 'Unknown'}`,
              timestamp: stageData.timestamp,
              data: {
                stage: stageName,
                vehicleNo: registration.vehicleNo || null,
                mobileNo: registration.mobileNo || null,
                sessionId: stageData.sessionId || null,
                registrationId: doc.id
              }
            });
          });
        }
      });
      
      return fastagActivities;
    } catch (error) {
      console.error('Error fetching FasTag registrations:', error);
      return [];
    }
  };

  const fetchUserActivity = async (user) => {
    try {
      setLoading(true);
      setSelectedUser(user);
      
      // Get user document for regular activities
      const userRef = collection(db, 'users');
      const q = query(userRef, where('__name__', '==', user.id));
      const userSnapshot = await getDocs(q);
      
      let regularActivities = [];
      
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        regularActivities = userData.activityHistory || [];
      }
      
      // Get FasTag registration activities
      const fastagActivities = await fetchFastagRegistrationsForUser(user.id);
      
      // Combine both types of activities
      let allActivities = [...regularActivities, ...fastagActivities];
      
      // Apply filters if needed
      if (filter.type) {
        allActivities = allActivities.filter(activity => activity.type === filter.type);
      }
      
      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        allActivities = allActivities.filter(activity =>
          activity.description.toLowerCase().includes(searchLower)
        );
      }
      
      // Sort by timestamp (most recent first)
      allActivities.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dateB - dateA;
      });
      
      // Update activity counts
      const updatedUsers = users.map(u => {
        if (u.id === user.id) {
          return {
            ...u,
            activityCount: allActivities.length
          };
        }
        return u;
      });
      
      setUsers(updatedUsers);
      setActivities(allActivities);
      setPage(0);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user activity:', error);
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilter({
      ...filter,
      [name]: value
    });
  };

  const applyFilter = () => {
    if (selectedUser) {
      fetchUserActivity(selectedUser);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const getActivityTypeChip = (type) => {
    let color = 'default';
    let label = type.replace('_', ' ');
    let icon = <InfoIcon />;
    
    switch (type) {
      case 'login':
        color = 'success';
        icon = <LoginIcon fontSize="small" />;
        break;
      case 'assignment':
        color = 'primary';
        icon = <AssignmentIcon fontSize="small" />;
        break;
      case 'unassignment':
        color = 'warning';
        icon = <AssignmentIcon fontSize="small" />;
        break;
      case 'status_change':
        color = 'info';
        break;
      case 'profile_update':
        color = 'secondary';
        icon = <EditIcon fontSize="small" />;
        break;
      case 'fastag_registration':
        color = 'primary';
        icon = <FastagIcon fontSize="small" />;
        label = 'FasTag Registration';
        break;
      default:
        color = 'default';
    }
    
    return (
      <Chip
        icon={icon}
        label={label}
        color={color}
        size="small"
      />
    );
  };

  const handleOpenDetails = (activity) => {
    setDetailDialog({
      open: true,
      activity
    });
  };

  const handleCloseDetails = () => {
    setDetailDialog({
      open: false,
      activity: null
    });
  };

  const renderActivityDetails = (activity) => {
    if (!activity) return null;
    
    // Different rendering based on activity type
    if (activity.type === 'fastag_registration') {
      return (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="h6">FasTag Registration Activity</Typography>
            <Typography variant="body2" color="textSecondary">
              {formatDate(activity.timestamp)}
            </Typography>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2">Stage</Typography>
            <Typography>{activity.data?.stage || 'Unknown'}</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2">Vehicle Number</Typography>
            <Typography>{activity.data?.vehicleNo || 'N/A'}</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2">Mobile Number</Typography>
            <Typography>{activity.data?.mobileNo || 'N/A'}</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2">Session ID</Typography>
            <Typography sx={{ wordBreak: 'break-all' }}>{activity.data?.sessionId || 'N/A'}</Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle2">Description</Typography>
            <Typography>{activity.description}</Typography>
          </Grid>
          
          {activity.data?.registrationId && (
            <Grid item xs={12}>
              <Typography variant="subtitle2">Registration ID</Typography>
              <Typography sx={{ wordBreak: 'break-all' }}>{activity.data.registrationId}</Typography>
            </Grid>
          )}
        </Grid>
      );
    }
    
    // Default rendering for other activity types
    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="h6">Activity Details</Typography>
          <Typography variant="body2" color="textSecondary">
            {formatDate(activity.timestamp)}
          </Typography>
          <Divider sx={{ my: 1 }} />
        </Grid>
        
        <Grid item xs={12}>
          <Typography variant="subtitle2">Type</Typography>
          <Typography>{activity.type}</Typography>
        </Grid>
        
        <Grid item xs={12}>
          <Typography variant="subtitle2">Description</Typography>
          <Typography>{activity.description}</Typography>
        </Grid>
        
        {activity.data && (
          <Grid item xs={12}>
            <Typography variant="subtitle2">Additional Data</Typography>
            <Box sx={{ pl: 2 }}>
              {Object.entries(activity.data).map(([key, value]) => (
                <Typography key={key} variant="body2">
                  {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
                </Typography>
              ))}
            </Box>
          </Grid>
        )}
      </Grid>
    );
  };

  const handleExportToExcel = () => {
    if (!selectedUser || activities.length === 0) {
      alert('Please select a user with activities first');
      return;
    }
    
    // Define column mapping for better readability in Excel
    const columnMapping = {
      id: 'Activity ID',
      type: 'Activity Type',
      description: 'Description',
      timestamp: 'Timestamp',
      ipAddress: 'IP Address',
      deviceInfo: 'Device Info',
      performedBy: 'Performed By'
    };
    
    // Fields to omit from export
    const omitFields = ['data'];
    
    // Process activities to format data
    const processedActivities = activities.map(activity => {
      // Format timestamp
      let timestamp = activity.timestamp;
      if (timestamp && timestamp.toDate) {
        timestamp = timestamp.toDate();
      } else if (timestamp) {
        timestamp = new Date(timestamp);
      } else {
        timestamp = 'Unknown';
      }
      
      // Get performedBy info if available
      let performedBy = 'Self';
      if (activity.performedBy) {
        performedBy = activity.performedBy.displayName || activity.performedBy.email || activity.performedBy.uid || 'Unknown';
      }
      
      return {
        ...activity,
        timestamp,
        performedBy,
        activityType: getActivityTypeDisplay(activity.type)
      };
    });
    
    // Format and export data
    const formattedData = formatDataForExport(processedActivities, columnMapping, omitFields);
    exportToExcel(formattedData, `User_Activity_${selectedUser.displayName.replace(/\s+/g, '_')}`, 'Activity History');
  };
  
  // Helper function to get display value for activity type
  const getActivityTypeDisplay = (type) => {
    switch (type) {
      case 'login':
        return 'Login';
      case 'logout':
        return 'Logout';
      case 'profile_update':
        return 'Profile Update';
      case 'fastag_registration':
        return 'FasTag Registration';
      case 'assignment':
        return 'FasTag Assignment';
      default:
        return type || 'Unknown';
    }
  };

  return (
    <Box>
      <Grid container spacing={2} justifyContent="space-between" alignItems="center" mb={3}>
        <Grid item>
          <Typography variant="h4" gutterBottom>
            User Activity History
          </Typography>
        </Grid>
        <Grid item>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportToExcel}
            disabled={!selectedUser || activities.length === 0}
            sx={{ mr: 1 }}
          >
            Export to Excel
          </Button>
        </Grid>
      </Grid>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Users
            </Typography>
            
            {loading && !selectedUser ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List>
                {users.map(user => (
                  <Box key={user.id}>
                    <ListItem 
                      button 
                      selected={selectedUser?.id === user.id}
                      onClick={() => fetchUserActivity(user)}
                    >
                      <ListItemIcon>
                        <Avatar sx={{ bgcolor: user.role === 'admin' ? 'primary.main' : user.role === 'subAdmin' ? 'secondary.main' : 'success.main' }}>
                          {user.displayName[0]}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText 
                        primary={user.displayName} 
                        secondary={
                          <Box>
                            <Typography variant="body2">{user.email}</Typography>
                            <Chip 
                              label={`${user.activityCount} activities`} 
                              size="small"
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        } 
                      />
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Activity Type</InputLabel>
                  <Select
                    name="type"
                    value={filter.type}
                    onChange={handleFilterChange}
                    label="Activity Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="login">Login</MenuItem>
                    <MenuItem value="assignment">Assignment</MenuItem>
                    <MenuItem value="unassignment">Unassignment</MenuItem>
                    <MenuItem value="status_change">Status Change</MenuItem>
                    <MenuItem value="profile_update">Profile Update</MenuItem>
                    <MenuItem value="fastag_registration">FasTag Registration</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Description"
                  name="searchText"
                  value={filter.searchText}
                  onChange={handleFilterChange}
                />
              </Grid>
              
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={applyFilter}
                  disabled={!selectedUser}
                >
                  Filter
                </Button>
              </Grid>
            </Grid>
          </Paper>
          
          <Paper sx={{ height: 'calc(70vh - 72px)' }}>
            <TableContainer sx={{ maxHeight: 'calc(70vh - 72px - 52px)' }}>
              {loading && selectedUser ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : !selectedUser ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, height: '50vh' }}>
                  <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    Select a user to view activity history
                  </Typography>
                </Box>
              ) : (
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          No activity history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      activities
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((activity, index) => (
                          <TableRow key={activity.id || index}>
                            <TableCell>{formatDate(activity.timestamp)}</TableCell>
                            <TableCell>{getActivityTypeChip(activity.type)}</TableCell>
                            <TableCell>{activity.description}</TableCell>
                            <TableCell>
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => handleOpenDetails(activity)}
                              >
                                <InfoIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              )}
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={activities.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Paper>
        </Grid>
      </Grid>
      
      {/* Activity Details Dialog */}
      <Dialog 
        open={detailDialog.open} 
        onClose={handleCloseDetails}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Activity Details</DialogTitle>
        <DialogContent dividers>
          {renderActivityDetails(detailDialog.activity)}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ActivityHistory; 