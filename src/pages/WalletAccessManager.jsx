import { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  IconButton, 
  Tooltip, 
  Dialog,
  DialogTitle, 
  DialogContent, 
  DialogActions,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  LockOutlined as LockIcon
} from '@mui/icons-material';
import { 
  createWalletAccessPassword,
  getWalletAccessPasswords,
  deactivateWalletAccessPassword
} from '../api/firestoreApi';
import { useAuth } from '../contexts/AuthContext';

function WalletAccessManager() {
  const [passwords, setPasswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [newPassword, setNewPassword] = useState('');
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [expiryType, setExpiryType] = useState('never');
  const [accessAuthorized, setAccessAuthorized] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordDialogOpen, setAdminPasswordDialogOpen] = useState(true);
  const [newName, setNewName] = useState('');
  
  const { userData, isSuperAdmin } = useAuth();
  
  useEffect(() => {
    if (!isSuperAdmin) {
      setError('Access denied: Only super admins can manage wallet access passwords');
      setLoading(false);
      return;
    }
    
    if (accessAuthorized) {
      fetchPasswords();
    }
  }, [isSuperAdmin, accessAuthorized]);
  
  const fetchPasswords = async () => {
    try {
      setLoading(true);
      const { success, passwords, error } = await getWalletAccessPasswords();
      
      if (success) {
        // Sort passwords by creation date (newest first)
        const sortedPasswords = passwords.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toDate() - a.createdAt.toDate();
        });
        
        // Add initial dummy passwords with Ravindra name if none exist
        if (sortedPasswords.length === 0) {
          await addInitialDummyPasswords();
          // Fetch again after adding initial passwords
          fetchPasswords();
          return;
        }
        
        setPasswords(sortedPasswords);
      } else {
        setError(error || 'Failed to fetch passwords');
        showSnackbar('Failed to fetch passwords', 'error');
      }
    } catch (err) {
      console.error('Error fetching passwords:', err);
      setError('Failed to fetch passwords');
      showSnackbar('Failed to fetch passwords', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Add initial dummy passwords with Ravindra name
  const addInitialDummyPasswords = async () => {
    try {
      // Create 5 dummy passwords with Ravindra's name
      const dummyPasswords = [
        { password: 'Ravindra1', name: 'Ravindra 1', expires: null },
        { password: 'Ravindra2', name: 'Ravindra 2', expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        { password: 'Ravindra3', name: 'Ravindra 3', expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        { password: 'Ravindra4', name: 'Ravindra 4', expires: null },
        { password: 'Ravindra5', name: 'Ravindra 5', expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      ];
      
      for (const dummy of dummyPasswords) {
        await createWalletAccessPassword(dummy.password, dummy.expires, dummy.name);
      }
      
      showSnackbar('Initial passwords created successfully', 'success');
    } catch (err) {
      console.error('Error creating initial passwords:', err);
    }
  };
  
  const verifyAdminPassword = () => {
    // Check if the password is correct (123456)
    if (adminPasswordInput === '123456') {
      setAccessAuthorized(true);
      setAdminPasswordDialogOpen(false);
      showSnackbar('Access granted', 'success');
    } else {
      showSnackbar('Incorrect password', 'error');
    }
  };
  
  const generateRandomPassword = () => {
    // Generate a random 8-character password with letters and numbers
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const length = 8;
    
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    setNewPassword(result);
  };
  
  const handleCreatePassword = async () => {
    if (!newPassword) {
      showSnackbar('Password cannot be empty', 'error');
      return;
    }
    
    if (!newName) {
      showSnackbar('Name cannot be empty', 'error');
      return;
    }
    
    try {
      setLoading(true);
      
      // Calculate expiration date if not 'never'
      let expiresAt = null;
      if (expiryType === 'custom' && customExpiryDate) {
        expiresAt = new Date(customExpiryDate);
      } else if (expiryType === '1day') {
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      } else if (expiryType === '1week') {
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      } else if (expiryType === '1month') {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
      
      const { success, error } = await createWalletAccessPassword(newPassword, expiresAt, newName);
      
      if (success) {
        await fetchPasswords();
        setCreateDialogOpen(false);
        setNewPassword('');
        setNewName('');
        setCustomExpiryDate('');
        setExpiryType('never');
        showSnackbar('Password created successfully', 'success');
      } else {
        showSnackbar(error || 'Failed to create password', 'error');
      }
    } catch (err) {
      console.error('Error creating password:', err);
      showSnackbar('Failed to create password', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeactivatePassword = async (passwordId) => {
    try {
      setLoading(true);
      const { success, error } = await deactivateWalletAccessPassword(passwordId);
      
      if (success) {
        await fetchPasswords();
        showSnackbar('Password deactivated successfully', 'success');
      } else {
        showSnackbar(error || 'Failed to deactivate password', 'error');
      }
    } catch (err) {
      console.error('Error deactivating password:', err);
      showSnackbar('Failed to deactivate password', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => showSnackbar('Password copied to clipboard', 'success'),
      () => showSnackbar('Failed to copy password', 'error')
    );
  };
  
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate();
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };
  
  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };
  
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };
  
  // Columns for the data grid
  const columns = [
    {
      field: 'name',
      headerName: 'Name',
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Typography variant="body2">{params.value || 'N/A'}</Typography>
      )
    },
    {
      field: 'password',
      headerName: 'Password',
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">{params.value || 'N/A'}</Typography>
          <Tooltip title="Copy password">
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(params.value);
              }}
            >
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    },
    {
      field: 'isActive',
      headerName: 'Status',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          color={params.value ? 'success' : 'error'}
          size="small"
        />
      )
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 180,
      sortable: false,
      filterable: false,
      valueGetter: (params) => {
        if (!params || !params.value) return 'N/A';
        return formatDate(params.value);
      }
    },
    {
      field: 'expiresAt',
      headerName: 'Expires',
      width: 180,
      sortable: false,
      filterable: false,
      valueGetter: (params) => {
        if (!params || !params.value) return 'Never';
        return formatDate(params.value);
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        if (!params.row.isActive) {
          return <Typography variant="caption">Deactivated</Typography>;
        }
        
        return (
          <Tooltip title="Deactivate password">
            <IconButton
              color="error"
              size="small"
              onClick={() => handleDeactivatePassword(params.row.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        );
      }
    }
  ];

  if (!isSuperAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          Only super administrators can access the wallet password management system.
        </Typography>
      </Box>
    );
  }
  
  // If not authorized, show only the admin password dialog
  if (!accessAuthorized) {
    return (
      <Box>
        {/* Admin Password Dialog */}
        <Dialog 
          open={adminPasswordDialogOpen} 
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LockIcon color="primary" />
              <Typography variant="h6">Admin Authorization Required</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Typography variant="body2">
                Please enter the admin password to access the Wallet Password Management system.
              </Typography>
              
              <TextField
                label="Admin Password"
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                fullWidth
                autoFocus
                placeholder="Enter admin password"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={verifyAdminPassword} variant="contained" color="primary">
              Verify
            </Button>
          </DialogActions>
        </Dialog>
        
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
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Wallet Access Password Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Password
        </Button>
      </Box>
      
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={passwords}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10, page: 0 },
            },
          }}
          pageSizeOptions={[10]}
          loading={loading}
          disableColumnMenu
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          autoHeight
          sx={{
            '& .MuiDataGrid-cell': {
              borderColor: 'divider',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
            },
          }}
        />
      </Paper>
      
      {/* Create Password Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Password</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              fullWidth
              required
              placeholder="Enter name for this password"
            />
            <TextField
              label="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              required
              placeholder="Enter password"
            />
            <Button
              variant="outlined"
              onClick={generateRandomPassword}
              startIcon={<AddIcon />}
            >
              Generate Random Password
            </Button>
            
            <FormControl fullWidth>
              <InputLabel>Expiration</InputLabel>
              <Select
                value={expiryType}
                onChange={(e) => setExpiryType(e.target.value)}
                label="Expiration"
              >
                <MenuItem value="never">Never expires</MenuItem>
                <MenuItem value="1day">1 day</MenuItem>
                <MenuItem value="1week">1 week</MenuItem>
                <MenuItem value="1month">1 month</MenuItem>
                <MenuItem value="custom">Custom date/time</MenuItem>
              </Select>
            </FormControl>
            
            {expiryType === 'custom' && (
              <TextField
                label="Expiration Date/Time"
                type="datetime-local"
                value={customExpiryDate}
                onChange={(e) => setCustomExpiryDate(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                fullWidth
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreatePassword} 
            variant="contained" 
            color="primary"
            disabled={!newPassword}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
      
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

export default WalletAccessManager; 