import React from 'react';

const colorScales = [
  { name: 'Default (Red-Blue)', colors: ['#b2182b', '#f7f7f7', '#2166ac'] },
  { name: 'Viridis', colors: ['#440154', '#21918c', '#fde725'] },
  { name: 'Plasma', colors: ['#0d0887', '#9c179e', '#ed7953'] },
  { name: 'Inferno', colors: ['#000004', '#b40426', '#f0f921'] },
  { name: 'Magma', colors: ['#000004', '#b5367a', '#fcfdbf'] },
  { name: 'Cividis', colors: ['#00204d', '#7c7b78', '#ffe100'] }
];

const ColorScaleSelector = ({ onSelectScale, currentScale }) => {
  return (
    <div className="color-scale-selector">
      <label>🎨 Color Scheme:</label>
      <select onChange={(e) => onSelectScale(e.target.value)} value={currentScale}>
        {colorScales.map(scale => (
          <option key={scale.name} value={scale.name}>
            {scale.name}
          </option>
        ))}
      </select>
      <div className="color-preview">
        {colorScales.find(s => s.name === currentScale)?.colors.map((color, i) => (
          <span 
            key={i} 
            style={{ 
              backgroundColor: color, 
              width: '30px', 
              height: '20px', 
              display: 'inline-block',
              margin: '0 2px',
              borderRadius: '3px'
            }} 
          />
        ))}
      </div>
    </div>
  );
};

export default ColorScaleSelector;