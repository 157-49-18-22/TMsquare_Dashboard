import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
  Paper
} from '@mui/material';
import {
  LocalShipping as FastagIcon,
  CheckCircle as CheckIcon,
  HourglassEmpty as PendingIcon,
  Error as ErrorIcon,
  Assignment as AssignedIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { getFirestore, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

const FastagSummary = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    assigned: 0,
    active: 0,
    inactive: 0,
    pending: 0
  });
  const [recentFastags, setRecentFastags] = useState([]);

  useEffect(() => {
    fetchFastagStats();
  }, []);

  const fetchFastagStats = async () => {
    setLoading(true);
    try {
      const db = getFirestore();
      const fastagRef = collection(db, 'fastags');
      
      // Get all FastTags
      const querySnapshot = await getDocs(fastagRef);
      
      // Calculate stats
      const newStats = {
        total: 0,
        available: 0,
        assigned: 0,
        active: 0,
        inactive: 0,
        pending: 0
      };
      
      const fastags = [];
      querySnapshot.forEach((doc) => {
        const fastagData = { id: doc.id, ...doc.data() };
        fastags.push(fastagData);
        
        newStats.total++;
        
        // Increment appropriate counter based on status
        if (fastagData.status) {
          if (newStats[fastagData.status] !== undefined) {
            newStats[fastagData.status]++;
          }
        }
      });
      
      setStats(newStats);
      
      // Get 5 most recent FastTags
      const recentQuery = query(
        fastagRef,
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      
      const recentSnapshot = await getDocs(recentQuery);
      const recentList = [];
      
      recentSnapshot.forEach((doc) => {
        recentList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setRecentFastags(recentList);
    } catch (error) {
      console.error('Error fetching FastTag stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'available':
        return <CheckIcon color="success" />;
      case 'assigned':
        return <AssignedIcon color="primary" />;
      case 'active':
        return <CheckIcon color="secondary" />;
      case 'inactive':
        return <ErrorIcon color="error" />;
      case 'pending':
        return <PendingIcon color="warning" />;
      default:
        return <FastagIcon />;
    }
  };

  const getStatusChip = (status) => {
    let color = 'default';
    
    switch (status) {
      case 'available':
        color = 'success';
        break;
      case 'assigned':
        color = 'primary';
        break;
      case 'active':
        color = 'secondary';
        break;
      case 'inactive':
        color = 'error';
        break;
      case 'pending':
        color = 'warning';
        break;
    }
    
    return (
      <Chip 
        size="small" 
        label={status.charAt(0).toUpperCase() + status.slice(1)} 
        color={color}
      />
    );
  };

  // Calculate percentage for progress bar
  const getTotalPercentage = () => {
    if (stats.total === 0) return 0;
    const activeAndAssignedCount = stats.active + stats.assigned;
    return (activeAndAssignedCount / stats.total) * 100;
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div">
            <FastagIcon /> FastTag Management
          </Typography>
          <Button 
            variant="contained" 
            size="small" 
            startIcon={<FastagIcon />}
            onClick={() => navigate('/fastag-management')}
          >
            View All
          </Button>
        </Box>
        
        {loading ? (
          <LinearProgress />
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={4} sm={2}>
                <Paper sx={{ p: 1, textAlign: 'center' }}>
                  <Typography variant="h6">{stats.total}</Typography>
                  <Typography variant="body2" color="textSecondary">Total</Typography>
                </Paper>
              </Grid>
              <Grid item xs={4} sm={2}>
                <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                  <Typography variant="h6">{stats.available}</Typography>
                  <Typography variant="body2" color="textSecondary">Available</Typography>
                </Paper>
              </Grid>
              <Grid item xs={4} sm={2}>
                <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                  <Typography variant="h6">{stats.assigned}</Typography>
                  <Typography variant="body2" color="textSecondary">Assigned</Typography>
                </Paper>
              </Grid>
              <Grid item xs={4} sm={2}>
                <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#f3e5f5' }}>
                  <Typography variant="h6">{stats.active}</Typography>
                  <Typography variant="body2" color="textSecondary">Active</Typography>
                </Paper>
              </Grid>
              <Grid item xs={4} sm={2}>
                <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#ffebee' }}>
                  <Typography variant="h6">{stats.inactive}</Typography>
                  <Typography variant="body2" color="textSecondary">Inactive</Typography>
                </Paper>
              </Grid>
              <Grid item xs={4} sm={2}>
                <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#fff8e1' }}>
                  <Typography variant="h6">{stats.pending}</Typography>
                  <Typography variant="body2" color="textSecondary">Pending</Typography>
                </Paper>
              </Grid>
            </Grid>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {stats.active + stats.assigned} of {stats.total} FastTags in use ({Math.round(getTotalPercentage())}%)
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={getTotalPercentage()} 
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              Recent FastTags
            </Typography>
            
            {recentFastags.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                No FastTags found
              </Typography>
            ) : (
              <List dense>
                {recentFastags.map((fastag) => (
                  <ListItem 
                    key={fastag.id}
                    secondaryAction={getStatusChip(fastag.status || 'unknown')}
                  >
                    <ListItemIcon>
                      {getStatusIcon(fastag.status)}
                    </ListItemIcon>
                    <ListItemText 
                      primary={fastag.serialNo}
                      secondary={`${fastag.vehicleNo || 'No vehicle'} | ${fastag.mobileNo || 'No mobile'}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={<AddIcon />}
                onClick={() => navigate('/fastag-management')}
              >
                Add FastTag
              </Button>
              <Button 
                variant="text" 
                size="small"
                onClick={() => navigate('/fastag-management')}
              >
                Manage Inventory
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FastagSummary; 