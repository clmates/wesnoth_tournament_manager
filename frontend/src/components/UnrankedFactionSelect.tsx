import React, { useState, useEffect } from 'react';
import './UnrankedFactionSelect.css';
import { api } from '../services/api';

interface UnrankedFactionSelectProps {
  selectedFactionIds: string[];
  onChange: (factionIds: string[]) => void;
  disabled?: boolean;
  tournamentId?: string;
}

interface Faction {
  id: string;
  name: string;
  is_ranked: boolean;
  created_at: string;
  used_in_tournaments: string | number;
}

interface ApiResponse {
  success: boolean;
  data?: Faction[];
  error?: string;
}

export const UnrankedFactionSelect: React.FC<UnrankedFactionSelectProps> = ({
  selectedFactionIds,
  onChange,
  disabled = false,
  tournamentId
}) => {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newFactionName, setNewFactionName] = useState('');
  const [creatingFaction, setCreatingFaction] = useState(false);

  // Fetch unranked factions
  useEffect(() => {
    const fetchFactions = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/unranked-factions');
        const data: ApiResponse = response.data;
        if (data.success && data.data) {
          setFactions(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch factions');
      } finally {
        setLoading(false);
      }
    };

    fetchFactions();
  }, []);

  const handleFactionSelect = (factionId: string) => {
    if (selectedFactionIds.includes(factionId)) {
      onChange(selectedFactionIds.filter(id => id !== factionId));
    } else {
      onChange([...selectedFactionIds, factionId]);
    }
  };

  const handleCreateFaction = async () => {
    if (!newFactionName.trim()) {
      alert('Please enter a faction name');
      return;
    }

    try {
      setCreatingFaction(true);
      const response = await api.post('/admin/unranked-factions', { 
        name: newFactionName.trim() 
      });

      const data = response.data;

      // Add new faction to list
      setFactions([...factions, data.data]);

      // Auto-select the new faction
      onChange([...selectedFactionIds, data.data.id]);

      // Reset form
      setNewFactionName('');
      setShowModal(false);
    } catch (err: any) {
      alert(err.response?.data?.error || (err instanceof Error ? err.message : 'Error creating faction'));
    } finally {
      setCreatingFaction(false);
    }
  };

  if (loading) {
    return <div className="unranked-faction-select loading">Loading factions...</div>;
  }

  return (
    <div className="unranked-faction-select">
      <div className="faction-list">
        <label className="faction-label">Unranked Factions</label>

        {error && <div className="error-message">{error}</div>}

        {factions.length === 0 ? (
          <div className="no-factions">No unranked factions available</div>
        ) : (
          <div className="faction-checkboxes">
            {factions.map((faction) => (
              <label key={faction.id} className="faction-checkbox">
                <input
                  type="checkbox"
                  checked={selectedFactionIds.includes(faction.id)}
                  onChange={() => handleFactionSelect(faction.id)}
                  disabled={disabled}
                />
                <span className="faction-name">{faction.name}</span>
                <span className="faction-usage">({faction.used_in_tournaments} tournaments)</span>
              </label>
            ))}
          </div>
        )}

        <button
          className="add-faction-btn"
          onClick={() => setShowModal(true)}
          disabled={disabled}
          type="button"
        >
          + Add New Faction
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Unranked Faction</h3>

            <input
              type="text"
              placeholder="Faction Name"
              value={newFactionName}
              onChange={(e) => setNewFactionName(e.target.value)}
              disabled={creatingFaction}
              maxLength={100}
              autoFocus
            />

            <div className="modal-buttons">
              <button
                onClick={() => setShowModal(false)}
                disabled={creatingFaction}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFaction}
                disabled={creatingFaction || !newFactionName.trim()}
                className="create-btn"
                type="button"
              >
                {creatingFaction ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnrankedFactionSelect;
