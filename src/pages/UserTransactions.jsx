import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  IconButton, 
  Tooltip, 
  Snackbar, 
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Chip,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Avatar,
  CircularProgress
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { collection, query, getDocs, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

function UserTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const { userData, isSuperAdmin, isSubAdmin } = useAuth();
  
  // User selection states
  const [showUserDialog, setShowUserDialog] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Filter states
  const [filter, setFilter] = useState({
    searchTerm: '',
    status: '',
    type: '',
    purpose: '',
    collection: '',
    paymentGateway: ''
  });
  
  const [debouncedFilter, setDebouncedFilter] = useState(filter);

  // Debounced filter effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [filter]);

  // Debounced user search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchTerm.trim() === '') {
        setFilteredUsers(users);
      } else {
        const filtered = users.filter(user => 
          user.displayName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
          user.firstName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
          user.lastName?.toLowerCase().includes(userSearchTerm.toLowerCase())
        );
        setFilteredUsers(filtered);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [userSearchTerm, users]);

  // Memoized filtered transactions
  const filteredTransactionsMemo = useMemo(() => {
    let filtered = [...transactions];
    
    // Filter by search term (across multiple fields)
    if (debouncedFilter.searchTerm) {
      const term = debouncedFilter.searchTerm.toLowerCase();
      filtered = filtered.filter(transaction => 
        (transaction.details?.name && transaction.details.name.toLowerCase().includes(term)) ||
        (transaction.details?.vehicleNo && transaction.details.vehicleNo.toLowerCase().includes(term)) ||
        (transaction.details?.serialNo && transaction.details.serialNo.toLowerCase().includes(term)) ||
        (transaction.transactionId && transaction.transactionId.toLowerCase().includes(term)) ||
        (transaction.userId && transaction.userId.toLowerCase().includes(term)) ||
        (transaction.purpose && transaction.purpose.toLowerCase().includes(term)) ||
        (transaction.collection && transaction.collection.toLowerCase().includes(term))
      );
    }
    
    // Filter by collection
    if (debouncedFilter.collection) {
      filtered = filtered.filter(transaction => 
        transaction.collection === debouncedFilter.collection
      );
    }
    
    // Filter by status
    if (debouncedFilter.status) {
      filtered = filtered.filter(transaction => 
        transaction.status === debouncedFilter.status
      );
    }
    
    // Filter by type
    if (debouncedFilter.type) {
      filtered = filtered.filter(transaction => 
        transaction.type === debouncedFilter.type
      );
    }
    
         // Filter by purpose
     if (debouncedFilter.purpose) {
       filtered = filtered.filter(transaction => 
         transaction.purpose === debouncedFilter.purpose
       );
     }
     
     // Filter by payment gateway
     if (debouncedFilter.paymentGateway) {
       filtered = filtered.filter(transaction => 
         transaction.paymentGateway === debouncedFilter.paymentGateway
       );
     }
     
     return filtered;
  }, [transactions, debouncedFilter]);

  // Update filtered transactions when memoized result changes
  useEffect(() => {
    setFilteredTransactions(filteredTransactionsMemo);
  }, [filteredTransactionsMemo]);

  // Fetch users for selection
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      console.log('🔄 Fetching users...');
      
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const usersData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data) {
          usersData.push({
            id: doc.id,
            displayName: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown User',
            email: data.email || 'N/A',
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            createdAt: data.createdAt
          });
        }
      });
      
      setUsers(usersData);
      setFilteredUsers(usersData);
      console.log('✅ Users fetched:', usersData.length);
    } catch (err) {
      console.error('Error fetching users:', err);
      showSnackbar('Failed to fetch users', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch transactions data for selected user
  const fetchTransactions = useCallback(async (userId) => {
    try {
      setLoading(true);
      console.log(`🔄 Fetching transactions for user: ${userId}...`);
      
      const transactionsData = [];
      
      // Fetch from transactions collection for specific user
      try {
        setLoadingMessage('Fetching transactions from transactions collection...');
        console.log('🔄 Fetching transactions from transactions collection...');
        const transactionsRef = collection(db, "transactions");
        const q = query(transactionsRef, where("userId", "==", userId), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
         
         setLoadingMessage(`Processing ${querySnapshot.size} transactions...`);
         console.log(`📊 Found ${querySnapshot.size} documents in transactions collection`);
         
         querySnapshot.forEach((doc) => {
          try {
            const data = doc.data();
            if (data) {
                             transactionsData.push({
                 id: doc.id,
                 collection: 'transactions',
                 ...data,
                 // Ensure details object exists for transactions collection
                 details: {
                   name: data.details?.name || 'N/A',
                   vehicleNo: data.details?.vehicleNo || 'N/A',
                   serialNo: data.details?.serialNo || 'N/A',
                   previousBalance: data.details?.previousBalance || 0,
                   newBalance: data.details?.newBalance || 0
                 },
                 // Format timestamp for display
                 formattedTimestamp: data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString('en-IN', {
                   day: 'numeric',
                   month: 'long',
                   year: 'numeric',
                   hour: '2-digit',
                   minute: '2-digit',
                   second: '2-digit',
                   timeZone: 'Asia/Kolkata'
                 }) : 'N/A'
               });
            }
          } catch (docError) {
            console.warn('Error processing transaction document:', doc.id, docError);
          }
        });
      } catch (err) {
        console.warn('Error fetching transactions collection:', err);
      }
      
      // Fetch from wallet_topups collection for specific user
      try {
        setLoadingMessage('Fetching wallet topups...');
        console.log('🔄 Fetching wallet topups...');
        const walletTopupsRef = collection(db, "wallet_topups");
        const q2 = query(walletTopupsRef, where("userId", "==", userId), orderBy("createdAt", "desc"));
        const walletSnapshot = await getDocs(q2);
         
         setLoadingMessage(`Processing ${walletSnapshot.size} wallet topups...`);
         console.log(`📊 Found ${walletSnapshot.size} documents in wallet_topups collection`);
         
         walletSnapshot.forEach((doc) => {
           try {
             const data = doc.data();
             if (data) {
               // Generate a user-friendly name if userName is not available
               let displayName = 'N/A';
               if (data.userName) {
                 displayName = data.userName;
               } else if (data.userId) {
                 // Use first 8 characters of userId as fallback
                 displayName = `User_${data.userId.substring(0, 8)}`;
               }
               
                               transactionsData.push({
                  id: doc.id,
                  collection: 'wallet_topups',
                  transactionId: `WALLET_${doc.id}`,
                  // Convert amount from paise to rupees (divide by 100)
                  amount: (data.amount || 0) / 100,
                  type: data.type || 'wallet_topup',
                  status: data.status || 'unknown',
                  purpose: data.description || 'Wallet Top-up',
                  details: {
                    name: displayName,
                    vehicleNo: 'N/A',
                    serialNo: 'N/A',
                    previousBalance: (data.previousBalance || 0) / 100,
                    newBalance: (data.newBalance || 0) / 100
                  },
                  userId: data.userId || 'N/A',
                  paymentGateway: data.paymentGateway || 'N/A',
                  method: data.method || 'N/A',
                  currency: data.currency || 'INR',
                  formattedTimestamp: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'Asia/Kolkata'
                  }) : 'N/A'
                });
             }
           } catch (docError) {
             console.warn('Error processing wallet topup document:', doc.id, docError);
           }
         });
      } catch (err) {
        console.warn('Error fetching wallet_topups collection:', err);
      }
      
      // Sort all transactions by timestamp (newest first)
      transactionsData.sort((a, b) => {
        const timeA = a.timestamp || a.createdAt;
        const timeB = b.timestamp || b.createdAt;
        if (!timeA || !timeB) return 0;
        return timeB.toDate ? timeB.toDate() - timeA.toDate() : timeB - timeA;
      });
      
      // Since we already have the selected user's info, use it directly
      const selectedUserName = selectedUser?.displayName || 'Selected User';
      transactionsData.forEach(transaction => {
        // Ensure details object exists
        if (!transaction.details) {
          transaction.details = {
            name: 'N/A',
            vehicleNo: 'N/A',
            serialNo: 'N/A',
            previousBalance: 0,
            newBalance: 0
          };
        }
        
        // Use the selected user's name
        transaction.details.name = selectedUserName;
        transaction.customerName = selectedUserName;
      });
       
      console.log('✅ Total transactions fetched:', transactionsData.length);
      
      setTransactions(transactionsData);
      setFilteredTransactions(transactionsData);
      setLoadingMessage('');
     } catch (err) {
       console.error('Error fetching transactions:', err);
       setError('Failed to fetch transactions');
       showSnackbar('Failed to fetch transactions', 'error');
     } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [selectedUser]);

  // Initialize users on component mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setShowUserDialog(false);
    fetchTransactions(user.id);
  };

  // Handle dialog close
  const handleDialogClose = () => {
    setShowUserDialog(false);
  };

  // Handle refresh with selected user
  const handleRefresh = () => {
    if (selectedUser) {
      fetchTransactions(selectedUser.id);
    }
  };

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilter(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Reset filters
  const resetFilters = () => {
    setFilter({
      searchTerm: '',
      status: '',
      type: '',
      purpose: '',
      collection: '',
      paymentGateway: ''
    });
  };

  // Export transactions to CSV
  const exportToCSV = () => {
    try {
      const headers = [
        'Source',
        'Transaction ID',
        'Amount',
        'Type',
        'Status',
        'Purpose',
        'Name',
        'Vehicle No',
        'Serial No',
        'Previous Balance',
        'New Balance',
        'Payment Gateway',
        'Method',
        'Currency',
        'Timestamp',
        'User ID'
      ];
      
      const csvData = filteredTransactions.map(transaction => [
        transaction.collection === 'wallet_topups' ? 'Wallet' : 'FasTag',
        transaction.transactionId || '',
        transaction.amount || 0,
        transaction.type || '',
        transaction.status || '',
        transaction.purpose || '',
        transaction.details?.name || '',
        transaction.details?.vehicleNo || '',
        transaction.details?.serialNo || '',
        transaction.details?.previousBalance || 0,
        transaction.details?.newBalance || 0,
        transaction.paymentGateway || '',
        transaction.method || '',
        transaction.currency || 'INR',
        transaction.formattedTimestamp || '',
        transaction.userId || ''
      ]);
      
      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showSnackbar('Transactions exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      showSnackbar('Failed to export transactions', 'error');
    }
  };

  // Define columns for the data grid
  const getColumns = () => [
    { 
      field: 'collection', 
      headerName: 'Source', 
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params?.value === 'wallet_topups' ? 'Wallet' : 'FasTag'}
          color={params?.value === 'wallet_topups' ? 'info' : 'primary'}
          size="small"
          variant="outlined"
        />
      )
    },
    { 
      field: 'transactionId', 
      headerName: 'Transaction ID', 
      width: 200,
      renderCell: (params) => (
        <Tooltip title={params?.value || ''}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {params?.value || 'N/A'}
          </span>
        </Tooltip>
      )
    },
    { 
      field: 'amount', 
      headerName: 'Amount (₹)', 
      width: 120,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={`₹${params?.value || 0}`}
          color={(params?.value || 0) > 0 ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      )
    },
    { 
      field: 'type', 
      headerName: 'Type', 
      width: 120,
      renderCell: (params) => {
        let color = 'default';
        let label = params?.value || 'N/A';
        
        switch (params?.value) {
          case 'debit':
            color = 'error';
            break;
          case 'credit':
          case 'wallet_topup':
          case 'recharge':
            color = 'success';
            break;
          default:
            color = 'default';
        }
        
        return (
          <Chip
            label={label}
            color={color}
            size="small"
          />
        );
      }
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params) => {
        let color = 'default';
        switch (params?.value) {
          case 'completed':
          case 'captured':
          case 'success':
            color = 'success';
            break;
          case 'pending':
            color = 'warning';
            break;
          case 'failed':
          case 'error':
            color = 'error';
            break;
          default:
            color = 'default';
        }
        return (
          <Chip
            label={params?.value || 'N/A'}
            color={color}
            size="small"
          />
        );
      }
    },
         { 
       field: 'purpose', 
       headerName: 'Purpose', 
       width: 150,
       renderCell: (params) => (
         <Tooltip title={params?.value || ''}>
           <span style={{ fontSize: '0.8rem' }}>
             {params?.value || 'N/A'}
           </span>
         </Tooltip>
       )
     },
     { 
       field: 'paymentGateway', 
       headerName: 'Payment Gateway', 
       width: 130,
       renderCell: (params) => {
         if (!params?.value || params.value === 'N/A') return 'N/A';
         return (
           <Chip
             label={params.value}
             color="secondary"
             size="small"
             variant="outlined"
           />
         );
       }
     },
                   { 
        field: 'customerName', 
        headerName: 'Customer Name', 
        width: 150,
        renderCell: (params) => {
          const name = params?.value || 'N/A';
          console.log('🔍 customerName renderCell params:', { value: params?.value, row: params?.row });
          
          if (name === 'N/A') {
            return (
              <Chip
                label="Missing Name"
                color="warning"
                size="small"
                variant="outlined"
              />
            );
          } else if (name.startsWith('User_')) {
            return (
              <Chip
                label="Generated Name"
                color="info"
                size="small"
                variant="outlined"
              />
            );
          }
          return (
            <Tooltip title={name}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'medium' }}>
                {name}
              </span>
            </Tooltip>
          );
        }
      },
    { 
      field: 'vehicleNo', 
      headerName: 'Vehicle No', 
      width: 130,
      valueGetter: (params) => {
        if (!params || !params.row) return 'N/A';
        return params.row.details?.vehicleNo || 'N/A';
      },
      renderCell: (params) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {params?.value || 'N/A'}
        </span>
      )
    },
    { 
      field: 'serialNo', 
      headerName: 'Serial No', 
      width: 150,
      valueGetter: (params) => {
        if (!params || !params.row) return 'N/A';
        return params.row.details?.serialNo || 'N/A';
      },
      renderCell: (params) => (
        <Tooltip title={params?.value || ''}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {params?.value || 'N/A'}
          </span>
        </Tooltip>
      )
    },
    { 
      field: 'previousBalance', 
      headerName: 'Previous Balance', 
      width: 140,
      type: 'number',
      valueGetter: (params) => {
        if (!params || !params.row) return 0;
        return params.row.details?.previousBalance || 0;
      },
      renderCell: (params) => (
        <span style={{ color: 'text.secondary' }}>
          ₹{params?.value || 0}
        </span>
      )
    },
    { 
      field: 'newBalance', 
      headerName: 'New Balance', 
      width: 120,
      type: 'number',
      valueGetter: (params) => {
        if (!params || !params.row) return 0;
        return params.row.details?.newBalance || 0;
      },
      renderCell: (params) => (
        <Chip
          label={`₹${params?.value || 0}`}
          color="primary"
          size="small"
          variant="outlined"
        />
      )
    },
    { 
      field: 'formattedTimestamp', 
      headerName: 'Timestamp', 
      width: 200,
      renderCell: (params) => (
        <Tooltip title={params?.value || ''}>
          <span style={{ fontSize: '0.8rem' }}>
            {params?.value || 'N/A'}
          </span>
        </Tooltip>
      )
    },
    { 
      field: 'userId', 
      headerName: 'User ID', 
      width: 200,   
      renderCell: (params) => (
        <Tooltip title={params?.value || ''}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
            {params?.value ? `${params.value.substring(0, 8)}...` : 'N/A'}
          </span>
        </Tooltip>
      )
    }
  ];

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Get unique values for filter options
  const getUniqueValues = (field) => {
    const values = new Set();
    transactions.forEach(transaction => {
      let value;
      if (field.includes('.')) {
        const [obj, prop] = field.split('.');
        value = transaction[obj]?.[prop];
      } else {
        value = transaction[field];
      }
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  return (
    <Box>
      {/* User Selection Dialog */}
      <Dialog 
        open={showUserDialog} 
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Select User to View Transactions</Typography>
            <IconButton onClick={handleDialogClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label="Search Users"
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
          
          {loadingUsers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
              {filteredUsers.length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary="No users found" 
                    secondary="Try adjusting your search terms"
                  />
                </ListItem>
              ) : (
                filteredUsers.map((user) => (
                  <ListItem key={user.id} disablePadding>
                    <ListItemButton onClick={() => handleUserSelect(user)}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        <PersonIcon />
                      </Avatar>
                      <ListItemText
                        primary={user.displayName}
                        secondary={user.email}
                      />
                    </ListItemButton>
                  </ListItem>
                ))
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Main Content - Only show if user is selected */}
      {!showUserDialog && selectedUser && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Transactions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage transaction records for {selectedUser?.displayName}
          </Typography>
          <Chip 
            label={`Selected: ${selectedUser?.displayName}`} 
            color="primary" 
            size="small" 
            sx={{ mt: 1 }}
            onDelete={() => {
              setSelectedUser(null);
              setShowUserDialog(true);
              setTransactions([]);
              setFilteredTransactions([]);
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportToCSV}
            disabled={filteredTransactions.length === 0}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={!selectedUser}
          >
            Refresh
          </Button>
        </Box>
      </Box>
      
                           {/* Filter Section */}
         <Paper sx={{ p: 2, mb: 3 }}>
           <Typography variant="h6" gutterBottom>Filters</Typography>
           <Grid container spacing={2} alignItems="center">
             <Grid item xs={12} md={1.5}>
               <TextField
                 fullWidth
                 size="small"
                 label="Search"
                 value={filter.searchTerm}
                 onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                 placeholder="Search by name, vehicle, serial no, transaction ID"
               />
             </Grid>
             
             <Grid item xs={12} md={1.5} width="10%">
               <FormControl fullWidth size="small">
                 <InputLabel>Source</InputLabel>
                 <Select
                   value={filter.collection}
                   onChange={(e) => handleFilterChange('collection', e.target.value)}
                   label="Source"
                 >
                   <MenuItem value="">All</MenuItem>
                   <MenuItem value="transactions">FasTag</MenuItem>
                   <MenuItem value="wallet_topups">Wallet</MenuItem>
                 </Select>
               </FormControl>
             </Grid>
             
             <Grid item xs={12} md={1.5} width="10%">
               <FormControl fullWidth size="small">
                 <InputLabel>Status</InputLabel>
                 <Select
                   value={filter.status}
                   onChange={(e) => handleFilterChange('status', e.target.value)}
                   label="Status"
                 >
                   <MenuItem value="">All</MenuItem>
                   {getUniqueValues('status').map(status => (
                     <MenuItem key={status} value={status}>{status}</MenuItem>
                   ))}
                 </Select>
               </FormControl>
             </Grid>
             
             <Grid item xs={12} md={1.5} width="10%">
               <FormControl fullWidth size="small">
                 <InputLabel>Type</InputLabel>
                 <Select
                   value={filter.type}
                   onChange={(e) => handleFilterChange('type', e.target.value)}
                   label="Type"
                 >
                   <MenuItem value="">All</MenuItem>
                   {getUniqueValues('type').map(type => (
                     <MenuItem key={type} value={type}>{type}</MenuItem>
                   ))}
                 </Select>
               </FormControl>
             </Grid>
             
             <Grid item xs={12} md={1.5} width="10%">
               <FormControl fullWidth size="small">
                 <InputLabel>Purpose</InputLabel>
                 <Select
                   value={filter.purpose}
                   onChange={(e) => handleFilterChange('purpose', e.target.value)}
                   label="Purpose"
                 >
                   <MenuItem value="">All</MenuItem>
                   {getUniqueValues('purpose').map(purpose => (
                     <MenuItem key={purpose} value={purpose}>{purpose}</MenuItem>
                   ))}
                 </Select>
               </FormControl>
             </Grid>
             
             <Grid item xs={12} md={1.5} width="10%">
               <FormControl fullWidth size="small">
                 <InputLabel>Payment Gateway</InputLabel>
                 <Select
                   value={filter.paymentGateway}
                   onChange={(e) => handleFilterChange('paymentGateway', e.target.value)}
                   label="Payment Gateway"
                 >
                   <MenuItem value="">All</MenuItem>
                   {getUniqueValues('paymentGateway').map(gateway => (
                     <MenuItem key={gateway} value={gateway}>{gateway}</MenuItem>
                   ))}
                 </Select>
               </FormControl>
             </Grid>
             
             <Grid item xs={12} md={1.5} width="10%">
               <Button
                 variant="outlined"
                 onClick={resetFilters}
                 size="medium"
                 sx={{ mr: 1 }}
               >
                 Reset
               </Button>
               <Button
                 variant="contained"
                 startIcon={<SearchIcon />}
                 size="medium"
               >
                 Search
               </Button>
             </Grid>
           </Grid>
         </Paper>
      
             {/* Transactions Table */}
       <Paper sx={{ height: 600, width: '100%' }}>
         {loading && loadingMessage && (
           <Box sx={{ p: 2, textAlign: 'center', borderBottom: 1, borderColor: 'divider' }}>
             <Typography variant="body2" color="text.secondary">
               {loadingMessage}
             </Typography>
           </Box>
         )}
         <DataGrid
           rows={filteredTransactions}
           columns={getColumns()}
           pageSize={10}
           rowsPerPageOptions={[10, 25, 50, 100]}
           loading={loading}
           error={error}
           getRowId={(row) => row.id}
           disableColumnMenu
           disableSelectionOnClick
           disableColumnFilter
           disableColumnSelector
           disableDensitySelector
           disableExtendRowFullWidth
           disableColumnResize
           sx={{
             '& .MuiDataGrid-cell:focus': {
               outline: 'none'
             },
             '& .MuiDataGrid-row:hover': {
               backgroundColor: 'transparent'
             }
           }}
           components={{
             NoRowsOverlay: () => (
               <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 5 }}>
                 <Typography variant="h6" color="text.secondary">
                   No Transactions Found
                 </Typography>
                 <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                   Try adjusting your filters or refresh the data
                 </Typography>
               </Box>
             )
           }}
         />
       </Paper>
      
             {/* Summary Stats */}
       <Paper sx={{ p: 2, mt: 3 }}>
         <Typography variant="h6" gutterBottom>Summary</Typography>
         <Grid container spacing={2}>
           <Grid item xs={12} md={2}>
             <Box sx={{ textAlign: 'center' }}>
               <Typography variant="h4" color="primary">
                 {filteredTransactions.length}
               </Typography>
               <Typography variant="body2" color="text.secondary">
                 Total Transactions
               </Typography>
             </Box>
           </Grid>
           <Grid item xs={12} md={2}>
             <Box sx={{ textAlign: 'center' }}>
               <Typography variant="h4" color="success.main">
                 ₹{filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}
               </Typography>
               <Typography variant="body2" color="text.secondary">
                 Total Amount
               </Typography>
             </Box>
           </Grid>
           <Grid item xs={12} md={2}>
             <Box sx={{ textAlign: 'center' }}>
               <Typography variant="h4" color="info.main">
                 {filteredTransactions.filter(t => t.collection === 'transactions').length}
               </Typography>
               <Typography variant="body2" color="text.secondary">
                 FasTag Transactions
               </Typography>
             </Box>
           </Grid>
           <Grid item xs={12} md={2}>
             <Box sx={{ textAlign: 'center' }}>
               <Typography variant="h4" color="warning.main">
                 {filteredTransactions.filter(t => t.collection === 'wallet_topups').length}
               </Typography>
               <Typography variant="body2" color="text.secondary">
                 Wallet Top-ups
               </Typography>
             </Box>
           </Grid>
           <Grid item xs={12} md={2}>
             <Box sx={{ textAlign: 'center' }}>
               <Typography variant="h4" color="success.main">
                 {filteredTransactions.filter(t => 
                   t.status === 'completed' || t.status === 'captured' || t.status === 'success'
                 ).length}
               </Typography>
               <Typography variant="body2" color="text.secondary">
                 Successful
               </Typography>
             </Box>
           </Grid>
           <Grid item xs={12} md={2}>
             <Box sx={{ textAlign: 'center' }}>
               <Typography variant="h4" color="error.main">
                 {filteredTransactions.filter(t => 
                   t.status === 'failed' || t.status === 'error'
                 ).length}
               </Typography>
               <Typography variant="body2" color="text.secondary">
                 Failed
               </Typography>
             </Box>
           </Grid>
         </Grid>
       </Paper>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
        </>
      )}
    </Box>
  );
}

export default UserTransactions;
