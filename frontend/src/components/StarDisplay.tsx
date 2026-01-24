import React from 'react';
import { useTranslation } from 'react-i18next';

interface StarDisplayProps {
  rating?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const StarDisplay: React.FC<StarDisplayProps> = ({ rating, size = 'md', showLabel = false }) => {
  const { t } = useTranslation();

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const getLabel = (r: number): string => {
    const labelMap: { [key: number]: string } = {
      1: t('report.rating_1'),
      2: t('report.rating_2'),
      3: t('report.rating_3'),
      4: t('report.rating_4'),
      5: t('report.rating_5'),
    };
    return labelMap[r] || '';
  };

  if (!rating || rating === 0) {
    return (
      <span className="inline-flex items-center gap-1" title={t('common.no_rating') || 'No rating'}>
        <svg
          className={`${sizeClasses[size]} text-gray-300`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        {showLabel && <span className="text-xs text-gray-500">{t('common.no_rating')}</span>}
      </span>
    );
  }

  const numRating = Math.min(Math.max(parseInt(String(rating)), 0), 5);

  return (
    <span
      className="inline-flex items-center gap-1 group"
      title={`${numRating} - ${getLabel(numRating)}`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sizeClasses[size]} ${
            star <= numRating ? 'text-yellow-400' : 'text-gray-300'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      
      {/* Tooltip with rating label */}
      {showLabel && (
        <span className="text-xs text-gray-600 ml-1 group-hover:text-gray-800">
          {numRating}
        </span>
      )}
    </span>
  );
};

export default StarDisplay;
