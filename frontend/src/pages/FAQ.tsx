import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { publicService } from '../services/api';
import { processMultiLanguageItems } from '../utils/languageFallback';

const FAQ: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const [faqItems, setFaqItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchFAQ();
  }, [i18n.language]);

  const fetchFAQ = async () => {
    try {
      setLoading(true);
      const res = await publicService.getFaq();
      const rawFaq = res.data || [];
      // Process with language fallback: use user's language, fallback to EN
      const localizedFaq = processMultiLanguageItems(rawFaq, i18n.language);
      setFaqItems(localizedFaq);
      setError('');
    } catch (err: any) {
      console.error('Error fetching FAQ:', err);
      setError('Error loading FAQ');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return <div className="w-full px-4 py-8"><p>{t('loading') || 'Loading...'}</p></div>;
  }

  return (
    <div className="w-full min-h-screen px-4 py-8 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">{t('faq', 'FAQ')}</h1>

        {error && <p className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6">{error}</p>}

        <section className="bg-white rounded-lg shadow-lg p-8">
          {faqItems.length > 0 ? (
            <div className="flex flex-col gap-4">
              {faqItems.map((item) => (
                <div 
                  key={item.id} 
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => toggleExpanded(item.id)}
                >
                  <div className="flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <h3 className="text-lg font-semibold text-gray-800">{item.question}</h3>
                    <span className="text-2xl text-gray-600 flex-shrink-0 ml-4">
                      {expandedId === item.id ? '▼' : '▶'}
                    </span>
                  </div>
                  {expandedId === item.id && (
                    <p className="p-4 text-gray-700 bg-white border-t border-gray-200">{item.answer}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No FAQ items available for your language</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default FAQ;
