import React, { useState } from 'react';

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
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-semibold text-gray-700">{label}</label>}
      <div className="relative inline-block w-full">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => setIsOpen(!isOpen)}
        >
          {currentLanguage && (
            <>
              <img
                src={`https://flagcdn.com/w20/${currentLanguage.countryCode}.png`}
                alt={currentLanguage.code}
                className="w-5 h-4 rounded"
              />
              <span className="flex-grow text-left text-sm font-medium">{currentLanguage.name}</span>
            </>
          )}
          <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
            {languages.map((lang) => (
              <button
                type="button"
                key={lang.code}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0 ${
                  lang.code === selectedLanguage ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                }`}
                onClick={() => handleSelect(lang.code)}
              >
                <img
                  src={`https://flagcdn.com/w20/${lang.countryCode}.png`}
                  alt={lang.code}
                  className="w-5 h-4 rounded"
                />
                <span className="flex-grow text-sm">{lang.name}</span>
                {lang.code === selectedLanguage && <span className="text-lg">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguageSelector;
