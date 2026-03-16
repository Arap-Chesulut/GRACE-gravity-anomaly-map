import { useState, useEffect, useCallback, useRef } from 'react';
import graceAPI from '../services/graceApi';

export const useGRACEData = (year, month = null, product = 'land_mascon') => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [availableDates, setAvailableDates] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use refs to prevent unnecessary re-renders
  const yearRef = useRef(year);
  const monthRef = useRef(month);
  const productRef = useRef(product);
  const abortControllerRef = useRef(null);

  // Update refs when props change
  useEffect(() => {
    yearRef.current = year;
    monthRef.current = month;
    productRef.current = product;
  }, [year, month, product]);

  // Fetch available dates once
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const dates = await graceAPI.getAvailableDates(product);
        setAvailableDates(dates);
      } catch (err) {
        console.warn('Could not fetch available dates:', err);
        // Set some default dates based on expected range
        const currentYear = new Date().getFullYear();
        const defaultDates = [];
        for (let y = 2002; y <= currentYear; y++) {
          for (let m = 1; m <= 12; m++) {
            // Skip gap between GRACE and GRACE-FO (Oct 2017 - May 2018)
            if (y === 2017 && m > 10) continue;
            if (y === 2018 && m < 5) continue;
            defaultDates.push({ year: y, month: m });
          }
        }
        setAvailableDates(defaultDates);
      }
    };
    fetchDates();
  }, [product]);

  // Cancel any ongoing fetch
  const cancelFetch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Don't fetch if year is null
    if (!yearRef.current) {
      setData(null);
      return;
    }

    // Cancel any ongoing fetch
    cancelFetch();

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      let result;
      
      // Check cache first for annual data
      if (!monthRef.current && !forceRefresh) {
        const cachedYearData = graceAPI.getCachedYearData?.(yearRef.current);
        if (cachedYearData) {
          console.log(`Using cached data for year ${yearRef.current}`);
          setData(cachedYearData);
          setProgress(100);
          setLoading(false);
          return;
        }
      }
      
      if (monthRef.current) {
        // Fetch single month
        result = await graceAPI.fetchMonthlyData(
          yearRef.current, 
          monthRef.current, 
          productRef.current,
          { signal: abortControllerRef.current.signal }
        );
        setProgress(100);
      } else {
        // Fetch all months with individual progress tracking
        const months = 12;
        const monthlyData = [];
        let completedMonths = 0;
        
        // Create array of promises but track each completion
        const promises = [];
        
        for (let m = 1; m <= months; m++) {
          if (abortControllerRef.current.signal.aborted) {
            console.log('Fetch cancelled');
            return;
          }

          // Create a promise for each month
          const promise = graceAPI.fetchMonthlyData(
            yearRef.current, 
            m, 
            productRef.current,
            { signal: abortControllerRef.current.signal }
          ).then(monthResult => {
            // This executes as each month completes
            completedMonths++;
            const newProgress = Math.round((completedMonths / months) * 100);
            setProgress(newProgress);
            console.log(`Month ${m} completed (${completedMonths}/12) - ${newProgress}%`);
            return { month: m, data: monthResult };
          }).catch(error => {
            if (error.name === 'AbortError') throw error;
            console.warn(`Failed to fetch month ${m}:`, error);
            completedMonths++;
            const newProgress = Math.round((completedMonths / months) * 100);
            setProgress(newProgress);
            return { month: m, data: [] };
          });
          
          promises.push(promise);
        }
        
        // Wait for all to complete
        const results = await Promise.all(promises);
        
        // Combine results in month order
        results.sort((a, b) => a.month - b.month).forEach(item => {
          if (item.data) {
            if (Array.isArray(item.data)) {
              monthlyData.push(...item.data);
            } else if (typeof item.data === 'object' && !Array.isArray(item.data)) {
              monthlyData.push(item.data);
            }
          }
        });
        
        result = monthlyData;
        
        // Cache the entire year's data
        if (result && result.length > 0) {
          graceAPI.cacheYearData?.(yearRef.current, result);
        }
      }

      // Check if fetch was cancelled before setting data
      if (!abortControllerRef.current?.signal.aborted) {
        setData(result);
        setProgress(100);
      }
    } catch (err) {
      // Don't set error if it's an abort error
      if (err.name === 'AbortError') {
        console.log('Fetch aborted');
        return;
      }
      setError(err.message);
      console.error('Error in useGRACEData:', err);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
      abortControllerRef.current = null;
    }
  }, [cancelFetch]);

  // Refresh data function (checks for newer data)
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    setProgress(0);
    try {
      // First refresh available dates
      const updatedDates = await graceAPI.refreshAvailableDates?.() || availableDates;
      setAvailableDates(updatedDates);
      
      // Clear year cache for current year to force fresh fetch
      if (graceAPI.yearCache) {
        graceAPI.yearCache.delete(yearRef.current);
      }
      
      // Then refresh current data with force flag
      await fetchData(true);
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchData, availableDates]);

  // Preload next year data in background
  useEffect(() => {
    if (!loading && data && yearRef.current && !monthRef.current) {
      const nextYear = yearRef.current + 1;
      const currentYear = new Date().getFullYear();
      
      if (nextYear <= currentYear) {
        // Check if next year is already cached
        const cachedNextYear = graceAPI.getCachedYearData?.(nextYear);
        if (!cachedNextYear) {
          // Preload in background with low priority
          const preloadTimeout = setTimeout(() => {
            console.log(`Preloading data for year ${nextYear}...`);
            graceAPI.prefetchYear?.(nextYear, productRef.current)
              .then(data => {
                if (data && data.length > 0) {
                  console.log(`Preloaded data for year ${nextYear}`);
                }
              })
              .catch(err => {
                if (err.name !== 'AbortError') {
                  console.warn(`Failed to preload year ${nextYear}:`, err);
                }
              });
          }, 2000);
          
          return () => clearTimeout(preloadTimeout);
        }
      }
    }
  }, [loading, data, yearRef.current, monthRef.current, productRef.current]);

  // Check if the selected year/month has data available
  const isDataAvailable = useCallback(() => {
    if (!yearRef.current) return false;
    
    if (monthRef.current) {
      return availableDates.some(d => 
        d.year === yearRef.current && d.month === monthRef.current
      );
    } else {
      // For annual data, check if any month in that year exists
      return availableDates.some(d => d.year === yearRef.current);
    }
  }, [availableDates]);

  // Get the latest available date
  const getLatestDate = useCallback(() => {
    if (!availableDates.length) return null;
    
    return availableDates.reduce((latest, current) => {
      if (!latest) return current;
      if (current.year > latest.year) return current;
      if (current.year === latest.year && current.month > latest.month) return current;
      return latest;
    }, null);
  }, [availableDates]);

  // In useGRACEData.js
  const [previewMode, setPreviewMode] = useState(true);

  const loadData = async () => {
    if (previewMode) {
      // Load low-res first (every 4th cell)
      const lowResData = await loadLowResolution();
      setData(lowResData);
      
      // Then load full resolution in background
      setTimeout(async () => {
        const fullResData = await loadFullResolution();
        setData(fullResData);
        setPreviewMode(false);
      }, 100);
    }
  };

  // In GravityMap.js, adjust cell size based on zoom
  const getCellSize = (zoom) => {
    if (zoom < 3) return 4; // Low zoom: big cells
    if (zoom < 5) return 2; // Medium zoom
    return 1; // High zoom: detailed cells
  };

  useEffect(() => {
    fetchData();
    
    // Cleanup on unmount or when dependencies change
    return () => {
      cancelFetch();
    };
  }, [fetchData, year, month, product, cancelFetch]);

  // In useGRACEData.js
  useEffect(() => {
    const worker = new Worker('/workers/dataWorker.js');
    
    worker.onmessage = (e) => {
      setProcessedData(e.data.processed);
      worker.terminate();
    };
    
    worker.postMessage({ data: rawData, year, month });
    
    return () => worker.terminate();
  }, [rawData]);

  return { 
    data, 
    loading, 
    error, 
    progress, 
    availableDates,
    isRefreshing,
    refetch: fetchData,
    refreshData,
    isDataAvailable: isDataAvailable(),
    latestDate: getLatestDate()
  };
};
