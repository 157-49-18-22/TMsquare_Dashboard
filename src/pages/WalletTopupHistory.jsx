import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
  Grid,
  Card,
  CardContent,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  TextField
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon
} from '@mui/icons-material';
import { getFirestore, collection, getDocs, query, orderBy, where, limit, startAfter } from 'firebase/firestore';
import { exportToExcel, formatDataForExport } from '../utils/excelExport';

const statusColors = {
  pending: {
    bg: '#FFF9C4',
    color: '#F57F17'
  },
  approved: {
    bg: '#E8F5E9',
    color: '#2E7D32'
  },
  rejected: {
    bg: '#FFEBEE',
    color: '#C62828'
  }
};

function WalletTopupHistory() {
  const [topupRequests, setTopupRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    dateRange: 'all',
    minAmount: '',
    maxAmount: '',
    bcId: '',
    utrNumber: ''
  });
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [bcIdOptions, setBcIdOptions] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);

  const db = getFirestore();

  useEffect(() => {
    fetchUsers();
    fetchBcIdOptions();
  }, []);

  useEffect(() => {
    applyFiltersLocal();
  }, [topupRequests, filters]);

  const fetchTopupRequests = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setTopupRequests([]);
        setLastDoc(null);
        setHasMore(true);
      }
      
      const topupsRef = collection(db, 'wallet_topups');
      
      // Build query
      let q = query(topupsRef, orderBy('createdAt', 'desc'), limit(50));
      
      // Add status filter if specified
      if (filters.status) {
        q = query(topupsRef, where('status', '==', filters.status), orderBy('createdAt', 'desc'), limit(50));
      }
      
      // Add pagination cursor if loading more
      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const querySnapshot = await getDocs(q);
      
      const requests = [];
      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const requestWithId = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date()
        };
        
        requests.push(requestWithId);
        
        if (data.status === 'pending') pendingCount++;
        else if (data.status === 'approved') approvedCount++;
        else if (data.status === 'rejected') rejectedCount++;
      });
      
      // Update state
      if (loadMore) {
        setTopupRequests(prev => [...prev, ...requests]);
      } else {
        setTopupRequests(requests);
      }
      
      // Update pagination state
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === 50);
      
      // Update stats
      if (!loadMore) {
        setStats({
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          total: requests.length
        });
      }
      
      console.log(`📊 [WalletTopupHistory] Loaded ${requests.length} requests${loadMore ? ' (more)' : ''}`);
      
    } catch (error) {
      console.error('Error fetching topup requests:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      const usersList = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        usersList.push({
          id: doc.id,
          displayName: userData.displayName || userData.email || 'Unknown User',
          email: userData.email,
          bcId: userData.bcId || ''
        });
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchBcIdOptions = async () => {
    try {
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      const bcIds = new Set();
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.bcId) {
          bcIds.add(userData.bcId);
        }
      });
      
      setBcIdOptions(Array.from(bcIds));
    } catch (error) {
      console.error('Error fetching BC_IDs:', error);
    }
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  const handleBcIdChange = (event, newValue) => {
    setFilters({
      ...filters,
      bcId: newValue || ''
    });
  };
  
  const applyFiltersLocal = () => {
    let filtered = [...topupRequests];
    
    if (filters.bcId) {
      const usersWithBcId = users.filter(user => user.bcId === filters.bcId);
      const userIds = usersWithBcId.map(user => user.id);
      
      filtered = filtered.filter(request => 
        userIds.includes(request.userId)
      );
    }
    
    if (filters.minAmount) {
      const minAmount = parseFloat(filters.minAmount);
      filtered = filtered.filter(request => request.amount >= minAmount);
    }
    
    if (filters.maxAmount) {
      const maxAmount = parseFloat(filters.maxAmount);
      filtered = filtered.filter(request => request.amount <= maxAmount);
    }
    
    if (filters.utrNumber) {
      filtered = filtered.filter(request => 
        request.utrNumber && request.utrNumber.toLowerCase().includes(filters.utrNumber.toLowerCase())
      );
    }
    
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
          break;
      }
      
      filtered = filtered.filter(request => request.createdAt >= startDate);
    }
    
    setFilteredRequests(filtered);
    setPage(0);
  };

  const resetFilters = () => {
    setFilters({
      status: '',
      dateRange: 'all',
      minAmount: '',
      maxAmount: '',
      bcId: '',
      utrNumber: ''
    });
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleExportToExcel = () => {
    // Process user data to include BC_ID in the export
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = {
        displayName: user.displayName,
        email: user.email,
        bcId: user.bcId || 'N/A'
      };
    });
    
    // Format data for export
    const data = filteredRequests.map(request => {
      const user = userMap[request.userId] || { displayName: 'Unknown', email: 'Unknown', bcId: 'N/A' };
      
      return {
        id: request.id,
        userName: request.userName || user.displayName,
        userEmail: user.email,
        bcId: user.bcId,
        amount: request.amount,
        utrNumber: request.utrNumber || 'N/A',
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        adminNote: request.adminNote || ''
      };
    });
    
    // Column mapping for better readability
    const columnMapping = {
      id: 'Request ID',
      userName: 'User Name',
      userEmail: 'User Email',
      bcId: 'BC_ID',
      amount: 'Amount',
      utrNumber: 'UTR Number',
      status: 'Status',
      createdAt: 'Requested Date',
      updatedAt: 'Updated Date',
      adminNote: 'Admin Notes'
    };
    
    // Export to Excel
    const formattedData = formatDataForExport(data, columnMapping, []);
    exportToExcel(formattedData, 'Wallet_Topup_History', 'History');
    alert('Export complete! File downloaded.');
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Wallet Top-up History
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportToExcel}
            sx={{ mr: 2 }}
          >
            Export to Excel
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={() => fetchTopupRequests()} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Complete historical data of all wallet top-up requests. 
        Data is loaded in batches of 50 records for better performance.
        Use filters to narrow down results and reduce load times.
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Filters</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={1.5}>
            <Autocomplete
              freeSolo
              options={bcIdOptions}
              value={filters.bcId}
              onChange={handleBcIdChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  size="small"
                  label="BC_ID"
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={1.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={1.5}>
            <TextField
              fullWidth
              size="small"
              label="Min Amount"
              name="minAmount"
              type="number"
              value={filters.minAmount}
              onChange={handleFilterChange}
            />
          </Grid>
          
          <Grid item xs={12} md={1.5}>
            <TextField
              fullWidth
              size="small"
              label="Max Amount"
              name="maxAmount"
              type="number"
              value={filters.maxAmount}
              onChange={handleFilterChange}
            />
          </Grid>
          
          <Grid item xs={12} md={1.5}>
            <TextField
              fullWidth
              size="small"
              label="UTR Number"
              name="utrNumber"
              value={filters.utrNumber}
              onChange={handleFilterChange}
            />
          </Grid>
          
          <Grid item xs={12} md={1.5}>
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
          
          <Grid item xs={12} md={1.5}>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={resetFilters}
            >
              Reset
            </Button>
          </Grid>
          
          <Grid item xs={12} md={1.5}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={applyFiltersLocal}
            >
              Filter
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#FFF9C4' }}>
            <CardContent>
              <Typography variant="h6" component="div">
                Pending Requests
              </Typography>
              <Typography variant="h3" component="div" fontWeight="bold">
                {stats.pending}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#E8F5E9' }}>
            <CardContent>
              <Typography variant="h6" component="div">
                Approved
              </Typography>
              <Typography variant="h3" component="div" fontWeight="bold">
                {stats.approved}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#FFEBEE' }}>
            <CardContent>
              <Typography variant="h6" component="div">
                Rejected
              </Typography>
              <Typography variant="h3" component="div" fontWeight="bold">
                {stats.rejected}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div">
                Total Requests
              </Typography>
              <Typography variant="h3" component="div" fontWeight="bold">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Load Data Button */}
      {topupRequests.length === 0 && !loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => fetchTopupRequests()}
            disabled={loading}
          >
            Load Historical Data
          </Button>
        </Box>
      )}

      {/* Requests Table */}
      <TableContainer component={Paper}>
        <Table aria-label="top-up requests history table">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>BC_ID</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>UTR Number</TableCell>
              <TableCell>Requested</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Admin Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={40} />
                </TableCell>
              </TableRow>
            ) : filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {topupRequests.length === 0 ? 'Click "Load Historical Data" to start' : 'No requests found with current filters'}
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((request) => {
                  // Find user with BC_ID
                  const user = users.find(u => u.id === request.userId) || {};
                  const bcId = user.bcId || 'N/A';
                  
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {request.userName || 'Unknown User'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          ID: {request.userId.substring(0, 8)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {bcId}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" fontWeight="bold">
                          ₹{request.amount.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {request.utrNumber || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {request.createdAt.toLocaleString() || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={request.status.toUpperCase()}
                          style={{
                            backgroundColor: statusColors[request.status]?.bg,
                            color: statusColors[request.status]?.color
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="textSecondary">
                          {request.adminNote || 'No notes'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredRequests.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Load More Button */}
      {hasMore && !loading && topupRequests.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => fetchTopupRequests(true)}
            disabled={loadingMore}
            startIcon={loadingMore ? <CircularProgress size={20} /> : null}
          >
            {loadingMore ? 'Loading...' : 'Load More (50 Records)'}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default WalletTopupHistory; 