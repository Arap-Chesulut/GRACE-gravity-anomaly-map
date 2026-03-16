import React from 'react';

const regions = [
  { name: 'Global', bounds: [[-90, -180], [90, 180]] },
  { name: 'Greenland', bounds: [[60, -60], [85, -20]] },
  { name: 'Antarctica', bounds: [[-90, -180], [-60, 180]] },
  { name: 'Amazon Basin', bounds: [[-20, -80], [10, -40]] },
  { name: 'Himalayas', bounds: [[25, 70], [40, 100]] },
  { name: 'North America', bounds: [[15, -130], [60, -60]] },
  { name: 'Europe', bounds: [[35, -10], [70, 40]] },
  { name: 'Africa', bounds: [[-35, -20], [35, 50]] },
  { name: 'Asia', bounds: [[0, 60], [55, 150]] },
  { name: 'Australia', bounds: [[-45, 110], [-10, 155]] }
];

const RegionSelector = ({ onSelectRegion, selectedRegion }) => {
  const handleChange = (e) => {
    const region = regions.find(r => r.name === e.target.value);
    if (region) onSelectRegion(region.bounds);
  };

  return (
    <div className="region-selector">
      <label>📍 Jump to Region:</label>
      <select onChange={handleChange} value={selectedRegion}>
        <option value="">Select a region...</option>
        {regions.map(region => (
          <option key={region.name} value={region.name}>
            {region.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default RegionSelector;