import React from 'react';
import '../styles/UserBadge.css';

interface UserBadgeProps {
  country?: string;
  avatar?: string;
  username?: string;
  size?: 'small' | 'medium' | 'large';
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
  const sizeClasses = {
    small: 'user-badge-small',
    medium: 'user-badge-medium',
    large: 'user-badge-large'
  };

  return (
    <div className={`user-badge ${sizeClasses[size]}`}>
      {avatar && (
        <img
          src={avatar}
          alt={username || 'Avatar'}
          className="user-badge-avatar"
          title={username}
        />
      )}
      {country && (
        <img
          src={getCountryFlagUrl(country)}
          alt={country}
          className="user-badge-flag"
          title={country}
        />
      )}
    </div>
  );
};

export default UserBadge;
