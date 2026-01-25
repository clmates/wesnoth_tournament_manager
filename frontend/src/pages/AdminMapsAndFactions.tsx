import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import MainLayout from '../components/MainLayout';

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
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-center text-red-600">Access denied. Admin only.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Manage Maps & Factions</h1>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
        {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{success}</div>}

        <div className="flex border-b border-gray-300 mb-6">
          <button
            className={`px-4 py-2 font-semibold border-b-2 ${
              activeTab === 'maps'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('maps')}
          >
            Maps ({maps.length})
          </button>
          <button
            className={`px-4 py-2 font-semibold border-b-2 ${
              activeTab === 'factions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('factions')}
          >
            Factions ({factions.length})
          </button>
        </div>

        {activeTab === 'maps' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Game Maps</h2>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
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
              <form onSubmit={handleMapSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Map Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={mapFormData.name}
                    onChange={(e) =>
                      setMapFormData({ ...mapFormData, name: e.target.value })
                    }
                    placeholder="e.g., Den of Onis"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Description</label>
                  <textarea
                    value={mapFormData.description}
                    onChange={(e) =>
                      setMapFormData({ ...mapFormData, description: e.target.value })
                    }
                    placeholder="Optional description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-5 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mapFormData.is_active}
                      onChange={(e) =>
                        setMapFormData({ ...mapFormData, is_active: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    Is Active
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mapFormData.is_ranked}
                      onChange={(e) =>
                        setMapFormData({ ...mapFormData, is_ranked: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    Is Ranked
                  </label>
                </div>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {editingId ? 'Update Map' : 'Add Map'}
                </button>
              </form>
            )}

            <div className="space-y-4">
              {maps.length === 0 ? (
                <p className="text-gray-600">No maps found. Add one to get started.</p>
              ) : (
                maps.map((map) => (
                  <div key={map.id} className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${
                    !map.is_active ? 'border-gray-400' : 'border-blue-500'
                  }`}>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800">{map.name}</h3>
                      <div className="flex gap-2 mt-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          map.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {map.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          map.is_ranked
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {map.is_ranked ? 'Ranked' : 'Unranked'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">Created: {new Date(map.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className={`px-3 py-1 text-sm rounded-lg font-semibold ${
                          map.is_active
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-500 text-white hover:bg-gray-600'
                        }`}
                        onClick={() => handleToggleMapStatus(map.id, map.is_active)}
                      >
                        {map.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        className="px-3 py-1 text-sm bg-yellow-500 text-black rounded-lg font-semibold hover:bg-yellow-600"
                        onClick={() => handleEditMap(map)}
                      >
                        Edit
                      </button>
                      <button
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
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
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Factions</h2>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
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
              <form onSubmit={handleFactionSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Faction Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={factionFormData.name}
                    onChange={(e) =>
                      setFactionFormData({ ...factionFormData, name: e.target.value })
                    }
                    placeholder="e.g., Elves"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-semibold mb-2">Description</label>
                  <textarea
                    value={factionFormData.description}
                    onChange={(e) =>
                      setFactionFormData({ ...factionFormData, description: e.target.value })
                    }
                    placeholder="Optional description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-5 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={factionFormData.is_active}
                      onChange={(e) =>
                        setFactionFormData({ ...factionFormData, is_active: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    Is Active
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={factionFormData.is_ranked}
                      onChange={(e) =>
                        setFactionFormData({ ...factionFormData, is_ranked: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    Is Ranked
                  </label>
                </div>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {editingId ? 'Update Faction' : 'Add Faction'}
                </button>
              </form>
            )}

            <div className="space-y-4">
              {factions.length === 0 ? (
                <p className="text-gray-600">No factions found. Add one to get started.</p>
              ) : (
                factions.map((faction) => (
                  <div key={faction.id} className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${
                    !faction.is_active ? 'border-gray-400' : 'border-blue-500'
                  }`}>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800">{faction.name}</h3>
                      <div className="flex gap-2 mt-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          faction.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {faction.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          faction.is_ranked
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {faction.is_ranked ? 'Ranked' : 'Unranked'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">Created: {new Date(faction.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className={`px-3 py-1 text-sm rounded-lg font-semibold ${
                          faction.is_active
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-500 text-white hover:bg-gray-600'
                        }`}
                        onClick={() => handleToggleFactionStatus(faction.id, faction.is_active)}
                      >
                        {faction.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        className="px-3 py-1 text-sm bg-yellow-500 text-black rounded-lg font-semibold hover:bg-yellow-600"
                        onClick={() => handleEditFaction(faction)}
                      >
                        Edit
                      </button>
                      <button
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
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
