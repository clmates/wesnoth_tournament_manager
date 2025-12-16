import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { adminService } from '../services/api';
import MainLayout from '../components/MainLayout';
import '../styles/Admin.css';

const AdminFAQ: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuthStore();
  
  const [faqItems, setFaqItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeLanguageTab, setActiveLanguageTab] = useState('en');
  
  const languages = ['en', 'es', 'zh', 'de', 'ru'];
  const languageLabels: Record<string, string> = {
    en: 'English',
    es: 'Español',
    zh: '中文',
    de: 'Deutsch',
    ru: 'Русский'
  };

  const [formData, setFormData] = useState({
    en: { question: '', answer: '' },
    es: { question: '', answer: '' },
    zh: { question: '', answer: '' },
    de: { question: '', answer: '' },
    ru: { question: '', answer: '' }
  });

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/');
      return;
    }

    fetchFAQ();
  }, [isAuthenticated, isAdmin, navigate]);

  const fetchFAQ = async () => {
    try {
      setLoading(true);
      const res = await adminService.getFaq();
      // Group FAQ items by ID to get all language versions
      const grouped: Record<string, any> = {};
      (res.data || []).forEach((item: any) => {
        if (!grouped[item.id]) {
          grouped[item.id] = {};
        }
        grouped[item.id][item.language_code || 'en'] = item;
      });
      setFaqItems(Object.values(grouped));
      setError('');
    } catch (err: any) {
      console.error('Error fetching FAQ:', err);
      setError('Error loading FAQ');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      en: { question: '', answer: '' },
      es: { question: '', answer: '' },
      zh: { question: '', answer: '' },
      de: { question: '', answer: '' },
      ru: { question: '', answer: '' }
    });
    setActiveLanguageTab('en');
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that English is required
    if (!formData.en.question || !formData.en.answer) {
      setError('English (question and answer) is required');
      return;
    }

    try {
      if (editingId) {
        await adminService.updateFaq(editingId, formData);
        setMessage('FAQ item updated successfully');
      } else {
        await adminService.createFaq(formData);
        setMessage('FAQ item created successfully');
      }

      resetForm();
      setShowForm(false);
      fetchFAQ();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save FAQ item');
    }
  };

  const handleEdit = (item: any) => {
    const newFormData = { ...formData };
    languages.forEach(lang => {
      if (item[lang]) {
        newFormData[lang as keyof typeof newFormData] = {
          question: item[lang].question,
          answer: item[lang].answer
        };
      }
    });
    setFormData(newFormData);
    setEditingId(item.en?.id || item[languages[0]]?.id);
    setActiveLanguageTab('en');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this FAQ item (all languages)?')) {
      try {
        await adminService.deleteFaq(id);
        setMessage('FAQ item deleted successfully');
        fetchFAQ();
        setTimeout(() => setMessage(''), 3000);
      } catch (err: any) {
        setError('Failed to delete FAQ item');
      }
    }
  };

  if (loading) {
    return <MainLayout><div className="admin-container"><p>Loading...</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="admin-container">
      <h1>Manage FAQ</h1>

      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <section className="faq-section">
        <div className="section-header">
          <h2>Frequently Asked Questions</h2>
          <button onClick={() => {
            if (showForm) {
              resetForm();
            }
            setShowForm(!showForm);
          }}>
            {showForm ? 'Cancel' : 'New FAQ Item'}
          </button>
        </div>

        {showForm && (
          <form className="admin-form" onSubmit={handleSubmit}>
            {/* Language Tabs */}
            <div className="language-tabs">
              {languages.map(lang => (
                <button
                  key={lang}
                  type="button"
                  className={`language-tab ${activeLanguageTab === lang ? 'active' : ''}`}
                  onClick={() => setActiveLanguageTab(lang)}
                >
                  {languageLabels[lang]}
                </button>
              ))}
            </div>

            {/* Language Content */}
            <div className="language-content">
              <input
                type="text"
                placeholder="Question"
                value={formData[activeLanguageTab as keyof typeof formData].question}
                onChange={(e) => setFormData({
                  ...formData,
                  [activeLanguageTab]: { ...formData[activeLanguageTab as keyof typeof formData], question: e.target.value }
                })}
                required
              />
              <textarea
                placeholder="Answer"
                value={formData[activeLanguageTab as keyof typeof formData].answer}
                onChange={(e) => setFormData({
                  ...formData,
                  [activeLanguageTab]: { ...formData[activeLanguageTab as keyof typeof formData], answer: e.target.value }
                })}
                rows={5}
                required
              />
            </div>

            <button type="submit">
              {editingId ? 'Update FAQ Item (All Languages)' : 'Add FAQ Item (All Languages)'}
            </button>
          </form>
        )}

        {faqItems.length > 0 ? (
          <div className="items-list">
            {faqItems.map((itemGroup) => {
              const firstLang = languages.find(lang => itemGroup[lang]);
              const id = firstLang ? itemGroup[firstLang].id : '';
              const question = firstLang ? itemGroup[firstLang].question : 'N/A';
              
              return (
                <div key={id} className="faq-item">
                  <div className="item-header">
                    <h3>{question}</h3>
                    <span className="language-badge">Multi-language</span>
                  </div>
                  <p>{itemGroup[firstLang || 'en']?.answer}</p>
                  <div className="item-actions">
                    <button onClick={() => handleEdit(itemGroup)} className="btn-edit">Edit</button>
                    <button onClick={() => handleDelete(id)} className="btn-delete">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p>No FAQ items yet</p>
        )}
      </section>
      </div>
    </MainLayout>
  );
};

export default AdminFAQ;
