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
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  IconButton,
  Chip
} from '@mui/material';
import { 
  Save as SaveIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Key as KeyIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { verifyWalletAccessPassword, logWalletUpdate, logSuccessfulRegistration } from '../api/firestoreApi';

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
    serialNo: '',
    agentId: '70062', // Default to RSA
    apiSuccess: true,
    error: null,
    status: 'success',
    customTimestamp: '',
    useCustomTimestamp: false,
    // Transaction fields
    createTransaction: false,
    transactionAmount: '',
    transactionType: 'debit',
    transactionPurpose: 'FasTag Registration',
    previousBalance: '',
    newBalance: ''
  });

  // Validation state
  const [errors, setErrors] = useState({});

  // Wallet access state
  const [walletAccessDialogOpen, setWalletAccessDialogOpen] = useState(false);
  const [walletAccessPassword, setWalletAccessPassword] = useState('');
  const [walletAccessGranted, setWalletAccessGranted] = useState(false);

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
          minFasTagBalance: userData.minFasTagBalance || '400',
          minRSABalance: userData.minRSABalance || '400',
          wallet: userData.wallet || 0
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

    // Transaction validation
    if (formData.createTransaction) {
      if (!formData.transactionAmount || formData.transactionAmount <= 0) {
        newErrors.transactionAmount = 'Transaction amount is required and must be greater than 0';
      }
      if (!formData.previousBalance || formData.previousBalance < 0) {
        newErrors.previousBalance = 'Previous balance is required and cannot be negative';
      }
      if (!formData.newBalance || formData.newBalance < 0) {
        newErrors.newBalance = 'New balance is required and cannot be negative';
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

    // Auto-calculate new balance for transactions
    if (field === 'transactionAmount' || field === 'previousBalance') {
      const amount = field === 'transactionAmount' ? parseFloat(value) || 0 : parseFloat(formData.transactionAmount) || 0;
      const prevBalance = field === 'previousBalance' ? parseFloat(value) || 0 : parseFloat(formData.previousBalance) || 0;
      const transactionType = formData.transactionType;
      
      if (amount > 0 && prevBalance >= 0) {
        let newBalance;
        if (transactionType === 'debit') {
          newBalance = prevBalance - amount;
        } else if (transactionType === 'credit' || transactionType === 'recharge') {
          newBalance = prevBalance + amount;
        } else {
          newBalance = prevBalance;
        }
        
        setFormData(prev => ({
          ...prev,
          newBalance: newBalance.toFixed(2)
        }));
      }
    }

    // Auto-calculate new balance when transaction type changes
    if (field === 'transactionType') {
      const amount = parseFloat(formData.transactionAmount) || 0;
      const prevBalance = parseFloat(formData.previousBalance) || 0;
      
      if (amount > 0 && prevBalance >= 0) {
        let newBalance;
        if (value === 'debit') {
          newBalance = prevBalance - amount;
        } else if (value === 'credit' || value === 'recharge') {
          newBalance = prevBalance + amount;
        } else {
          newBalance = prevBalance;
        }
        
        setFormData(prev => ({
          ...prev,
          newBalance: newBalance.toFixed(2)
        }));
      }
    }

    // Auto-populate transaction amount based on agent type
    if (field === 'agentId' && selectedUser) {
      let minBalance;
      if (value === '70062') { // RSA
        minBalance = selectedUser.minRSABalance || '400';
      } else if (value === '70043') { // Non-RSA
        minBalance = selectedUser.minFasTagBalance || '400';
      } else {
        minBalance = '400'; // Default for Manual Entry
      }
      
      setFormData(prev => {
        const updatedFormData = {
          ...prev,
          transactionAmount: minBalance
        };

        // Recalculate new balance if previous balance is set
        const amount = parseFloat(minBalance) || 0;
        const prevBalance = parseFloat(prev.previousBalance) || 0;
        const transactionType = prev.transactionType;
        
        if (amount > 0 && prevBalance >= 0) {
          let newBalance;
          if (transactionType === 'debit') {
            newBalance = prevBalance - amount;
          } else if (transactionType === 'credit' || transactionType === 'recharge') {
            newBalance = prevBalance + amount;
          } else {
            newBalance = prevBalance;
          }
          
          updatedFormData.newBalance = newBalance.toFixed(2);
        }

        return updatedFormData;
      });
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

    // Auto-populate previous balance from user's wallet
    if (newValue && newValue.wallet !== undefined) {
      setFormData(prev => {
        const updatedFormData = {
          ...prev,
          previousBalance: newValue.wallet.toString()
        };

        // Auto-populate transaction amount based on agent type
        let minBalance;
        if (prev.agentId === '70062') { // RSA
          minBalance = newValue.minRSABalance || '400';
        } else if (prev.agentId === '70043') { // Non-RSA
          minBalance = newValue.minFasTagBalance || '400';
        } else {
          minBalance = '400'; // Default for Manual Entry
        }
        
        updatedFormData.transactionAmount = minBalance;

        // Recalculate new balance
        const amount = parseFloat(minBalance) || 0;
        const prevBalance = parseFloat(newValue.wallet) || 0;
        const transactionType = prev.transactionType;
        
        if (amount > 0 && prevBalance >= 0) {
          let newBalance;
          if (transactionType === 'debit') {
            newBalance = prevBalance - amount;
          } else if (transactionType === 'credit' || transactionType === 'recharge') {
            newBalance = prevBalance + amount;
          } else {
            newBalance = prevBalance;
          }
          
          updatedFormData.newBalance = newBalance.toFixed(2);
        }

        return updatedFormData;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showSnackbar('Please fix the errors before submitting', 'error');
      return;
    }

    // Check wallet access if creating transaction
    if (formData.createTransaction && !walletAccessGranted) {
      showSnackbar('Wallet access required to create transactions. Please unlock wallet access first.', 'warning');
      handleWalletAccessRequest();
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

      // If this is a successful registration, also log it to successfulRegistrations collection
      if (formData.status === 'success') {
        try {
          const userData = {
            bcId: selectedUser.bcId || 'N/A',
            displayName: selectedUser.displayName || 'Unknown',
            minFasTagBalance: selectedUser.minFasTagBalance || '400'
          };

          const formDataForSuccessfulLog = {
            vehicleNo: formData.vehicleNo.trim(),
            serialNo: formData.serialNo.trim(),
            mobileNo: 'N/A', // Manual logs don't have mobile number
            agentId: formData.agentId,
            apiSuccess: formData.apiSuccess,
            error: formData.error,
            finalRegistrationData: {
              vrnDetails: {
                vrn: formData.vehicleNo.trim()
              },
              fasTagDetails: {
                serialNo: formData.serialNo.trim()
              },
              regDetails: {
                agentId: formData.agentId
              }
            }
          };

          const successfulLogResult = await logSuccessfulRegistration(
            formDataForSuccessfulLog,
            selectedUser.id,
            selectedUser.email,
            userData
          );

          if (successfulLogResult.success) {
            console.log('✅ Successfully logged to successfulRegistrations collection:', successfulLogResult.registrationId);
          } else {
            console.error('❌ Failed to log to successfulRegistrations collection:', successfulLogResult.error);
          }
        } catch (error) {
          console.error('❌ Error logging to successfulRegistrations collection:', error);
          // Don't fail the entire operation if this fails
        }
      }

      // Create transaction log if requested
      if (formData.createTransaction) {
        const transactionData = {
          transactionId: `MANUAL_${docRef.id}`,
          amount: parseFloat(formData.transactionAmount),
          type: formData.transactionType,
          status: formData.status === 'success' ? 'completed' : 'pending',
          purpose: formData.transactionPurpose,
          details: {
            name: selectedUser.displayName,
            vehicleNo: formData.vehicleNo.trim(),
            serialNo: formData.serialNo.trim(),
            previousBalance: parseFloat(formData.previousBalance),
            newBalance: parseFloat(formData.newBalance)
          },
          userId: selectedUser.id,
          paymentGateway: 'Manual Entry',
          method: 'Manual Entry',
          currency: 'INR',
          timestamp: logTimestamp,
          createdAt: logTimestamp,
          // Mark as manually created
          isManualEntry: true,
          createdBy: 'admin',
          // Link to the form log
          formLogId: docRef.id
        };

        const transactionRef = await addDoc(collection(db, 'transactions'), transactionData);
        console.log('Transaction log created with ID:', transactionRef.id);

        // Update user's wallet with the new balance
        try {
          const userRef = doc(db, 'users', selectedUser.id);
          const oldBalance = selectedUser.wallet || 0;
          const newBalance = parseFloat(formData.newBalance);
          
          // Update the wallet in Firestore
          await updateDoc(userRef, {
            wallet: newBalance
          });
          
          // Log the wallet update with the actual password used
          await logWalletUpdate(
            selectedUser.id,
            oldBalance,
            newBalance,
            null, // No password ID needed for manual entries
            walletAccessPassword // Store the actual password entered
          );
          
          console.log('User wallet updated to:', formData.newBalance);
        } catch (walletError) {
          console.error('Error updating user wallet:', walletError);
          // Don't fail the entire operation if wallet update fails
          showSnackbar('Transaction created but failed to update user wallet', 'warning');
        }
      }
      
      // Reset form
      setFormData({
        vehicleNo: '',
        serialNo: '',
        agentId: '70062', // Default to RSA
        apiSuccess: true,
        error: null,
        status: 'success',
        customTimestamp: '',
        useCustomTimestamp: false,
        // Transaction fields
        createTransaction: false,
        transactionAmount: '',
        transactionType: 'debit',
        transactionPurpose: 'FasTag Registration',
        previousBalance: '',
        newBalance: ''
      });
      setSelectedUser(null);
      setErrors({});
      
      const successMessage = formData.createTransaction 
        ? 'Manual log and transaction created successfully! User wallet updated. They will appear in Form Registration Logs, Successful Registrations, and Transactions.'
        : formData.status === 'success' 
          ? 'Manual log created successfully! It will appear in Form Registration Logs and Successful Registrations.'
          : 'Manual log created successfully! It will appear in Form Registration Logs.';
      showSnackbar(successMessage, 'success');
      
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
      serialNo: '',
      agentId: '70062', // Default to RSA
      apiSuccess: true,
      error: null,
      status: 'success',
      customTimestamp: '',
      useCustomTimestamp: false,
      // Transaction fields
      createTransaction: false,
      transactionAmount: '',
      transactionType: 'debit',
      transactionPurpose: 'FasTag Registration',
      previousBalance: '',
      newBalance: ''
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

  // Wallet access functions
  const handleWalletAccessRequest = () => {
    setWalletAccessDialogOpen(true);
  };
  
  const handleVerifyWalletAccess = async () => {
    try {
      setLoading(true);
      
      // Verify wallet access password
      const { success, error } = await verifyWalletAccessPassword(walletAccessPassword);
      
      if (success) {
        setWalletAccessGranted(true);
        setWalletAccessDialogOpen(false);
        setWalletAccessPassword('');
        showSnackbar('Wallet access granted successfully', 'success');
      } else {
        showSnackbar(error || 'Invalid wallet access password', 'error');
      }
    } catch (err) {
      console.error('Error verifying wallet access:', err);
      showSnackbar('Failed to verify wallet access', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCloseWalletAccessDialog = () => {
    setWalletAccessDialogOpen(false);
    setWalletAccessPassword('');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Add Manual Registration Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create manual entries that will appear in Form Registration Logs and optionally in Transactions
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<KeyIcon />}
            onClick={handleWalletAccessRequest}
            disabled={loading}
            color={walletAccessGranted ? 'success' : 'warning'}
          >
            {walletAccessGranted ? 'Wallet Access Granted' : 'Unlock Wallet Access'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchUsers}
            disabled={loading}
          >
            Refresh Users
          </Button>
        </Box>
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
                          {option.email} | BC ID: {option.bcId || 'N/A'} | Wallet: ₹{option.wallet || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          RSA: ₹{option.minRSABalance || 400} | Non-RSA: ₹{option.minFasTagBalance || 400}
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

              {/* Transaction Section */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircleIcon sx={{ mr: 1, color: 'primary.main' }} />
                    Transaction Details (Optional)
                  </Typography>
                  {!walletAccessGranted && (
                    <Tooltip title="Wallet access required to create transactions">
                      <Chip
                        label="Wallet Access Required"
                        color="warning"
                        size="small"
                        icon={<KeyIcon />}
                      />
                    </Tooltip>
                  )}
                </Box>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Create Transaction Log</InputLabel>
                  <Select
                    value={formData.createTransaction}
                    onChange={(e) => handleInputChange('createTransaction', e.target.value)}
                    label="Create Transaction Log"
                    disabled={!walletAccessGranted}
                  >
                    <MenuItem value={false}>No Transaction</MenuItem>
                    <MenuItem value={true} disabled={!walletAccessGranted}>
                      Create Transaction Entry {!walletAccessGranted && '(Wallet Access Required)'}
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {formData.createTransaction && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Transaction Amount (₹) *"
                      type="number"
                      value={formData.transactionAmount}
                      onChange={(e) => handleInputChange('transactionAmount', e.target.value)}
                      error={!!errors.transactionAmount}
                      helperText={
                        errors.transactionAmount || 
                        (selectedUser && formData.agentId && 
                          ((formData.agentId === '70062' && formData.transactionAmount === selectedUser.minRSABalance?.toString()) ||
                           (formData.agentId === '70043' && formData.transactionAmount === selectedUser.minFasTagBalance?.toString()))
                          ? '✅ Auto-populated from user minimum balance' 
                          : 'Auto-populated based on agent type and user minimum balance')
                      }
                      placeholder="e.g., 100"
                      inputProps={{ min: 0, step: 0.01 }}
                      InputProps={{
                        startAdornment: selectedUser && formData.agentId && 
                          ((formData.agentId === '70062' && formData.transactionAmount === selectedUser.minRSABalance?.toString()) ||
                           (formData.agentId === '70043' && formData.transactionAmount === selectedUser.minFasTagBalance?.toString())) ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <Typography variant="caption" color="success.main" sx={{ fontSize: '0.7rem' }}>
                              🔄
                            </Typography>
                          </Box>
                        ) : null
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Transaction Type</InputLabel>
                      <Select
                        value={formData.transactionType}
                        onChange={(e) => handleInputChange('transactionType', e.target.value)}
                        label="Transaction Type"
                      >
                        <MenuItem value="debit">Debit</MenuItem>
                        <MenuItem value="credit">Credit</MenuItem>
                        <MenuItem value="recharge">Recharge</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Transaction Purpose"
                      value={formData.transactionPurpose}
                      onChange={(e) => handleInputChange('transactionPurpose', e.target.value)}
                      placeholder="e.g., FasTag Registration"
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Previous Balance (₹) *"
                      type="number"
                      value={formData.previousBalance}
                      onChange={(e) => handleInputChange('previousBalance', e.target.value)}
                      error={!!errors.previousBalance}
                      helperText={
                        errors.previousBalance || 
                        (selectedUser && formData.previousBalance === selectedUser.wallet?.toString() 
                          ? '✅ Auto-populated from user wallet' 
                          : 'Auto-populated from user wallet, can be manually adjusted')
                      }
                      placeholder="e.g., 500"
                      inputProps={{ min: 0, step: 0.01 }}
                      InputProps={{
                        startAdornment: selectedUser && formData.previousBalance === selectedUser.wallet?.toString() ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <Typography variant="caption" color="success.main" sx={{ fontSize: '0.7rem' }}>
                              🔄
                            </Typography>
                          </Box>
                        ) : null
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="New Balance (₹) *"
                      type="number"
                      value={formData.newBalance}
                      onChange={(e) => handleInputChange('newBalance', e.target.value)}
                      error={!!errors.newBalance}
                      helperText={errors.newBalance || 'Auto-calculated based on transaction type, amount, and previous balance'}
                      placeholder="e.g., 400"
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
                      💡 Tip: Transaction amount is auto-populated based on agent type (RSA uses minRSABalance, Non-RSA uses minFasTagBalance). 
                      New balance is automatically calculated based on transaction type, amount, and previous balance. 
                      The user's wallet will be updated with the new balance when the log is created.
                      You can manually adjust any values if needed.
                    </Typography>
                  </Grid>
                </>
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
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Purpose
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Creates manual entries in the formLogs collection with action="register". 
                These logs will be visible in the Form Registration Logs page.
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Transaction Logs
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Optionally create corresponding transaction entries in the transactions 
                collection that will appear in the Transactions page. Previous balance 
                is auto-populated from user's wallet, and transaction amount is auto-populated 
                based on agent type (RSA uses minRSABalance, Non-RSA uses minFasTagBalance).
                User's wallet is automatically updated with the new balance.
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Timestamp Options
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use current time or set a custom date and time for when the registration 
                actually occurred. Useful for backdating registrations.
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Compatibility
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created logs include all necessary fields to be compatible with the 
                existing Form Registration Logs and Transactions display formats.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Wallet Access Dialog */}
      <Dialog
        open={walletAccessDialogOpen}
        onClose={handleCloseWalletAccessDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Wallet Access Authorization</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Typography variant="body2">
              Please enter the wallet access password to create transactions and update user wallets:
            </Typography>
            
            <TextField
              label="Wallet Access Password"
              value={walletAccessPassword}
              onChange={(e) => setWalletAccessPassword(e.target.value)}
              fullWidth
              autoFocus
              type="password"
              placeholder="Enter wallet access password"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWalletAccessDialog}>Cancel</Button>
          <Button
            onClick={handleVerifyWalletAccess}
            variant="contained"
            color="primary"
            disabled={!walletAccessPassword || loading}
          >
            {loading ? 'Verifying...' : 'Unlock'}
          </Button>
        </DialogActions>
      </Dialog>

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
