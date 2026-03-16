import React from 'react';

const ExportData = ({ data, year }) => {
  const exportToCSV = () => {
    // Ensure data exists
    if (!data || !Array.isArray(data) || data.length === 0) {
      alert('No data to export');
      return;
    }
    
    try {
      // Create CSV content
      const headers = ['Latitude', 'Longitude', 'Gravity_Anomaly_mGal'];
      const csvContent = [
        headers.join(','),
        ...data.map(point => {
          // Safely access point properties
          const lat = point?.lat ?? 0;
          const lng = point?.lng ?? 0;
          const value = point?.value ?? 0;
          return `${lat},${lng},${value.toFixed(4)}`;
        })
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
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting data. Please try again.');
    }
  };

  const exportAsImage = () => {
    alert('Screenshot feature coming soon!');
  };

  return (
    <div className="export-controls">
      <button 
        onClick={exportToCSV} 
        className="export-btn csv-btn"
        disabled={!data || data.length === 0}
      >
        📥 Export as CSV
      </button>
      <button 
        onClick={exportAsImage} 
        className="export-btn img-btn"
      >
        📸 Save as Image
      </button>
    </div>
  );
};

export default ExportData;