import React from 'react';

const Legend = ({ colorScale = 'Default (Red-Blue)' }) => {
  const legendItems = [
    { value: -50, label: '< -40 mGal (Extreme loss)' },
    { value: -30, label: '-40 to -20 mGal (Severe loss)' },
    { value: -10, label: '-20 to 0 mGal (Moderate loss)' },
    { value: 0, label: '0 mGal (No change)' },
    { value: 10, label: '0 to 20 mGal (Moderate gain)' },
    { value: 30, label: '20 to 40 mGal (Severe gain)' },
    { value: 50, label: '> 40 mGal (Extreme gain)' }
  ];

  // Color mapping based on scale
  const getColorForValue = (value) => {
    const colorScales = {
      'Default (Red-Blue)': (v) => {
        if (v < -30) return '#67001f';
        if (v < -20) return '#b2182b';
        if (v < -10) return '#d6604d';
        if (v < 0) return '#f4a582';
        if (v === 0) return '#f7f7f7';
        if (v < 10) return '#d1e5f0';
        if (v < 20) return '#92c5de';
        if (v < 30) return '#4393c3';
        if (v < 40) return '#2166ac';
        return '#053061';
      },
      'Viridis': (v) => {
        const colors = ['#440154', '#482878', '#3e4a89', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'];
        const index = Math.min(Math.floor((v + 50) / 10), 9);
        return colors[index];
      }
    };
    
    const colorFn = colorScales[colorScale] || colorScales['Default (Red-Blue)'];
    return colorFn(value);
  };

  return (
    <div className="legend">
      <h4>Gravity Anomaly (mGal)</h4>
      {legendItems.map((item, index) => (
        <div key={index} className="legend-item">
          <span className="legend-color" style={{ backgroundColor: getColorForValue(item.value) }}></span>
          <span className="legend-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default Legend;