import React from 'react';
import './LoadingSkeleton.css';

/**
 * LoadingSkeleton - Displays placeholder content while data is loading
 * @param {string} type - Type of skeleton: 'song', 'service', 'text', 'card', 'list'
 * @param {number} count - Number of skeleton items to show (default: 1)
 */
const LoadingSkeleton = ({ type = 'card', count = 1 }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'song':
        return (
          <div className="skeleton-song">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-subtitle"></div>
            <div className="skeleton-line skeleton-text"></div>
          </div>
        );

      case 'service':
        return (
          <div className="skeleton-service">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-text"></div>
            <div className="skeleton-line skeleton-text"></div>
          </div>
        );

      case 'text':
        return <div className="skeleton-line skeleton-text"></div>;

      case 'card':
        return (
          <div className="skeleton-card">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-text"></div>
          </div>
        );

      case 'list':
        return (
          <div className="skeleton-list-item">
            <div className="skeleton-line skeleton-text"></div>
          </div>
        );

      default:
        return <div className="skeleton-line"></div>;
    }
  };

  return (
    <div className="loading-skeleton-container">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-item">
          {renderSkeleton()}
        </div>
      ))}
    </div>
  );
};

export default LoadingSkeleton;
