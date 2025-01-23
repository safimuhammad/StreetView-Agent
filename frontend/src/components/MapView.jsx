import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { GoogleMap, LoadScript, MarkerF } from '@react-google-maps/api';
import { Box } from '@mui/material';

function MapView({mapCenter, mapRef, marker, setMarker}) {
    // eslint-disable-next-line no-unused-vars
    const [_userLocation, _setUserLocation] = useState(null);

  const onMapLoad = useCallback((mapInstance) => {
    if (mapRef) {
        mapRef.current = mapInstance;
    }
  }, [mapRef]);

  const onMapClick = useCallback((event) => {
    const newMarker = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };
    setMarker(newMarker);
    console.log('Marker position:', newMarker);
  }, [setMarker]);

  useEffect(() => {
    getUserLocation();
  }, []);

  if (!mapCenter) {
    return <div>Map center not specified...</div>;
  }

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          _setUserLocation({ lat: latitude, lng: longitude });
          console.log({ latitude, longitude });
        },
        (error) => {
          console.error('Geolocation error:', error);
          _setUserLocation({ lat: 40.748817, lng: -73.985428 });
        }
      );
    } else {
      console.error('Browser does not support geolocation');
      _setUserLocation({ lat: 40.748817, lng: -73.985428 });
    }
  };
  return (
    <Box sx={{ height: '100vh', width: '100vw' }}>
      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          center={{"lat": 36.28036, "lng": -115.2619504}}
          zoom={14}
          onLoad={onMapLoad}
          onClick={onMapClick}
          mapContainerStyle={{ width: '100%', height: '100%' }}
          options={{
            styles: [
              {
                featureType: 'all',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#ffffff' }]
              },
              {
                featureType: 'all',
                elementType: 'labels.text.stroke',
                stylers: [{ color: '#000000' }, { lightness: 13 }]
              },
              {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#0e1626' }]
              },
              {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#1c2541' }]
              }
            ]
          }}
        >
          {marker && <MarkerF position={marker} />}
        </GoogleMap>
      </LoadScript>
    </Box>
  );
}

MapView.propTypes = {
  mapCenter: PropTypes.shape({
    lat: PropTypes.number,
    lng: PropTypes.number
  }),
  mapRef: PropTypes.shape({
    current: PropTypes.any
  }),
  marker: PropTypes.shape({
    lat: PropTypes.number,
    lng: PropTypes.number
  }),
  setMarker: PropTypes.func.isRequired
};

export default MapView;