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
              <span className="country-flag">{selectedCountry.flag}</span>
            )}
            <span className="country-name">
              {selectedCountry?.name || t('common.select') || 'Select Country'}
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
                  const flag = country.flag || '🌍';
                  console.log('🎌 Rendering country:', country.code, 'flag:', flag);
                  return (
                    <li
                      key={country.code}
                      role="option"
                      className={`country-option ${value === country.code ? 'selected' : ''}`}
                      onClick={() => handleSelect(country.code)}
                    >
                      {showFlag && (
                        <span className="country-option-flag">{flag}</span>
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
