import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';

interface BalanceEventImpactProps {
  eventId?: string;
  onEventChange?: (eventId: string | null) => void;
}

interface BalanceEvent {
  id: string;
  event_date: string;
  patch_version?: string;
  event_type: string;
  description: string;
  faction_name?: string;
  map_name?: string;
  created_by_name?: string;
}

interface ImpactData {
  map_id: string;
  map_name: string;
  faction_id: string;
  faction_name: string;
  opponent_faction_id: string;
  opponent_faction_name: string;
  winrate_before: number;
  winrate_after: number;
  winrate_change: number;
  sample_size_before: number;
  sample_size_after: number;
  games_before: number;
  games_after: number;
}

const BalanceEventImpactPanel: React.FC<BalanceEventImpactProps> = ({ eventId, onEventChange }) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<BalanceEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<BalanceEvent | null>(null);
  const [impactData, setImpactData] = useState<ImpactData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load balance events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const data = await statisticsService.getBalanceEvents({ limit: 100 });
        setEvents(data.sort((a: BalanceEvent, b: BalanceEvent) => 
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        ));
      } catch (err) {
        console.error('Error loading balance events:', err);
      }
    };
    loadEvents();
  }, []);

  // Load impact data when event changes
  useEffect(() => {
    if (selectedEvent?.id) {
      loadEventImpact(selectedEvent.id);
      onEventChange?.(selectedEvent.id);
    } else {
      setImpactData([]);
      onEventChange?.(null);
    }
  }, [selectedEvent]);

  const loadEventImpact = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await statisticsService.getEventImpact(id, 30, 30);
      setImpactData(data);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_loading_impact') || 'Error loading impact data');
      setImpactData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEventSelect = (event: BalanceEvent | null) => {
    setSelectedEvent(event);
  };

  const getChangeColorClass = (change: number) => {
    if (change > 5) return 'positive';
    if (change < -5) return 'negative';
    return 'neutral';
  };

  const eventTypeColor: { [key: string]: string } = {
    BUFF: '#27ae60',
    NERF: '#e74c3c',
    REWORK: '#9b59b6',
    HOTFIX: '#f39c12',
    GENERAL_BALANCE_CHANGE: '#3498db',
  };

  return (
    <div className="balance-event-impact-panel">
      <div className="event-selector-section">
        <h3>{t('select_balance_event') || 'Select Balance Event'}</h3>
        
        <div className="event-selector">
          <button 
            className={`event-option ${!selectedEvent ? 'active' : ''}`}
            onClick={() => handleEventSelect(null)}
          >
            {t('all_accumulated') || 'All (Accumulated)'}
          </button>
          
          {events.map(event => (
            <button
              key={event.id}
              className={`event-option ${selectedEvent?.id === event.id ? 'active' : ''}`}
              onClick={() => handleEventSelect(event)}
              style={{
                borderLeftColor: eventTypeColor[event.event_type] || '#3498db',
              }}
            >
              <span className="event-date">{new Date(event.event_date).toLocaleDateString()}</span>
              <span className="event-type">{event.event_type}</span>
              {event.patch_version && <span className="patch">{event.patch_version}</span>}
            </button>
          ))}
        </div>
      </div>

      {selectedEvent && (
        <div className="event-details-section">
          <div className="event-details-header">
            <h4>{t('event_details') || 'Event Details'}</h4>
            <span 
              className="event-type-badge"
              style={{ background: eventTypeColor[selectedEvent.event_type] || '#3498db' }}
            >
              {selectedEvent.event_type}
            </span>
          </div>
          
          <p className="event-description">{selectedEvent.description}</p>
          
          <div className="event-metadata">
            {selectedEvent.faction_name && (
              <div className="meta-item">
                <span className="label">{t('faction') || 'Faction'}:</span>
                <span className="value">{selectedEvent.faction_name}</span>
              </div>
            )}
            {selectedEvent.map_name && (
              <div className="meta-item">
                <span className="label">{t('map') || 'Map'}:</span>
                <span className="value">{selectedEvent.map_name}</span>
              </div>
            )}
            {selectedEvent.patch_version && (
              <div className="meta-item">
                <span className="label">{t('patch_version') || 'Patch'}:</span>
                <span className="value">{selectedEvent.patch_version}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="label">{t('date') || 'Date'}:</span>
              <span className="value">{new Date(selectedEvent.event_date).toLocaleDateString()}</span>
            </div>
          </div>

          {loading && <div className="loading-message">{t('loading') || 'Loading...'}</div>}
          {error && <div className="error-message">{error}</div>}

          {impactData.length > 0 && (
            <div className="impact-data-section">
              <h5>{t('impact_analysis') || 'Impact Analysis (30 days before/after)'}</h5>
              
              <div className="impact-table-wrapper">
                <table className="impact-table">
                  <thead>
                    <tr>
                      <th>{t('map') || 'Map'}</th>
                      <th>{t('faction') || 'Faction'}</th>
                      <th>{t('vs') || 'vs'}</th>
                      <th>{t('winrate_before') || 'Before'}</th>
                      <th>{t('winrate_after') || 'After'}</th>
                      <th>{t('change') || 'Change'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impactData.map((impact, idx) => (
                      <tr key={`${impact.map_id}-${impact.faction_id}-${impact.opponent_faction_id}-${idx}`}>
                        <td className="map-name">{impact.map_name}</td>
                        <td className="faction-name">{impact.faction_name}</td>
                        <td className="vs">vs</td>
                        <td className="winrate">
                          {impact.winrate_before.toFixed(1)}%
                          <span className="sample-size">({impact.games_before} games)</span>
                        </td>
                        <td className="winrate">
                          {impact.winrate_after.toFixed(1)}%
                          <span className="sample-size">({impact.games_after} games)</span>
                        </td>
                        <td className={`change ${getChangeColorClass(impact.winrate_change)}`}>
                          {impact.winrate_change > 0 ? '+' : ''}{impact.winrate_change.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {impactData.length === 0 && (
                <p className="no-data">{t('no_data_available') || 'No data available for the selected event'}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BalanceEventImpactPanel;
