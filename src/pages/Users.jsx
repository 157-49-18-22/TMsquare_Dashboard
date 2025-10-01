import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Autocomplete,
  Grid,
  Popover
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Edit as EditIcon, 
  PersonAdd as AssignIcon,
  PersonRemove as UnassignIcon,
  Search as SearchIcon,
  Numbers as SerialNumbersIcon,
  Key as KeyIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { 
  getAllUsers, 
  updateUserData,
  getUsersBySubAdmin,
  getSubAdmins,
  assignUserToSubAdmin,
  unassignUserFromSubAdmin,
  createOrUpdateUser,
  generateWalletPassword,
  verifyWalletPassword,
  verifyWalletAccessPassword
} from '../api/firestoreApi';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

// Cache for reducing Firebase reads with localStorage persistence
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const CACHE_PREFIX = 'users_cache_';

// Initialize cache from localStorage
const initializeUsersCache = () => {
  const cache = {
    users: new Map(),
    subAdmins: [],
    userFasTags: new Map(),
    lastFetch: {
      users: 0,
      subAdmins: 0,
      userFasTags: 0
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
      console.log('📦 [Users] Users cache loaded from localStorage');
    }

    // Load sub-admins cache
    const subAdminsCache = localStorage.getItem(CACHE_PREFIX + 'subAdmins');
    if (subAdminsCache) {
      cache.subAdmins = JSON.parse(subAdminsCache);
      console.log('📦 [Users] Sub-admins cache loaded from localStorage');
    }

    // Load user FasTags cache
    const userFasTagsCache = localStorage.getItem(CACHE_PREFIX + 'userFasTags');
    if (userFasTagsCache) {
      const parsedUserFasTags = JSON.parse(userFasTagsCache);
      parsedUserFasTags.forEach(([key, value]) => {
        cache.userFasTags.set(key, value);
      });
      console.log('📦 [Users] User FasTags cache loaded from localStorage');
    }

    // Load last fetch timestamps
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
const isCacheValid = (cacheKey) => {
  const lastFetch = usersCache.lastFetch[cacheKey];
  return lastFetch && (Date.now() - lastFetch) < CACHE_EXPIRY;
};

// Helper function to save cache to localStorage
const saveUsersCacheToStorage = (cacheKey) => {
  try {
    if (cacheKey === 'users') {
      const usersArray = Array.from(usersCache.users.entries());
      localStorage.setItem(CACHE_PREFIX + 'users', JSON.stringify(usersArray));
    } else if (cacheKey === 'subAdmins') {
      localStorage.setItem(CACHE_PREFIX + 'subAdmins', JSON.stringify(usersCache.subAdmins));
    } else if (cacheKey === 'userFasTags') {
      const userFasTagsArray = Array.from(usersCache.userFasTags.entries());
      localStorage.setItem(CACHE_PREFIX + 'userFasTags', JSON.stringify(userFasTagsArray));
    }
    localStorage.setItem(CACHE_PREFIX + 'lastFetch', JSON.stringify(usersCache.lastFetch));
  } catch (error) {
    console.error('Error saving users cache to localStorage:', error);
  }
};

// Helper function to clear cache
const clearCache = (cacheKey = null) => {
  if (cacheKey) {
    if (cacheKey === 'users') {
      usersCache.users.clear();
      localStorage.removeItem(CACHE_PREFIX + 'users');
    } else if (cacheKey === 'subAdmins') {
      usersCache.subAdmins = [];
      localStorage.removeItem(CACHE_PREFIX + 'subAdmins');
    } else if (cacheKey === 'userFasTags') {
      usersCache.userFasTags.clear();
      localStorage.removeItem(CACHE_PREFIX + 'userFasTags');
    }
    usersCache.lastFetch[cacheKey] = 0;
  } else {
    usersCache.users.clear();
    usersCache.subAdmins = [];
    usersCache.userFasTags.clear();
    Object.keys(usersCache.lastFetch).forEach(key => {
      usersCache.lastFetch[key] = 0;
    });
    // Clear all localStorage cache
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
  saveUsersCacheToStorage();
};

function Users() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [assigningUser, setAssigningUser] = useState(null);
  const [selectedSubAdmin, setSelectedSubAdmin] = useState('');
  const { userData, isSuperAdmin, isSubAdmin } = useAuth();
  const [bcIdOptions, setBcIdOptions] = useState([]);
  const [filter, setFilter] = useState({
    bcId: '',
    searchTerm: ''
  });
  const [debouncedFilter, setDebouncedFilter] = useState(filter);
  const filterTimeoutRef = useRef(null);
  const [userFasTags, setUserFasTags] = useState({});
  const [serialNumbersAnchorEl, setSerialNumbersAnchorEl] = useState(null);
  const [selectedUserForSerialNumbers, setSelectedUserForSerialNumbers] = useState(null);
  const [walletPasswordDialogOpen, setWalletPasswordDialogOpen] = useState(false);
  const [walletPassword, setWalletPassword] = useState('');
  const [isGeneratingPassword, setIsGeneratingPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [pendingWalletUpdate, setPendingWalletUpdate] = useState(null);
  const [walletFieldLocked, setWalletFieldLocked] = useState(true);
  const [walletAccessPassword, setWalletAccessPassword] = useState('');
  const [walletAccessDialogOpen, setWalletAccessDialogOpen] = useState(false);
  
  const [editForm, setEditForm] = useState({
    displayName: '',
    email: '',
    role: '',
    status: '',
    phone: '',
    address: '',
    aadharCard: '',
    panCard: '',
    password: '',
    minFasTagBalance: '',
    minRSABalance: '',
    bcId: '',
    wallet: ''
  });

  // Debounced filter effect
  useEffect(() => {
    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }
    
    filterTimeoutRef.current = setTimeout(() => {
      setDebouncedFilter(filter);
    }, 300); // 300ms delay
    
    return () => {
      if (filterTimeoutRef.current) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, [filter]);

  // Memoized filtered users to avoid recalculation
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

  // Update filtered users when memoized result changes
  useEffect(() => {
    setFilteredUsers(filteredUsersMemo);
  }, [filteredUsersMemo]);

  // Optimized fetch data function with caching
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Fetch sub-admins if user is super admin
      if (isSuperAdmin) {
        // Check cache first
        if (!forceRefresh && usersCache.subAdmins.length > 0 && isCacheValid('subAdmins')) {
          console.log('✅ [Users] Sub-admins fetched from CACHE');
          setSubAdmins(usersCache.subAdmins);
        } else {
          console.log('🔄 [Users] Sub-admins not in cache, fetching from API...');
          const { success, subAdmins, error } = await getSubAdmins();
          if (success) {
            setSubAdmins(subAdmins);
            // Update cache
            usersCache.subAdmins = subAdmins;
            usersCache.lastFetch.subAdmins = Date.now();
            // Save to localStorage
            saveUsersCacheToStorage('subAdmins');
            console.log('✅ [Users] Sub-admins fetched from API and cached');
          } else {
            console.error('Error fetching sub-admins:', error);
          }
        }
      }
      
      // Fetch users based on role
      let usersData = [];
      if (isSuperAdmin) {
        // Super admin sees all users
        // Check cache first
        if (!forceRefresh && usersCache.users.size > 0 && isCacheValid('users')) {
          console.log('✅ [Users] Users fetched from CACHE');
          const cachedUsers = Array.from(usersCache.users.values());
          usersData = cachedUsers;
        } else {
          console.log('🔄 [Users] Users not in cache, fetching from API...');
          const { success, users, error } = await getAllUsers();
          if (success) {
            usersData = users;
            // Update cache
            usersCache.users.clear();
            users.forEach(user => {
              usersCache.users.set(user.id, user);
            });
            usersCache.lastFetch.users = Date.now();
            // Save to localStorage
            saveUsersCacheToStorage('users');
            console.log('✅ [Users] Users fetched from API and cached');
          } else {
            throw new Error(error);
          }
        }
      } else if (isSubAdmin && userData?.id) {
        // Sub-admin sees only assigned users
        console.log('🔄 [Users] Sub-admin users not in cache, fetching from API...');
        const { success, users, error } = await getUsersBySubAdmin(userData.id);
        if (success) {
          usersData = users;
          // Update cache for sub-admin users
          users.forEach(user => {
            usersCache.users.set(user.id, user);
          });
          usersCache.lastFetch.users = Date.now();
          // Save to localStorage
          saveUsersCacheToStorage('users');
          console.log('✅ [Users] Sub-admin users fetched from API and cached');
        } else {
          throw new Error(error);
        }
      }
      
      console.log('Fetched users:', usersData);
      setUsers(usersData);
      setFilteredUsers(usersData);
      
      // Extract unique BC_IDs for autocomplete
      const bcIds = new Set();
      usersData.forEach(user => {
        if (user.bcId) {
          bcIds.add(user.bcId);
        }
      });
      setBcIdOptions(Array.from(bcIds));
      
      // Check for BC_ID issues after users are loaded
      setTimeout(() => {
        checkBcIdIssues();
      }, 100);
      
      // Fetch FasTag allocations for each user
      await fetchUserFasTags(usersData, forceRefresh);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data');
      showSnackbar('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, isSubAdmin, userData]);

  // Optimized fetch FasTag allocations with caching
  const fetchUserFasTags = useCallback(async (usersData, forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && usersCache.userFasTags.size > 0 && isCacheValid('userFasTags')) {
        console.log('✅ [Users] User FasTags fetched from CACHE');
        setUserFasTags(Object.fromEntries(usersCache.userFasTags));
        return;
      }

      console.log('🔄 [Users] User FasTags not in cache, fetching from API...');
      const fasTagsMap = {};
      
      // Get all FasTag allocations in one query instead of individual queries
      const fastagRef = collection(db, "allocatedFasTags");
      // Apply filter: where status is "available"
      const availableFastagsQuery = query(fastagRef, where("status", "==", "available"));
      const querySnapshot = await getDocs(availableFastagsQuery);
      
      // Create a map of bcId to FasTags
      const bcIdToFasTags = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.bcId) {
          if (!bcIdToFasTags[data.bcId]) {
            bcIdToFasTags[data.bcId] = [];
          }
          bcIdToFasTags[data.bcId].push({
            id: doc.id,
            serialNo: data.serialNumber,
            status: data.status,
          });
        }
      });
      
      // Map FasTags to users
      for (const user of usersData) {
        if (user.bcId) {
          fasTagsMap[user.id] = bcIdToFasTags[user.bcId] || [];
        } else {
          fasTagsMap[user.id] = [];
        }
      }
      
      // Update cache
      usersCache.userFasTags.clear();
      Object.entries(fasTagsMap).forEach(([userId, tags]) => {
        usersCache.userFasTags.set(userId, tags);
      });
      usersCache.lastFetch.userFasTags = Date.now();
      
      // Save to localStorage
      saveUsersCacheToStorage('userFasTags');
      
      console.log('✅ [Users] User FasTags fetched from API and cached');
      setUserFasTags(fasTagsMap);
    } catch (error) {
      console.error('Error fetching FasTag allocations:', error);
    }
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Function to check and log BC_ID issues
  const checkBcIdIssues = useCallback(() => {
    const usersWithInvalidBcIds = users.filter(user => 
      user.bcId === '000na' || user.bcId === '' || !user.bcId
    );
    
    if (usersWithInvalidBcIds.length > 0) {
      console.warn('⚠️ Found users with invalid BC_IDs:', usersWithInvalidBcIds.map(u => ({
        id: u.id,
        name: u.displayName,
        bcId: u.bcId,
        status: u.status
      })));
    }
    
    const validBcIds = users
      .filter(user => user.bcId && user.bcId !== '000na' && user.bcId.trim() !== '')
      .map(user => user.bcId);
    
    console.log('✅ Valid BC_IDs in system:', validBcIds);
  }, [users]);

  // Function to generate unique BC_ID
  const generateUniqueBcId = useCallback(() => {
    // Get all existing BC_IDs from the current users list
    const existingBcIds = users
      .filter(user => user.bcId && user.bcId.trim() !== '' && user.bcId !== '000na')
      .map(user => user.bcId);
    
    console.log('Generating BC_ID. Existing BC_IDs:', existingBcIds);
    console.log('Total users:', users.length);
    console.log('Users with BC_IDs:', users.filter(user => user.bcId).length);
    
    let newBcId;
    if (existingBcIds.length === 0) {
      newBcId = '100001';
    } else {
      // Find highest number from existing BC_IDs
      const numericIds = existingBcIds
        .map(id => parseInt(id, 10))
        .filter(num => !isNaN(num) && num > 0); // Filter out non-numeric IDs and zeros
      
      console.log('Numeric BC_IDs:', numericIds);
      
      if (numericIds.length === 0) {
        newBcId = '100001';
      } else {
        const highestNumber = Math.max(...numericIds);
        newBcId = (highestNumber + 1).toString().padStart(6, '0');
      }
    }
    
    console.log('Generated unique BC_ID:', newBcId);
    return newBcId;
  }, [users]);

  // Optimized apply filters function (now handled by useMemo)
  const applyFilters = useCallback(() => {
    // This function is now handled by the memoized filteredUsersMemo
    // Keeping it for backward compatibility but it's no longer needed
  }, []);
  
  // Handle BC_ID autocomplete change
  const handleBcIdChange = (event, newValue) => {
    setFilter({
      ...filter,
      bcId: newValue || ''
    });
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setFilter({
      ...filter,
      searchTerm: e.target.value
    });
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilter({
      bcId: '',
      searchTerm: ''
    });
  };
  
  // Handle opening the serial numbers popover
  const handleOpenSerialNumbers = (event, user) => {
    setSerialNumbersAnchorEl(event.currentTarget);
    setSelectedUserForSerialNumbers(user);
  };
  
  // Handle closing the serial numbers popover
  const handleCloseSerialNumbers = () => {
    setSerialNumbersAnchorEl(null);
    setSelectedUserForSerialNumbers(null);
  };

  // Define columns for the data grid
  const getColumns = () => {
    const baseColumns = [
      { 
        field: 'id', 
        headerName: 'ID', 
        width: 90 
      },
      { 
        field: 'displayName', 
        headerName: 'Name', 
        width: 150,
        renderCell: (params) => {
          return <span>{params.row?.displayName || 'No Name'}</span>;
        }
      },
      { 
        field: 'email', 
        headerName: 'Email', 
        width: 200,
        renderCell: (params) => {
          return <span>{params.row?.email || 'No Email'}</span>;
        }
      },
      {
        field: 'bcId',
        headerName: 'BC_ID',
        width: 120,
        renderCell: (params) => {
          return <span>{params.row?.bcId || 'N/A'}</span>;
        }
      },
      { 
        field: 'phone', 
        headerName: 'Phone', 
        width: 130,
        renderCell: (params) => {
          return <span>{params.row?.phone || 'N/A'}</span>;
        }
      },
      {
        field: 'wallet',
        headerName: 'Wallet Balance',
        width: 130,
        renderCell: (params) => {
          const walletAmount = params.row?.wallet || 0;
          return (
            <Chip
              label={`₹ ${walletAmount}`}
              color={walletAmount > 0 ? 'success' : 'default'}
              size="small"
              variant="outlined"
            />
          );
        }
      },
      { 
        field: 'aadharCard', 
        headerName: 'Aadhar Card', 
        width: 150,
        renderCell: (params) => {
          return <span>{params.row?.aadharCard || 'N/A'}</span>;
        }
      },
      { 
        field: 'panCard', 
        headerName: 'PAN Card', 
        width: 130,
        renderCell: (params) => {
          return <span>{params.row?.panCard || 'N/A'}</span>;
        }
      },
      {
        field: 'fastagAllocations',
        headerName: 'FasTags',
        width: 130,
        renderCell: (params) => {
          const userId = params.row?.id;
          const allocatedTags = userFasTags[userId] || [];
          const tagCount = allocatedTags.length;
          
          return (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip 
                  label={`${tagCount} FasTag${tagCount !== 1 ? 's' : ''}`} 
                  color={tagCount > 0 ? 'primary' : 'default'}
                  size="small"
                  sx={{ mr: 1 }}
                />
                {tagCount > 0 && (
                  <Tooltip title="View Serial Numbers">
                    <IconButton
                      size="small"
                      onClick={(e) => handleOpenSerialNumbers(e, params.row)}
                    >
                      <SerialNumbersIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </>
          );
        }
      },
      { 
        field: 'role', 
        headerName: 'Role', 
        width: 130,
        renderCell: (params) => {
          const role = params.row?.role || 'user';
          return (
            <Chip 
              label={role} 
              color={
                role === 'admin' ? 'primary' : 
                role === 'subAdmin' ? 'secondary' : 
                'default'
              }
              size="small"
            />
          );
        }
      },
      { 
        field: 'status', 
        headerName: 'Status', 
        width: 130,
        renderCell: (params) => {
          const status = params.row?.status || 'inactive';
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
        field: 'edit',
        headerName: 'Edit',
        width: 60,
        renderCell: (params) => {
          return (
            <IconButton
              onClick={() => handleEditUser(params.row)}
              size="small"
              color="primary"
            >
              <EditIcon />
            </IconButton>
          );
        }
      }
    ];
    
    // Add assignment column for super admin
    if (isSuperAdmin) {
      baseColumns.push({
        field: 'assignedTo',
        headerName: 'Assigned To',
        width: 150,
        renderCell: (params) => {
          const assignedTo = params.row?.assignedTo;
          const assignedSubAdmin = subAdmins.find(admin => admin.id === assignedTo);
          
          return assignedSubAdmin ? (
            <Chip
              label={assignedSubAdmin.displayName || assignedSubAdmin.email}
              color="info"
              size="small"
            />
          ) : (
            <span>Not assigned</span>
          );
        }
      });
      
      baseColumns.push({
        field: 'assign',
        headerName: 'Assign',
        width: 100,
        renderCell: (params) => {
          // Don't allow assigning admins or sub-admins
          if (params.row?.role === 'admin' || params.row?.role === 'subAdmin') {
            return null;
          }
          
          return params.row?.assignedTo ? (
            <Tooltip title="Unassign user">
              <IconButton
                onClick={() => handleUnassignUser(params.row)}
                size="small"
                color="error"
              >
                <UnassignIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Assign to sub-admin">
              <IconButton
                onClick={() => handleOpenAssignDialog(params.row)}
                size="small"
                color="primary"
              >
                <AssignIcon />
              </IconButton>
            </Tooltip>
          );
        }
      });
    }
    
    return baseColumns;
  };

  const handleEditUser = (user) => {
    console.log('Editing user:', user);
    if (!user) {
      console.error('Cannot edit undefined user');
      return;
    }
    
    setEditingUser(user);
    setWalletFieldLocked(true); // Reset wallet field lock when opening edit dialog
    setEditForm({
      displayName: user.displayName || '',
      email: user.email || '',
      role: user.role || 'user',
      status: user.status || 'inactive',
      phone: user.phone || '',
      address: user.address || '',
      aadharCard: user.aadharCard || '',
      panCard: user.panCard || '',
      password: '', // Password field starts empty for security
      minFasTagBalance: user.minFasTagBalance || '',
      minRSABalance: user.minRSABalance || '',
      bcId: user.bcId || '',
      wallet: user.wallet || 0
    });
    console.log('Initialized edit form with status:', user.status || 'inactive');
    setEditDialogOpen(true);
  };

  const handleOpenAssignDialog = (user) => {
    setAssigningUser(user);
    setSelectedSubAdmin('');
    setAssignDialogOpen(true);
  };

  const handleAssignUser = useCallback(async () => {
    if (!assigningUser || !selectedSubAdmin) return;
    
    try {
      setLoading(true);
      const { success, error } = await assignUserToSubAdmin(assigningUser.id, selectedSubAdmin);
      
      if (success) {
        // Refresh data with force refresh to clear cache
        await fetchData(true);
        setAssignDialogOpen(false);
        showSnackbar('User assigned successfully', 'success');
      } else {
        showSnackbar(error || 'Failed to assign user', 'error');
      }
    } catch (err) {
      console.error('Error assigning user:', err);
      showSnackbar('Failed to assign user', 'error');
    } finally {
      setLoading(false);
    }
  }, [assigningUser, selectedSubAdmin, fetchData]);

  const handleUnassignUser = useCallback(async (user) => {
    try {
      setLoading(true);
      const { success, error } = await unassignUserFromSubAdmin(user.id);
      
      if (success) {
        // Refresh data with force refresh to clear cache
        await fetchData(true);
        showSnackbar('User unassigned successfully', 'success');
      } else {
        showSnackbar(error || 'Failed to unassign user', 'error');
      }
    } catch (err) {
      console.error('Error unassigning user:', err);
      showSnackbar('Failed to unassign user', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    console.log('Edit form change:', { name, value, currentBcId: editForm.bcId });
    
    // Check if wallet balance is changing
    if (name === 'wallet' && editingUser && editingUser.wallet !== parseFloat(value)) {
      console.log('Wallet balance change detected, original:', editingUser.wallet, 'new:', value);
    }
    
    // Check if status is being changed to active
    if (name === 'status' && value === 'active') {
      console.log('Status changed to active, setting minRSABalance to 100000000');
      
      // Check if user doesn't have a BC_ID and generate one
      if (!editForm.bcId || editForm.bcId === '000na' || editForm.bcId.trim() === '') {
        console.log('Status changed to active without valid BC_ID, generating new BC_ID');
        const newBcId = generateUniqueBcId();
        
        setEditForm(prevForm => ({
          ...prevForm,
          [name]: value,
          bcId: newBcId,
          minRSABalance: '100000000' // Set minRSABalance to 100000000 when status becomes active
        }));
      } else {
        setEditForm(prevForm => ({
          ...prevForm,
          [name]: value,
          minRSABalance: '100000000' // Set minRSABalance to 100000000 when status becomes active
        }));
      }
    } else {
      setEditForm(prevForm => ({
        ...prevForm,
        [name]: value
      }));
    }
  };

  const handleEditSubmit = useCallback(async () => {
    if (!editingUser) return;
    
    try {
      setLoading(true);
      console.log('Submitting edit form with data:', editForm);
      console.log('Editing user:', editingUser);
      
      const { success, error } = await updateUserData(editingUser.id, {
        ...editForm,
        isAdmin: editForm.role === 'admin' || editForm.role === 'subAdmin'
      }, null, walletAccessPassword);
      
      console.log('Update response:', { success, error });
      
      if (success) {
        // Refresh data with force refresh to clear cache
        await fetchData(true);
        setEditDialogOpen(false);
        showSnackbar('User updated successfully', 'success');
      } else {
        showSnackbar(error || 'Failed to update user', 'error');
      }
    } catch (err) {
      console.error('Error updating user:', err);
      showSnackbar('Failed to update user', 'error');
    } finally {
      setLoading(false);
    }
  }, [editingUser, editForm, fetchData]);

  // Keep wallet access related functions but remove wallet update password functions
  const handleWalletFieldUnlockRequest = () => {
    setWalletAccessDialogOpen(true);
  };
  
  const handleVerifyWalletAccess = async () => {
    try {
      setLoading(true);
      
      // Verify wallet access password
      const { success, error } = await verifyWalletAccessPassword(walletAccessPassword);
      
      if (success) {
        setWalletFieldLocked(false);
        setWalletAccessDialogOpen(false);
        setWalletAccessPassword('');
        showSnackbar('Wallet field unlocked successfully', 'success');
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

  const showSnackbar = (message, severity) => {
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
            {isSuperAdmin ? 'User Management' : 'Your Assigned Users'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Full user management with advanced features (higher Firebase usage)
          </Typography>
        </Box> 
        <Button
          variant="outlined"
          onClick={() => window.location.href = '/users-list'}
          sx={{ ml: 2 }}
        >
          View Simplified Users List
        </Button>
      </Box>
      
      {/* Filter Section with Cache Status */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Filters</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={`Users: ${isCacheValid('users') ? 'Cached' : 'Fresh'}`}
              size="small"
              color={isCacheValid('users') ? 'success' : 'warning'}
            />
            <Chip 
              label={`Tags: ${isCacheValid('userFasTags') ? 'Cached' : 'Fresh'}`}
              size="small"
              color={isCacheValid('userFasTags') ? 'success' : 'warning'}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => {
                console.log('🔄 [Users] Manual cache clear triggered');
                clearCache();
                fetchData(true);
                showSnackbar('Cache cleared and data refreshed', 'success');
              }}
              title="Clear cache and refresh data"
            >
              Refresh
            </Button>
          </Box>
        </Box>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4} width={'10%'}>
            <Autocomplete
              freeSolo
              options={bcIdOptions}
              value={filter.bcId}
              onChange={handleBcIdChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="BC_ID"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              value={filter.searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name, email, phone, BC_ID"
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
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
              onClick={applyFilters}
              size="medium"
            >
              Search
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredUsers}
          columns={getColumns()}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
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
                  No Users Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Try adjusting your filters or refresh the data
                </Typography>
              </Box>
            )
          }}
        />
      </Paper>
      
      {/* Serial Numbers Popover */}
      <Popover
        open={Boolean(serialNumbersAnchorEl)}
        anchorEl={serialNumbersAnchorEl}
        onClose={handleCloseSerialNumbers}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 400, maxHeight: 400, overflow: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            FasTag Serial Numbers
          </Typography>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            User: {selectedUserForSerialNumbers?.displayName || selectedUserForSerialNumbers?.email || 'N/A'}
          </Typography>
          
          {selectedUserForSerialNumbers && userFasTags[selectedUserForSerialNumbers.id]?.length > 0 ? (
            <Box>
              {userFasTags[selectedUserForSerialNumbers.id].map((tag, index) => (
                <Chip
                  key={tag.id}
                  label={tag.serialNo}
                  color={tag.status === 'inactive' ? 'primary' : tag.status === 'pending_activation' ? 'warning' : 'default'}
                  sx={{ m: 0.5 }}
                  variant="outlined"
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No FasTags allocated to this user.
            </Typography>
          )}
        </Box>
      </Popover>
      
      {/* Edit User Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Name"
              name="displayName"
              value={editForm.displayName}
              onChange={handleEditFormChange}
              fullWidth
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={editForm.email}
              onChange={handleEditFormChange}
              fullWidth
              disabled={!isSuperAdmin} // Only super admin can change email
            />
            <TextField
              label="BC_ID"
              name="bcId"
              value={editForm.bcId}
              onChange={handleEditFormChange}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                name="role"
                value={editForm.role}
                onChange={handleEditFormChange}
                label="Role"
                disabled={!isSuperAdmin} // Only super admin can change role
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="subAdmin">Sub Admin</MenuItem>
                {isSuperAdmin && <MenuItem value="admin">Admin</MenuItem>}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={editForm.status}
                onChange={handleEditFormChange}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Phone"
              name="phone"
              value={editForm.phone}
              onChange={handleEditFormChange}
              fullWidth
            />
            <TextField
              label="Address"
              name="address"
              value={editForm.address}
              onChange={handleEditFormChange}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Aadhar Card"
              name="aadharCard"
              value={editForm.aadharCard}
              onChange={handleEditFormChange}
              fullWidth
            />
            <TextField
              label="PAN Card"
              name="panCard"
              value={editForm.panCard}
              onChange={handleEditFormChange}
              fullWidth
            />
            <Box sx={{ position: 'relative' }}>
              <TextField
                label="Wallet Balance"
                name="wallet"
                type="number"
                value={editForm.wallet}
                onChange={handleEditFormChange}
                fullWidth
                InputProps={{
                  startAdornment: <span style={{ marginRight: '8px' }}>₹</span>,
                  readOnly: walletFieldLocked,
                  sx: walletFieldLocked ? { 
                    backgroundColor: 'rgba(0, 0, 0, 0.09)', 
                    cursor: 'not-allowed' 
                  } : {}
                }}
              />
              {walletFieldLocked && (
                <Tooltip title="Unlock wallet balance field">
                  <IconButton
                    sx={{ position: 'absolute', right: 8, top: 8 }}
                    onClick={handleWalletFieldUnlockRequest}
                  >
                    <KeyIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            <TextField
              label="Minimum FasTag Balance"
              name="minFasTagBalance"
              type="number"
              value={editForm.minFasTagBalance || ''}
              onChange={handleEditFormChange}
              fullWidth
              helperText="Custom minimum balance required for FasTag registration (leave empty to use default 400)"
            />
            {/* <TextField
              label="Minimum RSA Balance"
              name="minRSABalance"
              type="number"
              value={editForm.minRSABalance || ''}
              onChange={handleEditFormChange}
              fullWidth
              helperText="Custom minimum balance required for RSA registration (leave empty to use default 400)"
            /> */}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Assign User Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)}>
        <DialogTitle>Assign User to Sub-Admin</DialogTitle>
        <DialogContent>
          <Box sx={{ minWidth: 300, mt: 2 }}>
            <Typography variant="body1" gutterBottom>
              Assign {assigningUser?.displayName || assigningUser?.email || 'user'} to:
            </Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Select Sub-Admin</InputLabel>
              <Select
                value={selectedSubAdmin}
                onChange={(e) => setSelectedSubAdmin(e.target.value)}
                label="Select Sub-Admin"
              >
                {subAdmins.map((admin) => (
                  <MenuItem key={admin.id} value={admin.id}>
                    {admin.displayName || admin.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAssignUser} 
            variant="contained" 
            color="primary"
            disabled={!selectedSubAdmin}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Keep Wallet Access Dialog but remove Wallet Password Dialog */}
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
              Please enter the wallet access password to edit wallet balance:
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
            disabled={!walletAccessPassword}
          >
            Unlock
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

export default Users; 