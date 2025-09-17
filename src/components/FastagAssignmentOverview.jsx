import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress
} from '@mui/material';
import {
  LocalShipping as FastagIcon,
  SupervisorAccount as AdminIcon,
  Person as PersonIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const FastagAssignmentOverview = () => {
  const navigate = useNavigate();
  const db = getFirestore();
  
  const [loading, setLoading] = useState(true);
  const [subadmins, setSubadmins] = useState([]);
  const [fastagCounts, setFastagCounts] = useState({});
  const [selectedSubadmin, setSelectedSubadmin] = useState(null);
  const [assignedFastags, setAssignedFastags] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get all subadmins
      const subadminQuery = query(
        collection(db, 'users'),
        where('role', '==', 'subAdmin')
      );
      
      const subadminSnapshot = await getDocs(subadminQuery);
      const subadminList = [];
      const counts = {};
      
      subadminSnapshot.forEach((doc) => {
        const subadmin = { id: doc.id, ...doc.data() };
        subadminList.push(subadmin);
        counts[subadmin.id] = 0; // Initialize count to 0
      });
      
      setSubadmins(subadminList);
      
      // Get all fastags and count assignments
      const fastagRef = collection(db, 'fastags');
      const fastagSnapshot = await getDocs(fastagRef);
      
      fastagSnapshot.forEach((doc) => {
        const fastag = doc.data();
        
        if (fastag.assignedTo && counts[fastag.assignedTo] !== undefined) {
          counts[fastag.assignedTo]++;
        }
      });
      
      setFastagCounts(counts);
    } catch (error) {
      console.error('Error fetching Fastag assignment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubadminClick = async (subadmin) => {
    setSelectedSubadmin(subadmin);
    
    try {
      setLoading(true);
      
      // Get fastags assigned to this subadmin
      const fastagQuery = query(
        collection(db, 'fastags'),
        where('assignedTo', '==', subadmin.id)
      );
      
      const fastagSnapshot = await getDocs(fastagQuery);
      const fastagList = [];
      
      fastagSnapshot.forEach((doc) => {
        fastagList.push({ id: doc.id, ...doc.data() });
      });
      
      setAssignedFastags(fastagList);
    } catch (error) {
      console.error('Error fetching assigned FastTags:', error);
      setAssignedFastags([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status) => {
    const statusColors = {
      available: 'success',
      assigned: 'primary',
      active: 'secondary',
      inactive: 'error',
      pending: 'warning'
    };
    
    return (
      <Chip 
        label={status.charAt(0).toUpperCase() + status.slice(1)} 
        color={statusColors[status] || 'default'} 
        size="small" 
      />
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="div">
          <FastagIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          FastTag Assignment Overview
        </Typography>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => navigate('/fastag-management')}
        >
          Go to FastTag Management
        </Button>
      </Box>
      
      {loading && <CircularProgress />}
      
      {!loading && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2, height: '65vh', overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Sub-Admins
              </Typography>
              
              {subadmins.length === 0 ? (
                <Typography>No sub-admins found.</Typography>
              ) : (
                <List>
                  {subadmins.map((admin) => (
                    <Box key={admin.id}>
                      <ListItem 
                        button 
                        selected={selectedSubadmin?.id === admin.id}
                        onClick={() => handleSubadminClick(admin)}
                      >
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: 'secondary.main' }}>
                            {admin.displayName?.[0] || admin.email?.[0] || <AdminIcon />}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText 
                          primary={admin.displayName || admin.email} 
                          secondary={`${fastagCounts[admin.id] || 0} FastTags assigned`} 
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
            <Paper sx={{ p: 2, height: '65vh', overflow: 'auto' }}>
              {selectedSubadmin ? (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      {selectedSubadmin.displayName || selectedSubadmin.email} 
                    </Typography>
                    <Chip 
                      label={`${fastagCounts[selectedSubadmin.id] || 0} FastTags`} 
                      color="primary"
                    />
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                    Assigned FastTags ({assignedFastags.length})
                  </Typography>
                  
                  {assignedFastags.length === 0 ? (
                    <Typography>No FastTags assigned to this sub-admin.</Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {assignedFastags.map((fastag) => (
                        <Grid item xs={12} md={6} key={fastag.id}>
                          <Card variant="outlined">
                            <CardContent>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle1">
                                  Serial: {fastag.serialNo}
                                </Typography>
                                {getStatusChip(fastag.status || 'unknown')}
                              </Box>
                              <Divider sx={{ my: 1 }} />
                              <Typography variant="body2">
                                TID: {fastag.tid || 'Not set'}
                              </Typography>
                              {fastag.vehicleNo && (
                                <Typography variant="body2">
                                  Vehicle: {fastag.vehicleNo}
                                </Typography>
                              )}
                              {fastag.mobileNo && (
                                <Typography variant="body2">
                                  Mobile: {fastag.mobileNo}
                                </Typography>
                              )}
                            </CardContent>
                            <CardActions>
                              <Button 
                                size="small" 
                                endIcon={<ArrowIcon />}
                                onClick={() => navigate('/fastag-management')}
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
                  <FastagIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    Select a sub-admin to view assigned FastTags
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default FastagAssignmentOverview; 