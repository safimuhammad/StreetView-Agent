import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { TextField, IconButton, Typography, Box, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// eslint-disable-next-line no-unused-vars
function ChatInterface({ setMapCenter, mapRef, marker }) {
  // Local chat input/messages
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);
  const start_marker = marker;
  console.log(start_marker, "start_marker");

  const socketRef = useRef(null);
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket opened');
    };
    ws.onclose = () => {
      console.log('WebSocket closed');
    };

    // Cleanup if component unmounts
    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    const ws = socketRef.current;
    if (!ws) return; // If not yet set up

    ws.onmessage = (event) => {
      if (isPaused) return;  // skip handling if paused
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (err) {
        console.warn('Non-JSON or parse error, raw data:', event.data, err);
      }
    };
  }, [isPaused]); 

  const handleServerMessage = (data) => {
    // Get current tempCoords from localStorage
    const currentTempCoords = JSON.parse(localStorage.getItem('tempCoords'));
    console.log('Current tempCoords:', currentTempCoords);
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    switch (data.type) {
      case 'NAVIGATE':
        handleNavigate(data);
        break;
      case 'PAN_CAMERA':
        handlePanCamera(data);
        break;
      case 'SATELLITE_SNAPSHOT':
        takeSatelliteViewSnapshot(data);
        break;
      case 'END':
        setMessages((prev) => [...prev, { role: 'assistant', content: `END: ${data.thought}`, type: 'END' }]);
        break;
      case 'ERROR':
        console.log("ERROR Caught, sending back");
        captureAndSendSnapshot(true);
        break;
      default:
        console.log('Unhandled message type:', data.type, data);
    }
  };

  const handlePanCamera = async (data) => {
    if (!mapRef?.current) return;
    const streetView = mapRef.current.getStreetView();
    streetView.setPov({ heading:data.heading, pitch: 0 });
    if(data.heading){
        console.log(data.heading, "heading in pan camera");
        streetView.setPov({ heading:data.heading%360, pitch: 0 });
    }
    streetView.setVisible(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Capture and send snapshot
    await captureAndSendSnapshot();

    setMessages((prev) => [
      ...prev,
      { 
        role: 'assistant', 
        content: `Panning camera, ${data.thought || ` ${data.pano || `${data.lat},${data.lng}`}`}`,
        type: 'PAN_CAMERA'
      }
    ]);

  }
  const handleNavigate =async (data) => {
    if (!mapRef?.current) return;
    const streetView = mapRef.current.getStreetView();

    if (data.lat && data.lng) {
      streetView.setPosition({ lat: data.lat, lng: data.lng });
    } else if (data.pano) {
      streetView.setPano(data.pano);
    }

    if (data.heading) {
        console.log(data.heading, " in NAVIGATE");
      streetView.setPov({ heading: data.heading, pitch: 0 });

    }


    streetView.setVisible(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Capture and send snapshot
    await captureAndSendSnapshot();


    setMessages((prev) => [
      ...prev,
      { 
        role: 'assistant', 
        content: `Navigating ${data.thought || `Navigating to ${data.pano || `${data.lat},${data.lng}`}`}`,
        type: 'NAVIGATE'
      }
    ]);
  };

  const captureAndSendSnapshot = async (error=false) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('Socket is not open for sending snapshot');
      return;
    }
    const snapshot = await takeStreetViewSnapshot();
    console.log(snapshot, "snapshot");
    if (!snapshot) return;

    
    const message = error 
      ? { type: 'STREETVIEW_SNAPSHOT', ...snapshot, user_query: "Error in previous response please only respond using function calls" }
      : { type: 'STREETVIEW_SNAPSHOT', ...snapshot, user_query: input };
    console.log(message, "message");
    ws.send(JSON.stringify(message));
    console.log('Snapshot + links sent to backend');
  };

  const takeStreetViewSnapshot = async () => {
    try {
      if (!mapRef?.current) return null;
      const streetView = mapRef.current.getStreetView();
      if (!streetView.getVisible()) {
        console.warn('Street View is not visible, cannot take snapshot.');
        return null;
      }
      setMessages((prev) => [
        ...prev,
        { 
          role: 'assistant', 
          content: "Thinking...",
          type: 'thinking'
        }
      ]);

      const panoId = streetView.getPano();
      const pos = streetView.getPosition();
      const pov = streetView.getPov();
      const links = streetView.getLinks() || [];
      

      // Add navigation direction to each link
      const linksWithDirections = links.map(link => ({
        heading: link.heading,
        description: link.description,
        pano: link.pano,
        navigation_direction: getDirectionFromHeading(link.heading)
      }));

      console.log(linksWithDirections, "links with directions");

      const lat = pos?.lat();
      const lng = pos?.lng();

      // Save current position to localStorage
      const tempCoords = { lat, lng };
      localStorage.setItem('tempCoords', JSON.stringify(tempCoords));
      console.log('Saved tempCoords:', tempCoords);

      // Build the Street View Static API URL
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      const width = 400, height = 400, fov = 80;
      const staticUrl =
        `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}`
        + `&location=${lat},${lng}`
        + `&heading=${pov.heading}`
        + `&pitch=${pov.pitch}`
        + `&fov=${fov}`
        + `&key=${apiKey}`;

      // Fetch the image as a Blob
      const res = await fetch(staticUrl);
      if (!res.ok) throw new Error('Failed to fetch Street View snapshot');

      const imageBlob = await res.blob();
      const base64String = await blobToBase64(imageBlob);
      console.log(imageBlob, "imageBlob");
      
      return {
        panoId,
        lat,
        lng,
        heading: pov.heading,
        pitch: pov.pitch,
        image: base64String,
        marker: start_marker,
        links: linksWithDirections
      };
    } catch (err) {
      console.error('Error capturing Street View snapshot:', err);
      return null;
    }
  };

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(',')[1];
        resolve(base64data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  function getDirectionFromHeading(heading) {
    // Normalize heading to [0, 360)
    let normalized = heading % 360;
    if (normalized < 0) {
      normalized += 360;
    }
    const offset = 22.5;
    const adjusted = (normalized + offset) % 360;
  
    // Determine which 45° slice the angle falls into
    const directionIndex = Math.floor(adjusted / 45);
  
    // Map the slice index to the corresponding compass direction
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  
    return directions[directionIndex];
  }

  async function takeSatelliteViewSnapshot(data) {
    try {
      // Make sure mapRef is available
      if (!mapRef?.current) {
        console.warn('Map reference is not available');
        return null;
      }
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('Socket is not open for sending snapshot');
        return;
      }
  
      // 1. Grab the Google Map instance from mapRef
      const map = mapRef.current;

      // Get tempCoords from localStorage
      const tempCoords = JSON.parse(localStorage.getItem('tempCoords'));
      console.log('Retrieved tempCoords:', tempCoords);
      
      let coords;
      if (data?.lat === 0 && data?.lng === 0) {
        if (tempCoords) {
          coords = tempCoords;
        } else {
          coords = start_marker;
        }
      } else {
        coords = data;
      }

      console.log(coords.lat, coords.lng, "coords");
      const zoom = map.getZoom();
  
      // 3. Construct the Static Maps API URL with satellite map type and a marker
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      const width = 400;
      const height = 400;
      const staticMapUrl = 
        `https://maps.googleapis.com/maps/api/staticmap?` +
        `center=${coords.lat},${coords.lng}&` +
        `zoom=${zoom}&` +
        `size=${width}x${height}&` +
        `maptype=satellite&` +
        // Marker at the same position
        `markers=color:red||label:A|${coords.lat},${coords.lng}&` +
        `markers=color:blue|label:B|${start_marker?.lat+0.2},${start_marker?.lat+0.32}&` +
        `key=${apiKey}`;
  
      // 4. Fetch the static map image as a Blob
      const response = await fetch(staticMapUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch satellite snapshot');
      }
      const blob = await response.blob();
  
      // 5. Convert the Blob into a Base64 string (reuse your existing blobToBase64 function)
      const base64String = await blobToBase64(blob);
      const snapshot = {
        lat: coords.lat,
        lng: coords.lng,
        zoom,
        image: base64String // base64-encoded PNG/JPEG
      };
  
      // Return an object that can be sent to your backend or displayed in the UI
      ws.send(JSON.stringify({ type:'STREETVIEW_SNAPSHOT', ...snapshot, user_query: "Here is the requested satellite view for the current location" }));
      console.log("Sent Sattelite Snapshot to backend",snapshot);
      return {
        lat: coords.lat,
        lng: coords.lng,
        zoom,
        image: base64String // base64-encoded PNG/JPEG
      };
    } catch (error) {
      console.error('Error taking satellite view snapshot:', error);
      return null;
    }
  }

  // Sending user queries
  const handleSend = async () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: input }]);

    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('Socket is not open for sending user query');
      setInput('');
      return;
    }
    const coords = {"lat": marker.lat,"lng": marker.lng}
    const userQueryMessage = {
      type: 'NAVIGATE',
      query: input,
      lat: coords.lat,
      lng: coords.lng,
      heading: 0
    };
    // ws.send(JSON.stringify(userQueryMessage));
    handleNavigate(userQueryMessage);
   

    setInput('');
  };
  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const getMessageStyle = (role, type) => {
    if (role === 'assistant') {
      switch (type) {
        case 'PAN_CAMERA':
          return {
            background: 'rgba(223, 237, 49, 0.1)',
            borderLeft: '4px solid #dfed31',
            color: '#dfed31'
          };
        case 'NAVIGATE':
          return {
            background: 'rgba(132, 132, 239, 0.1)',
            borderLeft: '4px solid #8484ef',
            color: '#8484ef'
          };
        case 'END':
          return {
            background: 'rgba(117, 243, 65, 0.1)',
            borderLeft: '4px solid #75f341',
            color: '#75f341'
          };
        case 'thinking':
          return {
            background: 'rgba(243, 65, 117, 0.1)',
            borderLeft: '4px solid #f34175',
            color: '#f34175'
          };
        default:
          return {
            background: 'rgba(144, 202, 249, 0.1)',
            borderLeft: '4px solid #90caf9',
            color: '#90caf9'
          };
      }
    }
    return {
      background: 'rgba(255, 255, 255, 0.05)',
      borderLeft: '4px solid #ffffff',
      color: '#ffffff'
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <Box 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        p: 2
      }}
    >
      {/* Header */}
      <Typography 
        variant="h4" 
        sx={{ 
          mb: 3,
          color: 'primary.main',
          fontWeight: 700,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          fontSize: '1.5rem',
          fontFamily: "'Orbitron', sans-serif",
          textShadow: '0 0 10px rgba(144, 202, 249, 0.3)',
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: '-8px',
            left: '0',
            width: '60px',
            height: '3px',
            background: 'linear-gradient(90deg, #90caf9 0%, rgba(144, 202, 249, 0) 100%)',
            borderRadius: '2px'
          }
        }}
      >
        Command Center
      </Typography>

      {/* Messages Area */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          mb: 2,
          p: 2,
          overflowY: 'auto',
          bgcolor: 'background.paper',
          borderRadius: 2,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255, 255, 255, 0.05)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
          }
        }}
      >
        <Box sx={{ py: 2 }}>
          {messages.map((msg, idx) => {
            const messageStyle = getMessageStyle(msg.role, msg.type);
            
            return (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    maxWidth: '85%',
                    p: 1.5,
                    borderRadius: '4px',
                    ...messageStyle
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: '0.95rem',
                      lineHeight: 1.5,
                      letterSpacing: '0.2px'
                    }}
                  >
                    <Box component="span" sx={{ 
                      opacity: 0.8, 
                      fontSize: '0.85rem',
                      display: 'block',
                      mb: 0.5 
                    }}>
                      {msg.role.toUpperCase()}
                    </Box>
                    {msg.content}
                  </Typography>
                </Paper>
              </Box>
            );
          })}
          <div ref={messagesEndRef} />
        </Box>
      </Paper>

      {/* Input Area */}
      <Box 
        sx={{ 
          display: 'flex', 
          gap: 1, 
          alignItems: 'center',
          bgcolor: 'background.paper',
          p: 1,
          borderRadius: 2
        }}
      >
        <TextField
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask the agent or give a command..."
          variant="outlined"
          fullWidth
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
              '& fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
              '&:hover fieldset': {
                borderColor: 'primary.main',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              }
            },
            '& .MuiInputBase-input': {
              color: 'white',
              fontSize: '0.95rem',
              padding: '10px 14px',
            }
          }}
        />

        <IconButton 
          onClick={handleSend}
          sx={{
            bgcolor: 'primary.main',
            color: 'background.paper',
            '&:hover': { 
              bgcolor: 'primary.dark',
            },
            p: 1,
            borderRadius: 1.5
          }}
        >
          <SendIcon fontSize="small" />
        </IconButton>

        <IconButton
          onClick={togglePause}
          sx={{
            bgcolor: 'primary.main',
            color: 'background.paper',
            '&:hover': { 
              bgcolor: 'primary.dark',
            },
            p: 1,
            borderRadius: 1.5
          }}
        >
          {isPaused ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
  );
}

ChatInterface.propTypes = {
  setMapCenter: PropTypes.func.isRequired,
  mapRef: PropTypes.shape({
    current: PropTypes.any
  }).isRequired,
  marker: PropTypes.shape({
    lat: PropTypes.number,
    lng: PropTypes.number
  })
};

export default ChatInterface;