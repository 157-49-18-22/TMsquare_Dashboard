import { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import { 
  Save as SaveIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

function NewLogs() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Form state
  const [formData, setFormData] = useState({
    vehicleNo: '',
    mobileNo: '',
    serialNo: '',
    agentId: '70062', // Default to RSA
    apiSuccess: true,
    error: null,
    status: 'success',
    customTimestamp: '',
    useCustomTimestamp: false
  });

  // Validation state
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('displayName', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const usersList = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        usersList.push({
          id: doc.id,
          displayName: userData.displayName || userData.email || 'Unknown User',
          email: userData.email,
          bcId: userData.bcId || '',
          minFasTagBalance: userData.minFasTagBalance || '400'
        });
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
      showSnackbar('Failed to fetch users', 'error');
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.vehicleNo.trim()) {
      newErrors.vehicleNo = 'Vehicle number is required';
    }

    if (!formData.mobileNo.trim()) {
      newErrors.mobileNo = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(formData.mobileNo.replace(/\D/g, ''))) {
      newErrors.mobileNo = 'Please enter a valid 10-digit mobile number';
    }

    if (!formData.serialNo.trim()) {
      newErrors.serialNo = 'Serial number is required';
    }

    if (!selectedUser) {
      newErrors.user = 'Please select a user';
    }

    if (formData.useCustomTimestamp && !formData.customTimestamp) {
      newErrors.customTimestamp = 'Please select a date and time';
    }

    if (formData.useCustomTimestamp && formData.customTimestamp) {
      const selectedDate = new Date(formData.customTimestamp);
      const now = new Date();
      if (selectedDate > now) {
        newErrors.customTimestamp = 'Date cannot be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }

    // Set default timestamp when custom timestamp is enabled
    if (field === 'useCustomTimestamp' && value === true && !formData.customTimestamp) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setFormData(prev => ({
        ...prev,
        customTimestamp: localDateTime
      }));
    }
  };

  const handleUserChange = (event, newValue) => {
    setSelectedUser(newValue);
    
    // Clear user error when user is selected
    if (errors.user) {
      setErrors(prev => ({
        ...prev,
        user: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showSnackbar('Please fix the errors before submitting', 'error');
      return;
    }

    try {
      setLoading(true);

      // Prepare timestamp - use custom if provided, otherwise use server timestamp
      let logTimestamp;
      if (formData.useCustomTimestamp && formData.customTimestamp) {
        // Convert custom timestamp to Firestore Timestamp for proper sorting
        const customDate = new Date(formData.customTimestamp);
        logTimestamp = Timestamp.fromDate(customDate);
        console.log('Custom timestamp conversion:', {
          input: formData.customTimestamp,
          date: customDate,
          timestamp: logTimestamp,
          timestampSeconds: logTimestamp.seconds,
          timestampNanoseconds: logTimestamp.nanoseconds
        });
      } else {
        logTimestamp = serverTimestamp();
        console.log('Using server timestamp');
      }

      // Prepare the log data structure that matches FormRegistrationLogs expectations
      const logData = {
        action: 'register',
        userId: selectedUser.id,
        timestamp: logTimestamp,
        createdAt: logTimestamp,
        status: formData.status,
        formData: {
          vehicleNo: formData.vehicleNo.trim(),
          mobileNo: formData.mobileNo.trim(),
          serialNo: formData.serialNo.trim(),
          agentId: formData.agentId,
          apiSuccess: formData.apiSuccess,
          error: formData.error,
          // Add structure that matches successful registration format
          finalRegistrationData: {
            vrnDetails: {
              vrn: formData.vehicleNo.trim()
            },
            fasTagDetails: {
              serialNo: formData.serialNo.trim()
            },
            custDetails: {
              mobileNo: formData.mobileNo.trim()
            },
            regDetails: {
              agentId: formData.agentId
            }
          }
        },
        // Add user information for easy reference
        user: {
          uid: selectedUser.id,
          displayName: selectedUser.displayName,
          email: selectedUser.email
        },
        // Mark as manually created
        isManualEntry: true,
        createdBy: 'admin' // You can get this from auth context if needed
      };

      // Add the log to formLogs collection
      const docRef = await addDoc(collection(db, 'formLogs'), logData);
      
      console.log('Manual log created with ID:', docRef.id);
      console.log('Timestamp used:', formData.useCustomTimestamp ? 
        `Custom: ${formData.customTimestamp} -> ${logTimestamp.toDate()}` : 
        'Server timestamp');
      console.log('Log data timestamp type:', typeof logTimestamp);
      console.log('Log data timestamp value:', logTimestamp);
      
      // Reset form
      setFormData({
        vehicleNo: '',
        mobileNo: '',
        serialNo: '',
        agentId: '70062', // Default to RSA
        apiSuccess: true,
        error: null,
        status: 'success',
        customTimestamp: '',
        useCustomTimestamp: false
      });
      setSelectedUser(null);
      setErrors({});
      
      showSnackbar('Manual log created successfully! It will appear in Form Registration Logs.', 'success');
      
    } catch (error) {
      console.error('Error creating manual log:', error);
      showSnackbar('Failed to create manual log', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      vehicleNo: '',
      mobileNo: '',
      serialNo: '',
      agentId: '70062', // Default to RSA
      apiSuccess: true,
      error: null,
      status: 'success',
      customTimestamp: '',
      useCustomTimestamp: false
    });
    setSelectedUser(null);
    setErrors({});
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Add Manual Registration Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create manual entries that will appear in Form Registration Logs
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchUsers}
          disabled={loading}
        >
          Refresh Users
        </Button>
      </Box>

      <Card sx={{ maxWidth: 1200, mx: 'auto' }}>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* User Selection */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircleIcon sx={{ mr: 1, color: 'primary.main' }} />
                  Manual Log
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={users}
                  getOptionLabel={(option) => `${option.displayName} (${option.email})`}
                  value={selectedUser}
                  onChange={handleUserChange}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select User *"
                      error={!!errors.user}
                      helperText={errors.user || 'Choose the user for this registration'}
                      fullWidth
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box>
                        <Typography variant="body1">{option.displayName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {option.email} | BC ID: {option.bcId || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Agent Type *</InputLabel>
                  <Select
                    value={formData.agentId}
                    onChange={(e) => handleInputChange('agentId', e.target.value)}
                    label="Agent Type *"
                  >
                    <MenuItem value="70062">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          backgroundColor: 'success.main' 
                        }} />
                        RSA (70062)
                      </Box>
                    </MenuItem>
                    <MenuItem value="70043">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          backgroundColor: 'info.main' 
                        }} />
                        Non-RSA (70043)
                      </Box>
                    </MenuItem>
                    <MenuItem value="MANUAL">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          backgroundColor: 'warning.main' 
                        }} />
                        Manual Entry
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Registration Details */}
              {/* <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mt: 3 }}>
                  <CheckCircleIcon sx={{ mr: 1, color: 'primary.main' }} />
                  Registration Details
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid> */}

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Vehicle Number *"
                  value={formData.vehicleNo}
                  onChange={(e) => handleInputChange('vehicleNo', e.target.value.toUpperCase())}
                  error={!!errors.vehicleNo}
                  helperText={errors.vehicleNo || 'Enter the vehicle registration number'}
                  placeholder="e.g., KA01AB1234"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Mobile Number *"
                  value={formData.mobileNo}
                  onChange={(e) => handleInputChange('mobileNo', e.target.value.replace(/\D/g, ''))}
                  error={!!errors.mobileNo}
                  helperText={errors.mobileNo || 'Enter 10-digit mobile number'}
                  placeholder="e.g., 9876543210"
                  inputProps={{ maxLength: 10 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Serial Number *"
                  value={formData.serialNo}
                  onChange={(e) => handleInputChange('serialNo', e.target.value)}
                  error={!!errors.serialNo}
                  helperText={errors.serialNo || 'Enter the FasTag serial number'}
                  placeholder="e.g., FT123456789"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Registration Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    label="Registration Status"
                  >
                    <MenuItem value="success">Success</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="failed">Failed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* API Success Toggle */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>API Success</InputLabel>
                  <Select
                    value={formData.apiSuccess}
                    onChange={(e) => handleInputChange('apiSuccess', e.target.value === 'true')}
                    label="API Success"
                  >
                    <MenuItem value={true}>True</MenuItem>
                    <MenuItem value={false}>False</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Error Message (if API Success is false) */}
              {!formData.apiSuccess && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Error Message"
                    value={formData.error || ''}
                    onChange={(e) => handleInputChange('error', e.target.value)}
                    placeholder="Enter error message if API failed"
                    multiline
                    rows={2}
                  />
                </Grid>
              )}

              {/* Timestamp Section
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mt: 3 }}>
                  <CheckCircleIcon sx={{ mr: 1, color: 'primary.main' }} />
                  Timestamp Settings
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid> */}

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Use Custom Timestamp</InputLabel>
                  <Select
                    value={formData.useCustomTimestamp}
                    onChange={(e) => handleInputChange('useCustomTimestamp', e.target.value)}
                    label="Use Custom Timestamp"
                  >
                    <MenuItem value={false}>Use Current Time</MenuItem>
                    <MenuItem value={true}>Set Custom Date & Time</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {formData.useCustomTimestamp && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Registration Date & Time *"
                    type="datetime-local"
                    value={formData.customTimestamp}
                    onChange={(e) => handleInputChange('customTimestamp', e.target.value)}
                    error={!!errors.customTimestamp}
                    helperText={errors.customTimestamp || 'Select when the registration actually occurred'}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
              )}

              {!formData.useCustomTimestamp && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Will Use Current Time"
                    value={`${new Date().toLocaleString()}`}
                    disabled
                    helperText="The log will be created with the current timestamp"
                  />
                </Grid>
              )}

              {formData.useCustomTimestamp && formData.customTimestamp && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Preview: Selected Time"
                    value={`${new Date(formData.customTimestamp).toLocaleString()}`}
                    disabled
                    helperText="This is the timestamp that will be used for the log"
                    sx={{
                      '& .MuiInputBase-input': {
                        color: 'success.main',
                        fontWeight: 'bold'
                      }
                    }}
                  />
                </Grid>
              )}
            </Grid>
          </form>
        </CardContent>

        <CardActions sx={{ p: 3, justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={loading}
            size="large"
          >
            Reset Form
          </Button>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSubmit}
            disabled={loading}
            size="large"
            sx={{ minWidth: 150 }}
          >
            {loading ? 'Creating...' : 'Create Log'}
          </Button>
        </CardActions>
      </Card>

      {/* Information Card */}
      <Card sx={{ mt: 3, maxWidth: 1200, mx: 'auto' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AddIcon sx={{ mr: 1, color: 'info.main' }} />
            Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Purpose
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Creates manual entries in the formLogs collection with action="register". 
                These logs will be visible in the Form Registration Logs page.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Timestamp Options
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use current time or set a custom date and time for when the registration 
                actually occurred. Useful for backdating registrations.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Compatibility
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created logs include all necessary fields to be compatible with the 
                existing Form Registration Logs display format.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

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

export default NewLogs;
