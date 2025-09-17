import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import FastagRegistrationHistory from '../components/FastagRegistrationHistory';

function FastagRegistrationHistoryPage() {
  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <FastagRegistrationHistory />
      </Box>
    </Container>
  );
}

export default FastagRegistrationHistoryPage; 