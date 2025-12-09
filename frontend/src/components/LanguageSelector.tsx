import React, { useState } from 'react';
import '../styles/LanguageSelector.css';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  label?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onLanguageChange,
  label = 'Language',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English', countryCode: 'us' },
    { code: 'es', name: 'Español', countryCode: 'es' },
    { code: 'zh', name: '中文', countryCode: 'cn' },
    { code: 'de', name: 'Deutsch', countryCode: 'de' },
    { code: 'ru', name: 'Русский', countryCode: 'ru' },
  ];

  const currentLanguage = languages.find(l => l.code === selectedLanguage);

  const handleSelect = (code: string) => {
    onLanguageChange(code);
    setIsOpen(false);
  };

  return (
    <div className="language-selector-wrapper">
      {label && <label className="language-label">{label}</label>}
      <div className="language-selector-container">
        <button
          className="language-selector-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          {currentLanguage && (
            <>
              <img
                src={`https://flagcdn.com/w20/${currentLanguage.countryCode}.png`}
                alt={currentLanguage.code}
                className="flag-img"
              />
              <span>{currentLanguage.name}</span>
            </>
          )}
          <span className="dropdown-arrow">▼</span>
        </button>

        {isOpen && (
          <div className="language-selector-menu">
            {languages.map((lang) => (
              <button
                key={lang.code}
                className={`language-selector-option ${lang.code === selectedLanguage ? 'active' : ''}`}
                onClick={() => handleSelect(lang.code)}
              >
                <img
                  src={`https://flagcdn.com/w20/${lang.countryCode}.png`}
                  alt={lang.code}
                  className="flag-img"
                />
                <span>{lang.name}</span>
                {lang.code === selectedLanguage && <span className="checkmark">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguageSelector;
