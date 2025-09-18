import { useState, useEffect } from 'react';
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
import { collection, query, where, getDocs, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { format, parse, isValid } from 'date-fns';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { exportToExcel, formatDataForExport } from '../utils/excelExport';

function FormRegistrationLogsAgent70062() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // State for tracking which logs are being processed
  const [processingLogs, setProcessingLogs] = useState(new Set());
  
  // Filter state
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    vehicleNo: '',
    bcId: '',
    mobileNo: '',
    serialNo: ''
  });
  
  // Filter options for dropdown lists
  const [filterOptions, setFilterOptions] = useState({
    bcIds: [],
    vehicleNos: [],
    mobileNos: []
  });

  useEffect(() => {
    fetchRegistrationLogs();
  }, []);
  
  // Apply filters when logs or filters change
  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

  const fetchRegistrationLogs = async () => {
    try {
      setLoading(true);
      
      // Query formLogs where action is "register"
      const formLogsRef = collection(db, 'formLogs');
      const q = query(
        formLogsRef,
        where('action', '==', 'register'),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      console.log(`Found ${snapshot.size} form logs with action=register`);
      
      // Filter for logs where formData.error is "Registration request is pending"
      const pendingLogs = [];
      const userDataCache = {}; // Cache for user data to avoid duplicate fetches
      
      for (const docSnapshot of snapshot.docs) {
        const logData = docSnapshot.data();
        console.log(`Processing log ${docSnapshot.id}, timestamp:`, logData.timestamp);
        
        // Check if formData.error is "Registration request is pending"
        const isPending = logData.formData?.error === "Registration request is pending";
        
        if (isPending) {
          
          // Extract fields from correct paths in the document structure
          let vehicleNo = logData.formData?.vehicleNo || 
                         logData.formData?.finalRegistrationData?.vrnDetails?.vrn ||
                         logData.formData?.vrn ||
                         'N/A';
                         
          let serialNo = logData.formData?.serialNo || 
                         logData.formData?.finalRegistrationData?.fasTagDetails?.serialNo ||
                         'N/A';
                         
          let mobileNo = logData.formData?.mobileNo || 
                         logData.formData?.finalRegistrationData?.custDetails?.mobileNo ||
                         'N/A';
          
          // Ensure timestamp is properly extracted and processed
          let timestamp = logData.timestamp;
          if (timestamp && timestamp.toDate && typeof timestamp.toDate === 'function') {
            // If it's a Firebase Timestamp, convert to Date
            timestamp = timestamp.toDate();
          } else if (typeof timestamp === 'string') {
            // If it's a string, leave as is, will be parsed in the formatter
            timestamp = timestamp;
          } else if (!timestamp) {
            // Fallback to createdAt if timestamp is missing
            timestamp = logData.createdAt || new Date().toISOString();
          }
          
          const processedLog = {
            id: docSnapshot.id,
            vehicleNo: vehicleNo,
            timestamp: timestamp,
            serialNo: serialNo,
            mobileNo: mobileNo,
            userId: logData.userId || '',
            bcId: 'Loading...',
            displayName: 'Loading...',
            minFasTagBalance: 'Loading...',
            agentId: logData.formData?.finalRegistrationData?.regDetails?.agentId || 'N/A'
          };
          
          console.log("Created processed log with timestamp:", processedLog.timestamp);
          
          pendingLogs.push(processedLog);
          
          // Fetch user data for each log
          if (logData.userId && !userDataCache[logData.userId]) {
            try {
              const userRef = doc(db, 'users', logData.userId);
              const userDoc = await getDoc(userRef);
              
              if (userDoc.exists()) {
                const userData = userDoc.data();
                userDataCache[logData.userId] = {
                  bcId: userData.bcId || 'N/A',
                  displayName: userData.displayName || 'Unknown',
                  minFasTagBalance: userData.minFasTagBalance || '400' // Default is 400 if not specified
                };
              } else {
                userDataCache[logData.userId] = {
                  bcId: 'N/A',
                  displayName: 'User not found',
                  minFasTagBalance: 'N/A'
                };
              }
            } catch (error) {
              console.error(`Error fetching user data for ${logData.userId}:`, error);
              userDataCache[logData.userId] = {
                bcId: 'Error',
                displayName: 'Error loading user',
                minFasTagBalance: 'Error'
              };
            }
          }
        }
      }
      
      // Update logs with user data from cache
      const logsWithUserData = pendingLogs.map(log => {
        const userData = userDataCache[log.userId] || { 
          bcId: 'N/A', 
          displayName: 'Unknown',
          minFasTagBalance: 'N/A' 
        };
        
        return {
          ...log,
          bcId: userData.bcId,
          displayName: userData.displayName,
          minFasTagBalance: userData.minFasTagBalance
        };
      });
      
      // Deduplicate by VRN - keep only the latest entry for each vehicle number
      const vrnMap = new Map();
      
      logsWithUserData.forEach(log => {
        const vrn = log.vehicleNo;
        if (vrn && vrn !== 'N/A') {
          // If this VRN doesn't exist in map, or if this log is newer, add/update it
          if (!vrnMap.has(vrn)) {
            vrnMap.set(vrn, log);
          } else {
            const existingLog = vrnMap.get(vrn);
            // Compare timestamps to keep the latest one
            const currentTimestamp = new Date(log.timestamp);
            const existingTimestamp = new Date(existingLog.timestamp);
            
            if (currentTimestamp > existingTimestamp) {
              vrnMap.set(vrn, log);
            }
          }
        } else {
          // For logs without VRN, add them as-is (they won't be deduplicated)
          vrnMap.set(`no-vrn-${log.id}`, log);
        }
      });
      
      const finalLogs = Array.from(vrnMap.values());
      
      setLogs(finalLogs);
      console.log(`Found ${logsWithUserData.length} total pending logs, ${finalLogs.length} unique VRNs after deduplication`);
      
      // After setting logs, extract filter options from final logs (after deduplication)
      if (finalLogs.length > 0) {
        const bcIds = new Set();
        const vehicleNos = new Set();
        const mobileNos = new Set();
        
        finalLogs.forEach(log => {
          if (log.bcId) bcIds.add(log.bcId);
          if (log.vehicleNo) vehicleNos.add(log.vehicleNo);
          if (log.mobileNo) mobileNos.add(log.mobileNo);
        });
        
        setFilterOptions({
          bcIds: Array.from(bcIds).filter(Boolean),
          vehicleNos: Array.from(vehicleNos).filter(Boolean),
          mobileNos: Array.from(mobileNos).filter(Boolean)
        });
      }
      
    } catch (err) {
      console.error('Error fetching registration logs:', err);
      setError('Failed to fetch registration logs');
      showSnackbar('Failed to fetch registration logs', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Apply filters to the data
  const applyFilters = () => {
    if (logs.length === 0) {
      setFilteredLogs([]);
      return;
    }
    
    let filtered = [...logs];
    
    // Filter by date range
    if (filters.startDate) {
      const startDate = parse(filters.startDate, 'yyyy-MM-dd', new Date());
      if (isValid(startDate)) {
        startDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(log => {
          let logDate;
          if (typeof log.timestamp === 'string') {
            logDate = new Date(log.timestamp);
          } else if (log.timestamp instanceof Date) {
            logDate = log.timestamp;
          } else if (log.timestamp && log.timestamp.toDate) {
            logDate = log.timestamp.toDate();
          } else {
            return true; // Keep logs with invalid dates
          }
          return logDate >= startDate;
        });
      }
    }
    
    if (filters.endDate) {
      const endDate = parse(filters.endDate, 'yyyy-MM-dd', new Date());
      if (isValid(endDate)) {
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(log => {
          let logDate;
          if (typeof log.timestamp === 'string') {
            logDate = new Date(log.timestamp);
          } else if (log.timestamp instanceof Date) {
            logDate = log.timestamp;
          } else if (log.timestamp && log.timestamp.toDate) {
            logDate = log.timestamp.toDate();
          } else {
            return true; // Keep logs with invalid dates
          }
          return logDate <= endDate;
        });
      }
    }
    
    // Filter by vehicleNo
    if (filters.vehicleNo) {
      filtered = filtered.filter(log => 
        log.vehicleNo && log.vehicleNo.toLowerCase().includes(filters.vehicleNo.toLowerCase())
      );
    }
    
    // Filter by BC ID
    if (filters.bcId) {
      filtered = filtered.filter(log => 
        log.bcId && log.bcId.toLowerCase() === filters.bcId.toLowerCase()
      );
    }
    
    // Filter by mobile number
    if (filters.mobileNo) {
      filtered = filtered.filter(log => 
        log.mobileNo && log.mobileNo.includes(filters.mobileNo)
      );
    }
    
    // Filter by serial number
    if (filters.serialNo) {
      filtered = filtered.filter(log => 
        log.serialNo && log.serialNo.toLowerCase().includes(filters.serialNo.toLowerCase())
      );
    }
    
    setFilteredLogs(filtered);
  };
  
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
      serialNo: ''
    });
  };

  // Show snackbar with provided message and severity
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // Handle snackbar close
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle marking registration as successful
  const handleMarkAsSuccessful = async (logId) => {
    try {
      // Add to processing set
      setProcessingLogs(prev => new Set([...prev, logId]));
      
      // Update the document in Firestore
      const logRef = doc(db, 'formLogs', logId);
      await updateDoc(logRef, {
        'formData.apiSuccess': true,
        'formData.error': null, // Clear the error message
        'status': 'success', // Update status to success
        'updatedAt': new Date().toISOString()
      });
      
      // Remove from logs list (since it's no longer pending)
      setLogs(prev => prev.filter(log => log.id !== logId));
      setFilteredLogs(prev => prev.filter(log => log.id !== logId));
      
      showSnackbar('Registration marked as successful!', 'success');
      
    } catch (error) {
      console.error('Error updating registration status:', error);
      showSnackbar('Failed to update registration status', 'error');
    } finally {
      // Remove from processing set
      setProcessingLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(logId);
        return newSet;
      });
    }
  };

  // Format timestamp to readable date and time
  const formatTimestamp = (timestamp) => {
    console.log("Formatting timestamp:", timestamp, typeof timestamp);
    
    if (!timestamp) return 'N/A';
    
    try {
      // Check if timestamp is a string
      if (typeof timestamp === 'string') {
        console.log("Timestamp is string, parsing:", timestamp);
        const date = new Date(timestamp);
        console.log("Parsed date:", date);
        return format(date, 'dd/MM/yyyy HH:mm:ss');
      }
      
      // Check if timestamp is a Firebase timestamp
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        console.log("Timestamp is Firebase timestamp");
        return format(timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss');
      }
      
      // If it's a Date object
      if (timestamp instanceof Date) {
        console.log("Timestamp is Date object");
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
      timestamp: 'Date & Time',
      serialNo: 'Serial Number',
      mobileNo: 'Mobile Number',
      bcId: 'BC ID',
      displayName: 'User Name',
      minFasTagBalance: 'Min FasTag Balance',
      agentId: 'Agent ID'
    };
    
    // Fields to omit from export
    const omitFields = ['id', 'userId'];
    
    // Process the logs to ensure timestamps are well-formatted
    const processedLogs = filteredLogs.map(log => {
      return {
        ...log,
        timestamp: formatTimestamp(log.timestamp),
      };
    });
    
    // Format and export data
    const formattedData = formatDataForExport(processedLogs, columnMapping, omitFields);
    exportToExcel(formattedData, 'Pending_FasTag_Registration_Requests', 'Pending_Registrations');
    
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
      headerName: 'Date & Time',
      width: 180,
      renderCell: (params) => (
        <span>{formatTimestamp(params.value)}</span>
      )
    },
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
      field: 'agentId',
      headerName: 'Agent ID',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color="secondary" variant="outlined" size="small" />
      )
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
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const isProcessing = processingLogs.has(params.row.id);
        return (
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<CheckCircleIcon />}
            onClick={() => handleMarkAsSuccessful(params.row.id)}
            disabled={isProcessing}
            sx={{ 
              minWidth: 'auto',
              fontSize: '0.75rem',
              py: 0.5,
              px: 1
            }}
          >
            {isProcessing ? 'Processing...' : 'Mark Success'}
          </Button>
        );
      }
    }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Pending FasTag Registration Requests
        </Typography>
        
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<DownloadIcon />} 
          onClick={handleExportToExcel}
          disabled={loading || filteredLogs.length === 0}
        >
          Export to Excel
        </Button>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Showing FasTag registration requests that are currently pending
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
          <Grid item xs={12} md={3}>
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
          
          <Grid item xs={12} md={3}>
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
          
          <Grid item xs={12} md={3}>
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
          
          <Grid item xs={12} md={3}>
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
          
          <Grid item xs={12} md={3}>
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
          
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Serial Number"
              name="serialNo"
              value={filters.serialNo}
              onChange={handleFilterChange}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography color="textSecondary">
                {filteredLogs.length} {filteredLogs.length === 1 ? 'record' : 'records'} found
                {filteredLogs.length !== logs.length && ` (filtered from ${logs.length})`}
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
            rows={filteredLogs}
            columns={columns}
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            disableSelectionOnClick
            getRowId={(row) => row.id}
            loading={loading}
            error={error}
            key={filteredLogs.length} 
            components={{
              NoRowsOverlay: () => (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography>No pending registration requests found</Typography>
                </Box>
              )
            }}
          />
        )}
      </Paper>
      
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

export default FormRegistrationLogsAgent70062;
    