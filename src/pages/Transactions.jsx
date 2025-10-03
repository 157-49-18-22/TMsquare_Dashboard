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
import { collection, query, getDocs, orderBy, doc, getDoc, where, writeBatch } from 'firebase/firestore';
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

  // Memoized filtered transactions with optimized filtering
  const filteredTransactionsMemo = useMemo(() => {
    let filtered = transactions;
    
    // Early return if no filters applied
    const hasFilters = debouncedFilter.searchTerm || 
                      debouncedFilter.collection || 
                      debouncedFilter.status || 
                      debouncedFilter.type || 
                      debouncedFilter.purpose || 
                      debouncedFilter.paymentGateway;
    
    if (!hasFilters) {
      return transactions;
    }
    
    // Create a single filter function for better performance
    const filterFunction = (transaction) => {
      // Search term filter (most expensive, so check first)
      if (debouncedFilter.searchTerm) {
        const term = debouncedFilter.searchTerm.toLowerCase();
        const searchFields = [
          transaction.details?.name,
          transaction.details?.email,
          transaction.details?.mobile,
          transaction.details?.vehicleNo,
          transaction.details?.serialNo,
          transaction.transactionId,
          transaction.userId,
          transaction.purpose,
          transaction.collection
        ];
        
        if (!searchFields.some(field => field && field.toLowerCase().includes(term))) {
          return false;
        }
      }
      
      // Other filters (fast equality checks)
      if (debouncedFilter.collection && transaction.collection !== debouncedFilter.collection) {
        return false;
      }
      
      if (debouncedFilter.status && transaction.status !== debouncedFilter.status) {
        return false;
      }
      
      if (debouncedFilter.type && transaction.type !== debouncedFilter.type) {
        return false;
      }
      
      if (debouncedFilter.purpose && transaction.purpose !== debouncedFilter.purpose) {
        return false;
      }
      
      if (debouncedFilter.paymentGateway && transaction.paymentGateway !== debouncedFilter.paymentGateway) {
        return false;
      }
      
      return true;
    };
    
    return transactions.filter(filterFunction);
  }, [transactions, debouncedFilter]);

  // Update filtered transactions when memoized result changes
  useEffect(() => {
    setFilteredTransactions(filteredTransactionsMemo);
  }, [filteredTransactionsMemo]);

  // User data cache
  const [userCache, setUserCache] = useState({});
  const CACHE_KEY = 'transactions_user_cache';
  const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  // Load user cache from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          setUserCache(data);
          console.log('📦 Loaded user cache from localStorage');
        }
      }
    } catch (error) {
      console.warn('Error loading user cache:', error);
    }
  }, []);

  // Save user cache to localStorage
  const saveUserCache = (userData) => {
    try {
      const cacheData = {
        data: userData,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log('💾 Saved user cache to localStorage');
    } catch (error) {
      console.warn('Error saving user cache:', error);
    }
  };

  // Fetch transactions data
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching transactions...');
      
      const transactionsData = [];
      
      // Fetch both collections in parallel for faster loading
      setLoadingMessage('Fetching transactions and wallet data in parallel...');
      console.log('🔄 Fetching transactions and wallet data in parallel...');
      
      const [transactionsSnapshot, walletSnapshot] = await Promise.all([
        // Fetch from transactions collection
        (async () => {
          try {
            setLoadingMessage('Fetching transactions collection...');
            console.log('🔄 Fetching transactions collection...');
            const transactionsRef = collection(db, "transactions");
            const q = query(transactionsRef, orderBy("timestamp", "desc"));
            return await getDocs(q);
          } catch (err) {
            console.warn('Error fetching transactions collection:', err);
            return { docs: [] };
          }
        })(),
        
        // Fetch from wallet_topups collection
        (async () => {
          try {
            setLoadingMessage('Fetching wallet topups collection...');
            console.log('🔄 Fetching wallet topups collection...');
            const walletTopupsRef = collection(db, "wallet_topups");
            const q2 = query(walletTopupsRef, orderBy("createdAt", "desc"));
            return await getDocs(q2);
          } catch (err) {
            console.warn('Error fetching wallet_topups collection:', err);
            return { docs: [] };
          }
        })()
      ]);
      
      // Process transactions collection
      try {
        setLoadingMessage(`Processing ${transactionsSnapshot.docs.length} transactions...`);
        console.log(`📊 Found ${transactionsSnapshot.docs.length} documents in transactions collection`);
         
         transactionsSnapshot.forEach((doc) => {
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
                   email: 'N/A', // Will be populated from users collection
                   mobile: 'N/A', // Will be populated from users collection
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
        console.warn('Error processing transactions collection:', err);
      }
      
      // Process wallet_topups collection
      try {
        setLoadingMessage(`Processing ${walletSnapshot.docs.length} wallet topups...`);
        console.log(`📊 Found ${walletSnapshot.docs.length} documents in wallet_topups collection`);
         
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
                    email: 'N/A',
                    mobile: 'N/A',
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
        console.warn('Error processing wallet_topups collection:', err);
      }
      
             // Sort all transactions by timestamp (newest first)
       transactionsData.sort((a, b) => {
         const timeA = a.timestamp || a.createdAt;
         const timeB = b.timestamp || b.createdAt;
         if (!timeA || !timeB) return 0;
         return timeB.toDate ? timeB.toDate() - timeA.toDate() : timeB - timeA;
       });
       
               // Now fetch user names for all transactions (JOIN with users table)
        setLoadingMessage('Fetching user data from users collection...');
        console.log('🔄 Fetching user data from users collection...');
        const uniqueUserIds = [...new Set(transactionsData.map(t => t.userId).filter(id => id && id !== 'N/A'))];
       
       if (uniqueUserIds.length > 0) {
         try {
           const usersRef = collection(db, "users");
           const userNamesMap = { ...userCache }; // Start with cached data
           
           // Find users that need to be fetched (not in cache)
           const usersToFetch = uniqueUserIds.filter(userId => !userCache[userId]);
           console.log(`📦 Cache hit: ${Object.keys(userCache).length} users, Need to fetch: ${usersToFetch.length} users`);
           
           // Debug: Test fetch a single user to see the structure (only if needed)
           if (usersToFetch.length > 0) {
             console.log(`🔍 Testing fetch for user: ${usersToFetch[0]}`);
             const testUserRef = doc(db, "users", usersToFetch[0]);
             const testUserDoc = await getDoc(testUserRef);
             if (testUserDoc.exists()) {
               const testUserData = testUserDoc.data();
               console.log(`✅ Test user data structure:`, {
                 id: testUserDoc.id,
                 displayName: testUserData.displayName,
                 email: testUserData.email,
                 phone: testUserData.phone,
                 mobileNo: testUserData.mobileNo,
                 phoneNumber: testUserData.phoneNumber,
                 mobile: testUserData.mobile,
                 firstName: testUserData.firstName,
                 lastName: testUserData.lastName
               });
             } else {
               console.log(`❌ Test user not found: ${usersToFetch[0]}`);
             }
           }
           
           // Only fetch users that are not in cache
           if (usersToFetch.length > 0) {
             // Optimized batch processing with larger batches and parallel execution
             const batchSize = 20; // Increased from 10 to 20
             const userBatches = [];
             
             // Split users to fetch into batches of 20
             for (let i = 0; i < usersToFetch.length; i += batchSize) {
               userBatches.push(usersToFetch.slice(i, i + batchSize));
             }
           
             console.log(`📦 Processing ${userBatches.length} batches of users (${usersToFetch.length} users to fetch)`);
             
             // Process batches in parallel for maximum speed
             const batchPromises = userBatches.map(async (userBatch, batchIndex) => {
               setLoadingMessage(`Fetching user batch ${batchIndex + 1} of ${userBatches.length} (${userBatch.length} users)...`);
               
               try {
                 // Fetch all users in this batch in parallel
                 const userPromises = userBatch.map(userId => {
                   const userDocRef = doc(db, "users", userId);
                   return getDoc(userDocRef);
                 });
                 
                 const userDocs = await Promise.all(userPromises);
                 const batchSnapshot = { docs: userDocs.filter(doc => doc.exists()) };
                 
                 console.log(`📊 Batch ${batchIndex + 1}: Found ${batchSnapshot.docs.length} users out of ${userBatch.length} requested`);
                 
                 const batchResults = {};
                 batchSnapshot.forEach((userDoc) => {
                   const userData = userDoc.data();
                   if (userData) {
                     const userId = userDoc.id;
                     
                     // Use the correct field names from your users table
                     const userName = userData.displayName || 
                                    `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 
                                    userData.email || 
                                    'Unknown User';
                     
                     const userEmail = userData.email || 'N/A';
                     const userMobile = userData.phone || userData.mobileNo || userData.phoneNumber || userData.mobile || 'N/A';
                     
                     // Store user data object
                     batchResults[userId] = {
                       name: userName,
                       email: userEmail,
                       mobile: userMobile
                     };
                     console.log(`👤 Mapped user ${userId} -> ${userName} (${userEmail}, ${userMobile})`);
                   }
                 });
                 
                 // Handle users not found in this batch
                 const foundUserIds = batchSnapshot.docs.map(doc => doc.id);
                 const missingUserIds = userBatch.filter(id => !foundUserIds.includes(id));
                 if (missingUserIds.length > 0) {
                   console.log(`⚠️ Users not found in batch ${batchIndex + 1}:`, missingUserIds);
                 }
                 
                 return batchResults;
                 
               } catch (batchErr) {
                 console.warn(`Error fetching user batch ${batchIndex + 1}:`, batchErr);
                 // Fallback: try individual fetches for this batch
                 const fallbackResults = {};
                 for (const userId of userBatch) {
                   try {
                     const userDocRef = doc(db, "users", userId);
                     const userDoc = await getDoc(userDocRef);
                     
                     if (userDoc.exists()) {
                       const userData = userDoc.data();
                       if (userData) {
                         const userName = userData.displayName || 
                                        `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 
                                        userData.email || 
                                        'Unknown User';
                         
                         const userEmail = userData.email || 'N/A';
                         const userMobile = userData.phone || userData.mobileNo || userData.phoneNumber || userData.mobile || 'N/A';
                         
                         fallbackResults[userId] = {
                           name: userName,
                           email: userEmail,
                           mobile: userMobile
                         };
                       }
                     }
                   } catch (individualErr) {
                     console.warn(`Error fetching individual user ${userId}:`, individualErr);
                   }
                 }
                 return fallbackResults;
               }
             });
             
             // Wait for all batches to complete in parallel
             const batchResults = await Promise.all(batchPromises);
             
             // Merge all batch results into userNamesMap
             batchResults.forEach(batchResult => {
               Object.assign(userNamesMap, batchResult);
             });
             
             // Save updated cache
             setUserCache(userNamesMap);
             saveUserCache(userNamesMap);
           } else {
             console.log('📦 All users found in cache, skipping fetch');
           }
           
           console.log(`🗺️ Final userNamesMap:`, userNamesMap);
           console.log(`📊 Total users available: ${Object.keys(userNamesMap).length}`);
           console.log(`📊 Sample user data:`, Object.entries(userNamesMap).slice(0, 3));
           
           // Update transaction names with actual user names (MERGE the data)
           console.log(`🔄 Starting to merge user data with ${transactionsData.length} transactions`);
           const transactionUserIds = transactionsData.map(t => t.userId).filter(id => id && id !== 'N/A');
           console.log(`📋 Transaction userIds to look up:`, transactionUserIds.slice(0, 5), '...');
           
           transactionsData.forEach(transaction => {
             if (transaction.userId && transaction.userId !== 'N/A') {
               // Ensure details object exists
               if (!transaction.details) {
                 transaction.details = {
                   name: 'N/A',
                   email: 'N/A',
                   mobile: 'N/A',
                   vehicleNo: 'N/A',
                   serialNo: 'N/A',
                   previousBalance: 0,
                   newBalance: 0
                 };
               }
               
               const userData = userNamesMap[transaction.userId];
               console.log(`🔍 Looking up userId: ${transaction.userId}, found:`, userData || 'NOT FOUND');
               
               if (userData) {
                 transaction.details.name = userData.name;
                 transaction.details.email = userData.email;
                 transaction.details.mobile = userData.mobile;
                 console.log(`✅ Updated transaction ${transaction.id} with user data:`, userData);
               } else {
                 transaction.details.name = `User_${transaction.userId.substring(0, 8)}`;
                 transaction.details.email = 'N/A';
                 transaction.details.mobile = 'N/A';
                 console.log(`⚠️ Generated fallback data for transaction ${transaction.id}: User_${transaction.userId.substring(0, 8)}`);
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
                   email: 'N/A',
                   mobile: 'N/A',
                   vehicleNo: 'N/A',
                   serialNo: 'N/A',
                   previousBalance: 0,
                   newBalance: 0
                 };
               }
               
               if (transaction.details.name === 'N/A') {
                 transaction.details.name = `User_${transaction.userId.substring(0, 8)}`;
                 transaction.details.email = 'N/A';
                 transaction.details.mobile = 'N/A';
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
            email: t.details?.email,
            mobile: t.details?.mobile,
            details: t.details,
            customerName: t.details?.name // This should match the column field
          });
        });
        
        // Pre-compute all fields for DataGrid to avoid repeated calculations
        transactionsData.forEach(transaction => {
          transaction.customerName = transaction.details?.name || 'N/A';
          transaction.customerEmail = transaction.details?.email || 'N/A';
          transaction.customerMobile = transaction.details?.mobile || 'N/A';
          transaction.vehicleNumber = transaction.details?.vehicleNo || 'N/A';
          transaction.serialNumber = transaction.details?.serialNo || 'N/A';
          transaction.previousBalance = Math.round((transaction.details?.previousBalance || 0) * 100);
          transaction.newBalance = Math.round((transaction.details?.newBalance || 0) * 100);
        });
        
        console.log('✅ Final transaction data with customerName field:');
        transactionsData.slice(0, 3).forEach((t, i) => {
          console.log(`Final Transaction ${i + 1}:`, {
            id: t.id,
            customerName: t.customerName,
            email: t.details?.email,
            mobile: t.details?.mobile,
            details: t.details
          });
        });
        
        // Set state AFTER user data is merged
        console.log('🔄 Setting transactions state with merged user data...');
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
        'Email',
        'Mobile No',
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
        transaction.customerName || '',
        transaction.customerEmail || '',
        transaction.customerMobile || '',
        transaction.vehicleNumber || '',
        transaction.serialNumber || '',
        transaction.previousBalance || 0,
        transaction.newBalance || 0,
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
      field: 'customerEmail', 
      headerName: 'Email', 
      width: 200,
      renderCell: (params) => {
        const email = params?.value || 'N/A';
        if (email === 'N/A') {
          return (
            <Chip
              label="No Email"
              color="warning"
              size="small"
              variant="outlined"
            />
          );
        }
        return (
          <Tooltip title={email}>
            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {email}
            </span>
          </Tooltip>
        );
      }
    },
    { 
      field: 'customerMobile', 
      headerName: 'Mobile No', 
      width: 130,
      renderCell: (params) => {
        const mobile = params?.value || 'N/A';
        if (mobile === 'N/A') {
          return (
            <Chip
              label="No Mobile"
              color="warning"
              size="small"
              variant="outlined"
            />
          );
        }
        return (
          <Tooltip title={mobile}>
            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {mobile}
            </span>
          </Tooltip>
        );
      }
    },
    { 
      field: 'vehicleNumber', 
      headerName: 'Vehicle No', 
      width: 130,
      renderCell: (params) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {params?.value || 'N/A'}
        </span>
      )
    },
    { 
      field: 'serialNumber', 
      headerName: 'Serial No', 
      width: 150,
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
                 placeholder="Search by name, email, mobile, vehicle, serial no, transaction ID"
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
           pageSize={25}
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
           // Performance optimizations
           disableVirtualization={false}
           rowHeight={52}
           columnBuffer={5}
           rowBuffer={5}
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
