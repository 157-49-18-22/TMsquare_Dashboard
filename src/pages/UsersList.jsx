import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  IconButton, 
  Tooltip, 
  Snackbar, 
  Alert,
  TextField,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Edit as EditIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { 
  getAllUsers, 
  updateUserData
} from '../api/firestoreApi';
import { useAuth } from '../contexts/AuthContext';

// Cache for reducing Firebase reads
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const CACHE_PREFIX = 'users_list_cache_';

// Initialize cache from localStorage
const initializeUsersCache = () => {
  const cache = {
    users: [],
    allUsers: [],
    lastFetch: 0
  };

  try {
    const usersCache = localStorage.getItem(CACHE_PREFIX + 'users');
    if (usersCache) {
      cache.users = JSON.parse(usersCache);
      console.log('📦 [UsersList] Active users cache loaded from localStorage');
    }

    const allUsersCache = localStorage.getItem(CACHE_PREFIX + 'allUsers');
    if (allUsersCache) {
      cache.allUsers = JSON.parse(allUsersCache);
      console.log('📦 [UsersList] All users cache loaded from localStorage');
    }

    const lastFetchCache = localStorage.getItem(CACHE_PREFIX + 'lastFetch');
    if (lastFetchCache) {
      cache.lastFetch = JSON.parse(lastFetchCache);
    }
  } catch (error) {
    console.error('Error loading users cache from localStorage:', error);
  }

  return cache;
};

const usersCache = initializeUsersCache();

// Helper function to check if cache is valid
const isCacheValid = () => {
  return usersCache.lastFetch && (Date.now() - usersCache.lastFetch) < CACHE_EXPIRY;
};

// Helper function to save cache to localStorage
const saveUsersCacheToStorage = () => {
  try {
    localStorage.setItem(CACHE_PREFIX + 'users', JSON.stringify(usersCache.users));
    localStorage.setItem(CACHE_PREFIX + 'allUsers', JSON.stringify(usersCache.allUsers));
    localStorage.setItem(CACHE_PREFIX + 'lastFetch', JSON.stringify(usersCache.lastFetch));
  } catch (error) {
    console.error('Error saving users cache to localStorage:', error);
  }
};

// Helper function to clear cache
const clearCache = () => {
  usersCache.users = [];
  usersCache.allUsers = [];
  usersCache.lastFetch = 0;
  localStorage.removeItem(CACHE_PREFIX + 'users');
  localStorage.removeItem(CACHE_PREFIX + 'allUsers');
  localStorage.removeItem(CACHE_PREFIX + 'lastFetch');
};

function UsersList() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const { userData, isSuperAdmin, isSubAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const searchTimeoutRef = useRef(null);
  const [filter, setFilter] = useState({
    bcId: '',
    searchTerm: ''
  });
  const [debouncedFilter, setDebouncedFilter] = useState(filter);
  const filterTimeoutRef = useRef(null);
  const [activeTab, setActiveTab] = useState(1); // 0: Active, 1: Inactive, 2: All
  const [allUsers, setAllUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [inactiveUsers, setInactiveUsers] = useState([]);
  
  const [editForm, setEditForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    bcId: '',
    wallet: '',
    status: ''
  });

  // Debounced filter effect
  useEffect(() => {
    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }
    
    filterTimeoutRef.current = setTimeout(() => {
      setDebouncedFilter(filter);
    }, 300);
    
    return () => {
      if (filterTimeoutRef.current) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, [filter]);

  // Memoized filtered users
  const filteredUsersMemo = useMemo(() => {
    let filtered = [...users];
    
    // Filter by BC_ID
    if (debouncedFilter.bcId) {
      filtered = filtered.filter(user =>
        user.bcId === debouncedFilter.bcId
      );
    }
    
    // Filter by search term (across multiple fields)
    if (debouncedFilter.searchTerm) {
      const term = debouncedFilter.searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        (user.displayName && user.displayName.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user.phone && user.phone.includes(term)) ||
        (user.bcId && user.bcId.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [users, debouncedFilter]);

  useEffect(() => {
    setFilteredUsers(filteredUsersMemo);
  }, [filteredUsersMemo]);

  const fetchUsers = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first (unless force refresh)
      if (!forceRefresh && isCacheValid()) {
        console.log('📦 [UsersList] Using cached users data');
        
        // Set cached data
        setActiveUsers(usersCache.users || []);
        setAllUsers(usersCache.allUsers || []);
        
                 // Set current users based on active tab
         switch (activeTab) {
           case 0: // Active
             setUsers(usersCache.users || []);
             break;
           case 1: // Inactive
             const inactiveFromCache = (usersCache.allUsers || []).filter(user => user.status !== 'active');
             setInactiveUsers(inactiveFromCache);
             setUsers(inactiveFromCache);
             break;
           case 2: // All
             setUsers(usersCache.allUsers || []);
             break;
           default:
             const defaultInactiveFromCache = (usersCache.allUsers || []).filter(user => user.status !== 'active');
             setInactiveUsers(defaultInactiveFromCache);
             setUsers(defaultInactiveFromCache);
         }
        
        setLoading(false);
        return;
      }

      console.log('🔄 [UsersList] Fetching users data from last month...');
      let usersData;

      // Calculate date for last month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      if (isSuperAdmin) {
        const result = await getAllUsers();
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch users');
        }
        usersData = result.users;
      } else if (isSubAdmin) {
        // For sub-admin, get only assigned users
        const { getUsersBySubAdmin } = await import('../api/firestoreApi');
        const result = await getUsersBySubAdmin(userData.uid);
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch users');
        }
        usersData = result.users;
      } else {
        throw new Error('Unauthorized access');
      }

      // Transform data to include only essential fields and filter by date
      const simplifiedUsers = usersData
        .filter(user => {
          try {
            // Filter users created in the last month
            const createdAt = user.createdAt?.toDate?.() || user.createdAt || new Date();
            return createdAt >= oneMonthAgo;
          } catch (error) {
            console.warn('⚠️ [UsersList] Error parsing user creation date:', error);
            return true; // Include user if date parsing fails
          }
        })
        .map(user => ({
          id: user.id || user.uid,
          displayName: user.displayName || 'N/A',
          email: user.email || 'N/A',
          bcId: user.bcId || 'N/A',
          phone: user.phone || 'N/A',
          wallet: user.wallet || '0',
          status: user.status || 'inactive',
          role: user.role || 'user',
          createdAt: user.createdAt?.toDate?.() || user.createdAt || new Date()
        }));

      // Sort users by creation date (newest first)
      const sortedUsers = simplifiedUsers.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB - dateA; // Decreasing order (newest first)
      });

      // Separate users by status
      const active = sortedUsers.filter(user => user.status === 'active');
      const inactive = sortedUsers.filter(user => user.status !== 'active' && user.status !== 'suspended');
      const suspended = sortedUsers.filter(user => user.status === 'suspended');
      
      // Combine inactive and suspended for the inactive tab
      const allInactive = [...inactive, ...suspended];

      setAllUsers(sortedUsers);
      setActiveUsers(active);
      setInactiveUsers(allInactive);
      setUsers(allInactive); // Default to inactive users
      
      // Update cache with both active and all users
      usersCache.users = active;
      usersCache.allUsers = sortedUsers;
      usersCache.lastFetch = Date.now();
      saveUsersCacheToStorage();
      
      console.log(`✅ [UsersList] Loaded ${simplifiedUsers.length} users`);
      console.log(`📊 [UsersList] Status breakdown: Active: ${active.length}, Inactive: ${inactive.length}, Suspended: ${suspended.length}`);
      console.log('📊 [UsersList] Sample user data:', simplifiedUsers[0]);
    } catch (err) {
      console.error('❌ [UsersList] Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isSuperAdmin, isSubAdmin, userData?.uid]);

  const handleBcIdChange = (event, newValue) => {
    setFilter({
      ...filter,
      bcId: newValue || ''
    });
  };

  const handleSearchChange = (e) => {
    setFilter({
      ...filter,
      searchTerm: e.target.value
    });
  };

  const resetFilters = () => {
    setFilter({
      bcId: '',
      searchTerm: ''
    });
  };

  const applyFilters = () => {
    // This function is now handled by the memoized filteredUsersMemo
    console.log('🔍 [UsersList] Applying filters:', filter);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    
    // Switch between different user lists based on tab
    switch (newValue) {
      case 0: // Active
        setUsers(activeUsers);
        break;
      case 1: // Inactive (includes suspended)
        setUsers(inactiveUsers);
        break;
      case 2: // All
        setUsers(allUsers);
        break;
      default:
        setUsers(activeUsers);
    }
  };

  const getColumns = () => [
    {
      field: 'displayName',
      headerName: 'Name',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value}
        </Typography>
      )
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.2,
      minWidth: 200,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value}
        </Typography>
      )
    },
    {
      field: 'bcId',
      headerName: 'BC ID',
      flex: 0.8,
      minWidth: 120,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value}
        </Typography>
      )
    },
    {
      field: 'phone',
      headerName: 'Phone',
      flex: 1,
      minWidth: 130,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value}
        </Typography>
      )
    },
    {
      field: 'wallet',
      headerName: 'Wallet Balance',
      flex: 0.8,
      minWidth: 120,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="medium">
          ₹{parseFloat(params.value || 0).toFixed(2)}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.6,
      minWidth: 100,
      renderCell: (params) => {
        const status = params.value || 'inactive';
        return (
          <Chip
            label={status}
            color={status === 'active' ? 'success' : 'error'}
            size="small"
          />
        );
      }
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      flex: 0.8,
      minWidth: 120,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value ? new Date(params.value).toLocaleDateString() : 'N/A'}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.5,
      minWidth: 80,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="Edit User">
          <IconButton
            size="small"
            onClick={() => handleEditUser(params.row)}
            color="primary"
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
      )
    }
  ];

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      displayName: user.displayName || '',
      email: user.email || '',
      phone: user.phone || '',
      bcId: user.bcId || '',
      wallet: user.wallet || '0',
      status: user.status || 'active'
    });
    setEditDialogOpen(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    
    // Check if status is being changed to active and user doesn't have a BC_ID
    if (name === 'status' && value === 'active' && (!editForm.bcId || editForm.bcId === 'N/A' || editForm.bcId.trim() === '')) {
      console.log('Status changed to active without valid BC_ID, generating new BC_ID');
      
      // Generate a unique BC_ID (you can implement your own logic here)
      const newBcId = generateUniqueBcId();
      
      setEditForm(prevForm => ({
        ...prevForm,
        [name]: value,
        bcId: newBcId
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Function to generate unique BC_ID (similar to Users.jsx)
  const generateUniqueBcId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${timestamp}${random}`;
  };

  const handleSaveEdit = async () => {
    try {
      if (!editingUser) return;

      const updateData = {
        displayName: editForm.displayName,
        phone: editForm.phone,
        bcId: editForm.bcId,
        wallet: editForm.wallet,
        status: editForm.status
      };

      await updateUserData(editingUser.id, updateData);
      
      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === editingUser.id 
          ? { ...user, ...updateData }
          : user
      ));

      // Update cache
      usersCache.users = users.map(user => 
        user.id === editingUser.id 
          ? { ...user, ...updateData }
          : user
      );
      saveUsersCacheToStorage();

      setEditDialogOpen(false);
      setEditingUser(null);
      showSnackbar('User updated successfully', 'success');
    } catch (error) {
      console.error('Error updating user:', error);
      showSnackbar('Failed to update user', 'error');
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingUser(null);
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => fetchUsers(true)} variant="contained">
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Users List
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Simplified view of user data from last month (reduces Firebase reads)
      </Typography>

      {/* User Status Tabs with Better Design */}
      <Paper sx={{ mb: 3, boxShadow: 2 }}>
        <Box sx={{ p: 2, backgroundColor: 'white', color: 'black' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            User Management Dashboard
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {activeTab === 0 && `Viewing ${activeUsers.length} active users (cached for fast access)`}
            {activeTab === 1 && `Viewing ${inactiveUsers.length} inactive/suspended users`}
            {activeTab === 2 && `Viewing all ${allUsers.length} users from last month`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip 
              label={isCacheValid() ? 'Cached' : 'Fresh Data'} 
              size="small" 
              color={isCacheValid() ? 'success' : 'warning'}
              variant="outlined"
            />
            <Chip 
              label={`Last Month Only`} 
              size="small" 
              color="info"
              variant="outlined"
            />
          </Box>
        </Box>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            '& .MuiTab-root': {
              fontWeight: 'bold',
              minWidth: 140
            }
          }}
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={activeUsers.length} 
                  size="small" 
                  color="success" 
                  sx={{ fontWeight: 'bold' }}
                />
                <span>Active Users</span>
              </Box>
            }
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={inactiveUsers.length} 
                  size="small" 
                  color="error" 
                  sx={{ fontWeight: 'bold' }}
                />
                <span>Inactive Users</span>
              </Box>
            }
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={allUsers.length} 
                  size="small" 
                  color="primary" 
                  sx={{ fontWeight: 'bold' }}
                />
                <span>All Users</span>
              </Box>
            }
          />
        </Tabs>
      </Paper>

      {/* Filter Section with Enhanced Design */}
      <Paper sx={{ p: 3, mb: 3, boxShadow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Search & Filters
          </Typography>
          <Chip 
            label={`${filteredUsers.length} users found`}
            color="info"
            size="small"
          />
        </Box>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="BC ID Filter"
              value={filter.bcId}
              onChange={(e) => handleBcIdChange(e, e.target.value)}
              placeholder="Enter exact BC ID"
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search Users"
              value={filter.searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name, email, phone, BC ID"
              size="small"
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={resetFilters}
                size="small"
                disabled={!filter.bcId && !filter.searchTerm}
              >
                Clear Filters
              </Button>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={applyFilters}
                size="small"
              >
                Apply
              </Button>
              <Button
                variant="outlined"
                onClick={() => fetchUsers(true)}
                startIcon={<RefreshIcon />}
                disabled={loading}
                size="small"
              >
                Refresh Data
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Users Table with Enhanced Design */}
      <Paper sx={{ height: 600, width: '100%', boxShadow: 2 }}>
        <Box sx={{ p: 2, backgroundColor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            User Data Table
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sorted by creation date (newest first) • Click edit icon to modify user details
          </Typography>
        </Box>
        <DataGrid
          rows={filteredUsers}
          columns={getColumns()}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 25 }
            },
            sorting: {
              sortModel: [{ field: 'createdAt', sort: 'desc' }]
            }
          }}
          disableRowSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solidrgb(0, 0, 0)',
              fontSize: '0.875rem'
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'primary.main',
              color: 'black',
              fontWeight: 'bold',
              fontSize: '0.875rem'
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        />
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit User
          {editForm.bcId && editForm.bcId !== editingUser?.bcId && (
            <Chip 
              label="BC ID Auto-Generated" 
              color="success" 
              size="small" 
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                name="displayName"
                value={editForm.displayName}
                onChange={handleEditFormChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                value={editForm.email}
                disabled
                helperText="Email cannot be changed"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={editForm.phone}
                onChange={handleEditFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="BC ID"
                name="bcId"
                value={editForm.bcId}
                disabled
                helperText="BC ID is auto-generated and cannot be modified"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Wallet Balance"
                name="wallet"
                type="number"
                value={editForm.wallet}
                onChange={handleEditFormChange}
                disabled
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Status"
                name="status"
                value={editForm.status}
                onChange={handleEditFormChange}
                select
                SelectProps={{ native: true }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default UsersList; 