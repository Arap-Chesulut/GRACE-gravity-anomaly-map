import React, { useMemo } from 'react';

const Statistics = ({ data, year }) => {
  // Use useMemo to cache expensive calculations
  // This will only recalculate when data actually changes
  const stats = useMemo(() => {
    console.log('📊 Recalculating statistics...'); // Helpful for debugging
    
    // Add a check to ensure data exists and is an array
    if (!data || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    // Safely compute statistics
    try {
      const values = data
        .map(d => d?.value)
        .filter(v => v !== null && v !== undefined && !isNaN(v));
      
      if (values.length === 0) {
        return { empty: true };
      }

      const max = Math.max(...values);
      const min = Math.min(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      
      const positiveCount = values.filter(v => v > 0).length;
      const negativeCount = values.filter(v => v < 0).length;
      const zeroCount = values.filter(v => v === 0).length;

      return {
        max,
        min,
        avg,
        positiveCount,
        negativeCount,
        zeroCount,
        empty: false
      };
    } catch (error) {
      console.error('Error computing statistics:', error);
      return { error: true };
    }
  }, [data]); // ⚡ Only re-run when 'data' changes!

  // Handle different states based on memoized result
  if (!stats || stats.empty) {
    return (
      <div className="statistics-panel">
        <h4>📊 Statistics for {year}</h4>
        <p className="no-data-message">No data available for this period</p>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="statistics-panel">
        <h4>📊 Statistics for {year}</h4>
        <p className="error-message">Error computing statistics</p>
      </div>
    );
  }

  // Render using cached stats
  return (
    <div className="statistics-panel">
      <h4>📊 Statistics for {year}</h4>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">Maximum:</span>
          <span className="stat-value" style={{color: '#2166ac'}}>
            {stats.max.toFixed(2)} mGal
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Minimum:</span>
          <span className="stat-value" style={{color: '#b2182b'}}>
            {stats.min.toFixed(2)} mGal
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Average:</span>
          <span className="stat-value">
            {stats.avg.toFixed(2)} mGal
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Positive areas:</span>
          <span className="stat-value">
            {stats.positiveCount} cells
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Negative areas:</span>
          <span className="stat-value">
            {stats.negativeCount} cells
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Zero areas:</span>
          <span className="stat-value">
            {stats.zeroCount} cells
          </span>
        </div>
      </div>
    </div>
  );
};

export default Statistics;