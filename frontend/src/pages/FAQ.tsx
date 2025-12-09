import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { publicService } from '../services/api';
import { processMultiLanguageItems } from '../utils/languageFallback';
import '../styles/Admin.css';

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
    return <div className="admin-container"><p>Loading...</p></div>;
  }

  return (
    <div className="admin-container">
      <h1>{t('faq', 'FAQ')}</h1>

      {error && <p className="error-message">{error}</p>}

      <section className="faq-section">
        {faqItems.length > 0 ? (
          <div className="items-list">
            {faqItems.map((item) => (
              <div 
                key={item.id} 
                className={`faq-item ${expandedId === item.id ? 'expanded' : ''}`}
                onClick={() => toggleExpanded(item.id)}
              >
                <div className="item-header">
                  <h3>{item.question}</h3>
                  <span className="expand-icon">{expandedId === item.id ? '▼' : '▶'}</span>
                </div>
                {expandedId === item.id && (
                  <p className="faq-answer">{item.answer}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No FAQ items available for your language</p>
        )}
      </section>
    </div>
  );
};

export default FAQ;
