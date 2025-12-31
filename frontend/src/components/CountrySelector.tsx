import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { countriesService, Country } from '../services/countryAvatarService';
import '../styles/CountrySelector.css';

interface CountrySelectorProps {
  value?: string;
  onChange: (countryCode: string) => void;
  disabled?: boolean;
  showFlag?: boolean;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  value,
  onChange,
  disabled = false,
  showFlag = true
}) => {
  const { i18n, t } = useTranslation();
  const [countries, setCountries] = useState<Country[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadCountries = async () => {
      setIsLoading(true);
      const data = await countriesService.getCountriesByLanguage(i18n.language);
      setCountries(data);
      setIsLoading(false);
    };

    loadCountries();
  }, [i18n.language]);

  // Filter countries based on search term
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCountry = countries.find(c => c.code === value);
  
  // Get display name even if countries are still loading
  const getSelectedCountryName = (): string => {
    if (selectedCountry) {
      return selectedCountry.name;
    }
    // If no selected country or still loading, show placeholder
    return t('common.select') || 'Select Country';
  };

  // Convert country code to flag code for flagcdn.com
  const getCountryFlagCode = (code: string): string => {
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
      'TN': 'tn', 'DZ': 'dz', 'MA': 'ma', 'LY': 'ly', 'SD': 'sd',
      'GH': 'gh', 'CI': 'ci', 'SN': 'sn', 'CM': 'cm', 'UG': 'ug',
      'TZ': 'tz', 'MZ': 'mz', 'ZM': 'zm', 'ZW': 'zw', 'BW': 'bw',
      'NA': 'na', 'AO': 'ao', 'MG': 'mg', 'MU': 'mu', 'SC': 'sc',
      'TW': 'tw', 'HK': 'hk', 'MO': 'mo', 'KH': 'kh', 'LA': 'la',
      'MM': 'mm', 'NP': 'np', 'LK': 'lk', 'MV': 'mv', 'AF': 'af',
      'UZ': 'uz', 'TJ': 'tj', 'KG': 'kg', 'TM': 'tm', 'KZ': 'kz',
      'QA': 'qa', 'BH': 'bh', 'KW': 'kw', 'OM': 'om', 'YE': 'ye',
      'JO': 'jo', 'LB': 'lb', 'SY': 'sy', 'PS': 'ps', 'EH': 'eh',
      'MR': 'mr', 'ML': 'ml', 'BJ': 'bj', 'TG': 'tg', 'SL': 'sl',
      'LR': 'lr', 'GM': 'gm', 'GW': 'gw', 'CV': 'cv', 'ST': 'st',
      'PA': 'pa', 'CR': 'cr', 'NI': 'ni', 'HN': 'hn', 'SV': 'sv',
      'GT': 'gt', 'BZ': 'bz', 'CU': 'cu', 'DO': 'do', 'HT': 'ht',
      'JM': 'jm', 'TT': 'tt', 'BS': 'bs', 'BB': 'bb', 'AG': 'ag',
      'VC': 'vc', 'LC': 'lc', 'DM': 'dm', 'GD': 'gd', 'KN': 'kn',
      'FJ': 'fj', 'PG': 'pg', 'SB': 'sb', 'VU': 'vu', 'WS': 'ws',
      'TO': 'to', 'KI': 'ki', 'MH': 'mh', 'FM': 'fm', 'PW': 'pw',
      'GU': 'gu', 'MP': 'mp', 'VI': 'vi', 'AS': 'as', 'PR': 'pr',
      'GP': 'gp', 'MQ': 'mq', 'RE': 're', 'YT': 'yt', 'BL': 'bl',
      'MF': 'mf', 'GF': 'gf', 'SR': 'sr', 'GY': 'gy', 'FK': 'fk',
      'AI': 'ai', 'BM': 'bm', 'KY': 'ky', 'GI': 'gi',
      'SJ': 'sj', 'AX': 'ax', 'GG': 'gg', 'JE': 'je', 'IM': 'im',
      'MS': 'ms', 'TC': 'tc', 'VG': 'vg', 'SH': 'sh', 'PN': 'pn',
      'AW': 'aw', 'CW': 'cw', 'BQ': 'bq', 'PM': 'pm'
    };
    return codeMap[code.toUpperCase()] || code.toLowerCase();
  };

  const getCountryFlagUrl = (code: string): string => {
    const flagCode = getCountryFlagCode(code);
    return `https://flagcdn.com/w40/${flagCode}.png`;
  };

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="country-selector">
      <label htmlFor="country-select" className="country-label">
        {t('profile.country') || 'Country'}
      </label>

      <div className="country-input-wrapper">
        <button
          id="country-select"
          type="button"
          className={`country-button ${value ? 'has-value' : ''} ${disabled ? 'disabled' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="country-button-content">
            {showFlag && selectedCountry && (
              <img 
                src={getCountryFlagUrl(selectedCountry.code)} 
                alt={selectedCountry.code}
                className="country-flag-image"
              />
            )}
            <span className="country-name">
              {getSelectedCountryName()}
            </span>
          </span>
          <span className="country-chevron">▼</span>
        </button>

        {isOpen && (
          <div className="country-dropdown">
            <input
              type="text"
              className="country-search"
              placeholder={t('common.search') || 'Search...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />

            {isLoading ? (
              <div className="country-loading">
                {t('common.loading') || 'Loading...'}
              </div>
            ) : filteredCountries.length === 0 ? (
              <div className="country-empty">
                {t('common.noResults') || 'No countries found'}
              </div>
            ) : (
              <ul className="country-list" role="listbox">
                {filteredCountries.map((country) => {
                  return (
                    <li
                      key={country.code}
                      role="option"
                      className={`country-option ${value === country.code ? 'selected' : ''}`}
                      onClick={() => handleSelect(country.code)}
                    >
                      {showFlag && (
                        <img 
                          src={getCountryFlagUrl(country.code)} 
                          alt={country.code}
                          className="country-option-flag-image"
                        />
                      )}
                      <div className="country-option-content">
                        <span className="country-option-name">{country.name}</span>
                        <span className="country-option-code">{country.code}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="country-backdrop"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default CountrySelector;
