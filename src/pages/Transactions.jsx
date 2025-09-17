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
  Button
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { collection, query, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
     const [loading, setLoading] = useState(true);
   const [loadingMessage, setLoadingMessage] = useState('');
   const [error, setError] = useState(null);
   const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const { userData, isSuperAdmin, isSubAdmin } = useAuth();
  
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

  // Fetch transactions data
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching transactions...');
      
      const transactionsData = [];
      
                    // Fetch from transactions collection
       try {
         setLoadingMessage('Fetching all transactions from transactions collection...');
         console.log('🔄 Fetching all transactions from transactions collection...');
         const transactionsRef = collection(db, "transactions");
         const q = query(transactionsRef, orderBy("timestamp", "desc"));
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
      
                    // Fetch from wallet_topups collection
       try {
         setLoadingMessage('Fetching all transactions from wallet_topups collection...');
         console.log('🔄 Fetching all transactions from wallet_topups collection...');
         const walletTopupsRef = collection(db, "wallet_topups");
         const q2 = query(walletTopupsRef, orderBy("createdAt", "desc"));
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
       
               // Now fetch user names for all transactions (JOIN with users table)
        setLoadingMessage('Fetching user names from users collection...');
        console.log('🔄 Fetching user names from users collection...');
        const uniqueUserIds = [...new Set(transactionsData.map(t => t.userId).filter(id => id && id !== 'N/A'))];
       
       if (uniqueUserIds.length > 0) {
         try {
           const usersRef = collection(db, "users");
           
           // Since userId in transactions is actually the document ID of users, fetch each user individually
           const userNamesMap = {};
           
                       for (let i = 0; i < uniqueUserIds.length; i++) {
              const userId = uniqueUserIds[i];
              try {
                setLoadingMessage(`Fetching user ${i + 1} of ${uniqueUserIds.length}...`);
                // Get the user document directly by ID (this is the JOIN operation)
                const userDocRef = doc(db, "users", userId);
                const userDoc = await getDoc(userDocRef);
               
               if (userDoc.exists()) {
                 const userData = userDoc.data();
                 if (userData) {
                   // Use the correct field names from your users table
                   const userName = userData.displayName || 
                                  `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 
                                  userData.email || 
                                  'Unknown User';
                   // Use the userId (document ID) as the key
                   userNamesMap[userId] = userName;
                   console.log(`👤 Mapped user ${userId} -> ${userName}`);
                 }
               } else {
                 console.log(`⚠️ No user found for userId: ${userId}`);
               }
             } catch (userErr) {
               console.warn(`Error fetching user ${userId}:`, userErr);
             }
           }
           
           console.log(`🗺️ Final userNamesMap:`, userNamesMap);
           
           // Update transaction names with actual user names (MERGE the data)
           transactionsData.forEach(transaction => {
             if (transaction.userId && transaction.userId !== 'N/A') {
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
               
               const userName = userNamesMap[transaction.userId];
               console.log(`🔍 Looking up userId: ${transaction.userId}, found: ${userName || 'NOT FOUND'}`);
               
               if (userName) {
                 transaction.details.name = userName;
                 console.log(`✅ Updated transaction ${transaction.id} with name: ${userName}`);
               } else {
                 transaction.details.name = `User_${transaction.userId.substring(0, 8)}`;
                 console.log(`⚠️ Generated fallback name for transaction ${transaction.id}: User_${transaction.userId.substring(0, 8)}`);
               }
             }
           });
           
           console.log('✅ User names fetched and merged with transactions');
         } catch (userErr) {
           console.warn('Error fetching user names:', userErr);
           // Fallback to generated names if user fetch fails
           transactionsData.forEach(transaction => {
             if (transaction.userId && transaction.userId !== 'N/A') {
               if (!transaction.details) {
                 transaction.details = {
                   name: 'N/A',
                   vehicleNo: 'N/A',
                   serialNo: 'N/A',
                   previousBalance: 0,
                   newBalance: 0
                 };
               }
               
               if (transaction.details.name === 'N/A') {
                 transaction.details.name = `User_${transaction.userId.substring(0, 8)}`;
               }
             }
           });
         }
       }
       
       console.log('✅ Total transactions fetched:', transactionsData.length);
       
               // Debug: Show first few transactions with their merged names
        console.log('🔍 Sample transactions with merged names:');
        transactionsData.slice(0, 3).forEach((t, i) => {
          console.log(`Transaction ${i + 1}:`, {
            id: t.id,
            userId: t.userId,
            name: t.details?.name,
            details: t.details,
            customerName: t.details?.name // This should match the column field
          });
        });
        
        // Add customerName field directly to each transaction for DataGrid
        transactionsData.forEach(transaction => {
          transaction.customerName = transaction.details?.name || 'N/A';
        });
        
        console.log('✅ Final transaction data with customerName field:');
        transactionsData.slice(0, 3).forEach((t, i) => {
          console.log(`Final Transaction ${i + 1}:`, {
            id: t.id,
            customerName: t.customerName,
            details: t.details
          });
        });
        
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
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Transactions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage all transaction records
          </Typography>
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
            onClick={fetchTransactions}
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
    </Box>
  );
}

export default Transactions;
