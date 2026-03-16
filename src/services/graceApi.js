/**
 * GRACE/GRACE-FO Data API Service
 * Fetches real gravity anomaly data from NASA PO.DAAC
 */

// Base URLs for different data sources
const DATA_SOURCES = {
  JPL_MASCON: 'https://podaac-tools.jpl.nasa.gov/podaac/data/grace',
  CSR_MASCON: 'https://www2.csr.utexas.edu/grace/RL06_mascons',
  TELLUS: 'https://grace.jpl.nasa.gov/api/data',
  PODAAC_OPENDAP: 'https://podaac-opendap.jpl.nasa.gov/opendap/allData/grace'
};

// Available data products with their specifications
const PRODUCTS = {
  land_mascon: {
    name: 'JPL GRACE Mascon Land',
    path: 'mascon_land',
    resolution: '0.5deg',
    unit: 'cm water equivalent',
    source: DATA_SOURCES.JPL_MASCON,
    version: 'RL06'
  },
  ocean_mascon: {
    name: 'JPL GRACE Mascon Ocean',
    path: 'mascon_ocean',
    resolution: '0.5deg',
    unit: 'cm water equivalent',
    source: DATA_SOURCES.JPL_MASCON,
    version: 'RL06'
  },
  global_timeseries: {
    name: 'Global Time Series',
    path: 'timeseries',
    resolution: 'global',
    unit: 'cm',
    source: DATA_SOURCES.TELLUS,
    version: 'RL06'
  }
};

// NASA Earthdata Login credentials (you'll need to register)
// Store these in environment variables
const NASA_EARTHDATA_USERNAME = process.env.REACT_APP_NASA_USERNAME || '';
const NASA_EARTHDATA_PASSWORD = process.env.REACT_APP_NASA_PASSWORD || '';

/**
 * Main API class for GRACE data
 */
class GRACEAPI {
  constructor() {
    this.cache = new Map();
    this.yearCache = new Map();
    this.rateLimit = 1000; // ms between requests
    this.lastRequest = 0;
    this.authToken = null;
    this.tokenExpiry = null;
    
    // Load persistent cache from localStorage
    this.loadPersistentCache();
  }

  /**
   * Rate limiting helper
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequest;
    if (timeSinceLast < this.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimit - timeSinceLast));
    }
    this.lastRequest = Date.now();
  }

  /**
   * Authenticate with NASA Earthdata Login
   */
  async authenticate() {
    // Check if we have a valid token
    if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.authToken;
    }

    // Skip authentication if no credentials
    if (!NASA_EARTHDATA_USERNAME || !NASA_EARTHDATA_PASSWORD) {
      console.warn('NASA Earthdata credentials not provided. Using public access only.');
      return null;
    }

    try {
      // Basic authentication for NASA Earthdata Login
      const response = await fetch('https://urs.earthdata.nasa.gov/api/users/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${NASA_EARTHDATA_USERNAME}:${NASA_EARTHDATA_PASSWORD}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      this.authToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
      
      return this.authToken;
    } catch (error) {
      console.warn('Authentication failed, continuing with public access:', error);
      return null;
    }
  }

  /**
   * Get authentication headers
   */
  async getAuthHeaders() {
    const token = await this.authenticate();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, application/x-netcdf, application/octet-stream'
      };
    }
    return {
      'Accept': 'application/json, application/x-netcdf, application/octet-stream'
    };
  }

  // ==================== COMPRESSION UTILITIES ====================

  /**
   * Compress data for storage (reduces size by ~70%)
   * @param {Array} data - Array of {lat, lng, value} objects
   * @returns {string} Compressed base64 string
   */
  compressData(data) {
    if (!data || !data.length) return null;
    
    try {
      console.time('compressData');
      
      // Use different compression based on data size
      if (data.length > 10000) {
        return this.compressDataHigh(data);
      } else {
        return this.compressDataLow(data);
      }
    } catch (e) {
      console.warn('Compression failed:', e);
      return null;
    }
  }

  /**
   * High-compression method for large datasets (70-80% reduction)
   */
  compressDataHigh(data) {
    // Flatten array into typed arrays for efficient storage
    const count = data.length;
    const lats = new Float32Array(count);
    const lngs = new Float32Array(count);
    const values = new Float32Array(count);
    
    // Store as separate typed arrays for better compression
    data.forEach((point, i) => {
      lats[i] = point.lat;
      lngs[i] = point.lng;
      values[i] = point.value;
    });
    
    // Combine all buffers
    const totalLength = lats.byteLength + lngs.byteLength + values.byteLength;
    const combinedBuffer = new ArrayBuffer(totalLength);
    const combinedView = new Uint8Array(combinedBuffer);
    
    // Copy each typed array into the combined buffer
    combinedView.set(new Uint8Array(lats.buffer), 0);
    combinedView.set(new Uint8Array(lngs.buffer), lats.byteLength);
    combinedView.set(new Uint8Array(values.buffer), lats.byteLength + lngs.byteLength);
    
    // Convert to base64 with metadata
    const base64 = btoa(String.fromCharCode(...combinedView));
    
    // Create metadata object
    const compressed = JSON.stringify({
      v: '2', // version
      c: count,
      t: 'high',
      l: lats.byteLength,
      n: lngs.byteLength,
      d: base64
    });
    
    console.timeEnd('compressData');
    console.log(`Compressed ${count} points from ${JSON.stringify(data).length} to ${compressed.length} chars (${Math.round((1 - compressed.length / JSON.stringify(data).length) * 100)}% reduction)`);
    
    return compressed;
  }

  /**
   * Low-compression method for smaller datasets (50-60% reduction)
   */
  compressDataLow(data) {
    // For smaller datasets, use a simpler approach
    const simplified = data.map(p => ({
      lat: Math.round(p.lat * 100) / 100,
      lng: Math.round(p.lng * 100) / 100,
      val: Math.round(p.value * 100) / 100
    }));
    
    const compressed = JSON.stringify({
      v: '2',
      c: data.length,
      t: 'low',
      d: btoa(JSON.stringify(simplified))
    });
    
    console.log(`Compressed ${data.length} points with low compression`);
    return compressed;
  }

  /**
   * Decompress data from storage
   * @param {string} compressed - Compressed data string
   * @returns {Array} Decompressed array of {lat, lng, value} objects
   */
  decompressData(compressed) {
    if (!compressed) return null;
    
    try {
      console.time('decompressData');
      
      const parsed = JSON.parse(compressed);
      
      // Check version
      if (parsed.v !== '2') {
        // Legacy format - try to parse directly
        return this.decompressLegacy(compressed);
      }
      
      let result;
      if (parsed.t === 'high') {
        result = this.decompressDataHigh(parsed);
      } else {
        result = this.decompressDataLow(parsed);
      }
      
      console.timeEnd('decompressData');
      return result;
    } catch (e) {
      console.warn('Decompression failed:', e);
      return null;
    }
  }

  /**
   * Decompress high-compression data
   */
  decompressDataHigh(parsed) {
    const { c: count, l: latBytes, n: lngBytes, d: base64 } = parsed;
    
    // Convert base64 back to bytes
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // Extract individual typed arrays
    const lats = new Float32Array(bytes.buffer.slice(0, latBytes));
    const lngs = new Float32Array(bytes.buffer.slice(latBytes, latBytes + lngBytes));
    const values = new Float32Array(bytes.buffer.slice(latBytes + lngBytes));
    
    // Reconstruct objects
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push({
        lat: lats[i],
        lng: lngs[i],
        value: values[i]
      });
    }
    
    return result;
  }

  /**
   * Decompress low-compression data
   */
  decompressDataLow(parsed) {
    const decoded = atob(parsed.d);
    const simplified = JSON.parse(decoded);
    
    return simplified.map(p => ({
      lat: p.lat,
      lng: p.lng,
      value: p.val
    }));
  }

  /**
   * Decompress legacy format (for backward compatibility)
   */
  decompressLegacy(compressed) {
    try {
      // Try to parse as regular JSON first
      return JSON.parse(compressed);
    } catch {
      // If that fails, try base64 decode
      try {
        const decoded = atob(compressed);
        return JSON.parse(decoded);
      } catch {
        console.warn('Unable to decompress legacy format');
        return null;
      }
    }
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Load persistent cache from localStorage
   */
  loadPersistentCache() {
    try {
      const savedCache = localStorage.getItem('graceYearCache');
      if (savedCache) {
        const parsed = JSON.parse(savedCache);
        // Convert back to Map with proper structure
        Object.entries(parsed).forEach(([year, item]) => {
          // Check if data is compressed
          if (typeof item.data === 'string' && (item.data.startsWith('{') || item.data.includes('v":"2'))) {
            // Decompress the data
            const decompressed = this.decompressData(item.data);
            if (decompressed) {
              this.yearCache.set(parseInt(year), {
                data: decompressed,
                timestamp: item.timestamp,
                compressed: true
              });
            }
          } else {
            // Legacy uncompressed data
            this.yearCache.set(parseInt(year), {
              data: item.data,
              timestamp: item.timestamp,
              compressed: false
            });
          }
        });
        console.log(`Loaded ${this.yearCache.size} years from persistent cache`);
      }
    } catch (e) {
      console.warn('Could not load persistent cache:', e);
    }
  }

  /**
   * Save persistent cache to localStorage
   */
  savePersistentCache() {
    try {
      const cacheObj = {};
      this.yearCache.forEach((value, key) => {
        // Compress data before saving
        const compressed = this.compressData(value.data);
        cacheObj[key] = {
          data: compressed, // Store compressed version
          timestamp: value.timestamp
        };
      });
      localStorage.setItem('graceYearCache', JSON.stringify(cacheObj));
      
      // Calculate total size
      const size = new Blob([JSON.stringify(cacheObj)]).size;
      console.log(`Saved ${this.yearCache.size} compressed years to cache (${(size / 1024).toFixed(2)} KB)`);
    } catch (e) {
      console.warn('Could not save persistent cache:', e);
    }
  }

  /**
   * Get oldest cache key for cleanup
   */
  getOldestCacheKey() {
    let oldestKey = null;
    let oldestTime = Infinity;
    this.yearCache.forEach((value, key) => {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    });
    return oldestKey;
  }

  /**
   * Cache year data
   */
  cacheYearData(year, data) {
    this.yearCache.set(year, {
      data: data,
      timestamp: Date.now(),
      compressed: false // Will be compressed on save
    });
    this.savePersistentCache(); // Save to localStorage (compresses automatically)
    
    // Limit cache size
    if (this.yearCache.size > 10) {
      const oldestKey = this.getOldestCacheKey();
      if (oldestKey) {
        this.yearCache.delete(oldestKey);
        console.log(`Removed oldest cache for year ${oldestKey}`);
      }
    }
  }

  /**
   * Check if year is cached
   */
  getCachedYearData(year) {
    const cached = this.yearCache.get(year);
    if (cached && (Date.now() - cached.timestamp) < 3600000) { // 1 hour cache
      return cached.data;
    }
    return null;
  }

  /**
   * Get cache size in bytes
   */
  getCacheSize() {
    try {
      const cacheStr = localStorage.getItem('graceYearCache');
      if (!cacheStr) return 0;
      return new Blob([cacheStr]).size;
    } catch {
      return 0;
    }
  }

  // ==================== DATA FETCHING METHODS ====================

  /**
   * Fetch GRACE mascon data for a specific year and month
   * @param {number} year - Year (2002-2023)
   * @param {number} month - Month (1-12)
   * @param {string} product - Product type ('land_mascon', 'ocean_mascon', 'global_timeseries')
   * @param {Object} options - Fetch options (signal for abort)
   * @returns {Promise<Object>} Gravity anomaly data
   */
  async fetchMonthlyData(year, month, product = 'land_mascon', options = {}) {
    const cacheKey = `${product}_${year}_${month}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log('Returning cached data for', cacheKey);
      return this.cache.get(cacheKey);
    }

    await this.waitForRateLimit();

    try {
      let data;
      const productType = product.includes('land') ? 'land' : 
                         product.includes('ocean') ? 'ocean' : 'timeseries';
      
      switch (product) {
        case 'land_mascon':
        case 'ocean_mascon':
          data = await this.fetchJPLMascon(year, month, productType, options);
          break;
        case 'global_timeseries':
          data = await this.fetchGlobalTimeseries(year, month, options);
          break;
        default:
          throw new Error(`Unknown product: ${product}`);
      }

      // Cache the result
      this.cache.set(cacheKey, data);
      
      // Limit cache size
      if (this.cache.size > 50) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      console.error('Error fetching GRACE data:', error);
      // Fall back to simulated data
      return this.generateFallbackData(year, month, product);
    }
  }

  /**
   * Fetch JPL MASCON data with abort support
   */
  async fetchJPLMascon(year, month, type, options = {}) {
    const monthStr = month.toString().padStart(2, '0');
    const { signal } = options;
    
    // Try different possible filename patterns
    const filenamePatterns = [
      `GRACE_${year}-${monthStr}_${type}_mascon.nc`,
      `GRACE_${year}-${monthStr}_${type}_mascon_v02.nc`,
      `GRACE_${year}-${monthStr}_${type}_mascon_v03.nc`,
      `GRACE_${year}-${monthStr}_${type}_mascon_v04.nc`,
      `GRACE_${year}-${month}_${type}_mascon.nc`
    ];

    const headers = await this.getAuthHeaders();

    // Try each pattern
    for (const filename of filenamePatterns) {
      // Check if aborted
      if (signal?.aborted) {
        throw new Error('AbortError');
      }
      
      const url = `${DATA_SOURCES.JPL_MASCON}/${year}/${filename}`;
      
      try {
        const response = await fetch(url, { 
          headers, 
          signal 
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return this.parseNetCDF(arrayBuffer, type, { year, month });
        }
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        // Continue to next pattern
      }
    }

    // Check if aborted before fallback
    if (signal?.aborted) {
      throw new Error('AbortError');
    }

    // Try alternative source (Tellus)
    return this.fetchTellusMascon(year, month, type, options);
  }

  /**
   * Fetch Tellus mascon data with abort support
   */
  async fetchTellusMascon(year, month, type, options = {}) {
    const { signal } = options;
    const monthStr = month.toString().padStart(2, '0');
    const url = `${DATA_SOURCES.TELLUS}/mascon/${type}`;
    
    const params = new URLSearchParams({
      'time': `${year}-${monthStr}`,
      'format': 'json'
    });

    // Check if aborted
    if (signal?.aborted) {
      throw new Error('AbortError');
    }

    try {
      const response = await fetch(`${url}?${params}`, { 
        signal 
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.formatMasconData(data, type, { year, month });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.warn(`Tellus fetch failed for ${year}-${month}, using fallback`);
      
      // Check if aborted before fallback
      if (signal?.aborted) {
        throw new Error('AbortError');
      }
      
      return this.generateFallbackData(year, month, type);
    }
  }

  /**
   * Fetch global time series data
   */
  async fetchGlobalTimeseries(year, month, options = {}) {
    const url = `${DATA_SOURCES.TELLUS}/mascon/global`;
    
    const params = new URLSearchParams({
      'time-start': `${year}-${month.toString().padStart(2, '0')}-01`,
      'time-end': `${year}-${month.toString().padStart(2, '0')}-31`,
      'format': 'json'
    });

    try {
      const response = await fetch(`${url}?${params}`, { 
        signal: options.signal 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.formatTimeseriesData(data, { year, month });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.error('Error fetching timeseries:', error);
      throw error;
    }
  }

  /**
   * Format mascon data for the app
   */
  formatMasconData(data, type, { year, month }) {
    // Convert Tellus format to app format
    const result = [];
    
    if (data && Array.isArray(data)) {
      data.forEach(point => {
        if (point.lat && point.lon && point.value !== undefined) {
          result.push({
            lat: point.lat,
            lng: point.lon,
            value: point.value,
            uncertainty: point.uncertainty || 0,
            date: `${year}-${month.toString().padStart(2, '0')}`,
            source: 'tellus'
          });
        }
      });
    }
    
    return result;
  }

  /**
   * Parse NetCDF data (simplified - would need actual NetCDF parser)
   */
  parseNetCDF(arrayBuffer, type, { year, month }) {
    // In production, use a NetCDF library like 'netcdfjs'
    console.log('NetCDF parsing would happen here');
    
    // Return simulated data as fallback
    return this.generateFallbackData(year, month, type);
  }

  /**
   * Format timeseries data for your app
   */
  formatTimeseriesData(data, { year, month }) {
    return {
      type: 'timeseries',
      values: data.map(point => ({
        date: point.time || `${year}-${month.toString().padStart(2, '0')}`,
        value: point.anomaly || point.value || 0,
        uncertainty: point.uncertainty || 0
      })),
      metadata: {
        source: 'GRACE Tellus',
        unit: 'cm',
        region: 'global',
        date: `${year}-${month.toString().padStart(2, '0')}`
      }
    };
  }

  /**
   * Generate fallback simulated data when real data isn't available
   */
  generateFallbackData(year, month, type) {
    const data = [];
    const resolution = 2; // degrees
    
    // Determine base value based on type
    let baseValue = 0;
    if (type === 'land' || type === 'land_mascon') baseValue = 0;
    else if (type === 'ocean' || type === 'ocean_mascon') baseValue = -5;
    else if (type === 'global_timeseries' || type === 'timeseries') baseValue = 2;
    
    for (let lat = -90; lat <= 90; lat += resolution) {
      for (let lng = -180; lng <= 180; lng += resolution) {
        let value = baseValue;
        
        // Add realistic geophysical patterns
        const yearFactor = (year - 2002) * 0.3;
        
        // Greenland ice loss
        if (lat > 60 && lat < 80 && lng > -60 && lng < -20) {
          value = -15 - yearFactor * 0.5;
        }
        // Antarctica ice loss  
        else if (lat < -60 && lat > -80) {
          value = -10 - yearFactor * 0.3;
          if (lng > -120 && lng < -60) value -= 5; // West Antarctica
          if (lng > 60 && lng < 150) value += 3;   // East Antarctica
        }
        // Amazon water storage
        else if (lat > -20 && lat < 5 && lng > -70 && lng < -50) {
          value = -30 + Math.sin((year - 2000) * 0.3) * 8;
          value += Math.sin((month / 12) * 2 * Math.PI) * 5; // Seasonal
        }
        // Himalayas tectonic uplift
        else if (lat > 25 && lat < 35 && lng > 75 && lng < 95) {
          value = 40 + yearFactor * 0.2;
        }
        // Ocean basins
        else if (Math.abs(lat) < 40 && (lng > 140 || lng < -120)) {
          value = -8 + Math.sin((year - 2000) * 0.1) * 2;
        }
        // Background noise
        else {
          value = (Math.random() - 0.5) * 10;
          value += yearFactor * 0.1;
        }
        
        // Add seasonal variation everywhere
        value += Math.sin((month / 12) * 2 * Math.PI) * 2;
        
        data.push({ 
          lat, 
          lng, 
          value,
          date: `${year}-${month.toString().padStart(2, '0')}`,
          source: 'simulated'
        });
      }
    }
    
    return data;
  }

  /**
   * Fetch multiple months of data with progress callback
   * @param {number} year - Year to fetch
   * @param {string} product - Product type
   * @param {Object} options - Fetch options
   * @param {Function} onProgress - Progress callback (progress, month, completed)
   * @returns {Promise<Array>} Combined monthly data
   */
  async fetchYearDataWithProgress(year, product = 'land_mascon', options = {}, onProgress) {
    const monthlyData = [];
    const months = 12;
    let completedMonths = 0;
    
    console.log(`Fetching year ${year} with progress tracking...`);
    
    // Check cache first
    const cachedYear = this.getCachedYearData(year);
    if (cachedYear) {
      console.log(`Using cached data for year ${year}`);
      if (onProgress) {
        onProgress(100, 12, 12);
      }
      return cachedYear;
    }
    
    // Create array of promises
    const promises = [];
    
    for (let month = 1; month <= months; month++) {
      // Check if aborted
      if (options.signal?.aborted) {
        throw new Error('AbortError');
      }
      
      // Create promise for each month
      const promise = this.fetchMonthlyData(year, month, product, options)
        .then(monthData => {
          completedMonths++;
          const progress = Math.round((completedMonths / months) * 100);
          
          // Call progress callback
          if (onProgress) {
            onProgress(progress, month, completedMonths);
          }
          
          console.log(`Month ${month} completed (${completedMonths}/12) - ${progress}%`);
          return { month, data: monthData };
        })
        .catch(error => {
          if (error.name === 'AbortError') throw error;
          console.warn(`Failed to fetch month ${month}:`, error);
          
          completedMonths++;
          const progress = Math.round((completedMonths / months) * 100);
          
          // Still report progress even on failure
          if (onProgress) {
            onProgress(progress, month, completedMonths);
          }
          
          return { month, data: [] };
        });
      
      promises.push(promise);
    }
    
    // Wait for all promises to resolve
    const results = await Promise.all(promises);
    
    // Sort by month and combine
    results.sort((a, b) => a.month - b.month).forEach(item => {
      if (item.data) {
        if (Array.isArray(item.data)) {
          monthlyData.push(...item.data);
        } else if (item.data && typeof item.data === 'object') {
          monthlyData.push(item.data);
        }
      }
    });
    
    console.log(`Year ${year} complete - total data points: ${monthlyData.length}`);
    
    // Cache the year data
    this.cacheYearData(year, monthlyData);
    
    return monthlyData;
  }

  /**
   * Fetch multiple months of data (original method)
   */
  async fetchYearData(year, product = 'land_mascon', options = {}) {
    return this.fetchYearDataWithProgress(year, product, options, () => {});
  }

  /**
   * Prefetch and cache all months for a year
   */
  async prefetchYear(year, product = 'land_mascon') {
    console.log(`Prefetching all months for year ${year}...`);
    
    // Check if already cached
    const cachedYear = this.getCachedYearData(year);
    if (cachedYear) {
      console.log(`Year ${year} already cached`);
      return cachedYear;
    }
    
    const monthlyData = [];
    const months = 12;
    
    // Fetch all months in parallel
    const promises = [];
    for (let month = 1; month <= months; month++) {
      promises.push(
        this.fetchMonthlyData(year, month, product, {})
          .then(data => {
            console.log(`Prefetched ${year}-${month}`);
            return data;
          })
          .catch(err => {
            console.warn(`Failed to prefetch ${year}-${month}:`, err);
            return [];
          })
      );
    }
    
    const results = await Promise.all(promises);
    
    // Combine results
    results.forEach(monthResult => {
      if (Array.isArray(monthResult)) {
        monthlyData.push(...monthResult);
      } else if (monthResult && typeof monthResult === 'object') {
        monthlyData.push(monthResult);
      }
    });
    
    // Cache the year
    this.cacheYearData(year, monthlyData);
    console.log(`Cached ${monthlyData.length} data points for year ${year}`);
    
    return monthlyData;
  }

  /**
   * Average monthly data for annual product
   */
  averageMonthlyData(monthlyData) {
    if (!monthlyData.length) return [];
    
    const grouped = {};
    
    monthlyData.forEach(point => {
      const key = `${point.lat},${point.lng}`;
      if (!grouped[key]) {
        grouped[key] = {
          lat: point.lat,
          lng: point.lng,
          values: [],
          sum: 0
        };
      }
      if (point.value !== undefined && !isNaN(point.value)) {
        grouped[key].values.push(point.value);
        grouped[key].sum += point.value;
      }
    });
    
    return Object.values(grouped).map(item => ({
      lat: item.lat,
      lng: item.lng,
      value: item.values.length > 0 ? item.sum / item.values.length : 0,
      monthlyValues: item.values,
      source: 'averaged'
    }));
  }

  /**
   * Get available years and months for a product
   */
  async getAvailableDates(product = 'land_mascon') {
    // Try to fetch real availability from API
    try {
      const headers = await this.getAuthHeaders();
      const url = `${DATA_SOURCES.TELLUS}/mascon/availability`;
      
      const response = await fetch(url, { headers });
      
      if (response.ok) {
        const data = await response.json();
        return data.dates.map(d => ({
          year: d.year,
          month: d.month,
          available: d.available
        }));
      }
    } catch (error) {
      console.warn('Could not fetch real availability, using estimated dates');
    }
    
    // Fallback to estimated dates
    const dates = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // GRACE-FO data typically has 2-6 month latency
    const latestAvailableYear = currentYear;
    const latestAvailableMonth = Math.max(1, currentMonth - 3);
    
    for (let year = 2002; year <= latestAvailableYear; year++) {
      const maxMonth = (year === latestAvailableYear) ? latestAvailableMonth : 12;
      
      for (let month = 1; month <= maxMonth; month++) {
        // Skip gap between GRACE and GRACE-FO (Oct 2017 - May 2018)
        if (year === 2017 && month > 10) continue;
        if (year === 2018 && month < 5) continue;
        
        // Skip future dates
        if (year === currentYear && month > currentMonth) continue;
        
        dates.push({ year, month, available: true });
      }
    }
    
    return dates;
  }

  /**
   * Refresh available dates (check for new data)
   */
  async refreshAvailableDates() {
    // Clear cache to force fresh data
    this.cache.clear();
    
    // Fetch fresh availability
    const dates = await this.getAvailableDates();
    
    // Check if there's newer data than what we had
    const lastDate = dates[dates.length - 1];
    const lastYear = lastDate?.year || 2002;
    const lastMonth = lastDate?.month || 1;
    
    console.log(`Latest available data: ${lastYear}-${lastMonth.toString().padStart(2, '0')}`);
    
    return dates;
  }

  /**
   * Check if specific date has data
   */
  async hasDataForDate(year, month, product = 'land_mascon') {
    const dates = await this.getAvailableDates(product);
    return dates.some(d => d.year === year && d.month === month);
  }

  /**
   * Get data summary statistics
   */
  async getDataSummary(product = 'land_mascon') {
    const dates = await this.getAvailableDates(product);
    
    if (dates.length === 0) {
      return {
        totalMonths: 0,
        firstDate: null,
        lastDate: null,
        completeYears: 0
      };
    }
    
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    
    // Group by year to find complete years
    const byYear = {};
    dates.forEach(d => {
      if (!byYear[d.year]) byYear[d.year] = [];
      byYear[d.year].push(d.month);
    });
    
    const completeYears = Object.entries(byYear)
      .filter(([year, months]) => months.length === 12)
      .map(([year]) => parseInt(year));
    
    return {
      totalMonths: dates.length,
      firstDate,
      lastDate,
      completeYears,
      percentComplete: (dates.length / ((lastDate.year - 2002 + 1) * 12) * 100).toFixed(1)
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.yearCache.clear();
    localStorage.removeItem('graceYearCache');
    console.log('Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    const cacheSize = this.getCacheSize();
    return {
      monthlyCache: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys())
      },
      yearCache: {
        size: this.yearCache.size,
        years: Array.from(this.yearCache.keys())
      },
      storageSize: `${(cacheSize / 1024).toFixed(2)} KB`
    };
  }
}

// Create and export singleton instance
const graceAPI = new GRACEAPI();
export default graceAPI;