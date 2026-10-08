import React from 'react';
import type { OptionColor } from '../../shared/types.ts';

interface ShapeIconProps {
  color: OptionColor;
  className?: string;
}

/**
 * Renders the geometric symbol for each quiz color:
 * - RED (Kırmızı) -> Daire (Circle)
 * - BLUE (Mavi) -> Üçgen (Triangle)
 * - YELLOW (Sarı) -> Altıgen (Hexagon)
 * - GREEN (Yeşil) -> Kare (Square)
 */
export const ShapeIcon: React.FC<ShapeIconProps> = ({ color, className = 'w-12 h-12' }) => {
  switch (color) {
    case 'RED':
      // Kırmızı Daire (Circle)
      return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
          <circle cx="50" cy="50" r="40" />
        </svg>
      );
    case 'BLUE':
      // Mavi Üçgen (Triangle)
      return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
          <polygon points="50,12 90,86 10,86" strokeLinejoin="round" />
        </svg>
      );
    case 'YELLOW':
      // Sarı Altıgen (Hexagon)
      return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
          <polygon points="50,8 88,29 88,71 50,92 12,71 12,29" strokeLinejoin="round" />
        </svg>
      );
    case 'GREEN':
      // Yeşil Kare (Square)
      return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
          <rect x="14" y="14" width="72" height="72" rx="8" />
        </svg>
      );
  }
};
