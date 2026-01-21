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
  is_ranked: boolean;
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
  is_ranked: boolean;
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
  const [mapFormData, setMapFormData] = useState({ name: '', description: '', is_active: true, is_ranked: true });
  const [factionFormData, setFactionFormData] = useState({ name: '', description: '', is_active: true, is_ranked: true });
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
      setError('');
      const [mapsRes, factionsRes] = await Promise.all([
        api.get('/admin/maps'),
        api.get('/admin/factions'),
      ]);
      if (import.meta.env.VITE_DEBUG_LOGS === 'true') {
        console.log('Maps response:', mapsRes.data);
        console.log('Factions response:', factionsRes.data);
      }
      setMaps(mapsRes.data || []);
      setFactions(factionsRes.data || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load maps and factions';
      setError(errorMsg);
      setMaps([]);
      setFactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const data = {
        name: mapFormData.name,
        description: mapFormData.description || null,
        language_code: 'en',
        is_active: mapFormData.is_active,
        is_ranked: mapFormData.is_ranked,
      };

      if (editingId) {
        await api.patch(`/admin/maps/${editingId}`, data);
        setSuccess('Map updated successfully');
      } else {
        await api.post('/admin/maps', data);
        setSuccess('Map added successfully');
      }

      setMapFormData({ name: '', description: '', is_active: true, is_ranked: true });
      setEditingId(null);
      setShowMapForm(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save map');
    }
  };

  const handleEditMap = (map: Map) => {
    setMapFormData({
      name: map.name,
      description: '', // Description requires separate fetch if needed
      is_active: map.is_active,
      is_ranked: map.is_ranked ?? true, // Default to true if undefined
    });
    setEditingId(map.id);
    setShowMapForm(true);
  };

  const handleFactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const data = {
        name: factionFormData.name,
        description: factionFormData.description || null,
        language_code: 'en',
        is_active: factionFormData.is_active,
        is_ranked: factionFormData.is_ranked,
      };

      if (editingId) {
        await api.patch(`/admin/factions/${editingId}`, data);
        setSuccess('Faction updated successfully');
      } else {
        await api.post('/admin/factions', data);
        setSuccess('Faction added successfully');
      }

      setFactionFormData({ name: '', description: '', is_active: true, is_ranked: true });
      setEditingId(null);
      setShowFactionForm(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save faction');
    }
  };

  const handleEditFaction = (faction: Faction) => {
    setFactionFormData({
      name: faction.name,
      description: '',
      is_active: faction.is_active,
      is_ranked: faction.is_ranked ?? true,
    });
    setEditingId(faction.id);
    setShowFactionForm(true);
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
                onClick={() => {
                  setShowMapForm(!showMapForm);
                  setEditingId(null);
                  setMapFormData({ name: '', description: '', is_active: true, is_ranked: true });
                }}
              >
                {showMapForm ? 'Cancel' : '+ Add Map'}
              </button>
            </div>

            {showMapForm && (
              <form onSubmit={handleMapSubmit} className="form-section">
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
                <div className="form-row" style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={mapFormData.is_active}
                      onChange={(e) =>
                        setMapFormData({ ...mapFormData, is_active: e.target.checked })
                      }
                    />
                    Is Active
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={mapFormData.is_ranked}
                      onChange={(e) =>
                        setMapFormData({ ...mapFormData, is_ranked: e.target.checked })
                      }
                    />
                    Is Ranked
                  </label>
                </div>
                <button type="submit" className="btn-submit">
                  {editingId ? 'Update Map' : 'Add Map'}
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
                      <div className="status-badges" style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <span className={`badge ${map.is_active ? 'active' : 'inactive'}`}>
                          {map.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`badge ${map.is_ranked ? 'ranked' : 'unranked'}`} style={{
                          backgroundColor: map.is_ranked ? '#28a745' : '#6c757d',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.8em'
                        }}>
                          {map.is_ranked ? 'Ranked' : 'Unranked'}
                        </span>
                      </div>
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
                        className="btn-status"
                        onClick={() => handleEditMap(map)}
                        style={{ backgroundColor: '#ffc107', color: 'black', marginRight: '8px' }}
                      >
                        Edit
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
                onClick={() => {
                  setShowFactionForm(!showFactionForm);
                  setEditingId(null);
                  setFactionFormData({ name: '', description: '', is_active: true, is_ranked: true });
                }}
              >
                {showFactionForm ? 'Cancel' : '+ Add Faction'}
              </button>
            </div>

            {showFactionForm && (
              <form onSubmit={handleFactionSubmit} className="form-section">
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
                <div className="form-row" style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={factionFormData.is_active}
                      onChange={(e) =>
                        setFactionFormData({ ...factionFormData, is_active: e.target.checked })
                      }
                    />
                    Is Active
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={factionFormData.is_ranked}
                      onChange={(e) =>
                        setFactionFormData({ ...factionFormData, is_ranked: e.target.checked })
                      }
                    />
                    Is Ranked
                  </label>
                </div>
                <button type="submit" className="btn-submit">
                  {editingId ? 'Update Faction' : 'Add Faction'}
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
                      <div className="status-badges" style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <span className={`badge ${faction.is_active ? 'active' : 'inactive'}`}>
                          {faction.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`badge ${faction.is_ranked ? 'ranked' : 'unranked'}`} style={{
                          backgroundColor: faction.is_ranked ? '#28a745' : '#6c757d',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.8em'
                        }}>
                          {faction.is_ranked ? 'Ranked' : 'Unranked'}
                        </span>
                      </div>
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
                        className="btn-status"
                        onClick={() => handleEditFaction(faction)}
                        style={{ backgroundColor: '#ffc107', color: 'black', marginRight: '8px' }}
                      >
                        Edit
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
        )
        }
      </div >
    </MainLayout >
  );
};

export default AdminMapsAndFactions;
