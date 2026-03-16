import React, { useState, useEffect } from 'react';

const DataSourceSelector = ({ 
  dataSource, 
  onDataSourceChange, 
  selectedProduct, 
  onProductChange,
  selectedMonth,
  onMonthChange,
  availableDates,    
  onRefreshData,  
  isRefreshing,
  onClearCache,
  lastUpdated,
  dataQuality
}) => {
  const [dataRange, setDataRange] = useState({ start: 2002, end: 2023, count: 0 });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const products = [
    { id: 'land_mascon', name: 'Land Mascon (JPL)' },
    { id: 'ocean_mascon', name: 'Ocean Mascon (JPL)' },
    { id: 'global_timeseries', name: 'Global Time Series' }
  ];

  // Calculate data range from availableDates
  useEffect(() => {
    if (availableDates && availableDates.length > 0) {
      // Sort dates to ensure correct order
      const sortedDates = [...availableDates].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      
      const start = sortedDates[0];
      const end = sortedDates[sortedDates.length - 1];
      
      setDataRange({
        start: start.year,
        end: end.year,
        count: availableDates.length
      });
    } else {
      // Default range if no data available
      setDataRange({
        start: 2002,
        end: currentYear,
        count: (currentYear - 2002 + 1) * 12 // Approximate months
      });
    }
  }, [availableDates, currentYear]);

  // Get detailed availability info
  const getDetailedAvailability = () => {
    if (!availableDates || availableDates.length === 0) return null;

    // Group by year
    const byYear = {};
    availableDates.forEach(date => {
      if (!byYear[date.year]) {
        byYear[date.year] = [];
      }
      if (date.month) {
        byYear[date.year].push(date.month);
      }
    });

    // Find years with complete data
    const completeYears = Object.entries(byYear)
      .filter(([year, months]) => months.length === 12)
      .map(([year]) => parseInt(year))
      .sort((a, b) => a - b);

    // Find years with missing data
    const incompleteYears = Object.entries(byYear)
      .filter(([year, months]) => months.length < 12)
      .map(([year, months]) => ({
        year: parseInt(year),
        missing: 12 - months.length,
        months: months
      }))
      .sort((a, b) => a.year - b.year);

    // Find latest data
    const latest = availableDates[availableDates.length - 1];
    const latestDate = latest.month 
      ? `${latest.year}-${latest.month.toString().padStart(2, '0')}`
      : latest.year;

    // Calculate data latency (how recent is the data)
    let latency = null;
    if (latest.year === currentYear) {
      latency = currentMonth - latest.month;
    } else if (latest.year === currentYear - 1) {
      latency = (12 - latest.month) + currentMonth;
    }

    return { 
      completeYears, 
      incompleteYears,
      latestDate,
      latest,
      latency,
      byYear 
    };
  };

  const detailed = getDetailedAvailability();

  // Format the data availability message
  const getDataAvailabilityMessage = () => {
    if (!availableDates || availableDates.length === 0) {
      // If no real data, show expected range
      const totalMonths = (currentYear - 2002 + 1) * 12;
      return `📊 Data coverage: ${totalMonths} months expected (2002-${currentYear})`;
    }
    
    const startYear = dataRange.start;
    const endYear = dataRange.end;
    const monthCount = dataRange.count;
    
    // Calculate expected total months
    const expectedTotal = (currentYear - 2002 + 1) * 12;
    const coveragePercent = ((monthCount / expectedTotal) * 100).toFixed(1);
    
    // Check if data is up to date (within last 6 months)
    const isUpToDate = detailed?.latest?.year >= currentYear - 1;
    
    return (
      <>
        <span>📊 Data available: </span>
        <strong>{monthCount} months</strong>
        <span> ({startYear}-{endYear})</span>
        <span className="coverage-percent"> ({coveragePercent}% coverage)</span>
        {isUpToDate ? (
          <span className="data-status up-to-date"> ✅ Up to date</span>
        ) : (
          <span className="data-status outdated"> ⏳ Partial coverage</span>
        )}
      </>
    );
  };

  // Get data quality score
  const getDataQualityScore = () => {
    if (!availableDates || availableDates.length === 0) return null;
    
    const expectedTotal = (currentYear - 2002 + 1) * 12;
    const coverage = (dataRange.count / expectedTotal * 100).toFixed(1);
    
    let quality = 'good';
    let color = '#28a745';
    
    if (coverage < 80) {
      quality = 'fair';
      color = '#ffc107';
    }
    if (coverage < 60) {
      quality = 'poor';
      color = '#dc3545';
    }
    
    return { coverage, quality, color };
  };

  const qualityScore = getDataQualityScore();

  // Format relative time for last updated
  const getRelativeTime = () => {
    if (!lastUpdated) return null;
    
    const diff = Date.now() - lastUpdated;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  };

  return (
    <div className="data-source-selector">
      <div className="source-toggle">
        <label>📡 Data Source:</label>
        <div className="toggle-buttons">
          <button 
            className={`toggle-btn ${dataSource === 'simulated' ? 'active' : ''}`}
            onClick={() => onDataSourceChange('simulated')}
          >
            Simulated (Demo)
          </button>
          <button 
            className={`toggle-btn ${dataSource === 'grace' ? 'active' : ''}`}
            onClick={() => onDataSourceChange('grace')}
          >
            Real GRACE Data
          </button>
        </div>
      </div>

      {dataSource === 'grace' && (
        <div className="grace-options">
          <div className="selector-row">
            <label>Product:</label>
            <select 
              value={selectedProduct} 
              onChange={(e) => onProductChange(e.target.value)}
              className="product-select"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="selector-row">
            <label>
              <input 
                type="checkbox" 
                checked={selectedMonth !== null}
                onChange={(e) => onMonthChange(e.target.checked ? 1 : null)}
              />
              Monthly resolution
            </label>
          </div>

          {selectedMonth !== null && (
            <div className="selector-row">
              <label>Month:</label>
              <select 
                value={selectedMonth} 
                onChange={(e) => onMonthChange(parseInt(e.target.value))}
                className="month-select"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {new Date(2000, m-1, 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Data Quality Indicator */}
          {qualityScore && (
            <div className="data-quality-section">
              <div className="quality-header">
                <span>Data Quality</span>
                <span className="quality-badge" style={{ backgroundColor: qualityScore.color }}>
                  {qualityScore.quality}
                </span>
              </div>
              <div className="quality-bar-container">
                <div 
                  className="quality-bar-fill" 
                  style={{ 
                    width: `${qualityScore.coverage}%`,
                    backgroundColor: qualityScore.color
                  }}
                ></div>
              </div>
              <div className="quality-stats">
                <span>{qualityScore.coverage}% coverage</span>
                {detailed?.latency !== undefined && (
                  <span> • {detailed.latency} months latency</span>
                )}
              </div>
            </div>
          )}

          <div className="data-availability">
            <small>
              {getDataAvailabilityMessage()}
            </small>
            
            {/* Show detailed stats if available */}
            {detailed && (
              <div className="data-details">
                <small>
                  • Latest data: <strong>{detailed.latestDate}</strong><br />
                  • Complete years: <strong>{detailed.completeYears.length}</strong> 
                  ({detailed.completeYears.slice(0, 3).join(', ')}
                  {detailed.completeYears.length > 3 ? '...' : ''})<br />
                  
                  {/* Show incomplete years if any */}
                  {detailed.incompleteYears.length > 0 && (
                    <>
                      • Incomplete years: <strong>{detailed.incompleteYears.length}</strong><br />
                      <span className="incomplete-details">
                        {detailed.incompleteYears.slice(0, 2).map(y => 
                          `${y.year} (missing ${y.missing} mo)`
                        ).join(', ')}
                        {detailed.incompleteYears.length > 2 ? '...' : ''}
                      </span>
                    </>
                  )}
                </small>
              </div>
            )}
          </div>

          {/* Show GRACE mission timeline */}
          <div className="mission-timeline">
            <div className="timeline-bar">
              <div className="timeline-segment grace" style={{ width: '65%' }}>
                <span>GRACE</span>
              </div>
              <div className="timeline-segment grace-fo" style={{ width: '35%' }}>
                <span>GRACE-FO</span>
              </div>
            </div>
            <div className="timeline-labels">
              <span>2002</span>
              <span>2017</span>
              <span>{currentYear}</span>
            </div>
          </div>

          {/* Data source info with refresh controls */}
          <div className="data-source-footer">
            <div className="data-source-info">
              <small>
                🔗 Data from <a href="https://podaac.jpl.nasa.gov/GRACE" target="_blank" rel="noopener noreferrer">
                  NASA PO.DAAC
                </a>
                {availableDates && availableDates.length > 0 && (
                  <> • Updated monthly</>
                )}
              </small>
            </div>

            {/* Refresh and Cache Controls */}
            <div className="refresh-controls">
              <button 
                onClick={onRefreshData}
                disabled={isRefreshing}
                className="refresh-btn"
                title="Check for new data from NASA PO.DAAC"
              >
                {isRefreshing ? (
                  <>🔄 Refreshing...</>
                ) : (
                  <>🔄 Check for Updates</>
                )}
              </button>
              
              {onClearCache && (
                <button 
                  onClick={onClearCache}
                  className="clear-cache-btn"
                  title="Clear cached data"
                >
                  🗑️ Clear Cache
                </button>
              )}
            </div>

            {/* Last Updated Info */}
            {lastUpdated && (
              <div className="last-updated">
                <small>
                  Last updated: {new Date(lastUpdated).toLocaleString()} ({getRelativeTime()})
                </small>
              </div>
            )}
          </div>

          {/* Advanced Options Toggle */}
          <div className="advanced-toggle">
            <button 
              className="advanced-btn"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '▼' : '▶'} Advanced Options
            </button>
          </div>

          {showAdvanced && (
            <div className="advanced-options">
              <h5>Data Product Details</h5>
              <table className="product-details">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Resolution</th>
                    <th>Unit</th>
                    <th>Version</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className={p.id === selectedProduct ? 'selected' : ''}>
                      <td>{p.name}</td>
                      <td>{p.id === 'global_timeseries' ? 'global' : '0.5°'}</td>
                      <td>{p.id === 'global_timeseries' ? 'cm' : 'cm water eq.'}</td>
                      <td>RL06</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="data-notes">
                <h5>Notes</h5>
                <ul>
                  <li>GRACE data: 2002-2017</li>
                  <li>GRACE-FO data: 2018-present</li>
                  <li>7-month data gap: Oct 2017 - May 2018</li>
                  <li>Data latency: 2-6 months</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataSourceSelector;