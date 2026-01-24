import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface StarRatingProps {
  value: string;
  onChange: (value: string) => void;
  ratingLabels?: {
    [key: number]: string;
  };
}

const StarRating: React.FC<StarRatingProps> = ({ value, onChange, ratingLabels }) => {
  const { t } = useTranslation();
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  
  const currentValue = value ? parseInt(value) : 0;
  const displayValue = hoverValue || currentValue;

  const getLabel = (rating: number): string => {
    if (ratingLabels && ratingLabels[rating]) {
      return ratingLabels[rating];
    }
    
    // Fallback to translation keys
    const labelMap: { [key: number]: string } = {
      1: t('report.rating_1'),
      2: t('report.rating_2'),
      3: t('report.rating_3'),
      4: t('report.rating_4'),
      5: t('report.rating_5'),
    };
    
    return labelMap[rating] || '';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(currentValue === rating ? '' : rating.toString())}
            onMouseEnter={() => setHoverValue(rating)}
            onMouseLeave={() => setHoverValue(null)}
            className="relative group"
            title={`${rating} - ${getLabel(rating)}`}
          >
            {/* Background star (empty) */}
            <svg
              className="w-8 h-8 text-gray-300"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>

            {/* Filled star overlay */}
            {displayValue >= rating && (
              <svg
                className="absolute top-0 left-0 w-8 h-8 text-yellow-400 transition-all duration-150"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}

            {/* Tooltip */}
            <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10">
              {rating} - {getLabel(rating)}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
            </div>
          </button>
        ))}
      </div>
      
      {/* Clear button - shown when a value is selected */}
      {currentValue > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-xs text-gray-500 hover:text-gray-700 ml-2"
          title={t('common.clear') || 'Clear'}
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default StarRating;
