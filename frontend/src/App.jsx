import { useState, useRef } from 'react';
import MapView from './components/MapView';
import ChatInterface from './components/ChatInterface';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, Paper, CssBaseline } from '@mui/material';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d',
    },
  },
});

function App() {
  const [mapCenter, setMapCenter] = useState({ lat: 40.748817, lng: -73.985428 }); // null until we get it
  const [marker, setMarker] = useState(null);
  const mapRef = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const [loadingLocation, setLoadingLocation] = useState(true);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          padding: 2,
          bgcolor: 'background.default',
          overflow: 'hidden', // Prevent outer scrollbars
          boxSizing: 'border-box'
        }}
      >
        {/* Map Container */}
        <Paper
          elevation={6}
          sx={{
            width: '60%',
            height: '100%',
            overflow: 'hidden',
            margin: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2 // Remove border radius to prevent corner gaps
          }}
        >
          <MapView
            mapCenter={mapCenter}
            mapRef={mapRef}
            marker={marker}
            setMarker={setMarker}
          />
        </Paper>

        {/* Chat Interface Container */}
        <Paper
          elevation={6}
          sx={{
            width: '35%',
            height: '100%',
            display: 'flex',
            margin: 1,
            flexDirection: 'column',
            borderRadius: 2, // Remove border radius to prevent corner gaps
            bgcolor: 'background.paper'
          }}
        >
          <ChatInterface
            setMapCenter={setMapCenter}
            mapRef={mapRef}
            marker={marker}
          />
        </Paper>
      </Box>
    </ThemeProvider>
  );
}


export default App;