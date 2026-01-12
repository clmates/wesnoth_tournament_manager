import React, { useState, useEffect } from 'react';
import './UnrankedMapSelect.css';
import { api } from '../services/api';

interface UnrankedMapSelectProps {
  selectedMapIds: string[];
  onChange: (mapIds: string[]) => void;
  disabled?: boolean;
  tournamentId?: string;
}

interface Map {
  id: string;
  name: string;
  is_ranked: boolean;
  width?: number;
  height?: number;
  created_at: string;
  used_in_tournaments: string | number;
}

interface ApiResponse {
  success: boolean;
  data?: Map[];
  error?: string;
}

export const UnrankedMapSelect: React.FC<UnrankedMapSelectProps> = ({
  selectedMapIds,
  onChange,
  disabled = false,
  tournamentId
}) => {
  const [maps, setMaps] = useState<Map[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newMapData, setNewMapData] = useState({
    name: ''
  });
  const [creatingMap, setCreatingMap] = useState(false);

  // Fetch unranked maps
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/unranked-maps');
        const data: ApiResponse = response.data;
        if (data.success && data.data) {
          setMaps(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch maps');
      } finally {
        setLoading(false);
      }
    };

    fetchMaps();
  }, []);

  const handleMapSelect = (mapId: string) => {
    if (selectedMapIds.includes(mapId)) {
      onChange(selectedMapIds.filter(id => id !== mapId));
    } else {
      onChange([...selectedMapIds, mapId]);
    }
  };

  const handleCreateMap = async () => {
    if (!newMapData.name.trim()) {
      alert('Please enter a map name');
      return;
    }

    try {
      setCreatingMap(true);
      const response = await api.post('/admin/unranked-maps', {
        name: newMapData.name.trim()
      });

      const data = response.data;

      // Add new map to list
      setMaps([...maps, data.data]);

      // Auto-select the new map
      onChange([...selectedMapIds, data.data.id]);

      // Reset form
      setNewMapData({ name: '' });
      setShowModal(false);
    } catch (err: any) {
      alert(err.response?.data?.error || (err instanceof Error ? err.message : 'Error creating map'));
    } finally {
      setCreatingMap(false);
    }
  };

  if (loading) {
    return <div className="unranked-map-select loading">Loading maps...</div>;
  }

  return (
    <div className="unranked-map-select">
      <div className="map-list">
        <label className="map-label">Unranked Maps</label>

        {error && <div className="error-message">{error}</div>}

        {maps.length === 0 ? (
          <div className="no-maps">No unranked maps available</div>
        ) : (
          <div className="map-checkboxes">
            {maps.map((map) => (
              <label key={map.id} className="map-checkbox">
                <input
                  type="checkbox"
                  checked={selectedMapIds.includes(map.id)}
                  onChange={() => handleMapSelect(map.id)}
                  disabled={disabled}
                />
                <span className="map-name">{map.name}</span>
                {map.width && map.height && (
                  <span className="map-dimensions">
                    ({map.width}×{map.height})
                  </span>
                )}
                <span className="map-usage">({map.used_in_tournaments} tournaments)</span>
              </label>
            ))}
          </div>
        )}

        <button
          className="add-map-btn"
          onClick={() => setShowModal(true)}
          disabled={disabled}
          type="button"
        >
          + Add New Map
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Unranked Map</h3>

            <input
              type="text"
              placeholder="Map Name"
              value={newMapData.name}
              onChange={(e) => setNewMapData({ ...newMapData, name: e.target.value })}
              disabled={creatingMap}
              maxLength={100}
              autoFocus
            />

            <div className="modal-buttons">
              <button
                onClick={() => setShowModal(false)}
                disabled={creatingMap}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMap}
                disabled={creatingMap || !newMapData.name.trim()}
                className="create-btn"
                type="button"
              >
                {creatingMap ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnrankedMapSelect;
