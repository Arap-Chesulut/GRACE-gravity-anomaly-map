import React, { useMemo } from 'react';

const YearSlider = ({ years, selectedYear, onChange }) => {
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const currentYear = new Date().getFullYear();
  
  const handleChange = (e) => {
    onChange(parseInt(e.target.value));
  };

  // Memoize the slider labels to prevent recalculation on every render
  const sliderLabels = useMemo(() => {
    console.log('🏷️ Recalculating slider labels...'); // Debug message
    
    return years
      .filter(year => year % 5 === 0 || year === currentYear)
      .map(year => ({
        year,
        left: `${((year - minYear) / (maxYear - minYear)) * 100}%`,
        isCurrent: year === currentYear,
        // Precompute the display text
        displayText: year === currentYear ? `${year} (Now)` : `${year}`
      }));
  }, [years, minYear, maxYear, currentYear]); // ⚡ Re-run when these dependencies change

  return (
    <div className="slider-container">
      <label htmlFor="year-slider">
        Select Year: {selectedYear}
        {selectedYear === currentYear && (
          <span className="current-year-badge">Current</span>
        )}
      </label>
      <input
        type="range"
        id="year-slider"
        min={minYear}
        max={maxYear}
        value={selectedYear}
        onChange={handleChange}
        step="1"
        className="slider"
      />
      <div className="slider-labels">
        {sliderLabels.map(({ year, left, isCurrent, displayText }) => (
          <span 
            key={year} 
            style={{ 
              left,
              fontWeight: isCurrent ? 'bold' : 'normal',
              color: isCurrent ? '#28a745' : '#666'
            }}
          >
            {displayText}
          </span>
        ))}
      </div>
    </div>
  );
};

export default YearSlider;