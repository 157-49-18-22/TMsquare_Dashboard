import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  CircularProgress,
  Snackbar,
  Alert,
  Chip,
  Button,
  Grid,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  MenuItem,
  Select
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format, parse, isValid, subDays } from 'date-fns';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { exportToExcel, formatDataForExport } from '../utils/excelExport';
import { transferSuccessfulRegistrationsFromFormLogs, getSuccessfulRegistrationsPaginated } from '../api/firestoreApi';

// Cache for reducing Firebase reads with localStorage persistence
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const CACHE_PREFIX = 'successful_registrations_cache_';

// Initialize cache from localStorage
const initializeRegistrationsCache = () => {
  const cache = {
    registrations: [],
    lastFetch: 0,
    paginationInfo: {
      hasMore: false,
      lastDocId: null,
      currentDateRange: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }
    }
  };

  try {
    // Load registrations cache
    const registrationsCache = localStorage.getItem(CACHE_PREFIX + 'registrations');
    if (registrationsCache) {
      cache.registrations = JSON.parse(registrationsCache);
      console.log('📦 [SuccessfulRegistrations] Registrations cache loaded from localStorage');
    }

    // Load last fetch timestamp
    const lastFetchCache = localStorage.getItem(CACHE_PREFIX + 'lastFetch');
    if (lastFetchCache) {
      cache.lastFetch = JSON.parse(lastFetchCache);
    }

    // Load pagination info
    const paginationCache = localStorage.getItem(CACHE_PREFIX + 'paginationInfo');
    if (paginationCache) {
      cache.paginationInfo = JSON.parse(paginationCache);
    }
  } catch (error) {
    console.error('Error loading registrations cache from localStorage:', error);
  }

  return cache;
};

const registrationsCache = initializeRegistrationsCache();

// Helper function to check if cache is valid
const isCacheValid = () => {
  return registrationsCache.lastFetch && (Date.now() - registrationsCache.lastFetch) < CACHE_EXPIRY;
};

// Helper function to save cache to localStorage
const saveRegistrationsCacheToStorage = () => {
  try {
    localStorage.setItem(CACHE_PREFIX + 'registrations', JSON.stringify(registrationsCache.registrations));
    localStorage.setItem(CACHE_PREFIX + 'lastFetch', JSON.stringify(registrationsCache.lastFetch));
    localStorage.setItem(CACHE_PREFIX + 'paginationInfo', JSON.stringify(registrationsCache.paginationInfo));
  } catch (error) {
    console.error('Error saving registrations cache to localStorage:', error);
  }
};

// Helper function to clear cache
const clearRegistrationsCache = () => {
  registrationsCache.registrations = [];
  registrationsCache.lastFetch = 0;
      registrationsCache.paginationInfo = {
      hasMore: false,
      lastDocId: null,
      currentDateRange: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }
    };
  // Clear localStorage cache
  localStorage.removeItem(CACHE_PREFIX + 'registrations');
  localStorage.removeItem(CACHE_PREFIX + 'lastFetch');
  localStorage.removeItem(CACHE_PREFIX + 'paginationInfo');
  console.log('🗑️ [SuccessfulRegistrations] Cache cleared');
};

function SuccessfulRegistrations() {
  const [registrations, setRegistrations] = useState([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // Pagination state
  const [paginationInfo, setPaginationInfo] = useState({
    hasMore: false,
    lastDocId: null,
    currentDateRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    vehicleNo: '',
    bcId: '',
    mobileNo: '',
    serialNo: '',
    userEmail: ''
  });
  
  // Filter options for dropdown lists
  const [filterOptions, setFilterOptions] = useState({
    bcIds: [],
    vehicleNos: [],
    mobileNos: [],
    userEmails: []
  });

  // Optimized fetch registrations function with pagination
  const fetchSuccessfulRegistrations = useCallback(async (forceRefresh = false, loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      // Check cache first (only for initial load, not for load more)
      if (!forceRefresh && !loadMore && registrationsCache.registrations.length > 0 && isCacheValid()) {
        console.log('✅ [SuccessfulRegistrations] Registrations fetched from CACHE');
        setRegistrations(registrationsCache.registrations);
        setPaginationInfo(registrationsCache.paginationInfo);
        
        // Extract filter options from cached data
        extractFilterOptions(registrationsCache.registrations);
        return;
      }

      console.log('🔄 [SuccessfulRegistrations] Registrations not in cache, fetching from API...');
      
      // Calculate date range for pagination
      let startDate, endDate;
      
      if (loadMore && paginationInfo.lastDocId) {
        // Load more: use the same date range but with pagination cursor
        startDate = new Date(paginationInfo.currentDateRange.startDate);
        endDate = new Date(paginationInfo.currentDateRange.endDate);
      } else {
        // Initial load: get last 30 days
        endDate = new Date();
        startDate = subDays(endDate, 30);
      }
      
             const result = await getSuccessfulRegistrationsPaginated({
         startDate,
         endDate,
         limitCount: 10000,
         lastDocId: loadMore ? paginationInfo.lastDocId : null
       });
      
      if (result.success) {
        let newRegistrations;
        
        if (loadMore) {
          // Append to existing registrations
          newRegistrations = [...registrations, ...result.registrations];
          console.log(`📈 [SuccessfulRegistrations] Loaded ${result.registrations.length} more registrations`);
        } else {
          // Replace registrations
          newRegistrations = result.registrations;
          console.log(`✅ [SuccessfulRegistrations] ${result.registrations.length} registrations fetched from API`);
        }
        
        // Update cache
        registrationsCache.registrations = newRegistrations;
        registrationsCache.lastFetch = Date.now();
        registrationsCache.paginationInfo = {
          hasMore: result.hasMore,
          lastDocId: result.lastDocId,
          currentDateRange: result.dateRange
        };
        saveRegistrationsCacheToStorage();
        
        setRegistrations(newRegistrations);
        setPaginationInfo({
          hasMore: result.hasMore,
          lastDocId: result.lastDocId,
          currentDateRange: result.dateRange
        });
        
        // Extract filter options from fetched data (only for initial load)
        if (!loadMore) {
          extractFilterOptions(newRegistrations);
        }
        
        if (loadMore) {
          showSnackbar(`Loaded ${result.registrations.length} more registrations`, 'success');
        }
      } else {
        setError('Failed to fetch successful registrations');
        showSnackbar('Failed to fetch successful registrations', 'error');
      }
      
    } catch (err) {
      console.error('Error fetching successful registrations:', err);
      setError('Failed to fetch successful registrations');
      showSnackbar('Failed to fetch successful registrations', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [registrations, paginationInfo]);

  // Load more registrations
  const handleLoadMore = useCallback(async () => {
    if (paginationInfo.hasMore && !loadingMore) {
      await fetchSuccessfulRegistrations(false, true);
    }
  }, [paginationInfo.hasMore, loadingMore, fetchSuccessfulRegistrations]);

  // Helper function to extract filter options
  const extractFilterOptions = useCallback((registrationsList) => {
    if (registrationsList.length > 0) {
      const bcIds = new Set();
      const vehicleNos = new Set();
      const mobileNos = new Set();
      const userEmails = new Set();
      
      registrationsList.forEach(registration => {
        if (registration.bcId) bcIds.add(registration.bcId);
        if (registration.vehicleNo) vehicleNos.add(registration.vehicleNo);
        if (registration.mobileNo) mobileNos.add(registration.mobileNo);
        if (registration.userEmail) userEmails.add(registration.userEmail);
      });
      
      setFilterOptions({
        bcIds: Array.from(bcIds).filter(Boolean),
        vehicleNos: Array.from(vehicleNos).filter(Boolean),
        mobileNos: Array.from(mobileNos).filter(Boolean),
        userEmails: Array.from(userEmails).filter(Boolean)
      });
    }
  }, []);

  // Memoized filtered registrations to avoid recalculation
  const filteredRegistrationsMemo = useMemo(() => {
    if (registrations.length === 0) {
      return [];
    }
    
    let filtered = [...registrations];
    
    // Filter by date range
    if (filters.startDate) {
      const startDate = parse(filters.startDate, 'yyyy-MM-dd', new Date());
      if (isValid(startDate)) {
        startDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(registration => {
          let registrationDate;
          if (typeof registration.timestamp === 'string') {
            registrationDate = new Date(registration.timestamp);
          } else if (registration.timestamp instanceof Date) {
            registrationDate = registration.timestamp;
          } else if (registration.timestamp && registration.timestamp.toDate) {
            registrationDate = registration.timestamp.toDate();
          } else {
            return true; // Keep registrations with invalid dates
          }
          return registrationDate >= startDate;
        });
      }
    }
    
    if (filters.endDate) {
      const endDate = parse(filters.endDate, 'yyyy-MM-dd', new Date());
      if (isValid(endDate)) {
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(registration => {
          let registrationDate;
          if (typeof registration.timestamp === 'string') {
            registrationDate = new Date(registration.timestamp);
          } else if (registration.timestamp instanceof Date) {
            registrationDate = registration.timestamp;
          } else if (registration.timestamp && registration.timestamp.toDate) {
            registrationDate = registration.timestamp.toDate();
          } else {
            return true; // Keep registrations with invalid dates
          }
          return registrationDate <= endDate;
        });
      }
    }
    
    // Filter by vehicleNo
    if (filters.vehicleNo) {
      filtered = filtered.filter(registration => 
        registration.vehicleNo && registration.vehicleNo.toLowerCase().includes(filters.vehicleNo.toLowerCase())
      );
    }
    
    // Filter by BC ID
    if (filters.bcId) {
      filtered = filtered.filter(registration => 
        registration.bcId && registration.bcId.toLowerCase() === filters.bcId.toLowerCase()
      );
    }
    
    // Filter by mobile number
    if (filters.mobileNo) {
      filtered = filtered.filter(registration => 
        registration.mobileNo && registration.mobileNo.includes(filters.mobileNo)
      );
    }
    
    // Filter by serial number
    if (filters.serialNo) {
      filtered = filtered.filter(registration => 
        registration.serialNo && registration.serialNo.toLowerCase().includes(filters.serialNo.toLowerCase())
      );
    }
    
    // Filter by user email
    if (filters.userEmail) {
      filtered = filtered.filter(registration => 
        registration.userEmail && registration.userEmail.toLowerCase().includes(filters.userEmail.toLowerCase())
      );
    }
    
    return filtered;
  }, [registrations, filters]);

  // Update filtered registrations when memoized result changes
  useEffect(() => {
    setFilteredRegistrations(filteredRegistrationsMemo);
  }, [filteredRegistrationsMemo]);

  // Initialize data on component mount
  useEffect(() => {
    fetchSuccessfulRegistrations();
  }, [fetchSuccessfulRegistrations]);
  
  // Handle filter changes
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      vehicleNo: '',
      bcId: '',
      mobileNo: '',
      serialNo: '',
      userEmail: ''
    });
  };

  // Force refresh data
  const handleForceRefresh = () => {
    console.log('🔄 [SuccessfulRegistrations] Force refresh requested');
    clearRegistrationsCache();
    fetchSuccessfulRegistrations(true);
  };

  // Handle transfer from formLogs
  const handleTransferFromFormLogs = async () => {
    try {
      setLoading(true);
      showSnackbar('Starting transfer from formLogs...', 'info');
      
      console.log('🔄 [SuccessfulRegistrations] Starting transfer from formLogs...');
      const result = await transferSuccessfulRegistrationsFromFormLogs();
      
      if (result.success) {
        const message = `Transfer completed! ${result.transferredCount} transferred, ${result.skippedCount} skipped, ${result.errorCount} errors`;
        showSnackbar(message, result.errorCount > 0 ? 'warning' : 'success');
        
        // Clear cache and refresh data
        clearRegistrationsCache();
        await fetchSuccessfulRegistrations(true);
        
        console.log('✅ [SuccessfulRegistrations] Transfer completed successfully');
      } else {
        showSnackbar(`Transfer failed: ${result.error}`, 'error');
        console.error('❌ [SuccessfulRegistrations] Transfer failed:', result.error);
      }
    } catch (error) {
      console.error('❌ [SuccessfulRegistrations] Error during transfer:', error);
      showSnackbar(`Transfer error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Show snackbar with provided message and severity
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // Handle snackbar close
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Format timestamp to readable date and time
  const formatTimestamp = (timestamp) => {
    // console.log("Formatting timestamp:", timestamp, typeof timestamp);
    
    if (!timestamp) return 'N/A';
    
    try {
      // Check if timestamp is a string
      if (typeof timestamp === 'string') {
        // console.log("Timestamp is string, parsing:", timestamp);
        const date = new Date(timestamp);
        // console.log("Parsed date:", date);
        return format(date, 'dd/MM/yyyy HH:mm:ss');
      }
      
      // Check if timestamp is a Firebase timestamp
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        // console.log("Timestamp is Firebase timestamp");
        return format(timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss');
      }
      
      // If it's a Date object
      if (timestamp instanceof Date) {
        // console.log("Timestamp is Date object");
        return format(timestamp, 'dd/MM/yyyy HH:mm:ss');
      }
      
      console.log("Unhandled timestamp format");
      return 'Invalid date';
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Error';
    }
  };

  // Export data to Excel
  const handleExportToExcel = () => {
    // Define column mapping for better readability in Excel
    const columnMapping = {
      vehicleNo: 'Vehicle Number',
      timestamp: 'Registration Date & Time',
      // secondtimestamp: 'System Date & Time',
      serialNo: 'Serial Number',
      mobileNo: 'Mobile Number',
      userEmail: 'User Email',
      bcId: 'BC ID',
      displayName: 'User Name',
      minFasTagBalance: 'Min FasTag Balance'
    };
    
    // Fields to omit from export
    const omitFields = ['id', 'userId', 'secondtimestamp'];
    
    // Sort data by timestamp in descending order (newest first) before processing
    const sortedRegistrations = [...filteredRegistrations].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB.getTime() - dateA.getTime(); // Descending order
    });
    
    // Process the registrations to ensure timestamps are well-formatted
    const processedRegistrations = sortedRegistrations.map(registration => {
      return {
        ...registration,
        timestamp: formatTimestamp(registration.timestamp),
        secondtimestamp: formatTimestamp(registration.secondtimestamp),
      };
    });
    
    // Format and export data
    const formattedData = formatDataForExport(processedRegistrations, columnMapping, omitFields);
    exportToExcel(formattedData, 'Successful_Registrations', 'Registrations');
    
    showSnackbar('Export complete! File downloaded.', 'success');
  };

  // Define columns for DataGrid
  const columns = [
    {
      field: 'vehicleNo',
      headerName: 'Vehicle Number',
      width: 150,
      renderCell: (params) => (
        <Chip label={params.value} color="primary" variant="outlined" size="small" />
      )
    },
    {
      field: 'timestamp',
      headerName: 'Registration Date & Time',
      width: 200,
      sortable: true,
      renderCell: (params) => (
        <span>{formatTimestamp(params.value)}</span>
      ),
      sortComparator: (v1, v2) => {
        const date1 = new Date(v1);
        const date2 = new Date(v2);
        return date1.getTime() - date2.getTime();
      }
    },
    // {
    //   field: 'secondtimestamp',
    //   headerName: 'System Date & Time',
    //   width: 200,
    //   sortable: true,
    //   renderCell: (params) => (
    //     <span style={{ color: '#666', fontSize: '0.9em' }}>
    //       {formatTimestamp(params.value)}
    //     </span>
    //   ),
    //   sortComparator: (v1, v2) => {
    //     const date1 = new Date(v1);
    //     const date2 = new Date(v2);
    //     return date1.getTime() - date2.getTime();
    //   }
    // },
    {
      field: 'serialNo',
      headerName: 'Serial Number',
      width: 150
    },
    {
      field: 'mobileNo',
      headerName: 'Mobile Number',
      width: 150
    },
    {
      field: 'userEmail',
      headerName: 'User Email',
      width: 200
    },
    {
      field: 'bcId',
      headerName: 'BC ID',
      width: 120
    },
    {
      field: 'displayName',
      headerName: 'User Name',
      width: 180
    },
    {
      field: 'minFasTagBalance',
      headerName: 'Min FasTag Balance',
      width: 150,
      renderCell: (params) => (
        <Chip 
          label={`₹ ${params.value}`} 
          color="success" 
          variant="outlined" 
          size="small"
          sx={{ fontWeight: 'bold' }}
        />
      )
    }
  ];

  // Debug effect to show data structure
  useEffect(() => {
    if (registrations.length > 0) {
      console.log('Sample registration data:', registrations.slice(0, 2).map(r => ({
        id: r.id,
        timestamp: r.timestamp, // Should be originalFormData.timestamp
        secondtimestamp: r.secondtimestamp, // Should be original main timestamp
        vehicleNo: r.vehicleNo
      })));
    }
  }, [registrations]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Successful Registrations
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* <Button 
            variant="outlined" 
            color="warning" 
            startIcon={<CloudDownloadIcon />} 
            onClick={handleTransferFromFormLogs}
            disabled={loading}
            title="Transfer successful registrations from formLogs collection"
          >
            Transfer from FormLogs
          </Button> */}
          <Button 
            variant="outlined" 
            color="secondary" 
            startIcon={<RefreshIcon />} 
            onClick={handleForceRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<DownloadIcon />} 
            onClick={handleExportToExcel}
            disabled={loading || filteredRegistrations.length === 0}
          >
            Export to Excel
          </Button>
        </Box>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Showing successful FasTag registrations from the dedicated collection. 
        Initially loads last 30 days of data to reduce database read load.
        {paginationInfo.hasMore && (
          <span style={{ marginLeft: '8px', color: '#1976d2', fontWeight: 'bold' }}>
            • More data available - click "Load More" to fetch additional records
          </span>
        )}
        {registrationsCache.lastFetch > 0 && (
          <span style={{ marginLeft: '8px', color: '#666' }}>
            (Last updated: {format(new Date(registrationsCache.lastFetch), 'dd/MM/yyyy HH:mm:ss')})
          </span>
        )}
      </Typography>
      
      {/* Filter Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" display="flex" alignItems="center">
            <FilterListIcon sx={{ mr: 1 }} /> Filters
          </Typography>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<RestartAltIcon />}
            onClick={handleResetFilters}
          >
            Reset
          </Button>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={3} sx={{ width: '12%' }}>
            <TextField
              fullWidth
              label="Start Date"
              name="startDate"
              type="date"
              value={filters.startDate}
              onChange={handleFilterChange}
              InputLabelProps={{
                shrink: true,
              }}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={3} sx={{ width: '12%' }}>
            <TextField
              fullWidth
              label="End Date"
              name="endDate"
              type="date"
              value={filters.endDate}
              onChange={handleFilterChange}
              InputLabelProps={{
                shrink: true,
              }}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={3} sx={{ width: '15%' }}>
            <Autocomplete
              freeSolo
              options={filterOptions.vehicleNos}
              value={filters.vehicleNo}
              onChange={(event, newValue) => {
                setFilters(prev => ({
                  ...prev,
                  vehicleNo: newValue || ''
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Vehicle Number"
                  name="vehicleNo"
                  onChange={handleFilterChange}
                  size="small"
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={3} sx={{ width: '15%' }}>
            <Autocomplete
              freeSolo
              options={filterOptions.bcIds}
              value={filters.bcId}
              onChange={(event, newValue) => {
                setFilters(prev => ({
                  ...prev,
                  bcId: newValue || ''
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="BC ID"
                  name="bcId"
                  onChange={handleFilterChange}
                  size="small"
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={3} sx={{ width: '15%' }}>
            <Autocomplete
              freeSolo
              options={filterOptions.mobileNos}
              value={filters.mobileNo}
              onChange={(event, newValue) => {
                setFilters(prev => ({
                  ...prev,
                  mobileNo: newValue || ''
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Mobile Number"
                  name="mobileNo"
                  onChange={handleFilterChange}
                  size="small"
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={3} sx={{ width: '20%' }}>
            <TextField
              fullWidth
              label="Serial Number"
              name="serialNo"
              value={filters.serialNo}
              onChange={handleFilterChange}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={3} sx={{ width: '25%' }}>
            <Autocomplete
              freeSolo
              options={filterOptions.userEmails}
              value={filters.userEmail}
              onChange={(event, newValue) => {
                setFilters(prev => ({
                  ...prev,
                  userEmail: newValue || ''
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="User Email"
                  name="userEmail"
                  onChange={handleFilterChange}
                  size="small"
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={3} sx={{ width: '12%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography color="textSecondary">
                {filteredRegistrations.length} {filteredRegistrations.length === 1 ? 'record' : 'records'} found
                {filteredRegistrations.length !== registrations.length && ` (filtered from ${registrations.length})`}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      <Paper sx={{ height: 600, width: '100%' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={filteredRegistrations}
            columns={columns}
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            disableSelectionOnClick
            getRowId={(row) => row.id}
            loading={loading}
            error={error}
            key={filteredRegistrations.length}
            initialState={{
              sorting: {
                sortModel: [{ field: 'timestamp', sort: 'desc' }]
              }
            }}
            components={{
              NoRowsOverlay: () => (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography>No successful registrations found</Typography>
                </Box>
              )
            }}
          />
        )}
      </Paper>
      
      {/* Load More Button */}
      {paginationInfo.hasMore && !loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={loadingMore ? <CircularProgress size={20} /> : <ExpandMoreIcon />}
            onClick={handleLoadMore}
            disabled={loadingMore}
            sx={{ minWidth: 200 }}
          >
            {loadingMore ? 'Loading...' : 'Load More (Next 30 Days)'}
          </Button>
        </Box>
      )}
      
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

export default SuccessfulRegistrations; 