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
  Grid
} from '@mui/material';
import { Search as SearchIcon, FileDownload as DownloadIcon } from '@mui/icons-material';
import { getFirestore, collection, query, getDocs, orderBy, limit, where, startAfter } from 'firebase/firestore';
import { exportToExcel, formatDataForExport } from '../utils/excelExport';

const AssignmentLogs = () => {
  const db = getFirestore();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalLogs, setTotalLogs] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);
  const [userMap, setUserMap] = useState({});
  const [filters, setFilters] = useState({
    userId: '',
    subAdminId: '',
    dateRange: 'all'
  });

  useEffect(() => {
    fetchUserData();
    fetchLogs();
  }, []);
  
  const fetchUserData = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const users = {};
      snapshot.forEach(doc => {
        const user = doc.data();
        users[doc.id] = {
          displayName: user.displayName || user.email || doc.id,
          role: user.role || 'user',
          email: user.email
        };
      });
      
      setUserMap(users);
    } catch (error) {
      console.error('Error fetching users for log display:', error);
    }
  };

  const fetchLogs = async (reset = true) => {
    try {
      setLoading(true);
      
      // Build query
      let logsQuery = collection(db, 'assignmentLogs');
      let constraints = [orderBy('assignedAt', 'desc')];
      
      // Apply filters
      if (filters.userId) {
        constraints.push(where('userId', '==', filters.userId));
      }
      
      if (filters.subAdminId) {
        constraints.push(where('subAdminId', '==', filters.subAdminId));
      }
      
      // Date range filter
      if (filters.dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (filters.dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
          default:
            // No date filter
            break;
        }
        
        constraints.push(where('assignedAt', '>=', startDate));
      }
      
      // Add pagination
      constraints.push(limit(rowsPerPage));
      
      // If continuing pagination, add startAfter
      if (lastVisible && !reset) {
        constraints.push(startAfter(lastVisible));
      }
      
      logsQuery = query(logsQuery, ...constraints);
      
      // Execute query
      const snapshot = await getDocs(logsQuery);
      const logsList = [];
      
      snapshot.forEach(doc => {
        logsList.push({
          id: doc.id,
          ...doc.data(),
          // Convert Firestore timestamp to Date
          assignedAt: doc.data().assignedAt?.toDate() || new Date()
        });
      });
      
      // Update last visible for pagination
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setLastVisible(null);
      }
      
      // Get total count (this is a simplified approach - in production, you'd use an aggregation query)
      const countConstraints = constraints.filter(c => c.type !== 'limit' && c.type !== 'startAfter');
      const countQuery = query(collection(db, 'assignmentLogs'), ...countConstraints);
      const countSnapshot = await getDocs(countQuery);
      setTotalLogs(countSnapshot.size);
      
      // Update logs
      setLogs(reset ? logsList : [...logs, ...logsList]);
    } catch (error) {
      console.error('Error fetching assignment logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    if (newPage > page) {
      // Next page, fetch more data
      fetchLogs(false);
    }
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    fetchLogs(true);
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  const applyFilters = () => {
    setPage(0);
    fetchLogs(true);
  };
  
  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleString();
  };
  
  const getUserInfo = (userId) => {
    if (!userId || !userMap[userId]) return { name: 'Unknown User', role: 'unknown' };
    return {
      name: userMap[userId].displayName,
      role: userMap[userId].role
    };
  };

  const handleExportToExcel = () => {
    // Define column mapping for better readability in Excel
    const columnMapping = {
      id: 'Log ID',
      fastagId: 'FasTag ID',
      fastagSerialNo: 'FasTag Serial Number',
      fastagTid: 'FasTag TID',
      userId: 'User ID',
      userDisplayName: 'User',
      subAdminId: 'SubAdmin ID',
      subAdminDisplayName: 'SubAdmin',
      assignedAt: 'Assigned At',
      status: 'Status',
      quantity: 'Quantity'
    };
    
    // Fields to omit from export
    const omitFields = [];
    
    // Process logs to add user display names
    const processedLogs = logs.map(log => {
      const user = userMap[log.userId] || { displayName: 'Unknown', email: '' };
      const subAdmin = userMap[log.subAdminId] || { displayName: 'Unknown', email: '' };
      
      return {
        ...log,
        userDisplayName: user.displayName,
        subAdminDisplayName: subAdmin.displayName
      };
    });
    
    // Format and export data
    const formattedData = formatDataForExport(processedLogs, columnMapping, omitFields);
    exportToExcel(formattedData, 'FasTag_Assignment_Logs', 'Assignment Logs');
  };

  return (
    <Box>
      <Grid container spacing={2} justifyContent="space-between" alignItems="center" mb={3}>
        <Grid item>
          <Typography variant="h4" gutterBottom>
            Assignment Logs
          </Typography>
        </Grid>
        <Grid item>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportToExcel}
          >
            Export to Excel
          </Button>
        </Grid>
      </Grid>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Filter by User ID"
              name="userId"
              value={filters.userId}
              onChange={handleFilterChange}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Filter by Sub-Admin ID"
              name="subAdminId"
              value={filters.subAdminId}
              onChange={handleFilterChange}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Date Range</InputLabel>
              <Select
                name="dateRange"
                value={filters.dateRange}
                onChange={handleFilterChange}
                label="Date Range"
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">Last 7 Days</MenuItem>
                <MenuItem value="month">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Button 
              fullWidth
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={applyFilters}
            >
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      <Paper>
        <TableContainer component={Paper}>
          {loading && page === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Assigned By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No assignment logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(log => {
                    const user = getUserInfo(log.userId);
                    const subAdmin = getUserInfo(log.subAdminId);
                    const assigner = getUserInfo(log.assignedBy);
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell>{formatDate(log.assignedAt)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">{user.name}</Typography>
                            <Chip 
                              label={user.role} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                              sx={{ maxWidth: 'fit-content', mt: 0.5 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">{subAdmin.name}</Typography>
                            <Chip 
                              label={subAdmin.role} 
                              size="small"
                              color="secondary"
                              variant="outlined"
                              sx={{ maxWidth: 'fit-content', mt: 0.5 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">{assigner.name}</Typography>
                            <Chip 
                              label={assigner.role} 
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ maxWidth: 'fit-content', mt: 0.5 }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {loading && page > 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalLogs}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default AssignmentLogs; 