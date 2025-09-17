import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  TextField, 
  IconButton,
  Backdrop,
  CircularProgress,
  Alert,
  Snackbar,
  Checkbox,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import { collection, query, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { DataGrid } from '@mui/x-data-grid';
import * as XLSX from 'xlsx';

// Cache for reducing Firebase reads with localStorage persistence
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const CACHE_PREFIX = 'fastag_data_cache_';

// Initialize cache from localStorage
const initializeCache = () => {
  const cache = {
    allocatedTags: [],
    lastFetch: {
      allocatedTags: 0
    }
  };

  try {
    // Load allocated tags cache
    const tagsCache = localStorage.getItem(CACHE_PREFIX + 'allocatedTags');
    if (tagsCache) {
      cache.allocatedTags = JSON.parse(tagsCache);
      console.log('📦 [FastagData] Allocated tags cache loaded from localStorage');
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
    if (cacheKey === 'allocatedTags') {
      localStorage.setItem(CACHE_PREFIX + 'allocatedTags', JSON.stringify(fastagCache.allocatedTags));
    }
    localStorage.setItem(CACHE_PREFIX + 'lastFetch', JSON.stringify(fastagCache.lastFetch));
  } catch (error) {
    console.error('Error saving cache to localStorage:', error);
  }
};

// Helper function to clear cache
const clearCache = (cacheKey = null) => {
  if (cacheKey) {
    if (cacheKey === 'allocatedTags') {
      fastagCache.allocatedTags = [];
      localStorage.removeItem(CACHE_PREFIX + 'allocatedTags');
    }
    fastagCache.lastFetch[cacheKey] = 0;
  } else {
    fastagCache.allocatedTags = [];
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

// Component for FasTag Data Management (View/Manage FasTags)
const FastagData = () => {
  // State for allocated tags
  const [allocatedFasTags, setAllocatedFasTags] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef(null);
  
  // State for selection and editing
  const [selectedTags, setSelectedTags] = useState([]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Memoized filtered allocated tags to avoid recalculation
  const filteredAllocatedTags = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return allocatedFasTags;
    
    const searchLower = debouncedSearchQuery.toLowerCase();
    return allocatedFasTags.filter(tag => {
      return (
        tag.serialNumber?.toLowerCase().includes(searchLower) ||
        tag.bcId?.toLowerCase().includes(searchLower) ||
        tag.userName?.toLowerCase().includes(searchLower) ||
        tag.status?.toLowerCase().includes(searchLower)
      );
    });
  }, [allocatedFasTags, debouncedSearchQuery]);

  // Optimized fetch allocated tags function with caching
  const fetchAllocatedTags = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && fastagCache.allocatedTags.length > 0 && isCacheValid('allocatedTags')) {
        console.log('✅ [FastagData] Allocated tags fetched from CACHE');
        setAllocatedFasTags(fastagCache.allocatedTags);
        return;
      }

      console.log('🔄 [FastagData] Allocated tags not in cache, fetching from API...');
      setLoading(true);
      const fastagRef = collection(db, "allocatedFasTags");
      const fastagQuery = query(fastagRef, orderBy("allocatedAt", "desc"));
      const fastagSnapshot = await getDocs(fastagQuery);
      
      if (fastagSnapshot.empty) {
        setAllocatedFasTags([]);
        fastagCache.allocatedTags = [];
        fastagCache.lastFetch.allocatedTags = Date.now();
        setLoading(false);
        return;
      }
      
      const tags = fastagSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        allocatedAt: doc.data().allocatedAt?.toDate().toLocaleString() || 'Unknown'
      }));
      
      // Update cache
      fastagCache.allocatedTags = tags;
      fastagCache.lastFetch.allocatedTags = Date.now();
      
      // Save to localStorage
      saveCacheToStorage('allocatedTags');
      
      console.log('✅ [FastagData] Allocated tags fetched from API and cached');
      setAllocatedFasTags(tags);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching allocated FasTags:", error);
      setError("Failed to load allocated FasTags. Please try again.");
      setLoading(false);
    }
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    fetchAllocatedTags();
  }, [fetchAllocatedTags]);
  
  // Optimized delete an allocated FasTag
  const handleDeleteAllocation = useCallback(async (id) => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, "allocatedFasTags", id));
      
      // Show success message
      setSuccess("Successfully deleted the FasTag allocation.");
      
      // Refresh the allocated tags list with force refresh to clear cache
      fetchAllocatedTags(true);
    } catch (error) {
      console.error("Error deleting allocation:", error);
      setError("Failed to delete the allocation. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchAllocatedTags]);
  
  // Optimized handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedTags.length} FasTag(s)?`)) {
      return;
    }
    
    try {
      setLoading(true);
      const deletePromises = selectedTags.map(id => deleteDoc(doc(db, "allocatedFasTags", id)));
      await Promise.all(deletePromises);
      
      setSuccess(`Successfully deleted ${selectedTags.length} FasTag(s)`);
      setSelectedTags([]); // Clear selection
      // Refresh the allocated tags list with force refresh to clear cache
      fetchAllocatedTags(true);
    } catch (error) {
      console.error("Error deleting FasTags:", error);
      setError("Failed to delete FasTags. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedTags, fetchAllocatedTags]);

  // Handle tag selection
  const handleTagSelection = (ids) => {
    setSelectedTags(ids);
  };

  // Update columns to include selection and edit button
  const columns = [
    { 
      field: 'selection',
      headerName: '',
      width: 50,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderHeader: () => (
        <Checkbox
          checked={selectedTags.length === filteredAllocatedTags.length && filteredAllocatedTags.length > 0}
          indeterminate={selectedTags.length > 0 && selectedTags.length < filteredAllocatedTags.length}
          onChange={(e) => {
            if (e.target.checked) {
              handleTagSelection(filteredAllocatedTags.map(tag => tag.id));
            } else {
              handleTagSelection([]);
            }
          }}
        />
      ),
      renderCell: (params) => (
        <Checkbox
          checked={selectedTags.includes(params.row.id)}
          onChange={(e) => {
            e.stopPropagation();
            if (e.target.checked) {
              handleTagSelection([...selectedTags, params.row.id]);
            } else {
              handleTagSelection(selectedTags.filter(id => id !== params.row.id));
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )
    },
    { 
      field: 'serialNumber', 
      headerName: 'Serial Number', 
      flex: 1,
      sortable: false,
      filterable: false,
      disableColumnMenu: true
    },
    { 
      field: 'bcId', 
      headerName: 'BC ID', 
      flex: 1,
      sortable: false,
      filterable: false,
      disableColumnMenu: true
    },
    { 
      field: 'userName', 
      headerName: 'User Name', 
      flex: 1,
      sortable: false,
      filterable: false,
      disableColumnMenu: true
    },
    { 
      field: 'vehicleNo', 
      headerName: 'Vehicle Number', 
      flex: 1,
      sortable: false,
      filterable: false,
      disableColumnMenu: true
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      flex: 0.5,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          color={
            params.value === 'available' ? 'success' :
            params.value === 'used' ? 'primary' :
            params.value === 'revoked' ? 'error' : 'default'
          }
        />
      )
    },
    { 
      field: 'allocatedAt', 
      headerName: 'Allocation Date', 
      flex: 1,
      sortable: false,
      filterable: false,
      disableColumnMenu: true
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.5,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box>
          <IconButton 
            color="error" 
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteAllocation(params.row.id);
            }}
            size="small"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      )
    }
  ];
  
  // Export allocated FasTags to Excel
  const exportToExcel = () => {
    // Prepare data for export
    const exportData = filteredAllocatedTags.map(tag => ({
      'Serial Number': tag.serialNumber,
      'BC ID': tag.bcId,
      'User Name': tag.userName,
      'Status': tag.status,
      'Allocation Date': tag.allocatedAt
    }));
    
    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Allocated FasTags");
    
    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `allocated_fastags_${date}.xlsx`;
    
    // Save the file
    XLSX.writeFile(workbook, filename);
  };
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Page header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          FasTag Data Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => window.location.href = '/fastag-management'}
          >
            Allocate New FasTags
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
      
      {/* Add selected tags count and bulk actions */}
      {selectedTags.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography>
            {selectedTags.length} FasTag(s) selected
          </Typography>
          <Button 
            variant="outlined" 
            color="error"
            onClick={handleBulkDelete}
          >
            Delete Selected
          </Button>
        </Box>
      )}
      
      {/* Search bar and action buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField 
          label="Search by Serial No, BC ID or User" 
          variant="outlined" 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          sx={{ flex: 1, minWidth: 300 }}
        />
        <Button 
          variant="outlined" 
          startIcon={<DownloadIcon />} 
          onClick={exportToExcel}
        >
          Export
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            console.log('🔄 [FastagData] Manual cache clear triggered');
            clearCache();
            fetchAllocatedTags(true);
            setSuccess('Cache cleared and data refreshed');
          }}
          title="Clear cache and refresh data"
        >
          Refresh Data
        </Button>
      </Box>
      
      {/* Quick help section with cache status */}
      <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid #f0f0f0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            FasTag Data Management
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={`Tags: ${isCacheValid('allocatedTags') ? 'Cached' : 'Fresh'}`}
              size="small"
              color={isCacheValid('allocatedTags') ? 'success' : 'warning'}
            />
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          This page is for viewing and managing existing FasTag allocations. You can search, filter, export, and delete FasTag records.
        </Typography>
      </Box>
      
      {/* Data grid for allocated FasTags */}
      <Paper sx={{ width: '100%', mb: 3 }}>
        <DataGrid
          rows={filteredAllocatedTags}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          autoHeight
          disableSelectionOnClick
          loading={loading}
          disableColumnMenu
          disableColumnFilter
          disableColumnSelector
          disableDensitySelector
          disableExtendRowFullWidth
          disableColumnResize
          disableMultipleSelection={false}
          onRowClick={(params) => {
            params.event.stopPropagation();
          }}
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
                  No FasTags Allocated
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Click "Allocate New FasTags" to add new allocations
                </Typography>
              </Box>
            )
          }}
        />
      </Paper>
    </Box>
  );
};

export default FastagData; 