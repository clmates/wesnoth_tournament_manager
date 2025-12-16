import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { adminService } from '../services/api';
import MainLayout from '../components/MainLayout';
import '../styles/Admin.css';

const AdminAnnouncements: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuthStore();
  
  const [announcements, setAnnouncements] = useState<any[]>([]);
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
    en: { title: '', content: '' },
    es: { title: '', content: '' },
    zh: { title: '', content: '' },
    de: { title: '', content: '' },
    ru: { title: '', content: '' }
  });

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/');
      return;
    }

    fetchAnnouncements();
  }, [isAuthenticated, isAdmin, navigate]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await adminService.getNews();
      // Group announcements by ID to get all language versions
      const grouped: Record<string, any> = {};
      (res.data || []).forEach((item: any) => {
        if (!grouped[item.id]) {
          grouped[item.id] = {};
        }
        grouped[item.id][item.language_code || 'en'] = item;
      });
      setAnnouncements(Object.values(grouped));
      setError('');
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      setError('Error loading announcements');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      en: { title: '', content: '' },
      es: { title: '', content: '' },
      zh: { title: '', content: '' },
      de: { title: '', content: '' },
      ru: { title: '', content: '' }
    });
    setActiveLanguageTab('en');
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that English is required
    if (!formData.en.title || !formData.en.content) {
      setError('English (title and content) is required');
      return;
    }

    try {
      if (editingId) {
        await adminService.updateNews(editingId, formData);
        setMessage('Announcement updated successfully');
      } else {
        await adminService.createNews(formData);
        setMessage('Announcement created successfully');
      }

      resetForm();
      setShowForm(false);
      fetchAnnouncements();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save announcement');
    }
  };

  const handleEdit = (announcementGroup: any) => {
    const newFormData = { ...formData };
    languages.forEach(lang => {
      if (announcementGroup[lang]) {
        newFormData[lang as keyof typeof newFormData] = {
          title: announcementGroup[lang].title,
          content: announcementGroup[lang].content
        };
      }
    });
    setFormData(newFormData);
    setEditingId(announcementGroup.en?.id || announcementGroup[languages[0]]?.id);
    setActiveLanguageTab('en');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this announcement (all languages)?')) {
      try {
        await adminService.deleteNews(id);
        setMessage('Announcement deleted successfully');
        fetchAnnouncements();
        setTimeout(() => setMessage(''), 3000);
      } catch (err: any) {
        setError('Failed to delete announcement');
      }
    }
  };

  if (loading) {
    return <MainLayout><div className="admin-container"><p>Loading...</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="admin-container">
      <h1>Manage Announcements</h1>

      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <section className="announcements-section">
        <div className="section-header">
          <h2>Announcements</h2>
          <button onClick={() => {
            if (showForm) {
              resetForm();
            }
            setShowForm(!showForm);
          }}>
            {showForm ? 'Cancel' : 'New Announcement'}
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
                placeholder="Title"
                value={formData[activeLanguageTab as keyof typeof formData].title}
                onChange={(e) => setFormData({
                  ...formData,
                  [activeLanguageTab]: { ...formData[activeLanguageTab as keyof typeof formData], title: e.target.value }
                })}
                required
              />
              <textarea
                placeholder="Content"
                value={formData[activeLanguageTab as keyof typeof formData].content}
                onChange={(e) => setFormData({
                  ...formData,
                  [activeLanguageTab]: { ...formData[activeLanguageTab as keyof typeof formData], content: e.target.value }
                })}
                rows={5}
                required
              />
            </div>

            <button type="submit">
              {editingId ? 'Update Announcement (All Languages)' : 'Create Announcement (All Languages)'}
            </button>
          </form>
        )}

        {announcements.length > 0 ? (
          <div className="items-list">
            {announcements.map((annGroup) => {
              const firstLang = languages.find(lang => annGroup[lang]);
              const id = firstLang ? annGroup[firstLang].id : '';
              const title = firstLang ? annGroup[firstLang].title : 'N/A';
              const publishedAt = firstLang ? annGroup[firstLang].published_at : '';
              const author = firstLang ? annGroup[firstLang].author : '';
              
              return (
                <div key={id} className="announcement-item">
                  <div className="item-header">
                    <h3>{title}</h3>
                    <span className="language-badge">Multi-language</span>
                  </div>
                  <p>{annGroup[firstLang || 'en']?.content}</p>
                  {author && publishedAt && (
                    <small>By {author} on {new Date(publishedAt).toLocaleDateString()}</small>
                  )}
                  <div className="item-actions">
                    <button onClick={() => handleEdit(annGroup)} className="btn-edit">Edit</button>
                    <button onClick={() => handleDelete(id)} className="btn-delete">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p>No announcements yet</p>
        )}
      </section>
      </div>
    </MainLayout>
  );
};

export default AdminAnnouncements;
