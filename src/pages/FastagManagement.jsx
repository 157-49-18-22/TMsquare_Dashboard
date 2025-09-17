import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  TextField, 
  Grid, 
  Card, 
  CardContent, 
  IconButton,
  Backdrop,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  FormControl,
  InputLabel,
  OutlinedInput,
  FormHelperText,
  Chip,
  Stack,
  Snackbar,
  MenuItem,
  Select
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, limit, where, deleteDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import * as XLSX from 'xlsx';

// Cache for reducing Firebase reads with localStorage persistence
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const CACHE_PREFIX = 'fastag_allocation_cache_';

// Initialize cache from localStorage
const initializeCache = () => {
  const cache = {
    users: new Map(),
    lastFetch: {
      users: 0
    }
  };

  try {
    // Load users cache
    const usersCache = localStorage.getItem(CACHE_PREFIX + 'users');
    if (usersCache) {
      const parsedUsers = JSON.parse(usersCache);
      parsedUsers.forEach(([key, value]) => {
        cache.users.set(key, value);
      });
      console.log('📦 [FastagAllocation] Users cache loaded from localStorage');
    }

    // Load last fetch timestamps
    const lastFetchCache = localStorage.getItem(CACHE_PREFIX + 'lastFetch');
    if (lastFetchCache) {
      cache.lastFetch = JSON.parse(lastFetchCache);
    }
  } catch (error) {
    console.error('Error loading cache from localStorage:', error);
  }

  return cache;
};

const fastagCache = initializeCache();

// Helper function to check if cache is valid
const isCacheValid = (cacheKey) => {
  const lastFetch = fastagCache.lastFetch[cacheKey];
  return lastFetch && (Date.now() - lastFetch) < CACHE_EXPIRY;
};

// Helper function to save cache to localStorage
const saveCacheToStorage = (cacheKey) => {
  try {
    if (cacheKey === 'users') {
      const usersArray = Array.from(fastagCache.users.entries());
      localStorage.setItem(CACHE_PREFIX + 'users', JSON.stringify(usersArray));
    }
    localStorage.setItem(CACHE_PREFIX + 'lastFetch', JSON.stringify(fastagCache.lastFetch));
  } catch (error) {
    console.error('Error saving cache to localStorage:', error);
  }
};

// Helper function to clear cache
const clearCache = (cacheKey = null) => {
  if (cacheKey) {
    if (cacheKey === 'users') {
      fastagCache.users.clear();
      localStorage.removeItem(CACHE_PREFIX + 'users');
    }
    fastagCache.lastFetch[cacheKey] = 0;
  } else {
    fastagCache.users.clear();
    Object.keys(fastagCache.lastFetch).forEach(key => {
      fastagCache.lastFetch[key] = 0;
    });
    // Clear all localStorage cache
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
  saveCacheToStorage();
};

// Component for FasTag Allocation (Add/Allocate FasTags)
const FastagManagement = () => {
  // State for user data
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // State for serial numbers
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [newSerialNumber, setNewSerialNumber] = useState('');
  
  // State for recently allocated Fastags
  const [recentAllocations, setRecentAllocations] = useState([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openAllocationDialog, setOpenAllocationDialog] = useState(false);
  const [openDeletionDialog, setOpenDeletionDialog] = useState(false);
  const [deletionPreview, setDeletionPreview] = useState([]);
  const [deletionLoading, setDeletionLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Optimized fetch users function with caching
  const fetchUsers = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && fastagCache.users.size > 0 && isCacheValid('users')) {
        console.log('✅ [FastagAllocation] Users fetched from CACHE');
        const cachedUsers = Array.from(fastagCache.users.values());
        setUsers(cachedUsers);
        return;
      }

      console.log('🔄 [FastagAllocation] Users not in cache, fetching from API...');
      setLoading(true);
      const userRef = collection(db, "users");
      const userQuery = query(userRef);
      const userSnapshot = await getDocs(userQuery);
    
      if (userSnapshot.empty) {
        setUsers([]);
        fastagCache.users.clear();
        fastagCache.lastFetch.users = Date.now();
        setLoading(false);
        return;
      }
      
      const fetchedUsers = userSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(user => user.bcId || user.BC_Id); // Only users with BC_Id
      
      // Update cache
      fastagCache.users.clear();
      fetchedUsers.forEach(user => {
        fastagCache.users.set(user.id, user);
      });
      fastagCache.lastFetch.users = Date.now();
      
      // Save to localStorage
      saveCacheToStorage('users');
      
      console.log('✅ [FastagAllocation] Users fetched from API and cached');
      setUsers(fetchedUsers);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to load users. Please try again.");
      setLoading(false);
    }
  }, []);

  // Optimized function to get user by BC ID with caching
  const getUserByBcId = useCallback(async (bcId) => {
    // Check cache first
    for (const [userId, user] of fastagCache.users) {
      if (user.bcId === bcId || user.BC_Id === bcId) {
        return user;
      }
    }

    // If not in cache, fetch from Firebase
    try {
      const userRef = collection(db, "users");
      const userQuery = query(userRef, where("bcId", "==", bcId));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        // Try with BC_Id (uppercase) as well
        const userQuery2 = query(userRef, where("BC_Id", "==", bcId));
        const userSnapshot2 = await getDocs(userQuery2);
        
        if (userSnapshot2.empty) {
          return null;
        } else {
          const user = { id: userSnapshot2.docs[0].id, ...userSnapshot2.docs[0].data() };
          // Update cache
          fastagCache.users.set(user.id, user);
          return user;
        }
      } else {
        const user = { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
        // Update cache
        fastagCache.users.set(user.id, user);
        return user;
      }
    } catch (error) {
      console.error("Error fetching user by BC ID:", error);
      return null;
    }
  }, []);

  // Batch operation to get multiple users by BC IDs
  const getUsersByBcIds = useCallback(async (bcIds) => {
    const uniqueBcIds = [...new Set(bcIds)];
    const usersByBcId = {};
    const invalidBcIds = [];

    // First check cache for all BC IDs
    for (const bcId of uniqueBcIds) {
      for (const [userId, user] of fastagCache.users) {
        if (user.bcId === bcId || user.BC_Id === bcId) {
          usersByBcId[bcId] = user;
          break;
        }
      }
    }

    // For BC IDs not in cache, fetch from Firebase
    const uncachedBcIds = uniqueBcIds.filter(bcId => !usersByBcId[bcId]);
    
    if (uncachedBcIds.length > 0) {
      // Fetch all users at once and filter by BC IDs
      const userRef = collection(db, "users");
      const userQuery = query(userRef);
      const userSnapshot = await getDocs(userQuery);
      
      const allUsers = userSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Update cache with all users
      allUsers.forEach(user => {
        fastagCache.users.set(user.id, user);
      });

      // Find users for uncached BC IDs
      for (const bcId of uncachedBcIds) {
        const user = allUsers.find(u => u.bcId === bcId || u.BC_Id === bcId);
        if (user) {
          usersByBcId[bcId] = user;
        } else {
          invalidBcIds.push(bcId);
        }
      }
    }

    return { usersByBcId, invalidBcIds };
  }, []);

  // Function to fetch recently allocated Fastags
  const fetchRecentAllocations = useCallback(async () => {
    try {
      setLoadingAllocations(true);
      const allocationsRef = collection(db, "allocatedFasTags");
      const allocationsQuery = query(
        allocationsRef,
        orderBy("allocatedAt", "desc"),
        limit(20) // Show last 20 allocations
      );
      const allocationsSnapshot = await getDocs(allocationsQuery);
      
      const allocations = allocationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        allocatedAt: doc.data().allocatedAt?.toDate?.() || new Date()
      }));
      
      setRecentAllocations(allocations);
      setLoadingAllocations(false);
    } catch (error) {
      console.error("Error fetching recent allocations:", error);
      setError("Failed to load recent allocations.");
      setLoadingAllocations(false);
    }
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    fetchUsers();
    fetchRecentAllocations();
  }, [fetchUsers, fetchRecentAllocations]);
  
  // Handle adding a serial number to the list
  const handleAddSerialNumber = () => {
    if (!newSerialNumber.trim()) return;
    
    // Check if serial number already exists in the list
    if (serialNumbers.includes(newSerialNumber.trim())) {
      setError("This serial number is already in the list.");
      return;
    }
    
    setSerialNumbers([...serialNumbers, newSerialNumber.trim()]);
    setNewSerialNumber('');
  };
  
  // Handle removing a serial number from the list
  const handleRemoveSerialNumber = (index) => {
    const updatedSerialNumbers = [...serialNumbers];
    updatedSerialNumbers.splice(index, 1);
    setSerialNumbers(updatedSerialNumbers);
  };
  
  // Open allocation dialog
  const handleOpenAllocationDialog = () => {
    setOpenAllocationDialog(true);
  };
  
  // Close allocation dialog
  const handleCloseAllocationDialog = () => {
    setOpenAllocationDialog(false);
    setSerialNumbers([]);
    setSelectedUser(null);
  };
  
  // Create template Excel file for bulk upload
  const createTemplateExcel = () => {
    const template = [
      ["Serial Number", "BC ID"], // Header row with user BC_ID column
      ["EXAMPLE123456", "TMSQUARE12"], // Example row
      ["", ""] // Empty row for users to fill
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FasTag Serial Numbers");
    XLSX.writeFile(workbook, "fastag_serial_numbers_template.xlsx");
  };

  // Create template Excel file for bulk deletion
  const createDeletionTemplateExcel = () => {
    const template = [
      ["Serial Number"], // Header row
      ["EXAMPLE123456"], // Example row
      ["EXAMPLE789012"], // Another example
      [""] // Empty row for users to fill
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FasTag Serial Numbers to Delete");
    XLSX.writeFile(workbook, "fastag_deletion_template.xlsx");
  };
  
  // Handle bulk deletion of serial numbers from Excel
  const handleBulkDeletion = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Check if any data was found
        if (jsonData.length === 0) {
          setError("No valid data found in the Excel file.");
          return;
        }
        
        // Check if the file has the required columns
        const firstRow = jsonData[0];
        const hasSerialNumber = firstRow["Serial Number"] !== undefined;
        
        if (!hasSerialNumber) {
          setError("The Excel file is missing the 'Serial Number' column.");
          return;
        }
        
        // Extract serial numbers and filter out empty ones
        const extractedSerialNumbers = jsonData
          .map(row => String(row["Serial Number"] || "").trim())
          .filter(serialNo => serialNo !== "");
        
        if (extractedSerialNumbers.length === 0) {
          setError("No valid serial numbers found in the Excel file.");
          return;
        }
        
        // Preview the deletion
        previewDeletion(extractedSerialNumbers);
        
      } catch (error) {
        console.error("Error processing Excel file:", error);
        setError("Failed to process the Excel file. Please ensure it's in the correct format.");
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset the input to allow selecting the same file again
    event.target.value = '';
  };

  // Handle bulk upload of serial numbers from Excel
  const handleBulkUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Check if any data was found
        if (jsonData.length === 0) {
          setError("No valid data found in the Excel file.");
          return;
        }
        
        // Check if the file has the required columns
        const firstRow = jsonData[0];
        const hasSerialNumber = firstRow["Serial Number"] !== undefined;
        const hasBcId = firstRow["BC ID"] !== undefined;
        
        if (!hasSerialNumber) {
          setError("The Excel file is missing the 'Serial Number' column.");
          return;
        }
        
        if (hasBcId) {
          // Full format with BC_ID - this means we can directly allocate
          allocateFromExcel(jsonData);
        } else {
          // Legacy format with just serial numbers - extract and add to the list
          const extractedSerialNumbers = jsonData
            .map(row => String(row["Serial Number"] || "").trim())
            .filter(serialNo => serialNo !== "");
          
          if (extractedSerialNumbers.length === 0) {
            setError("No valid serial numbers found in the Excel file.");
            return;
          }
          
          // Merge with existing serial numbers, removing duplicates
          const newSerialNumbers = [...new Set([...serialNumbers, ...extractedSerialNumbers])];
          setSerialNumbers(newSerialNumbers);
          setSuccess(`Successfully imported ${extractedSerialNumbers.length} serial numbers from Excel.`);
        }
      } catch (error) {
        console.error("Error processing Excel file:", error);
        setError("Failed to process the Excel file. Please ensure it's in the correct format.");
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset the input to allow selecting the same file again
    event.target.value = '';
  };
  
  // Optimized function to handle allocating FasTags directly from Excel data
  const allocateFromExcel = useCallback(async (excelData) => {
    try {
      setLoading(true);
      
      // Filter out rows with empty serial numbers or BC IDs
      const validRows = excelData.filter(row => 
        row["Serial Number"] && 
        row["Serial Number"].toString().trim() !== "" && 
        row["BC ID"] && 
        row["BC ID"].toString().trim() !== ""
      );
      
      if (validRows.length === 0) {
        setError("No valid data found in the Excel file. Ensure both Serial Number and BC ID columns are filled.");
        setLoading(false);
        return;
      }
      
      // Check if all BC IDs exist in the system using batch operation
      const allBcIds = [...new Set(validRows.map(row => row["BC ID"].toString().trim()))];
      const { usersByBcId, invalidBcIds } = await getUsersByBcIds(allBcIds);
      
      // If there are invalid BC IDs, show an error
      if (invalidBcIds.length > 0) {
        setError(`The following BC IDs were not found in the system: ${invalidBcIds.join(", ")}`);
        setLoading(false);
        return;
      }
      
      // Allocate FasTags based on the Excel data
      let successCount = 0;
      let errorCount = 0;
      
      for (const row of validRows) {
        const serialNumber = row["Serial Number"].toString().trim();
        const bcId = row["BC ID"].toString().trim();
        const user = usersByBcId[bcId];
        
        try {
          await addDoc(collection(db, "allocatedFasTags"), {
            serialNumber,
            bcId,
            userId: user.uid || user.id || bcId || "unknown-user",
            userName: user.displayName || user.name || "Unknown",
            status: "available", // available, used, revoked
            allocatedAt: serverTimestamp(),
            allocatedBy: "admin",
            allocatedViaExcel: true
          });
          successCount++;
        } catch (err) {
          console.error(`Error allocating serial number ${serialNumber} to BC ID ${bcId}:`, err);
          errorCount++;
        }
      }
      
      // Show success/error message
      if (successCount > 0) {
        setSuccess(`Successfully allocated ${successCount} FasTags from Excel file${errorCount > 0 ? ` (${errorCount} errors)` : ""}.`);
        // Refresh recent allocations to show the new data
        await fetchRecentAllocations();
      } else {
        setError("Failed to allocate any FasTags from the Excel file.");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error allocating FasTags from Excel:", error);
      setError("Failed to allocate FasTags from Excel. Please try again.");
      setLoading(false);
    }
  }, [getUsersByBcIds]);
  
  // Update bulk upload section in the UI
  const renderBulkUploadSection = () => (
    <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px dashed #ccc' }}>
      <Typography variant="subtitle2" gutterBottom>
        Bulk Upload FasTag Serial Numbers
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        You can upload an Excel file with Serial Numbers and BC IDs to automatically allocate FasTags to users.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          variant="outlined"
          component="label"
        >
          Upload Excel File
          <input
            type="file"
            hidden
            accept=".xlsx, .xls"
            onChange={handleBulkUpload}
          />
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Upload an Excel file with serial numbers and BC IDs for direct allocation
        </Typography>
        <Button
          variant="text"
          size="small"
          onClick={createTemplateExcel}
        >
          Download Template
        </Button>
      </Box>
    </Box>
  );
  
  // Preview deletion by checking which serial numbers exist
  const previewDeletion = async (serialNumbers) => {
    try {
      setDeletionLoading(true);
      const previewData = [];
      
      for (const serialNumber of serialNumbers) {
        try {
          // Check if serial number exists in allocatedFasTags
          const allocatedRef = collection(db, "allocatedFasTags");
          const allocatedQuery = query(allocatedRef, where("serialNumber", "==", serialNumber));
          const allocatedSnapshot = await getDocs(allocatedQuery);
          
          if (!allocatedSnapshot.empty) {
            const allocation = allocatedSnapshot.docs[0];
            previewData.push({
              serialNumber,
              exists: true,
              documentId: allocation.id,
              status: allocation.data().status,
              bcId: allocation.data().bcId,
              userName: allocation.data().userName,
              allocatedAt: allocation.data().allocatedAt
            });
          } else {
            // Check if it exists in transactions collection
            const transactionsRef = collection(db, "transactions");
            const transactionsQuery = query(transactionsRef, where("details.serialNo", "==", serialNumber));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            
            if (!transactionsSnapshot.empty) {
              const transaction = transactionsSnapshot.docs[0];
              previewData.push({
                serialNumber,
                exists: true,
                documentId: transaction.id,
                status: 'in_transaction',
                bcId: 'N/A',
                userName: 'N/A',
                allocatedAt: transaction.data().timestamp
              });
            } else {
              previewData.push({
                serialNumber,
                exists: false,
                documentId: null,
                status: 'not_found',
                bcId: 'N/A',
                userName: 'N/A',
                allocatedAt: null
              });
            }
          }
        } catch (error) {
          console.error(`Error checking serial number ${serialNumber}:`, error);
          previewData.push({
            serialNumber,
            exists: false,
            documentId: null,
            status: 'error',
            bcId: 'N/A',
            userName: 'N/A',
            allocatedAt: null,
            error: error.message
          });
        }
      }
      
      setDeletionPreview(previewData);
      setOpenDeletionDialog(true);
      setDeletionLoading(false);
    } catch (error) {
      console.error("Error previewing deletion:", error);
      setError("Failed to preview deletion. Please try again.");
      setDeletionLoading(false);
    }
  };

  // Execute the actual deletion
  const executeDeletion = async () => {
    try {
      setDeletionLoading(true);
      const batch = writeBatch(db);
      let successCount = 0;
      let errorCount = 0;
      
      for (const item of deletionPreview) {
        if (item.exists && item.documentId) {
          try {
            if (item.status === 'in_transaction') {
              // Delete from transactions collection
              const transactionRef = doc(db, "transactions", item.documentId);
              batch.delete(transactionRef);
            } else {
              // Delete from allocatedFasTags collection
              const allocationRef = doc(db, "allocatedFasTags", item.documentId);
              batch.delete(allocationRef);
            }
            successCount++;
          } catch (error) {
            console.error(`Error deleting ${item.serialNumber}:`, error);
            errorCount++;
          }
        }
      }
      
      if (successCount > 0) {
        await batch.commit();
        setSuccess(`Successfully deleted ${successCount} Fastag records${errorCount > 0 ? ` (${errorCount} errors)` : ""}.`);
        setOpenDeletionDialog(false);
        setDeletionPreview([]);
        // Refresh recent allocations
        await fetchRecentAllocations();
      } else {
        setError("No Fastag records were deleted.");
      }
      
      setDeletionLoading(false);
    } catch (error) {
      console.error("Error executing deletion:", error);
      setError("Failed to execute deletion. Please try again.");
      setDeletionLoading(false);
    }
  };

  // Optimized allocate FasTags to the selected user
  const handleAllocateFasTags = useCallback(async () => {
    if (!selectedUser) {
      setError("Please select a user to allocate FasTags to.");
      return;
    }
    
    if (serialNumbers.length === 0) {
      setError("Please add at least one serial number to allocate.");
      return;
    }
    
    try {
      setLoading(true);
      
      // Get the user's BC_ID
      const bcId = selectedUser.bcId || selectedUser.BC_Id;
      
      // Make sure we have a user ID - use uid or id field, or bcId as fallback
      const userId = selectedUser.uid || selectedUser.id || bcId || "unknown-user";
      
      // Add each serial number to the allocatedFasTags collection in Firestore
      for (const serialNumber of serialNumbers) {
        await addDoc(collection(db, "allocatedFasTags"), {
          serialNumber,
          bcId,
          userId: userId,
          userName: selectedUser.displayName || selectedUser.name || "Unknown",
          status: "available", // available, used, revoked
          allocatedAt: serverTimestamp(),
          allocatedBy: "admin" // TODO: Get current admin ID
        });
      }
      
      // Show success message
      setSuccess(`Successfully allocated ${serialNumbers.length} FasTags to ${selectedUser.displayName || selectedUser.name || "user"}.`);
      
      // Refresh recent allocations to show the new data
      await fetchRecentAllocations();
      
      // Close the allocation dialog and reset form
      handleCloseAllocationDialog();
      setLoading(false);
    } catch (error) {
      console.error("Error allocating FasTags:", error);
      setError(`Failed to allocate FasTags: ${error.message}`);
      setLoading(false);
    }
  }, [selectedUser, serialNumbers]);
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Page header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          FasTag Allocation
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={() => window.location.href = '/fastag-data'}
          >
            View FasTag Data
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleOpenAllocationDialog}
          >
            Allocate FasTags
          </Button>
        </Box>
      </Box>
      
      {/* Error and success alerts */}
      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
      
      <Snackbar 
        open={!!success} 
        autoHideDuration={4000} 
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
      
      {/* Quick help section with cache status */}
      <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid #f0f0f0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            FasTag Allocation
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={`Users: ${isCacheValid('users') ? 'Cached' : 'Fresh'}`}
              size="small"
              color={isCacheValid('users') ? 'success' : 'warning'}
            />
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          This page is for allocating new FasTags to users. You can add serial numbers manually or upload an Excel file for bulk allocation.
          You can also delete Fastag records using Excel files with serial numbers.
          <Button 
            variant="text" 
            size="small" 
            onClick={createTemplateExcel}
            sx={{ ml: 1 }}
          >
            Download Templates
          </Button>
        </Typography>
      </Box>
      
      {/* Quick actions cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3} width="25%">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Manual Allocation
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add serial numbers manually and allocate them to a specific user
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={handleOpenAllocationDialog}
                fullWidth
              >
                Start Manual Allocation
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={3} width="20%">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Bulk Upload
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload an Excel file with serial numbers and BC IDs for automatic allocation
              </Typography>
              <Button 
                variant="outlined" 
                component="label"
                fullWidth
              >
                Upload Excel File
                <input 
                  type="file" 
                  hidden 
                  accept=".xlsx, .xls" 
                  onChange={handleBulkUpload}
                />
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={3} width="20%">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Bulk Deletion
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload an Excel file with serial numbers to delete Fastag records
              </Typography>
              <Button 
                variant="outlined" 
                color="error"
                component="label"
                fullWidth
              >
                Upload for Deletion
                <input 
                  type="file" 
                  hidden 
                  accept=".xlsx, .xls" 
                  onChange={handleBulkDeletion}
                />
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={3} width="20%">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Download Templates
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Download Excel templates for allocation and deletion
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={createTemplateExcel}
                  fullWidth
                >
                  Allocation Template
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  color="error"
                  onClick={createDeletionTemplateExcel}
                  fullWidth
                >
                  Deletion Template
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Allocation Dialog */}
      <Dialog 
        open={openAllocationDialog} 
        onClose={handleCloseAllocationDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Allocate FasTag Serial Numbers</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* User selection */}
            <Typography variant="subtitle1" gutterBottom>
              Select User to Allocate FasTags
            </Typography>
            <Autocomplete
              options={users}
              getOptionLabel={(option) => 
                `${option.displayName || option.name || "Unknown"} - BC ID: ${option.bcId || option.BC_Id || "Unknown"}`
              }
              value={selectedUser}
              onChange={(event, newValue) => setSelectedUser(newValue)}
              renderInput={(params) => 
                <TextField 
                  {...params} 
                  label="Select User" 
                  fullWidth 
                  required
                  margin="normal"
                />
              }
              sx={{ mb: 3 }}
            />
            
            {/* Serial number input */}
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={9}>
                <TextField
                  label="FasTag Serial Number"
                  variant="outlined"
                  fullWidth
                  value={newSerialNumber}
                  onChange={(e) => setNewSerialNumber(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSerialNumber();
                    }
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Button 
                  variant="contained"
                  onClick={handleAddSerialNumber}
                  fullWidth
                >
                  Add
                </Button>
              </Grid>
            </Grid>
            
            {/* Serial numbers list */}
            <Box sx={{ mt: 3, mb: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                {serialNumbers.map((serialNo, index) => (
                  <Chip
                    key={index}
                    label={serialNo}
                    onDelete={() => handleRemoveSerialNumber(index)}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Stack>
              {serialNumbers.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {serialNumbers.length} serial numbers added
                </Typography>
              )}
            </Box>
            
            {/* Updated Bulk upload section */}
            {renderBulkUploadSection()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAllocationDialog}>Cancel</Button>
          <Button 
            onClick={handleAllocateFasTags} 
            variant="contained" 
            disabled={!selectedUser || serialNumbers.length === 0 || loading}
          >
            {loading ? "Allocating..." : "Allocate FasTags"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deletion Preview Dialog */}
      <Dialog 
        open={openDeletionDialog} 
        onClose={() => setOpenDeletionDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          Fastag Deletion Preview
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Warning:</strong> This action will permanently delete the selected Fastag records. 
              Please review the list below before proceeding.
            </Alert>
            
            <Typography variant="subtitle1" gutterBottom>
              Serial Numbers to Delete: {deletionPreview.length}
            </Typography>
            
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Serial Number</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>BC ID</strong></TableCell>
                    <TableCell><strong>User Name</strong></TableCell>
                    <TableCell><strong>Allocated At</strong></TableCell>
                    <TableCell><strong>Action</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deletionPreview.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.serialNumber}</TableCell>
                      <TableCell>
                        <Chip 
                          label={item.status === 'in_transaction' ? 'In Transaction' : item.status} 
                          color={item.exists ? 'error' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{item.bcId}</TableCell>
                      <TableCell>{item.userName}</TableCell>
                      <TableCell>
                        {item.allocatedAt ? 
                          (item.allocatedAt.toDate ? item.allocatedAt.toDate().toLocaleString() : 'N/A') : 
                          'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        {item.exists ? (
                          <Chip 
                            label="Will Delete" 
                            color="error" 
                            size="small"
                          />
                        ) : (
                          <Chip 
                            label={item.error ? 'Error' : 'Not Found'} 
                            color="default" 
                            size="small"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Summary:</strong> {deletionPreview.filter(item => item.exists).length} records will be deleted, 
                {deletionPreview.filter(item => !item.exists).length} serial numbers were not found.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeletionDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={executeDeletion} 
            variant="contained" 
            color="error"
            disabled={deletionLoading || deletionPreview.filter(item => item.exists).length === 0}
            startIcon={<DeleteIcon />}
          >
            {deletionLoading ? "Deleting..." : `Delete ${deletionPreview.filter(item => item.exists).length} Records`}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Recently Allocated Fastags Section */}
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            Recently Allocated Fastags
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchRecentAllocations}
            disabled={loadingAllocations}
            size="small"
          >
            {loadingAllocations ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
        
        {loadingAllocations ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : recentAllocations.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No Fastags have been allocated yet. Start by allocating some Fastags using the options above.
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Serial Number</strong></TableCell>
                  <TableCell><strong>BC ID</strong></TableCell>
                  <TableCell><strong>User Name</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Allocated At</strong></TableCell>
                  <TableCell><strong>Allocated By</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentAllocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell>{allocation.serialNumber}</TableCell>
                    <TableCell>{allocation.bcId}</TableCell>
                    <TableCell>{allocation.userName}</TableCell>
                    <TableCell>
                      <Chip 
                        label={allocation.status} 
                        color={allocation.status === 'available' ? 'success' : allocation.status === 'used' ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {allocation.allocatedAt instanceof Date 
                        ? allocation.allocatedAt.toLocaleString()
                        : 'N/A'
                      }
                    </TableCell>
                    <TableCell>{allocation.allocatedBy || 'Admin'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};

export default FastagManagement; 