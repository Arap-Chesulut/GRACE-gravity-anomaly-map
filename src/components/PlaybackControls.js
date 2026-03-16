import React, { useState, useEffect } from 'react';

const PlaybackControls = ({ isPlaying, onPlayPause, onSpeedChange, speed }) => {
  return (
    <div className="playback-controls">
      <button 
        className={`play-button ${isPlaying ? 'playing' : ''}`}
        onClick={onPlayPause}
      >
        {isPlaying ? '⏸️ Pause' : '▶️ Play'}
      </button>
      <div className="speed-control">
        <label>Speed:</label>
        <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}>
          <option value={500}>Fast</option>
          <option value={1000}>Normal</option>
          <option value={2000}>Slow</option>
        </select>
      </div>
    </div>
  );
};

export default PlaybackControls;
