import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

const EnhancedExport = ({ data, year, mapRef, selectedRegion }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [imageFormat, setImageFormat] = useState('png');
  const [imageQuality, setImageQuality] = useState(1);

  const exportToCSV = () => {
    if (!data || data.length === 0) return;
    
    // Get current viewport data or full dataset
    let exportData = data;
    
    // Create CSV content
    const headers = ['Latitude', 'Longitude', 'Gravity_Anomaly_mGal'];
    const csvContent = [
      headers.join(','),
      ...exportData.map(point => `${point.lat},${point.lng},${point.value.toFixed(4)}`)
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gravity_anomaly_${year}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const captureMap = async () => {
    setIsExporting(true);
    
    try {
      // Find the map container
      const mapElement = document.getElementById('map');
      if (!mapElement) {
        alert('Map element not found');
        return;
      }

      // Add a temporary class for high-quality capture
      mapElement.classList.add('capturing');
      
      // Capture the map with html2canvas
      const canvas = await html2canvas(mapElement, {
        scale: imageQuality === 1 ? 2 : imageQuality, // Higher scale for better quality
        backgroundColor: '#ffffff',
        allowTaint: false,
        useCORS: true,
        logging: false,
        windowWidth: mapElement.scrollWidth,
        windowHeight: mapElement.scrollHeight
      });
      
      // Remove temporary class
      mapElement.classList.remove('capturing');
      
      // Convert to desired format
      let imageData;
      let mimeType;
      
      if (imageFormat === 'png') {
        mimeType = 'image/png';
        imageData = canvas.toDataURL(mimeType);
      } else if (imageFormat === 'jpeg') {
        mimeType = 'image/jpeg';
        imageData = canvas.toDataURL(mimeType, imageQuality);
      } else if (imageFormat === 'webp') {
        mimeType = 'image/webp';
        imageData = canvas.toDataURL(mimeType, imageQuality);
      }
      
      // Create download link
      const link = document.createElement('a');
      link.download = `gravity_map_${year}_${selectedRegion || 'global'}.${imageFormat}`;
      link.href = imageData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExporting(false);
    } catch (error) {
      console.error('Error capturing map:', error);
      alert('Error capturing map. Please try again.');
      setIsExporting(false);
    }
  };

  const captureWithLegend = async () => {
    setIsExporting(true);
    
    try {
      // Find the map container and legend
      const mapElement = document.getElementById('map');
      const legendElement = document.querySelector('.legend');
      
      if (!mapElement) {
        alert('Map element not found');
        return;
      }

      // Create a temporary container for combined capture
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.backgroundColor = '#ffffff';
      tempContainer.style.padding = '20px';
      tempContainer.style.borderRadius = '8px';
      tempContainer.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
      
      // Clone map
      const mapClone = mapElement.cloneNode(true);
      mapClone.style.width = '800px';
      mapClone.style.height = '500px';
      
      // Clone legend
      let legendClone = null;
      if (legendElement) {
        legendClone = legendElement.cloneNode(true);
        legendClone.style.position = 'relative';
        legendClone.style.top = '0';
        legendClone.style.right = '0';
        legendClone.style.marginTop = '20px';
        legendClone.style.boxShadow = 'none';
      }
      
      tempContainer.appendChild(mapClone);
      if (legendClone) {
        tempContainer.appendChild(legendClone);
      }
      
      document.body.appendChild(tempContainer);
      
      // Add title
      const title = document.createElement('h3');
      title.textContent = `GRACE Gravity Anomaly - Year ${year}`;
      title.style.textAlign = 'center';
      title.style.marginBottom = '10px';
      title.style.color = '#1e3c72';
      title.style.fontFamily = 'Arial, sans-serif';
      tempContainer.insertBefore(title, tempContainer.firstChild);
      
      // Add region info
      if (selectedRegion && selectedRegion !== 'Global') {
        const regionInfo = document.createElement('p');
        regionInfo.textContent = `Region: ${selectedRegion}`;
        regionInfo.style.textAlign = 'center';
        regionInfo.style.marginBottom = '15px';
        regionInfo.style.color = '#666';
        tempContainer.insertBefore(regionInfo, title.nextSibling);
      }
      
      // Capture
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      // Remove temporary container
      document.body.removeChild(tempContainer);
      
      // Download
      const link = document.createElement('a');
      link.download = `gravity_map_complete_${year}_${selectedRegion || 'global'}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExporting(false);
    } catch (error) {
      console.error('Error capturing map with legend:', error);
      alert('Error capturing image. Please try again.');
      setIsExporting(false);
    }
  };

  return (
    <div className="enhanced-export">
      <div className="export-header">
        <button 
          className="export-toggle-btn"
          onClick={() => setShowOptions(!showOptions)}
        >
          {showOptions ? '▼ Export Options' : '▶ Export Options'}
        </button>
      </div>
      
      {showOptions && (
        <div className="export-options-panel">
          <h4>📤 Export Data & Images</h4>
          
          <div className="export-section">
            <h5>Image Settings</h5>
            <div className="export-row">
              <label>Format:</label>
              <select value={imageFormat} onChange={(e) => setImageFormat(e.target.value)}>
                <option value="png">PNG (High Quality)</option>
                <option value="jpeg">JPEG (Smaller file)</option>
                <option value="webp">WebP (Modern)</option>
              </select>
            </div>
            
            <div className="export-row">
              <label>Quality:</label>
              <select value={imageQuality} onChange={(e) => setImageQuality(Number(e.target.value))}>
                <option value="1">High (2x scale)</option>
                <option value="0.8">Medium</option>
                <option value="0.5">Low</option>
              </select>
            </div>
          </div>
          
          <div className="export-section">
            <h5>Export Options</h5>
            <div className="export-buttons">
              <button 
                onClick={captureMap} 
                disabled={isExporting}
                className="export-btn capture-btn"
              >
                {isExporting ? '⏳ Capturing...' : '🖼️ Save Map Only'}
              </button>
              
              <button 
                onClick={captureWithLegend} 
                disabled={isExporting}
                className="export-btn capture-full-btn"
              >
                {isExporting ? '⏳ Capturing...' : '📸 Save Map + Legend'}
              </button>
              
              <button 
                onClick={exportToCSV} 
                disabled={isExporting}
                className="export-btn csv-btn"
              >
                📥 Export Data (CSV)
              </button>
            </div>
          </div>
          
          <div className="export-tips">
            <p>💡 <strong>Tip:</strong> Zoom to your region of interest before capturing for best results!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedExport;