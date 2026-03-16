import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import chroma from 'chroma-js';
import PropTypes from 'prop-types';

// Custom comparison function to prevent unnecessary re-renders
const areEqual = (prevProps, nextProps) => {
  // Only re-render if data actually changed (by reference)
  if (prevProps.data !== nextProps.data) return false;
  if (prevProps.colorScale !== nextProps.colorScale) return false;
  if (prevProps.onHover !== nextProps.onHover) return false;
  return true;
};

const GravityMap = forwardRef(({ data, onHover, colorScale = 'Default (Red-Blue)' }, ref) => {
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const mapContainerRef = useRef(null);
  const throttledUpdateRef = useRef(null);
  const visibleDataRef = useRef([]); // Keep track of visible data without re-rendering
  const isMapReadyRef = useRef(false); // Track if map is ready for updates

  // Color scales mapping - moved outside component or memoized
  const colorScales = React.useMemo(() => ({
    'Default (Red-Blue)': ['#b2182b', '#f7f7f7', '#2166ac'],
    'Viridis': ['#440154', '#21918c', '#fde725'],
    'Plasma': ['#0d0887', '#9c179e', '#ed7953'],
    'Inferno': ['#000004', '#b40426', '#f0f921'],
    'Magma': ['#000004', '#b5367a', '#fcfdbf'],
    'Cividis': ['#00204d', '#7c7b78', '#ffe100']
  }), []);

  // Get color scale function - memoized
  const getColorScale = useCallback(() => {
    const colors = colorScales[colorScale] || colorScales['Default (Red-Blue)'];
    return chroma.scale(colors).domain([-50, 0, 50]);
  }, [colorScale, colorScales]);

  // Function to filter data to visible bounds - memoized
  const filterVisibleData = useCallback(() => {
    if (!mapRef.current || !data) return [];
    
    const bounds = mapRef.current.getBounds();
    const visible = data.filter(point => 
      point.lat >= bounds.getSouth() && 
      point.lat <= bounds.getNorth() &&
      point.lng >= bounds.getWest() && 
      point.lng <= bounds.getEast()
    );
    
    // Only log if count changed significantly
    if (Math.abs(visible.length - visibleDataRef.current.length) > 100) {
      console.log(`Rendering ${visible.length}/${data.length} visible cells`);
    }
    
    visibleDataRef.current = visible;
    return visible;
  }, [data]);

  // Update map layers with visible data - memoized
  const updateMapLayers = useCallback((visible) => {
    if (!mapRef.current || !visible || !isMapReadyRef.current) return;
    
    // Clear existing layer
    if (layerRef.current) {
      mapRef.current.removeLayer(layerRef.current);
    }

    if (visible.length === 0) return;

    // Create new layer with visible data
    layerRef.current = L.layerGroup().addTo(mapRef.current);
    const colorScaleFn = getColorScale();

    // Use requestAnimationFrame for smoother rendering
    requestAnimationFrame(() => {
      visible.forEach(point => {
        if (point.value !== null && !isNaN(point.value)) {
          const color = colorScaleFn(point.value).hex();
          
          const rect = L.rectangle(
            [[point.lat - 1, point.lng - 1], [point.lat + 1, point.lng + 1]],
            {
              color: color,
              weight: 0,
              fillColor: color,
              fillOpacity: 0.7,
              interactive: true
            }
          );

          rect.on('mouseover', () => {
            onHover(point);
            rect.setStyle({ fillOpacity: 0.9, weight: 1, color: '#333' });
          });

          rect.on('mouseout', () => {
            onHover(null);
            rect.setStyle({ fillOpacity: 0.7, weight: 0 });
          });

          rect.addTo(layerRef.current);
        }
      });
    });
  }, [getColorScale, onHover]);

  // Handle map movement with throttling
  useEffect(() => {
    if (!mapRef.current || !isMapReadyRef.current) return;

    const handleMove = () => {
      if (throttledUpdateRef.current) {
        clearTimeout(throttledUpdateRef.current);
      }
      
      throttledUpdateRef.current = setTimeout(() => {
        const visible = filterVisibleData();
        updateMapLayers(visible);
      }, 100); // Throttle to 100ms
    };

    mapRef.current.on('moveend', handleMove);
    
    return () => {
      if (mapRef.current) {
        mapRef.current.off('moveend', handleMove);
      }
      if (throttledUpdateRef.current) {
        clearTimeout(throttledUpdateRef.current);
      }
    };
  }, [filterVisibleData, updateMapLayers]);

  // Expose map methods to parent components
  useImperativeHandle(ref, () => ({
    flyToBounds: (bounds, options) => {
      if (mapRef.current) {
        mapRef.current.flyToBounds(bounds, options);
      }
    },
    flyTo: (center, zoom, options) => {
      if (mapRef.current) {
        mapRef.current.flyTo(center, zoom, options);
      }
    },
    getMap: () => mapRef.current,
    getBounds: () => mapRef.current?.getBounds(),
    invalidateSize: () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        // Re-render visible data after resize
        setTimeout(() => {
          const visible = filterVisibleData();
          updateMapLayers(visible);
        }, 100);
      }
    },
    refresh: () => {
      // Force refresh of visible data
      const visible = filterVisibleData();
      updateMapLayers(visible);
    }
  }));

  // Initialize map
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      // Initialize map with scrollWheelZoom disabled to prevent page scrolling issues
      mapRef.current = L.map(mapContainerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        fadeAnimation: true, // Enable fade animations for smoother rendering
        zoomAnimation: true
      }).setView([20, 0], 2);
      
      // Add zoom control to top-left
      mapRef.current.zoomControl.setPosition('topleft');

      // Add base map tiles with caching
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 19,
        crossOrigin: true, // Enable CORS for better caching
        keepBuffer: 4 // Keep more tiles in buffer for smoother panning
      }).addTo(mapRef.current);

      // Add zoom instruction message
      const scrollMessage = L.control({ position: 'bottomright' });
      scrollMessage.onAdd = function() {
        const div = L.DomUtil.create('div', 'scroll-message');
        div.innerHTML = '🔍 Use + / - buttons to zoom';
        div.style.backgroundColor = 'white';
        div.style.padding = '5px 10px';
        div.style.borderRadius = '4px';
        div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        div.style.fontSize = '12px';
        div.style.margin = '10px';
        div.style.opacity = '0.8';
        return div;
      };
      scrollMessage.addTo(mapRef.current);

      // Add scale control
      L.control.scale({ imperial: true, metric: true }).addTo(mapRef.current);

      // Mark map as ready
      isMapReadyRef.current = true;

      // Initial render after map is ready
      setTimeout(() => {
        if (data && data.length > 0) {
          const visible = filterVisibleData();
          updateMapLayers(visible);
        }
      }, 100);
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (throttledUpdateRef.current) {
        clearTimeout(throttledUpdateRef.current);
      }
      isMapReadyRef.current = false;
    };
  }, []); // Empty deps - only run once

  // Initial render of data - separate effect for data changes
  useEffect(() => {
    if (!mapRef.current || !data || data.length === 0 || !isMapReadyRef.current) return;

    // Debounce data updates
    const timeoutId = setTimeout(() => {
      const visible = filterVisibleData();
      updateMapLayers(visible);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [data, filterVisibleData, updateMapLayers]);

  // Handle empty data state
  if (!data || data.length === 0) {
    return (
      <div 
        ref={mapContainerRef} 
        style={{ 
          height: '600px', 
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}
      >
        <p style={{ color: '#666', fontSize: '16px' }}>
          No gravity data available
        </p>
      </div>
    );
  }

  return (
    <div 
      id="map" 
      ref={mapContainerRef} 
      style={{ 
        height: '600px', 
        width: '100%',
        borderRadius: '4px',
        border: '1px solid #ddd'
      }} 
    />
  );
});

// PropTypes for type checking
GravityMap.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired
  })),
  onHover: PropTypes.func,
  colorScale: PropTypes.oneOf([
    'Default (Red-Blue)',
    'Viridis',
    'Plasma',
    'Inferno',
    'Magma',
    'Cividis'
  ])
};

// Default props
GravityMap.defaultProps = {
  data: [],
  onHover: () => {},
  colorScale: 'Default (Red-Blue)'
};

// Display name for debugging
GravityMap.displayName = 'GravityMap';

// Export memoized version with custom comparison
export default memo(GravityMap, areEqual);