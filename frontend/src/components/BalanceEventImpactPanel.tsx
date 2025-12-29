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
  winrate: number;
  total_games: number;
  wins: number;
  losses: number;
  snapshot_date: string;
  days_since_event: number;
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
      const data = await statisticsService.getEventImpact(id);
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

  const getChangeColorClass = (winrate: number) => {
    if (winrate > 55) return 'high';
    if (winrate < 45) return 'low';
    return 'balanced';
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
        
        <select 
          value={selectedEvent?.id || ''} 
          onChange={(e) => {
            if (e.target.value === '') {
              handleEventSelect(null);
            } else {
              const event = events.find(ev => ev.id === e.target.value);
              if (event) handleEventSelect(event);
            }
          }}
          className="event-dropdown"
        >
          <option value="">{t('all_accumulated') || 'All (Accumulated)'}</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>
              {new Date(event.event_date).toLocaleDateString()} - {event.event_type}
              {event.patch_version ? ` [${event.patch_version}]` : ''}
              {event.description ? ` - ${event.description.substring(0, 30)}${event.description.length > 30 ? '...' : ''}` : ''}
            </option>
          ))}
        </select>
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
              <h5>{t('impact_analysis') || 'Balance Statistics from Event Date'}</h5>
              
              <div className="impact-table-wrapper">
                <table className="impact-table">
                  <thead>
                    <tr>
                      <th>{t('date') || 'Date'}</th>
                      <th>{t('days_since') || 'Days'}</th>
                      <th>{t('map') || 'Map'}</th>
                      <th>{t('faction') || 'Faction'}</th>
                      <th colSpan={3} style={{ textAlign: 'center' }}>{t('matchup') || 'Matchup'}</th>
                      <th>{t('winrate') || 'Win Rate'}</th>
                      <th>{t('games') || 'Games'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impactData.map((impact, idx) => (
                      <tr key={`${impact.map_id}-${impact.faction_id}-${impact.opponent_faction_id}-${impact.snapshot_date}-${idx}`}>
                        <td className="date">{new Date(impact.snapshot_date).toLocaleDateString()}</td>
                        <td className="days">{impact.days_since_event}</td>
                        <td className="map-name">{impact.map_name}</td>
                        <td className="faction-name">{impact.faction_name}</td>
                        <td style={{ textAlign: 'right' }}>{impact.faction_name}</td>
                        <td style={{ textAlign: 'center' }}>{t('vs') || 'vs'}</td>
                        <td style={{ textAlign: 'left' }}>{impact.opponent_faction_name}</td>
                        <td className={`winrate ${getChangeColorClass(impact.winrate)}`}>
                          {impact.winrate.toFixed(1)}%
                        </td>
                        <td className="games">{impact.total_games}</td>
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
