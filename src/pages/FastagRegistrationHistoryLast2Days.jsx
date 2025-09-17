import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import FastagRegistrationHistoryLast2Days from '../components/FastagRegistrationHistoryLast2Days';

function FastagRegistrationHistoryLast2DaysPage() {
  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <FastagRegistrationHistoryLast2Days />
      </Box>
    </Container>
  );
}

export default FastagRegistrationHistoryLast2DaysPage;
