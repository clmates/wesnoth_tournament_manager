import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import MainLayout from '../components/MainLayout';
import '../styles/AdminMapsAndFactions.css';

interface Map {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface MapTranslation {
  id: string;
  map_id: string;
  language_code: string;
  name: string;
  description?: string;
}

interface Faction {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface FactionTranslation {
  id: string;
  faction_id: string;
  language_code: string;
  name: string;
  description?: string;
}

const AdminMapsAndFactions: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'maps' | 'factions'>('maps');
  const [maps, setMaps] = useState<Map[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form states
  const [showMapForm, setShowMapForm] = useState(false);
  const [showFactionForm, setShowFactionForm] = useState(false);
  const [mapFormData, setMapFormData] = useState({ name: '', description: '' });
  const [factionFormData, setFactionFormData] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const languages = ['en', 'es', 'de', 'zh'];

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/');
      return;
    }

    fetchData();
  }, [isAuthenticated, isAdmin, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mapsRes, factionsRes] = await Promise.all([
        api.get('/admin/maps'),
        api.get('/admin/factions'),
      ]);
      setMaps(mapsRes.data || []);
      setFactions(factionsRes.data || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError('Failed to load maps and factions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMap = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const data = {
        name: mapFormData.name,
        description: mapFormData.description || null,
        language_code: 'en',
      };
      await api.post('/admin/maps', data);
      setSuccess('Map added successfully');
      setMapFormData({ name: '', description: '' });
      setShowMapForm(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add map');
    }
  };

  const handleAddFaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const data = {
        name: factionFormData.name,
        description: factionFormData.description || null,
        language_code: 'en',
      };
      await api.post('/admin/factions', data);
      setSuccess('Faction added successfully');
      setFactionFormData({ name: '', description: '' });
      setShowFactionForm(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add faction');
    }
  };

  const handleToggleMapStatus = async (mapId: string, isActive: boolean) => {
    try {
      setError('');
      await api.patch(`/admin/maps/${mapId}`, { is_active: !isActive });
      setSuccess('Map status updated');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update map status');
    }
  };

  const handleToggleFactionStatus = async (factionId: string, isActive: boolean) => {
    try {
      setError('');
      await api.patch(`/admin/factions/${factionId}`, { is_active: !isActive });
      setSuccess('Faction status updated');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update faction status');
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    if (!window.confirm('Are you sure you want to delete this map?')) return;
    try {
      setError('');
      await api.delete(`/admin/maps/${mapId}`);
      setSuccess('Map deleted successfully');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete map');
    }
  };

  const handleDeleteFaction = async (factionId: string) => {
    if (!window.confirm('Are you sure you want to delete this faction?')) return;
    try {
      setError('');
      await api.delete(`/admin/factions/${factionId}`);
      setSuccess('Faction deleted successfully');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete faction');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="admin-container">
          <p>Loading...</p>
        </div>
      </MainLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <MainLayout>
        <div className="admin-container">
          <p>Access denied. Admin only.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="admin-maps-factions-container">
        <h1>Manage Maps & Factions</h1>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'maps' ? 'active' : ''}`}
            onClick={() => setActiveTab('maps')}
          >
            Maps ({maps.length})
          </button>
          <button
            className={`tab ${activeTab === 'factions' ? 'active' : ''}`}
            onClick={() => setActiveTab('factions')}
          >
            Factions ({factions.length})
          </button>
        </div>

        {activeTab === 'maps' && (
          <div className="tab-content">
            <div className="header">
              <h2>Game Maps</h2>
              <button
                className="btn-primary"
                onClick={() => setShowMapForm(!showMapForm)}
              >
                {showMapForm ? 'Cancel' : '+ Add Map'}
              </button>
            </div>

            {showMapForm && (
              <form onSubmit={handleAddMap} className="form-section">
                <div className="form-group">
                  <label>Map Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={mapFormData.name}
                    onChange={(e) =>
                      setMapFormData({ ...mapFormData, name: e.target.value })
                    }
                    placeholder="e.g., Den of Onis"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={mapFormData.description}
                    onChange={(e) =>
                      setMapFormData({ ...mapFormData, description: e.target.value })
                    }
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>
                <button type="submit" className="btn-submit">
                  Add Map
                </button>
              </form>
            )}

            <div className="items-list">
              {maps.length === 0 ? (
                <p>No maps found. Add one to get started.</p>
              ) : (
                maps.map((map) => (
                  <div key={map.id} className={`item ${!map.is_active ? 'inactive' : ''}`}>
                    <div className="item-info">
                      <h3>{map.name}</h3>
                      <p>Created: {new Date(map.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="item-actions">
                      <button
                        className={`btn-status ${map.is_active ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleMapStatus(map.id, map.is_active)}
                      >
                        {map.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteMap(map.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'factions' && (
          <div className="tab-content">
            <div className="header">
              <h2>Factions</h2>
              <button
                className="btn-primary"
                onClick={() => setShowFactionForm(!showFactionForm)}
              >
                {showFactionForm ? 'Cancel' : '+ Add Faction'}
              </button>
            </div>

            {showFactionForm && (
              <form onSubmit={handleAddFaction} className="form-section">
                <div className="form-group">
                  <label>Faction Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={factionFormData.name}
                    onChange={(e) =>
                      setFactionFormData({ ...factionFormData, name: e.target.value })
                    }
                    placeholder="e.g., Elves"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={factionFormData.description}
                    onChange={(e) =>
                      setFactionFormData({ ...factionFormData, description: e.target.value })
                    }
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>
                <button type="submit" className="btn-submit">
                  Add Faction
                </button>
              </form>
            )}

            <div className="items-list">
              {factions.length === 0 ? (
                <p>No factions found. Add one to get started.</p>
              ) : (
                factions.map((faction) => (
                  <div key={faction.id} className={`item ${!faction.is_active ? 'inactive' : ''}`}>
                    <div className="item-info">
                      <h3>{faction.name}</h3>
                      <p>Created: {new Date(faction.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="item-actions">
                      <button
                        className={`btn-status ${faction.is_active ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleFactionStatus(faction.id, faction.is_active)}
                      >
                        {faction.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteFaction(faction.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminMapsAndFactions;
