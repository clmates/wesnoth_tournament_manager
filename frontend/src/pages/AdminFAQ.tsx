import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { adminService } from '../services/api';
import MainLayout from '../components/MainLayout';

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
    en: { question: '', answer: '', order: '' },
    es: { question: '', answer: '', order: '' },
    zh: { question: '', answer: '', order: '' },
    de: { question: '', answer: '', order: '' },
    ru: { question: '', answer: '', order: '' }
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
      
      // Sort by question title (English version, or first available language)
      const sortedItems = Object.values(grouped).sort((a: any, b: any) => {
        const questionA = (a.en?.question || a[Object.keys(a)[0]]?.question || '').toLowerCase();
        const questionB = (b.en?.question || b[Object.keys(b)[0]]?.question || '').toLowerCase();
        return questionA.localeCompare(questionB);
      });
      
      setFaqItems(sortedItems);
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
      en: { question: '', answer: '', order: '' },
      es: { question: '', answer: '', order: '' },
      zh: { question: '', answer: '', order: '' },
      de: { question: '', answer: '', order: '' },
      ru: { question: '', answer: '', order: '' }
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
          answer: item[lang].answer,
          order: item[lang].order !== undefined ? String(item[lang].order) : ''
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
    return <MainLayout><div className="max-w-6xl mx-auto px-4 py-8"><p className="text-center text-gray-600">Loading...</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Manage FAQ</h1>

      {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</p>}
      {message && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{message}</p>}

      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Frequently Asked Questions</h2>
          <button onClick={() => {
            if (showForm) {
              resetForm();
            }
            setShowForm(!showForm);
          }} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            {showForm ? 'Cancel' : 'New FAQ Item'}
          </button>
        </div>

        {showForm && (
          <form className="bg-white rounded-lg shadow-md p-6 mb-6" onSubmit={handleSubmit}>
            {/* Language Tabs */}
            <div className="flex border-b border-gray-300 mb-6">
              {languages.map(lang => (
                <button
                  key={lang}
                  type="button"
                  className={`px-4 py-2 font-semibold border-b-2 ${
                    activeLanguageTab === lang
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                  onClick={() => setActiveLanguageTab(lang)}
                >
                  {languageLabels[lang]}
                </button>
              ))}
            </div>

            {/* Language Content */}
            <div className="mb-6">
            <div className="language-content">
              <input
                type="text"
                placeholder="Question"
                value={formData[activeLanguageTab as keyof typeof formData].question}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4"
              />
              {/* Campo order solo editable en inglés, visible en otros idiomas */}
              <input
                type="number"
                placeholder="Order"
                value={formData[activeLanguageTab as keyof typeof formData].order}
                onChange={(e) => {
                  if (activeLanguageTab === 'en') {
                    setFormData({
                      ...formData,
                      en: { ...formData.en, order: e.target.value }
                    });
                  }
                }}
                min={0}
                step={1}
                readOnly={activeLanguageTab !== 'en'}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 ${
                  activeLanguageTab !== 'en' ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                title={activeLanguageTab !== 'en' ? 'Order can only be edited in English' : ''}
              />
            </div>

            <button 
              type="submit" 
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
            >
              {editingId ? 'Update FAQ Item (All Languages)' : 'Add FAQ Item (All Languages)'}
            </button>
          </form>

          <div className="space-y-4">
            {faqItems.map((itemGroup) => {
              const firstLang = languages.find(lang => itemGroup[lang]);
              const id = firstLang ? itemGroup[firstLang].id : '';
              const question = firstLang ? itemGroup[firstLang].question : 'N/A';
              
              return (
                <div key={id} className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">{question}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Multi-language</span>
                  </div>
                  <p className="text-gray-700 mb-4">{itemGroup[firstLang || 'en']?.answer}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(itemGroup)} className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">Edit</button>
                    <button onClick={() => handleDelete(id)} className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-600"  );
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
