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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
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
  Tabs,
  Tab
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Image as ImageIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon
} from '@mui/icons-material';
import { getFirestore, collection, getDocs, doc, updateDoc, getDoc, runTransaction, query, orderBy, where, getCountFromServer, setDoc, increment, writeBatch } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { exportToExcel, formatDataForExport } from '../utils/excelExport';
import { logWalletUpdate } from '../api/firestoreApi';

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

function WalletTopupRequests() {
  const [topupRequests, setTopupRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imageNameDialogOpen, setImageNameDialogOpen] = useState(false);
  const [selectedImageName, setSelectedImageName] = useState('');
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Tab-based state
  const [activeTab, setActiveTab] = useState(0);
  const [tabData, setTabData] = useState({
    pending: { data: [], loaded: false, count: 0 },
    approved: { data: [], loaded: false, count: 0 },
    rejected: { data: [], loaded: false, count: 0 }
  });
  
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [filters, setFilters] = useState({
    userId: '',
    status: '',
    dateRange: 'all',
    minAmount: '',
    maxAmount: '',
    bcId: '',
    utrNumber: ''
  });
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [bcIdOptions, setBcIdOptions] = useState([]);

  const db = getFirestore();

  useEffect(() => {
    fetchUsers();
    fetchBcIdOptions();
    // Don't load stats initially - load on-demand when tabs are clicked
  }, []);

  useEffect(() => {
    applyFiltersLocal();
  }, [topupRequests, filters]);

  // Load data when tab changes
  useEffect(() => {
    const tabNames = ['pending', 'approved', 'rejected'];
    const currentTabName = tabNames[activeTab];
    
    if (currentTabName === 'pending') {
      // Always fetch fresh data for pending tab (real-time updates needed)
      console.log(`🔄 [WalletTopupRequests] Pending tab clicked - fetching fresh data`);
      fetchTabData(currentTabName);
    } else if (!tabData[currentTabName].loaded) {
      // For approved/rejected, only fetch if not already loaded
      fetchTabData(currentTabName);
    } else {
      // Use cached data for approved/rejected
      setTopupRequests(tabData[currentTabName].data);
      setFilteredRequests(tabData[currentTabName].data);
    }
  }, [activeTab]);



  const fetchTabData = async (tabName) => {
    try {
      setLoading(true);
      console.log(`🔄 [WalletTopupRequests] Loading ${tabName} tab data...`);
      
      const topupsRef = collection(db, 'wallet_topups');
      let queryRef;
      
      // For all tabs, load last 2 days initially
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      console.log(`📅 [WalletTopupRequests] Loading ${tabName} data from: ${twoDaysAgo.toISOString()} (2 days ago)`);
      
      queryRef = query(
        topupsRef,
        where('status', '==', tabName),
        where('createdAt', '>=', twoDaysAgo),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(queryRef);
      
      const requests = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const requestWithId = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date()
        };
        requests.push(requestWithId);
      });
      
      // Update tab data
      setTabData(prev => ({
        ...prev,
        [tabName]: { 
          data: requests, 
          loaded: true, 
          count: requests.length 
        }
      }));
      
      // Set current data
      setTopupRequests(requests);
      setFilteredRequests(requests);
      
      // Update stats based on loaded tab data
      updateStatsFromTabData(tabName, requests.length);
      
      console.log(`✅ [WalletTopupRequests] Loaded ${requests.length} ${tabName} requests`);
      
    } catch (error) {
      console.error(`Error fetching ${tabName} data:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setPage(0); // Reset pagination when changing tabs
  };

  const updateStatsFromTabData = (tabName, count) => {
    setStats(prev => {
      const newStats = { ...prev };
      newStats[tabName] = count;
      newStats.total = newStats.pending + newStats.approved + newStats.rejected;
      return newStats;
    });
  };

  const refreshCurrentTab = () => {
    const tabNames = ['pending', 'approved', 'rejected'];
    const currentTabName = tabNames[activeTab];
    
    console.log(`🔄 [WalletTopupRequests] Refreshing ${currentTabName} tab...`);
    
    // Mark current tab as not loaded to force refresh
    setTabData(prev => ({
      ...prev,
      [currentTabName]: { ...prev[currentTabName], loaded: false }
    }));
    
    // Force reload the current tab data
    fetchTabData(currentTabName);
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

  const handleUserChange = (event, newValue) => {
    setSelectedUser(newValue);
    setFilters({
      ...filters,
      userId: newValue ? newValue.id : ''
    });
  };
  
  const applyFiltersLocal = () => {
    let filtered = [...topupRequests];
    
    if (filters.userId) {
      filtered = filtered.filter(request => 
        request.userId === filters.userId
      );
    }
    
    if (filters.bcId) {
      const usersWithBcId = users.filter(user => user.bcId === filters.bcId);
      const userIds = usersWithBcId.map(user => user.id);
      
      filtered = filtered.filter(request => 
        userIds.includes(request.userId)
      );
    }
    
    if (filters.status) {
      filtered = filtered.filter(request => request.status === filters.status);
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
      userId: '',
      status: '',
      dateRange: 'all',
      minAmount: '',
      maxAmount: '',
      bcId: '',
      utrNumber: ''
    });
    setSelectedUser(null);
  };

  const handleViewImageName = (imageName) => {
    setSelectedImageName(imageName);
    setImageNameDialogOpen(true);
  };

  const handleApproveRequest = async (requestId) => {
    try {
      setLoading(true);
      
      // Get the request details
      const requestRef = doc(db, 'wallet_topups', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        console.error('Request not found');
        return;
      }
      
      const requestData = requestSnap.data();
      const userId = requestData.userId;
      const amount = requestData.amount;
      
      // OPTIMIZATION: Use individual writes instead of transaction to reduce quota usage
      // This approach eliminates the read operation (transaction.get) and uses increment for wallet updates
      // Total operations: 1 read (request) + 2 writes (request update + wallet increment) = 3 operations
      // Previous approach: 1 read (request) + 1 read (user) + 3 writes = 5 operations
      
      // First, update the request status immediately
      await updateDoc(requestRef, { 
        status: 'approved',
        updatedAt: new Date(),
        adminNote: 'Approved and added to wallet balance'
      });
      
      // Get current wallet balance before increment for logging
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const currentWalletBalance = userSnap.data()?.wallet || 0;
      
      // Then update the user's wallet balance using increment
      await updateDoc(userRef, { 
        wallet: increment(amount) // This will be added to existing balance by Firestore
      });
      
      // Log the wallet update
      await logWalletUpdate(
        userId,
        currentWalletBalance,
        currentWalletBalance + amount,
        null, // No password ID needed for system process
        'wallet_topup_approval' // Mark as wallet top-up approval
      );
      
      // OPTIMIZATION: Transaction record creation commented out to save writes
      // Uncomment the following block if you need transaction records
      /*
      try {
        const transactionRef = doc(collection(db, 'transactions'));
        await setDoc(transactionRef, {
          userId: userId,
          userName: requestData.userName || 'User',
          type: 'recharge',
          method: 'wallet_topup',
          amount: amount,
          status: 'success',
          description: 'Wallet top-up via UPI',
          createdAt: new Date(),
          updatedAt: new Date(),
          relatedDocId: requestId,
          collection: 'wallet_topups'
        });
      } catch (transactionError) {
        console.warn('Failed to create transaction record:', transactionError);
      }
      */
      
      // ALTERNATIVE: Use batch writes for atomic operations (uncomment if needed)
      // This ensures both operations succeed or fail together, but uses more quota
      /*
      const batch = writeBatch(db);
      batch.update(requestRef, { 
        status: 'approved',
        updatedAt: new Date(),
        adminNote: 'Approved and added to wallet balance'
      });
      batch.update(userRef, { wallet: increment(amount) });
      await batch.commit();
      */
      
      // Refresh current tab (stats will update automatically)
      refreshCurrentTab();
      alert('Request approved successfully');
    } catch (error) {
      console.error('Error approving request:', error);
      
      // Provide more specific error messages
      if (error.code === 'resource-exhausted') {
        alert('Firebase quota exceeded. Please try again later or contact support.');
      } else if (error.code === 'permission-denied') {
        alert('Permission denied. Please check your admin privileges.');
      } else {
        alert('Failed to approve request: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRejectDialog = (requestId) => {
    setSelectedRequestId(requestId);
    setRejectionDialogOpen(true);
  };

  const handleRejectRequest = async () => {
    if (!selectedRequestId) return;
    
    try {
      setLoading(true);
      
      // Update the request status to rejected
      const requestRef = doc(db, 'wallet_topups', selectedRequestId);
      await updateDoc(requestRef, {
        status: 'rejected',
        updatedAt: new Date(),
        adminNote: rejectionReason || 'Rejected by admin'
      });
      
      // Close dialog and reset state
      setRejectionDialogOpen(false);
      setRejectionReason('');
      setSelectedRequestId(null);
      
      // Refresh current tab (stats will update automatically)
      refreshCurrentTab();
      alert('Request rejected successfully');
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request: ' + error.message);
    } finally {
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
    exportToExcel(formattedData, 'Wallet_Topup_Requests', 'Requests');
    alert('Export complete! File downloaded.');
  };

  const tabNames = ['pending', 'approved', 'rejected'];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Wallet Top-up Requests
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
          <Tooltip title="Refresh Current Tab">
          <Button
  onClick={refreshCurrentTab}
  color="primary"
  startIcon={<RefreshIcon />}
>
  Refresh
</Button>
          </Tooltip>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Data is loaded on-demand per tab to reduce database reads. All tabs show last 2 days of data only.
        Stats update as you click each tab. Use refresh button to reload current tab data.
      </Typography>

      {/* Stats Cards */}
      {/* <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#FFF9C4' }}>
            <CardContent>
              <Typography variant="h6" component="div">
                Pending Requests
              </Typography>
              <Typography variant="h3" component="div" fontWeight="bold">
                {tabData.pending.loaded ? stats.pending : '...'}
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
                {tabData.approved.loaded ? stats.approved : '...'}
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
                {tabData.rejected.loaded ? stats.rejected : '...'}
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
                {stats.total > 0 ? stats.total : '...'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid> */}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label={`Pending (${stats.pending})`} 
            sx={{ 
              bgcolor: tabData.pending.loaded ? '#FFF9C4' : 'transparent',
              fontWeight: tabData.pending.loaded ? 'bold' : 'normal'
            }}
          />
          <Tab 
            label={`Approved (${stats.approved})`} 
            sx={{ 
              bgcolor: tabData.approved.loaded ? '#E8F5E9' : 'transparent',
              fontWeight: tabData.approved.loaded ? 'bold' : 'normal'
            }}
          />
          <Tab 
            label={`Rejected (${stats.rejected})`} 
            sx={{ 
              bgcolor: tabData.rejected.loaded ? '#FFEBEE' : 'transparent',
              fontWeight: tabData.rejected.loaded ? 'bold' : 'normal'
            }}
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box>
        {/* Debug Info */}
        {/* <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
          <Typography variant="h6" gutterBottom>Debug Info</Typography>
          <Typography variant="body2">
            Current Tab: {tabNames[activeTab]} | 
            Tab Loaded: {tabData[tabNames[activeTab]].loaded ? 'Yes' : 'No'} | 
            Data Count: {tabData[tabNames[activeTab]].data.length} | 
            Filtered Count: {filteredRequests.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All tabs: Last 2 days of data only
          </Typography>
          {tabData[tabNames[activeTab]].loaded && (
            <Typography variant="body2" color="text.secondary">
              Tab data: Showing last 2 days of {tabNames[activeTab]} requests
            </Typography>
          )}
        </Paper> */}

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Filters</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={1.5} width={'20%'}>
              <Autocomplete
                options={users}
                getOptionLabel={(option) => `${option.displayName} (${option.email})`}
                value={selectedUser}
                onChange={handleUserChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    size="small"
                    label="Select User"
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} md={1.5} width={'15%'}>
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
            
            <Grid item xs={12} md={1.5} width={'10%'}>
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
            
            <Grid item xs={12} md={1.5} width={'10%'}>
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
            
            {/* <Grid item xs={12} md={1.5}>
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
            </Grid> */}
            
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

        {/* Requests Table */}
        <TableContainer component={Paper}>
          <Table aria-label="top-up requests table">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>BC_ID</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>UTR Number</TableCell>
                <TableCell>Requested</TableCell>
                <TableCell>Screenshot</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress size={40} />
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {tabData[tabNames[activeTab]].loaded 
                      ? 'No requests found for this status' 
                      : 'Click the tab to load data'
                    }
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
                          {request.createdAt.toLocaleString(0)|| 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Tooltip title={request.screenshotName || "No screenshot name"}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ImageIcon />}
                              onClick={() => handleViewImageName(request.screenshotName)}
                            >
                              View Name
                            </Button>
                          </Tooltip>
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
                          {request.status === 'pending' && (
                            <>
                              <Tooltip title="Approve Request">
                                <IconButton
                                  color="success"
                                  onClick={() => handleApproveRequest(request.id)}
                                >
                                  <ApproveIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject Request">
                                <IconButton
                                  color="error"
                                  onClick={() => handleOpenRejectDialog(request.id)}
                                >
                                  <RejectIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {(request.status === 'approved' || request.status === 'rejected') && (
                            <Typography variant="caption" color="textSecondary">
                              {request.adminNote || 'No notes'}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredRequests.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Box>

      {/* Image Name Dialog */}
      <Dialog
        open={imageNameDialogOpen}
        onClose={() => setImageNameDialogOpen(false)}
      >
        <DialogTitle>Screenshot Filename</DialogTitle>
        <DialogContent>
          <Typography>
            {selectedImageName || "No filename available"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageNameDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog
        open={rejectionDialogOpen}
        onClose={() => setRejectionDialogOpen(false)}
      >
        <DialogTitle>Reject Top-up Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for Rejection"
            fullWidth
            multiline
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRejectRequest} color="error">
            Reject Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WalletTopupRequests; 