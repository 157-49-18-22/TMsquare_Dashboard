import {
  Box,
  Paper,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';

function Settings() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              General Settings
            </Typography>
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Enable Notifications"
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={<Switch />}
                label="Dark Mode"
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Auto Save"
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Profile Settings
            </Typography>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Display Name"
                defaultValue="Admin User"
                margin="normal"
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Email"
                defaultValue="admin@example.com"
                margin="normal"
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Language</InputLabel>
                <Select
                  defaultValue="en"
                  label="Language"
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Settings
            </Typography>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="API Key"
                defaultValue="sk_test_123456789"
                margin="normal"
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Webhook URL"
                defaultValue="https://api.example.com/webhook"
                margin="normal"
              />
            </Box>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined">Reset</Button>
              <Button variant="contained">Save Changes</Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Settings; 