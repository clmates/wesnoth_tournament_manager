import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import MainLayout from '../components/MainLayout';
import LanguageSelector from '../components/LanguageSelector';
import '../styles/Admin.css';

const AdminTournaments: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuthStore();
  
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxParticipants: '',
    status: 'active',
    language_code: 'en',
  });

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/');
      return;
    }

    fetchTournaments();
  }, [isAuthenticated, isAdmin, navigate]);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      // Fetch tournaments from backend
      setTournaments([]);
      setError('');
    } catch (err: any) {
      setError('Error loading tournaments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description || !formData.maxParticipants) {
      setError('All fields are required');
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        language_code: selectedLanguage,
      };
      // Create or update tournament
      setMessage('Tournament saved successfully');
      setFormData({ name: '', description: '', maxParticipants: '', status: 'active', language_code: 'en' });
      setSelectedLanguage('en');
      setShowForm(false);
      setSelectedTournament(null);
      fetchTournaments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save tournament');
    }
  };

  const handleDelete = async (tournamentId: string) => {
    if (window.confirm('Are you sure you want to delete this tournament?')) {
      try {
        // Delete tournament
        setMessage('Tournament deleted successfully');
        fetchTournaments();
      } catch (err: any) {
        setError('Failed to delete tournament');
      }
    }
  };

  if (loading) {
    return <MainLayout><div className="admin-container"><p>Loading...</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="admin-container">
      <h1>Manage Tournaments</h1>

      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <section className="tournaments-section">
        <div className="section-header">
          <h2>Active Tournaments</h2>
          <button onClick={() => {
            setShowForm(!showForm);
            if (showForm) setSelectedTournament(null);
          }}>
            {showForm ? 'Cancel' : 'Create Tournament'}
          </button>
        </div>

        {showForm && (
          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <input
                type="text"
                placeholder="Tournament Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <div className="form-language-selector">
                <LanguageSelector
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                  label="Language"
                />
              </div>
            </div>
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
            />
            <input
              type="number"
              placeholder="Max Participants"
              value={formData.maxParticipants}
              onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
              required
              min="2"
            />
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button type="submit">
              {selectedTournament ? 'Update Tournament' : 'Create Tournament'}
            </button>
          </form>
        )}

        {tournaments.length > 0 ? (
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Participants</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((tournament) => (
                <tr key={tournament.id}>
                  <td>{tournament.name}</td>
                  <td>{tournament.description}</td>
                  <td>{tournament.participantCount || 0}</td>
                  <td>
                    <span className={`status ${tournament.status}`}>
                      {tournament.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => {
                        setSelectedTournament(tournament);
                        setFormData({
                          name: tournament.name,
                          description: tournament.description,
                          maxParticipants: tournament.maxParticipants,
                          status: tournament.status,
                          language_code: tournament.language_code || 'en',
                        });
                        setShowForm(true);
                      }}
                      className="btn-edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tournament.id)}
                      className="btn-delete"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No tournaments yet</p>
        )}
      </section>
      </div>
    </MainLayout>
  );
};

export default AdminTournaments;
