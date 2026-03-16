import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import './App.css';
import GravityMap from './components/GravityMap';
import YearSlider from './components/YearSlider';
import Legend from './components/Legend';
import PlaybackControls from './components/PlaybackControls';
import RegionSelector from './components/RegionSelector';
import Statistics from './components/Statistics';
import ExportData from './components/ExportData';
// Lazy load the heavy components that aren't needed immediately
const EnhancedExport = lazy(() => import('./components/EnhancedExport'));
const ColorScaleSelector = lazy(() => import('./components/ColorScaleSelector'));
const DataSourceSelector = lazy(() => import('./components/DataSourceSelector'));

import { useGRACEData } from './hooks/useGRACEData';
import graceAPI from './services/graceApi'; 
import ReactGA from 'react-ga4';

// Initialize Google Analytics (only in production)
if (process.env.NODE_ENV === 'production') {
  ReactGA.initialize('G-XXXXXXXXXX');
  ReactGA.send('pageview');
}

// Loading fallback component for lazy-loaded components
const LoadingFallback = () => (
  <div style={{ 
    padding: '1rem', 
    textAlign: 'center', 
    color: '#666',
    background: '#f8f9fa',
    borderRadius: '8px',
    margin: '1rem 0'
  }}>
    <div className="loading-spinner-small" style={{ margin: '0 auto 0.5rem' }}></div>
    <span>Loading component...</span>
  </div>
);

function App() {
  const [selectedYear, setSelectedYear] = useState(2020);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState('land_mascon');
  const [dataSource, setDataSource] = useState('simulated');
  const [hoverValue, setHoverValue] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [colorScale, setColorScale] = useState('Default (Red-Blue)');
  const [viewMode, setViewMode] = useState('global');
  const [isChangingYear, setIsChangingYear] = useState(false);
  const mapRef = useRef(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataQuality, setDataQuality] = useState({ coverage: 0, quality: 'unknown' });
  const pendingYearRef = useRef(selectedYear);
  const yearChangeTimeoutRef = useRef(null);
  
  // Get current year dynamically
  const currentYear = new Date().getFullYear();
  
  // Generate years array from 2002 to current year
  const years = Array.from(
    { length: currentYear - 2001 }, 
    (_, i) => 2002 + i
  );
  
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [selectedRegionName, setSelectedRegionName] = useState('Global');
  
  // Use real GRACE data when dataSource is 'grace'
  const { 
    data: graceData, 
    loading: graceLoading, 
    error: graceError, 
    progress: graceProgress,
    availableDates,
    refreshData
  } = useGRACEData(
    dataSource === 'grace' ? selectedYear : null, 
    selectedMonth, 
    selectedProduct
  );

  // Debug progress updates
  useEffect(() => {
    if (dataSource === 'grace' && graceLoading) {
      console.log(`📊 Progress update: ${graceProgress}% - Loading ${selectedYear} data`);
    }
  }, [graceProgress, graceLoading, dataSource, selectedYear]);

  // Simulated data state
  const [simulatedData, setSimulatedData] = useState([]);

  // ==================== OPTIMIZED CALLBACKS ====================

  // Handle month change - memoized
  const handleMonthChange = useCallback((newMonth) => {
    setSelectedMonth(newMonth);
    
    // If switching to monthly view and we don't have the data, show mini progress
    if (newMonth !== null && dataSource === 'grace') {
      console.log(`Switching to month ${newMonth}`);
    }
  }, [dataSource]);

  // Handle year change with debounce - memoized
  const handleYearChange = useCallback((newYear) => {
    pendingYearRef.current = newYear;
    
    // Clear existing timeout
    if (yearChangeTimeoutRef.current) {
      clearTimeout(yearChangeTimeoutRef.current);
    }
    
    // Set new timeout to actually change year after user stops sliding
    yearChangeTimeoutRef.current = setTimeout(() => {
      setSelectedYear(pendingYearRef.current);
    }, 300); // 300ms debounce
  }, []);

  // Handle hover - memoized
  const handleHover = useCallback((value) => {
    setHoverValue(value);
  }, []);

  // Handle region select - memoized
  const handleRegionSelect = useCallback((bounds, regionName) => {
    if (mapRef.current) {
      mapRef.current.flyToBounds(bounds, { duration: 2 });
    }
    setSelectedRegion(bounds);
    setSelectedRegionName(regionName);
  }, []);

  // Handle reset view - memoized
  const handleResetView = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.flyTo([20, 0], 2, { duration: 2 });
    }
    setSelectedRegionName('Global');
  }, []);

  // Handle data source change - memoized
  const handleDataSourceChange = useCallback((source) => {
    setDataSource(source);
    if (source === 'grace') {
      if (availableDates && availableDates.length > 0) {
        const firstDate = availableDates[0];
        setSelectedYear(firstDate.year);
        if (firstDate.month) setSelectedMonth(firstDate.month);
      }
    }
  }, [availableDates]);

  // Handle refresh data - memoized
  const handleRefreshData = useCallback(async () => {
    if (dataSource === 'grace' && refreshData) {
      await refreshData();
      setLastUpdated(Date.now());
      
      // Update data quality information
      if (availableDates && availableDates.length > 0) {
        const expectedTotal = (currentYear - 2002 + 1) * 12;
        const coverage = ((availableDates.length / expectedTotal) * 100).toFixed(1);
        let quality = 'good';
        if (coverage < 80) quality = 'fair';
        if (coverage < 60) quality = 'poor';
        setDataQuality({ coverage, quality });
      }
    }
  }, [dataSource, refreshData, availableDates, currentYear]);

  // Handle product change - memoized
  const handleProductChange = useCallback((product) => {
    setSelectedProduct(product);
  }, []);

  // Handle color scale change - memoized
  const handleColorScaleChange = useCallback((scale) => {
    setColorScale(scale);
  }, []);

  // Handle view mode change - memoized
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  // Handle play/pause - memoized
  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // Handle speed change - memoized
  const handleSpeedChange = useCallback((speed) => {
    setPlaybackSpeed(speed);
  }, []);

  // Handle clear cache - memoized
  const handleClearCache = useCallback(() => {
    if (window.graceAPI) {
      window.graceAPI.clearCache();
      console.log('Cache cleared manually');
    }
  }, []);

  // Scroll to top - memoized
  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  // ==================== EFFECTS ====================

  // Handle year change loading state
  useEffect(() => {
    if (dataSource === 'grace') {
      setIsChangingYear(true);
      const timer = setTimeout(() => setIsChangingYear(false), 500);
      return () => clearTimeout(timer);
    }
  }, [selectedYear, dataSource]);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animation playback with dynamic end year
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setSelectedYear(prev => {
          const next = prev + 1;
          return next > currentYear ? 2002 : next;
        });
      }, playbackSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed, currentYear]);

  // Preload next year data in background
  useEffect(() => {
    if (dataSource === 'grace' && !graceLoading && graceData) {
      const nextYear = selectedYear + 1;
      if (nextYear <= currentYear) {
        // Check if next year is already cached
        const checkAndPreload = async () => {
          try {
            // Check if graceAPI has the method
            if (typeof graceAPI.getCachedYearData === 'function') {
              const cached = await graceAPI.getCachedYearData(nextYear);
              if (!cached) {
                console.log(`🔄 Background preloading data for ${nextYear}...`);
                // Preload in background without blocking UI
                setTimeout(() => {
                  if (typeof graceAPI.prefetchYear === 'function') {
                    graceAPI.prefetchYear(nextYear, selectedProduct)
                      .then(() => console.log(`✅ Preloaded ${nextYear}`))
                      .catch(err => console.warn(`⚠️ Preload failed for ${nextYear}:`, err));
                  } else {
                    console.log('prefetchYear method not available');
                  }
                }, 2000);
              }
            }
          } catch (err) {
            console.warn('Error checking cache:', err);
          }
        };
        
        checkAndPreload();
      }
    }
  }, [selectedYear, dataSource, graceLoading, graceData, currentYear, selectedProduct]);

  // Generate simulated GRACE gravity anomaly data
  useEffect(() => {
    const data = [];
    const resolution = viewMode === 'detailed' ? 1 : 2;
    
    console.log(`Generating simulated data with resolution: ${resolution}° (${viewMode} mode)`);
    
    for (let lat = -90; lat <= 90; lat += resolution) {
      for (let lng = -180; lng <= 180; lng += resolution) {
        let value = 0;
        
        // Amazon basin (negative anomaly - water loss)
        if (lat > -20 && lat < 5 && lng > -70 && lng < -50) {
          value = -30 + Math.sin((selectedYear - 2000) * 0.3) * 5;
          value += Math.sin((selectedYear - 2000) * 2 * Math.PI) * 3;
        }
        // Himalayas (positive anomaly - tectonic uplift)
        else if (lat > 25 && lat < 35 && lng > 75 && lng < 95) {
          value = 40 + Math.cos((selectedYear - 2000) * 0.2) * 8;
        }
        // Greenland (negative anomaly - ice loss)
        else if (lat > 60 && lat < 80 && lng > -50 && lng < -20) {
          value = -15 - (selectedYear - 2002) * 0.5;
          const elevation = Math.sin((lat - 60) * 0.2) * 5;
          value += elevation;
        }
        // Antarctica (ice mass changes)
        else if (lat < -60 && lat > -90) {
          value = -10 - (selectedYear - 2002) * 0.3;
          if (lng > -120 && lng < -60) value -= 5;
          if (lng > 60 && lng < 150) value += 3;
        }
        // Background with realistic noise
        else {
          value = (Math.random() - 0.5) * 15;
          value += (selectedYear - 2002) * 0.01;
        }
        
        data.push({ lat, lng, value });
      }
    }
    console.log(`Generated ${data.length} data points for ${viewMode} mode`);
    setSimulatedData(data);
  }, [selectedYear, viewMode]);

  // Determine which data to use
  const gravityData = dataSource === 'grace' && graceData ? graceData : simulatedData;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (yearChangeTimeoutRef.current) {
        clearTimeout(yearChangeTimeoutRef.current);
      }
    };
  }, []);

  // ==================== RENDER CONDITIONS ====================

  // Loading overlay for GRACE data
  if (dataSource === 'grace' && graceLoading && !isChangingYear) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <h2>Loading GRACE Data from NASA PO.DAAC</h2>
        <p>Fetching gravity anomaly data for {selectedYear}...</p>
        <div className="loading-progress-bar">
          <div 
            className="loading-progress-fill" 
            style={{ width: `${graceProgress}%` }}
          ></div>
        </div>
        <p className="progress-text">{graceProgress}% complete</p>
        <p className="progress-detail">
          {graceProgress > 0 
            ? `Loading month ${Math.ceil(graceProgress / 8.33)} of 12` 
            : 'Initializing...'}
        </p>
        <p className="loading-note">This may take a moment depending on data availability</p>
        <button 
          className="cancel-loading-btn"
          onClick={() => setDataSource('simulated')}
        >
          Switch to Simulated Data
        </button>
      </div>
    );
  }

  // Error display for GRACE data
  if (dataSource === 'grace' && graceError) {
    return (
      <div className="error-container">
        <h2>⚠️ Error Loading GRACE Data</h2>
        <p>{graceError}</p>
        <p>Would you like to:</p>
        <div className="error-actions">
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
          <button onClick={() => setDataSource('simulated')}>
            Use Simulated Data
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className="App">
      <header className="app-header">
        <h1>🌍 GRACE Gravity Anomaly Visualization</h1>
        <p>Interactive exploration of Earth's gravity field changes (2002-{currentYear})</p>
        <div className="data-source-badge">
          {dataSource === 'grace' ? (
            <span className="badge grace-badge">📡 Real GRACE Data</span>
          ) : (
            <span className="badge sim-badge">🔄 Simulated Data (Demo)</span>
          )}
        </div>
      </header>
      
      <main className="main-container">
        <div className="map-container">
          <GravityMap 
            ref={mapRef}
            data={gravityData} 
            onHover={handleHover}
            colorScale={colorScale}
          />
          <Legend colorScale={colorScale} />
          
          {hoverValue && (
            <div className="hover-info">
              <p><strong>📍 Location:</strong> {hoverValue.lat.toFixed(2)}°N, {hoverValue.lng.toFixed(2)}°E</p>
              <p><strong>📊 Gravity Anomaly:</strong> {hoverValue.value.toFixed(2)} mGal</p>
              <p><strong>📅 {selectedMonth ? 'Month' : 'Year'}:</strong> {selectedYear}{selectedMonth ? `-${selectedMonth.toString().padStart(2, '0')}` : ''}</p>
              <p><strong>📡 Data Source:</strong> {dataSource === 'grace' ? 'Real GRACE' : 'Simulated'}</p>
              <div className="anomaly-indicator" style={{
                backgroundColor: hoverValue.value > 0 ? '#2166ac' : hoverValue.value < 0 ? '#b2182b' : '#f7f7f7',
                height: '5px',
                width: '100%',
                marginTop: '5px',
                borderRadius: '3px'
              }} />
            </div>
          )}
          
          {/* Mini progress indicator for when loading continues in background */}
          {dataSource === 'grace' && graceLoading && graceProgress > 0 && graceProgress < 100 && (
            <div className="loading-progress-mini">
              <div className="loading-spinner-small"></div>
              <div className="loading-progress-bar-mini">
                <div 
                  className="loading-progress-fill-mini" 
                  style={{ width: `${graceProgress}%` }}
                ></div>
              </div>
              <span>Loading {selectedYear}... {graceProgress}%</span>
            </div>
          )}
          
          {/* Small loading indicator for year changes */}
          {isChangingYear && dataSource === 'grace' && (
            <div className="year-loading-indicator">
              <div className="small-spinner"></div>
              <span>Loading {selectedYear} data...</span>
            </div>
          )}
        </div>

        <div className="control-panel">
          <div className="control-row">
            <Suspense fallback={<LoadingFallback />}>
              <DataSourceSelector
                dataSource={dataSource}
                onDataSourceChange={handleDataSourceChange}
                selectedProduct={selectedProduct}
                onProductChange={handleProductChange}
                selectedMonth={selectedMonth}
                onMonthChange={handleMonthChange}
                availableDates={availableDates}
                onRefreshData={handleRefreshData}
                isRefreshing={graceLoading}
                onClearCache={handleClearCache}
                lastUpdated={lastUpdated} 
                dataQuality={dataQuality} 
              />
            </Suspense>
          </div>

          <div className="control-row">
            <RegionSelector onSelectRegion={handleRegionSelect} />
            <button className="reset-btn" onClick={handleResetView}>
              🌐 Reset View
            </button>
          </div>

          <div className="control-row">
            <Suspense fallback={<LoadingFallback />}>
              <ColorScaleSelector 
                onSelectScale={handleColorScaleChange} 
                currentScale={colorScale}
              />
            </Suspense>
            <div className="view-mode-toggle">
              <button 
                className={`mode-btn ${viewMode === 'global' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('global')}
              >
                Global View
              </button>
              <button 
                className={`mode-btn ${viewMode === 'detailed' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('detailed')}
              >
                Detailed View
              </button>
            </div>
          </div>

          <div className="controls">
            <PlaybackControls 
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onSpeedChange={handleSpeedChange}
              speed={playbackSpeed}
            />
            <YearSlider 
              years={years}
              selectedYear={selectedYear}
              onChange={handleYearChange}
              selectedMonth={selectedMonth}
              isMonthly={selectedMonth !== null}
            />
            <p className="year-display">
              📅 {selectedMonth ? 'Month' : 'Year'}: {selectedYear}
              {selectedMonth && `-${selectedMonth.toString().padStart(2, '0')}`}
              {selectedYear === currentYear && <span className="current-year-badge"> (Current)</span>}
            </p>
          </div>

          <div className="data-panel">
            <Statistics data={gravityData} year={selectedYear} />
            <ExportData data={gravityData} year={selectedYear} />
            <Suspense fallback={<LoadingFallback />}>
              <EnhancedExport 
                data={gravityData} 
                year={selectedYear} 
                mapRef={mapRef}
                selectedRegion={selectedRegionName}
              />
            </Suspense>
          </div>
        </div>
        
        <div className="info-panel">
          <h3>About GRACE & Interactive Features</h3>
          <div className="info-grid">
            <div className="info-card">
              <h4>🎮 Interactive Controls</h4>
              <ul>
                <li><strong>Play/Pause</strong> - Animate through years</li>
                <li><strong>Region Jump</strong> - Quick navigation to key areas</li>
                <li><strong>Color Schemes</strong> - Choose different palettes</li>
                <li><strong>Export Data</strong> - Download as CSV</li>
                <li><strong>Statistics</strong> - Real-time data analysis</li>
                <li><strong>Data Source</strong> - Toggle between real/simulated</li>
              </ul>
            </div>
            <div className="info-card">
              <h4>🔬 Key Regions</h4>
              <ul>
                <li><span style={{color: '#b2182b'}}>●</span> <strong>Greenland</strong>: Accelerating ice loss</li>
                <li><span style={{color: '#b2182b'}}>●</span> <strong>Antarctica</strong>: Ice sheet changes</li>
                <li><span style={{color: '#2166ac'}}>●</span> <strong>Himalayas</strong>: Tectonic uplift</li>
                <li><span style={{color: '#b2182b'}}>●</span> <strong>Amazon</strong>: Water storage</li>
              </ul>
            </div>
            <div className="info-card">
              <h4>📈 Trends</h4>
              <p><strong>2002-{currentYear}:</strong> Global ice loss accelerating, regional water storage changes visible through gravity variations.</p>
              {dataSource === 'grace' && (
                <p className="real-data-note">✨ Currently showing real GRACE satellite data from NASA PO.DAAC</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Back to Top Button */}
        {showBackToTop && (
          <button className="back-to-top" onClick={scrollToTop} title="Back to top">
            ↑
          </button>
        )}
      </main>
    </div>
  );
}

export default App;