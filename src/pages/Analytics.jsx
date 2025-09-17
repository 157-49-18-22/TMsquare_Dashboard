import { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, CircularProgress, Card, CardContent, Divider } from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

function Analytics() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState([]);
  const [fastagData, setFastagData] = useState([]);
  const [fastagStatusData, setFastagStatusData] = useState([]);
  const [assignmentData, setAssignmentData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const db = getFirestore();
      
      // Fetch users data
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const users = [];
      
      usersSnapshot.forEach(doc => {
        users.push({ id: doc.id, ...doc.data() });
      });
      
      setUserData(users);
      
      // Fetch FastTag data
      const fastagRef = collection(db, 'fastags');
      const fastagSnapshot = await getDocs(fastagRef);
      const fastags = [];
      
      fastagSnapshot.forEach(doc => {
        fastags.push({ id: doc.id, ...doc.data() });
      });
      
      setFastagData(fastags);
      
      // Process data for charts
      processChartData(users, fastags);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (users, fastags) => {
    // Process FastTag status distribution
    const statusCounts = {
      available: 0,
      assigned: 0,
      active: 0,
      inactive: 0,
      pending: 0
    };
    
    fastags.forEach(fastag => {
      const status = fastag.status || 'unknown';
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      } else if (status === 'unknown') {
        // Handle unknown status
      }
    });
    
    const statusData = Object.keys(statusCounts).map(key => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: statusCounts[key]
    }));
    
    setFastagStatusData(statusData);
    
    // Process assignment data
    const subAdmins = users.filter(user => user.role === 'subAdmin');
    const subAdminCounts = {};
    
    subAdmins.forEach(admin => {
      subAdminCounts[admin.id] = 0;
    });
    
    fastags.forEach(fastag => {
      if (fastag.assignedTo && subAdminCounts[fastag.assignedTo] !== undefined) {
        subAdminCounts[fastag.assignedTo]++;
      }
    });
    
    const assignmentChartData = subAdmins.map(admin => ({
      name: admin.displayName || admin.email || admin.id,
      value: subAdminCounts[admin.id] || 0
    })).sort((a, b) => b.value - a.value).slice(0, 5); // Top 5 admins by assignment
    
    setAssignmentData(assignmentChartData);
    
    // Create monthly data (mock for now)
    // In a real app, you would aggregate by month from timestamps
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const mockMonthlyData = months.map((month, index) => ({
      name: month,
      users: Math.floor(Math.random() * 50) + 10,
      fastags: Math.floor(Math.random() * 30) + 5
    }));
    
    setMonthlyData(mockMonthlyData);
  };

  // Define chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD'];
  const STATUS_COLORS = {
    available: '#4CAF50',
    assigned: '#2196F3',
    active: '#9C27B0',
    inactive: '#F44336',
    pending: '#FF9800'
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics Overview
      </Typography>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Users</Typography>
              <Typography variant="h3">{userData.filter(user => user.role !== 'admin').length}</Typography>
              <Typography variant="body2" color="textSecondary">
                {userData.filter(user => user.role === 'subAdmin').length} Sub-Admins
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total FastTags</Typography>
              <Typography variant="h3">{fastagData.length}</Typography>
              <Typography variant="body2" color="textSecondary">
                {fastagData.filter(tag => tag.assignedTo).length} Assigned
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Active FastTags</Typography>
              <Typography variant="h3">
                {fastagData.filter(tag => tag.status === 'active').length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {((fastagData.filter(tag => tag.status === 'active').length / fastagData.length) * 100).toFixed(1)}% of total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Available FastTags</Typography>
              <Typography variant="h3">
                {fastagData.filter(tag => tag.status === 'available').length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Ready for assignment
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Monthly Activity
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                  name="New Users"
                />
                <Line 
                  type="monotone" 
                  dataKey="fastags" 
                  stroke="#82ca9d"
                  name="FastTags Issued" 
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              FastTag Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fastagStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fastagStatusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STATUS_COLORS[entry.name.toLowerCase()] || COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Top FastTag Assignments by Sub-Admin
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={assignmentData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="FastTags Assigned" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              User Role Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Regular Users', value: userData.filter(user => user.role === 'user').length },
                    { name: 'Sub Admins', value: userData.filter(user => user.role === 'subAdmin').length },
                    { name: 'Admins', value: userData.filter(user => user.role === 'admin').length }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Analytics; 