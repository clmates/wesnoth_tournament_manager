import React, { useState, useEffect } from 'react';
import { avatarsService } from '../services/countryAvatarService';

interface UserBadgeProps {
  country?: string;
  avatar?: string;
  username?: string;
  size?: 'small' | 'medium-small' | 'medium' | 'large';
}

const getCountryFlagUrl = (countryCode: string): string => {
  const codeMap: Record<string, string> = {
    'US': 'us', 'GB': 'gb', 'DE': 'de', 'FR': 'fr', 'ES': 'es',
    'IT': 'it', 'JP': 'jp', 'CN': 'cn', 'IN': 'in', 'BR': 'br',
    'CA': 'ca', 'AU': 'au', 'MX': 'mx', 'RU': 'ru', 'KR': 'kr',
    'AR': 'ar', 'CL': 'cl', 'CO': 'co', 'PE': 'pe', 'VE': 've',
    'ZA': 'za', 'NG': 'ng', 'EG': 'eg', 'KE': 'ke', 'ET': 'et',
    'NZ': 'nz', 'SG': 'sg', 'TH': 'th', 'MY': 'my', 'ID': 'id',
    'PH': 'ph', 'VN': 'vn', 'TR': 'tr', 'SA': 'sa', 'AE': 'ae',
    'IL': 'il', 'PK': 'pk', 'BD': 'bd', 'IR': 'ir', 'IQ': 'iq',
    'SE': 'se', 'NO': 'no', 'DK': 'dk', 'FI': 'fi', 'PL': 'pl',
    'CZ': 'cz', 'HU': 'hu', 'RO': 'ro', 'GR': 'gr', 'PT': 'pt',
    'BE': 'be', 'NL': 'nl', 'AT': 'at', 'CH': 'ch', 'IE': 'ie',
    'UA': 'ua', 'BY': 'by', 'MD': 'md', 'HR': 'hr', 'RS': 'rs',
    'BG': 'bg', 'SK': 'sk', 'SI': 'si', 'LT': 'lt', 'LV': 'lv',
    'EE': 'ee', 'IS': 'is', 'LU': 'lu', 'MT': 'mt', 'CY': 'cy',
  };
  const flagCode = codeMap[countryCode.toUpperCase()] || countryCode.toLowerCase();
  return `https://flagcdn.com/w40/${flagCode}.png`;
};

export const UserBadge: React.FC<UserBadgeProps> = ({
  country,
  avatar,
  username,
  size = 'medium'
}) => {
  const [avatarPath, setAvatarPath] = useState<string>('');

  useEffect(() => {
    // If avatar is provided, resolve it to the actual path
    if (avatar) {
      // Check if it's already a full path
      if (avatar.startsWith('/') || avatar.startsWith('http')) {
        setAvatarPath(avatar);
      } else {
        // It's likely an avatar ID from the database, need to resolve it
        const resolveAvatar = async () => {
          try {
            const avatars = await avatarsService.getAvatars();
            const found = avatars.find(a => a.id === avatar);
            if (found) {
              setAvatarPath(found.path);
            }
          } catch (error) {
            console.error('Error resolving avatar:', error);
          }
        };
        resolveAvatar();
      }
    }
  }, [avatar]);
  const getSizeClasses = (size: 'small' | 'medium-small' | 'medium' | 'large'): string => {
    switch (size) {
      case 'small':
        return 'gap-1';
      case 'medium-small':
        return 'gap-1.5';
      case 'medium':
        return 'gap-2';
      case 'large':
        return 'gap-2.5';
      default:
        return 'gap-2';
    }
  };

  const getAvatarSize = (size: 'small' | 'medium-small' | 'medium' | 'large'): string => {
    switch (size) {
      case 'small':
        return 'w-5 h-5';
      case 'medium-small':
        return 'w-10 h-10 border shadow-md';
      case 'medium':
        return 'w-8 h-8';
      case 'large':
        return 'w-12 h-12';
      default:
        return 'w-8 h-8';
    }
  };

  const getFlagSize = (size: 'small' | 'medium-small' | 'medium' | 'large'): string => {
    switch (size) {
      case 'small':
        return 'w-4 h-3';
      case 'medium-small':
        return 'w-7 h-5 shadow-sm';
      case 'medium':
        return 'w-6 h-4';
      case 'large':
        return 'w-8 h-6';
      default:
        return 'w-6 h-4';
    }
  };

  // Construct full avatar path if needed
  const getAvatarUrl = (): string => {
    // If we already resolved the path from manifest, use it
    if (avatarPath) {
      return avatarPath;
    }
    // Otherwise, construct the path from the avatar value
    if (!avatar) return '';
    if (avatar.startsWith('/') || avatar.startsWith('http')) {
      return avatar;
    }
    // Encode to handle special characters like parentheses in filenames
    return `/wesnoth-avatars/${encodeURIComponent(avatar)}`;
  };

  const avatarUrl = getAvatarUrl();

  return (
    <div className={`flex items-center ${getSizeClasses(size)}`}>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={username || 'Avatar'}
          className={`${getAvatarSize(size)} rounded border border-gray-300 object-cover flex-shrink-0`}
          title={username}
        />
      )}
      {country && (
        <img
          src={getCountryFlagUrl(country)}
          alt={country}
          className={`${getFlagSize(size)} rounded border border-gray-300 object-cover flex-shrink-0`}
          title={country}
        />
      )}
    </div>
  );
};

export default UserBadge;
