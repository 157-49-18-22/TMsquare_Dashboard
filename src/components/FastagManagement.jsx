import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  IconButton,
  CircularProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Divider,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon,
  Upload as UploadIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, writeBatch } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { exportToExcel, formatDataForExport, importFromExcel, createExcelTemplate, parseExcelFile } from '../utils/excelExport';

const statusColors = {
  available: 'success',
  assigned: 'primary',
  active: 'secondary',
  inactive: 'error',
  pending: 'warning'
};

const FastagManagement = () => {
  const db = getFirestore();
  const [open, setOpen] = useState(false);
  const [fastags, setFastags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFastag, setSelectedFastag] = useState(null);
  const [formValues, setFormValues] = useState({
    serialNo: '',
    tid: '',
    status: 'available',
    assignedTo: '',
    bcId: '',
  });
  const [filter, setFilter] = useState({
    status: '',
    searchTerm: '',
    bcId: '',
  });
  const [bcIdOptions, setBcIdOptions] = useState([]);
  const [subadmins, setSubadmins] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fastagToDelete, setFastagToDelete] = useState(null);
  
  // New state variables for import functionality
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importStats, setImportStats] = useState({
    total: 0,
    added: 0,
    updated: 0,
    errors: 0
  });

  useEffect(() => {
    fetchFastags();
    fetchSubadmins();
    fetchBcIdOptions();
  }, []);

  const fetchBcIdOptions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'fastags'));
      const bcIds = new Set();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.bcId) {
          bcIds.add(data.bcId);
        }
      });
      
      setBcIdOptions(Array.from(bcIds));
    } catch (error) {
      console.error('Error fetching BC_IDs:', error);
    }
  };

  const fetchFastags = async () => {
    setLoading(true);
    try {
      let fastagQuery = collection(db, 'fastags');
      
      // Apply filters if they exist
      if (filter.status) {
        fastagQuery = query(fastagQuery, where('status', '==', filter.status));
      }
      
      // Apply BC_ID filter if it exists
      if (filter.bcId) {
        fastagQuery = query(fastagQuery, where('bcId', '==', filter.bcId));
      }
      
      // Order by creation date
      fastagQuery = query(fastagQuery, orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(fastagQuery);
      const fastagList = [];
      
      querySnapshot.forEach((doc) => {
        fastagList.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // Apply search filter client-side
      let filteredList = fastagList;
      if (filter.searchTerm) {
        const searchTermLower = filter.searchTerm.toLowerCase();
        filteredList = fastagList.filter(
          (fastag) => 
            (fastag.serialNo && fastag.serialNo.toLowerCase().includes(searchTermLower)) ||
            (fastag.tid && fastag.tid.toLowerCase().includes(searchTermLower)) ||
            (fastag.vehicleNo && fastag.vehicleNo.toLowerCase().includes(searchTermLower)) ||
            (fastag.mobileNo && fastag.mobileNo.includes(filter.searchTerm)) ||
            (fastag.bcId && fastag.bcId.toLowerCase().includes(searchTermLower))
        );
      }
      
      setFastags(filteredList);
    } catch (error) {
      console.error('Error fetching FastTags:', error);
      alert('Failed to fetch FastTags');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubadmins = async () => {
    try {
      // Query specifically for subadmin users
      const usersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'subAdmin')
      );
      
      const querySnapshot = await getDocs(usersQuery);
      const adminList = [];
      
      querySnapshot.forEach((doc) => {
        adminList.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      
      console.log('Fetched subadmins:', adminList);
      setSubadmins(adminList);
    } catch (error) {
      console.error('Error fetching subadmins:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues({
      ...formValues,
      [name]: value,
    });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter({
      ...filter,
      [name]: value,
    });
  };

  const handleBcIdChange = (event, newValue) => {
    setFilter({
      ...filter,
      bcId: newValue || '',
    });
  };

  const handleSearch = () => {
    fetchFastags();
  };

  const resetForm = () => {
    setFormValues({
      serialNo: '',
      tid: '',
      status: 'available',
      assignedTo: '',
      bcId: '',
    });
    setSelectedFastag(null);
  };

  const openAddModal = () => {
    resetForm();
    setOpen(true);
  };

  const openEditModal = (fastag) => {
    setSelectedFastag(fastag);
    setFormValues({
      serialNo: fastag.serialNo || '',
      tid: fastag.tid || '',
      status: fastag.status || 'available',
      assignedTo: fastag.assignedTo || '',
      bcId: fastag.bcId || '',
    });
    setOpen(true);
  };

  const handleCloseModal = () => {
    setOpen(false);
  };

  const handleCloseDeleteDialog = () => {
    setConfirmDelete(false);
    setFastagToDelete(null);
  };

  const handleSubmit = async () => {
    if (!formValues.serialNo) {
      alert('Serial number is required');
      return;
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (selectedFastag) {
        // Update existing FastTag
        const fastagRef = doc(db, 'fastags', selectedFastag.id);
        
        await updateDoc(fastagRef, {
          serialNo: formValues.serialNo,
          tid: formValues.tid || null,
          status: formValues.status,
          assignedTo: formValues.assignedTo || null,
          bcId: formValues.bcId || null,
          updatedAt: new Date(),
          updatedBy: user ? user.uid : null,
        });

        alert('FastTag updated successfully');
      } else {
        // Add new FastTag
        const fastagData = {
          serialNo: formValues.serialNo,
          tid: formValues.tid || null,
          status: formValues.status,
          assignedTo: formValues.assignedTo || null,
          bcId: formValues.bcId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: user ? {
            uid: user.uid,
            email: user.email
          } : null,
        };

        // Check if this serial number already exists
        const existingQuery = query(
          collection(db, 'fastags'),
          where('serialNo', '==', formValues.serialNo)
        );
        
        const existingSnapshot = await getDocs(existingQuery);
        
        if (!existingSnapshot.empty) {
          alert('A FastTag with this serial number already exists');
          return;
        }

        await setDoc(doc(collection(db, 'fastags')), fastagData);

        alert('FastTag added successfully');
      }

      handleCloseModal();
      resetForm();
      fetchFastags();
      fetchBcIdOptions();
    } catch (error) {
      console.error('Error saving FastTag:', error);
      alert('Failed to save FastTag');
    }
  };

  const openDeleteConfirmation = (id) => {
    setFastagToDelete(id);
    setConfirmDelete(true);
  };

  const handleDeleteFastag = async () => {
    if (!fastagToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'fastags', fastagToDelete));
      
      alert('FastTag deleted successfully');
      handleCloseDeleteDialog();
      fetchFastags();
    } catch (error) {
      console.error('Error deleting FastTag:', error);
      alert('Failed to delete FastTag');
    }
  };

  const getStatusChip = (status) => {
    return (
      <Chip 
        label={status.charAt(0).toUpperCase() + status.slice(1)} 
        color={statusColors[status] || 'default'} 
        size="small" 
      />
    );
  };

  const handleExportToExcel = () => {
    // Define column mapping for better readability in Excel
    const columnMapping = {
      serialNo: 'Serial Number',
      tid: 'TID',
      status: 'Status',
      vehicleNo: 'Vehicle Number',
      mobileNo: 'Mobile Number',
      bcId: 'BC_ID',
      assignedTo: 'Assigned To',
      assignedToName: 'Assigned To Name',
      createdAt: 'Created Date',
      updatedAt: 'Updated Date'
    };
    
    // Fields to omit from export
    const omitFields = ['id', 'createdBy'];
    
    // Process data to add assignedToName
    const processedData = fastags.map(fastag => {
      let assignedToName = '';
      
      if (fastag.assignedTo) {
        const assignedAdmin = subadmins.find(admin => admin.id === fastag.assignedTo);
        assignedToName = assignedAdmin ? (assignedAdmin.displayName || assignedAdmin.email) : 'Unknown';
      }
      
      return {
        ...fastag,
        assignedToName
      };
    });
    
    // Format and export data
    const formattedData = formatDataForExport(processedData, columnMapping, omitFields);
    exportToExcel(formattedData, 'FasTag_Inventory', 'FasTags');
  };

  // Function to handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImportFile(file);
      setImportPreview(null);
      setImportErrors([]);
      setImportSuccess(false);
      
      // Parse the Excel file to show preview
      parseExcelFile(file, (result) => {
        if (result.success) {
          setImportPreview(result);
        } else {
          setImportErrors([{ message: result.error }]);
        }
      });
    }
  };
  
  // Function to download FasTag import template
  const handleDownloadTemplate = () => {
    const headers = [
      { key: 'serialNo', label: 'Serial Number', description: 'Required - Unique serial number for the FasTag' },
      { key: 'tid', label: 'TID', description: 'Optional - Tag ID for the FasTag' },
      { key: 'status', label: 'Status', description: 'Optional - Status of the FasTag (available, assigned, active, inactive, pending). Default: available' },
      { key: 'bcId', label: 'BC_ID', description: 'Optional - Business Customer ID' },
      { key: 'vehicleNo', label: 'Vehicle Number', description: 'Optional - Associated vehicle number' },
      { key: 'mobileNo', label: 'Mobile Number', description: 'Optional - Associated mobile number' }
    ];
    
    createExcelTemplate(headers, 'FasTag_Import_Template', 'FasTags');
  };
  
  // Function to validate each row during import
  const validateFastagRow = (item, rowNum) => {
    // Required fields
    if (!item.serialNo) {
      return `Row ${rowNum}: Missing required Serial Number`;
    }
    
    // Validate status if provided
    if (item.status && !['available', 'assigned', 'active', 'inactive', 'pending'].includes(item.status)) {
      return `Row ${rowNum}: Invalid status. Must be one of: available, assigned, active, inactive, pending`;
    }
    
    // Validate TID format if provided
    if (item.tid && item.tid.length > 0) {
      if (item.tid.length > 30) {
        return `Row ${rowNum}: TID is too long (max 30 characters)`;
      }
    }
    
    return true;
  };
  
  // Function to import data
  const handleImportFastags = () => {
    if (!importFile) return;
    
    setImportLoading(true);
    setImportErrors([]);
    setImportSuccess(false);
    
    // Define column mapping for import
    const columnMapping = {
      'Serial Number': 'serialNo',
      'TID': 'tid',
      'Status': 'status',
      'BC_ID': 'bcId',
      'Vehicle Number': 'vehicleNo',
      'Mobile Number': 'mobileNo'
    };
    
    importFromExcel(importFile, {
      mapping: columnMapping,
      validateRow: validateFastagRow,
      onSuccess: async (data) => {
        try {
          const auth = getAuth();
          const user = auth.currentUser;
          const userId = user ? user.uid : null;
          
          // Use batch writes for better performance
          const batch = writeBatch(db);
          const stats = { total: data.length, added: 0, updated: 0, errors: 0 };
          const errors = [];
          
          // Map existing fastags by serial number for quick lookup
          const existingFastags = {};
          fastags.forEach(fastag => {
            existingFastags[fastag.serialNo] = fastag;
          });
          
          // Process each row
          for (const item of data) {
            try {
              // Set defaults for missing fields
              const fastagData = {
                serialNo: item.serialNo,
                tid: item.tid || null,
                status: item.status || 'available',
                bcId: item.bcId || null,
                vehicleNo: item.vehicleNo || null,
                mobileNo: item.mobileNo || null,
                updatedAt: new Date(),
                updatedBy: userId
              };
              
              // Check if this is an update or a new addition
              if (existingFastags[item.serialNo]) {
                // Update existing fastag
                const fastagRef = doc(db, 'fastags', existingFastags[item.serialNo].id);
                batch.update(fastagRef, fastagData);
                stats.updated++;
              } else {
                // Add new fastag
                fastagData.createdAt = new Date();
                fastagData.createdBy = userId;
                const newFastagRef = doc(collection(db, 'fastags'));
                batch.set(newFastagRef, fastagData);
                stats.added++;
              }
            } catch (error) {
              errors.push(`Error processing ${item.serialNo}: ${error.message}`);
              stats.errors++;
            }
          }
          
          // Commit the batch
          await batch.commit();
          
          // Update state
          setImportStats(stats);
          setImportSuccess(true);
          setImportErrors(errors);
          
          // Refresh fastag list
          fetchFastags();
        } catch (error) {
          setImportErrors([{ message: `Failed to import: ${error.message}` }]);
          setImportSuccess(false);
        } finally {
          setImportLoading(false);
        }
      },
      onError: (errors) => {
        setImportErrors(errors);
        setImportLoading(false);
        setImportSuccess(false);
      }
    });
  };
  
  // Function to close import dialog
  const handleCloseImportDialog = () => {
    if (!importLoading) {
      setImportDialogOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setImportErrors([]);
      setImportSuccess(false);
    }
  };
  
  // Function to open import dialog
  const openImportDialog = () => {
    setImportDialogOpen(true);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={3} alignItems="center" mb={3}>
          <Grid item xs={12} md={4}>
            {/* <Typography variant="h4" gutterBottom>
              FasTag Inventory Management
            </Typography> */}
          </Grid>
          <Grid item xs={12} md={8}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportToExcel}
              >
                Export to Excel
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={openImportDialog}
              >
                Import from Excel
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openAddModal}
              >
                Add FasTag
              </Button>
            </Stack>
          </Grid>
        </Grid>

        {/* Stats Dashboard */}
        <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f5f5f5' }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>FastTag Overview</Typography>
            </Grid>
            <Grid item xs={6} sm={2}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                <Typography variant="h5">
                  {fastags.filter(tag => tag.status === 'available').length}
                </Typography>
                <Typography variant="body2" color="textSecondary">Available</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={2}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                <Typography variant="h5">
                  {fastags.filter(tag => tag.status === 'assigned').length}
                </Typography>
                <Typography variant="body2" color="textSecondary">Assigned</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={2}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f3e5f5' }}>
                <Typography variant="h5">
                  {fastags.filter(tag => tag.status === 'active').length}
                </Typography>
                <Typography variant="body2" color="textSecondary">Active</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={2}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#ffebee' }}>
                <Typography variant="h5">
                  {fastags.filter(tag => tag.status === 'inactive').length}
                </Typography>
                <Typography variant="body2" color="textSecondary">Inactive</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={2}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fff8e1' }}>
                <Typography variant="h5">
                  {fastags.filter(tag => tag.status === 'pending').length}
                </Typography>
                <Typography variant="body2" color="textSecondary">Pending</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={2}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fafafa' }}>
                <Typography variant="h5">
                  {fastags.length}
                </Typography>
                <Typography variant="body2" color="textSecondary">Total</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Paper>

        {/* Filter and Search */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  name="status"
                  value={filter.status}
                  onChange={handleFilterChange}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="available">Available</MenuItem>
                  <MenuItem value="assigned">Assigned</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
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

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                name="searchTerm"
                value={filter.searchTerm}
                onChange={handleFilterChange}
                placeholder="Search by serial number, TID, vehicle number, or mobile"
                size="small"
              />
            </Grid>

            <Grid item xs={6} sm={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                disabled={loading}
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* FastTags Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Serial Number</TableCell>
                <TableCell>TID</TableCell>
                <TableCell>BC_ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Vehicle Number</TableCell>
                <TableCell>Mobile</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress size={30} />
                  </TableCell>
                </TableRow>
              ) : fastags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No FastTags found
                  </TableCell>
                </TableRow>
              ) : (
                fastags.map((fastag) => (
                  <TableRow key={fastag.id}>
                    <TableCell>{fastag.serialNo}</TableCell>
                    <TableCell>{fastag.tid || '-'}</TableCell>
                    <TableCell>{fastag.bcId || '-'}</TableCell>
                    <TableCell>{getStatusChip(fastag.status || 'unknown')}</TableCell>
                    <TableCell>{fastag.vehicleNo || '-'}</TableCell>
                    <TableCell>{fastag.mobileNo || '-'}</TableCell>
                    <TableCell>
                      {fastag.assignedTo ? (
                        <Chip
                          label={subadmins.find(admin => admin.id === fastag.assignedTo)?.displayName || 
                                subadmins.find(admin => admin.id === fastag.assignedTo)?.email || 
                                fastag.assignedTo}
                          color="info"
                          size="small"
                        />
                      ) : (
                        <span>Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {fastag.createdAt
                        ? new Date(fastag.createdAt.seconds * 1000).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => openEditModal(fastag)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => openDeleteConfirmation(fastag.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>

        {/* Add/Edit Dialog */}
        <Dialog open={open} onClose={handleCloseModal} maxWidth="sm" fullWidth>
          <DialogTitle>
            {selectedFastag ? 'Edit FastTag' : 'Add FastTag'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Stack spacing={3}>
                <TextField
                  required
                  name="serialNo"
                  label="Serial Number"
                  value={formValues.serialNo}
                  onChange={handleInputChange}
                  fullWidth
                />

                <TextField
                  name="tid"
                  label="TID"
                  value={formValues.tid}
                  onChange={handleInputChange}
                  fullWidth
                />

                <TextField
                  name="bcId"
                  label="BC_ID"
                  value={formValues.bcId}
                  onChange={handleInputChange}
                  fullWidth
                />

                <FormControl fullWidth>
                  <InputLabel id="status-label">Status</InputLabel>
                  <Select
                    labelId="status-label"
                    name="status"
                    value={formValues.status}
                    onChange={handleInputChange}
                    label="Status"
                  >
                    <MenuItem value="available">Available</MenuItem>
                    <MenuItem value="assigned">Assigned</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="assigned-to-label">Assign To</InputLabel>
                  <Select
                    labelId="assigned-to-label"
                    name="assignedTo"
                    value={formValues.assignedTo}
                    onChange={handleInputChange}
                    label="Assign To"
                  >
                    <MenuItem value="">
                      <em>None (Not Assigned)</em>
                    </MenuItem>
                    {subadmins.length === 0 ? (
                      <MenuItem disabled>No sub-admins available</MenuItem>
                    ) : (
                      subadmins.map((admin) => (
                        <MenuItem key={admin.id} value={admin.id}>
                          {admin.displayName || admin.email || admin.id} 
                          {admin.email && admin.displayName && ` (${admin.email})`}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                    Assigning a FastTag will make it available for use by the selected sub-admin.
                  </Typography>
                </FormControl>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              {selectedFastag ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirm Delete Dialog */}
        <Dialog
          open={confirmDelete}
          onClose={handleCloseDeleteDialog}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete this FastTag? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
            <Button onClick={handleDeleteFastag} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Import Dialog */}
        <Dialog
          open={importDialogOpen}
          onClose={handleCloseImportDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Import FasTags from Excel</DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" gutterBottom>
                Use this tool to bulk import FastTags from an Excel file. Download the template, fill it with your data, and upload it.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ mt: 1 }}
              >
                Download Template
              </Button>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={<CloudUploadIcon />}
                  disabled={importLoading}
                >
                  Select Excel File
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    hidden
                    onChange={handleFileSelect}
                    disabled={importLoading}
                  />
                </Button>
                {importFile && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Selected file: {importFile.name}
                  </Typography>
                )}
              </Grid>
              
              {importPreview && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      File Preview
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        Sheet: {importPreview.sheetNames[0]}
                      </Typography>
                      <Typography variant="body2">
                        Rows: {importPreview.rowCount}
                      </Typography>
                    </Box>
                    
                    {importPreview.headers.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Detected Headers:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {importPreview.headers.map((header, index) => (
                            <Chip 
                              key={index} 
                              label={header} 
                              size="small"
                              color={
                                ['Serial Number', 'TID', 'Status', 'Vehicle Number', 'Mobile Number'].includes(header)
                                ? 'primary' : 'default'
                              }
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    
                    {importPreview.preview.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Data Preview (first 5 rows):
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Row</TableCell>
                                {importPreview.headers.map((header, index) => (
                                  <TableCell key={index}>{header}</TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {importPreview.preview.map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                  <TableCell>{rowIndex + 1}</TableCell>
                                  {importPreview.headers.map((header, cellIndex) => (
                                    <TableCell key={cellIndex}>
                                      {row[cellIndex] !== undefined ? row[cellIndex] : ''}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              )}
              
              {importErrors.length > 0 && (
                <Grid item xs={12}>
                  <Alert severity="error" sx={{ mt: 2 }}>
                    <AlertTitle>Import Errors</AlertTitle>
                    <List dense>
                      {importErrors.map((error, index) => (
                        <ListItem key={index}>
                          <ListItemText primary={error.message || error} />
                        </ListItem>
                      ))}
                    </List>
                  </Alert>
                </Grid>
              )}
              
              {importSuccess && (
                <Grid item xs={12}>
                  <Alert severity="success" sx={{ mt: 2 }}>
                    <AlertTitle>Import Successful</AlertTitle>
                    <Typography variant="body2">
                      Total processed: {importStats.total} records
                    </Typography>
                    <Typography variant="body2">
                      New FasTags added: {importStats.added}
                    </Typography>
                    <Typography variant="body2">
                      Existing FasTags updated: {importStats.updated}
                    </Typography>
                    {importStats.errors > 0 && (
                      <Typography variant="body2">
                        Records with errors: {importStats.errors}
                      </Typography>
                    )}
                  </Alert>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={handleCloseImportDialog}
              disabled={importLoading}
            >
              Close
            </Button>
            <Button 
              onClick={handleImportFastags}
              variant="contained"
              disabled={!importFile || importLoading}
              startIcon={importLoading ? <CircularProgress size={20} /> : <UploadIcon />}
            >
              {importLoading ? 'Importing...' : 'Import Data'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default FastagManagement; 