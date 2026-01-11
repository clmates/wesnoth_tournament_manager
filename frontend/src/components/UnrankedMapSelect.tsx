import React, { useState, useEffect } from 'react';
import './UnrankedMapSelect.css';

interface UnrankedMapSelectProps {
  selectedMapIds: number[];
  onChange: (mapIds: number[]) => void;
  disabled?: boolean;
  tournamentId?: number;
}

interface Map {
  id: number;
  name: string;
  is_ranked: boolean;
  width?: number;
  height?: number;
  created_at: string;
  used_in_tournaments: number;
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
    name: '',
    width: '',
    height: ''
  });
  const [creatingMap, setCreatingMap] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  // Fetch unranked maps
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/admin/unranked-maps`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch maps');
        }

        const data: ApiResponse = await response.json();
        if (data.success && data.data) {
          setMaps(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMaps();
  }, []);

  const handleMapSelect = (mapId: number) => {
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

    const width = newMapData.width ? parseInt(newMapData.width) : null;
    const height = newMapData.height ? parseInt(newMapData.height) : null;

    if (width && (width < 10 || width > 200)) {
      alert('Width must be between 10 and 200');
      return;
    }

    if (height && (height < 10 || height > 200)) {
      alert('Height must be between 10 and 200');
      return;
    }

    try {
      setCreatingMap(true);
      const response = await fetch(`${API_URL}/admin/unranked-maps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newMapData.name.trim(),
          width,
          height
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create map');
      }

      // Add new map to list
      setMaps([...maps, data.data]);

      // Auto-select the new map
      onChange([...selectedMapIds, data.data.id]);

      // Reset form
      setNewMapData({ name: '', width: '', height: '' });
      setShowModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error creating map');
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

            <div className="input-row">
              <input
                type="number"
                placeholder="Width (10-200)"
                value={newMapData.width}
                onChange={(e) => setNewMapData({ ...newMapData, width: e.target.value })}
                disabled={creatingMap}
                min="10"
                max="200"
              />
              <input
                type="number"
                placeholder="Height (10-200)"
                value={newMapData.height}
                onChange={(e) => setNewMapData({ ...newMapData, height: e.target.value })}
                disabled={creatingMap}
                min="10"
                max="200"
              />
            </div>

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
