import React, { useState, useEffect } from 'react';
import './UnrankedMapSelect.css';
import { api } from '../services/api';

interface UnrankedMapSelectProps {
  selectedMapIds: string[];
  onChange: (mapIds: string[]) => void;
  disabled?: boolean;
  tournamentId?: string;
  isRankedOnly?: boolean;
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
  tournamentId,
  isRankedOnly = false
}) => {
  const [maps, setMaps] = useState<Map[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newMapData, setNewMapData] = useState({
    name: ''
  });
  const [creatingMap, setCreatingMap] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Fetch unranked maps
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/unranked-maps');
        const data: ApiResponse = response.data;
        if (data.success && data.data) {
          // Filter by ranked status if isRankedOnly is true
          const filtered = isRankedOnly ? data.data.filter(m => m.is_ranked) : data.data;
          setMaps(filtered);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch maps');
      } finally {
        setLoading(false);
      }
    };

    fetchMaps();
  }, [isRankedOnly]);

  // Track select all state
  useEffect(() => {
    if (maps.length > 0) {
      setSelectAll(selectedMapIds.length === maps.length);
    }
  }, [selectedMapIds, maps.length]);

  const handleMapSelect = (mapId: string) => {
    if (selectedMapIds.includes(mapId)) {
      onChange(selectedMapIds.filter(id => id !== mapId));
    } else {
      onChange([...selectedMapIds, mapId]);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      onChange([]);
    } else {
      onChange(maps.map(m => m.id));
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
      <div className="map-container">
        <div className="map-header">
          <h4>Maps</h4>
          <span className="count">{selectedMapIds.length} / {maps.length}</span>
        </div>

        {error && <div className="error-message">{error}</div>}

        {maps.length === 0 ? (
          <div className="no-items">No maps available</div>
        ) : (
          <>
            <div className="select-all-wrapper">
              <label className="checkbox-row header-row">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  disabled={disabled}
                />
                <span className="select-all-text">Select All</span>
              </label>
            </div>

            <div className="map-table">
              {maps.map((map) => (
                <label key={map.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedMapIds.includes(map.id)}
                    onChange={() => handleMapSelect(map.id)}
                    disabled={disabled}
                  />
                  <span className="map-name">{map.name}</span>
                  {map.width && map.height && (
                    <span className="map-dims">{map.width}×{map.height}</span>
                  )}
                </label>
              ))}
            </div>
          </>
        )}

        {!isRankedOnly && (
          <button
            className="add-btn"
            onClick={() => setShowModal(true)}
            disabled={disabled}
            type="button"
          >
            + New Map
          </button>
        )}
      </div>

      {!isRankedOnly && showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Map</h3>

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
