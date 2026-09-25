import React from 'react';

// DiagonalGrid component for the Today tab's diagonal grid layout
export interface DiagonalGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * DiagonalGrid - A wrapper component that creates a fluid diagonal grid layout
 * Supports both mobile (single column) and desktop (multi-column) layouts
 * Features subtle diagonal gradient background and smooth transitions
 */
export const DiagonalGrid: React.FC<DiagonalGridProps> = ({
  children,
  className = ''
}) => {
  return (
    <div
      className={`relative w-full min-h-[80vh] overflow-hidden ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, transparent 70%), ' +
          'linear-gradient(45deg, rgba(16, 185, 129, 0.03) 0%, transparent 50%)',
        backgroundBlendMode: 'overlay',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        transition: 'background-position 0.8s ease, background-opacity 0.6s ease'
      }}
    >
      {/* Diagonal overlay lines for enhanced biophilic feel */}
      <div className="pointer-events-none absolute inset-0">
        <div className="w-full h-full" style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(16, 185, 129, 0.02) 10px, rgba(16, 185, 129, 0.02) 20px)',
          pointerEvents: 'none'
        }}></div>
      </div>

      {/* Main grid container with fluid columns */}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* Mobile: Single column layout */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagonalGrid;