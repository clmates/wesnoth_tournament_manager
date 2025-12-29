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

interface AggregatedData {
  map_name: string;
  faction_name: string;
  opponent_faction_name: string;
  winrate: number;
  total_games: number;
  wins: number;
  losses: number;
}

const BalanceEventImpactPanel: React.FC<BalanceEventImpactProps> = ({ eventId, onEventChange }) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<BalanceEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<BalanceEvent | null>(null);
  const [impactData, setImpactData] = useState<ImpactData[]>([]);
  const [beforeData, setBeforeData] = useState<AggregatedData[]>([]);
  const [afterData, setAfterData] = useState<AggregatedData[]>([]);
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
      // Convert string values to numbers if needed
      const convertedData = data.map((item: any) => ({
        ...item,
        winrate: typeof item.winrate === 'string' ? parseFloat(item.winrate) : item.winrate,
        total_games: typeof item.total_games === 'string' ? parseInt(item.total_games) : item.total_games,
        wins: typeof item.wins === 'string' ? parseInt(item.wins) : item.wins,
        losses: typeof item.losses === 'string' ? parseInt(item.losses) : item.losses,
        days_since_event: typeof item.days_since_event === 'string' ? parseInt(item.days_since_event) : item.days_since_event,
      }));
      setImpactData(convertedData);
      
      // Aggregate data before and after event
      if (selectedEvent) {
        const eventDate = new Date(selectedEvent.event_date).getTime();
        
        const before = convertedData.filter((d: ImpactData) => new Date(d.snapshot_date).getTime() < eventDate);
        const after = convertedData.filter((d: ImpactData) => new Date(d.snapshot_date).getTime() >= eventDate);
        
        // Aggregate before data
        const beforeAgg = aggregateData(before);
        setBeforeData(beforeAgg);
        
        // Aggregate after data
        const afterAgg = aggregateData(after);
        setAfterData(afterAgg);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_loading_impact') || 'Error loading impact data');
      setImpactData([]);
      setBeforeData([]);
      setAfterData([]);
    } finally {
      setLoading(false);
    }
  };

  const aggregateData = (snapshots: ImpactData[]): AggregatedData[] => {
    const aggregated = new Map<string, { wins: number; losses: number; total: number }>();
    
    snapshots.forEach(snapshot => {
      const key = `${snapshot.map_name}|${snapshot.faction_name}|${snapshot.opponent_faction_name}`;
      const current = aggregated.get(key) || { wins: 0, losses: 0, total: 0 };
      
      aggregated.set(key, {
        wins: current.wins + snapshot.wins,
        losses: current.losses + snapshot.losses,
        total: current.total + snapshot.total_games,
      });
    });
    
    return Array.from(aggregated.entries()).map(([key, stats]) => {
      const [mapName, factionName, opponentName] = key.split('|');
      return {
        map_name: mapName,
        faction_name: factionName,
        opponent_faction_name: opponentName,
        winrate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
        total_games: stats.total,
        wins: stats.wins,
        losses: stats.losses,
      };
    }).sort((a, b) => b.total_games - a.total_games);
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

          {!loading && !error && (beforeData.length > 0 || afterData.length > 0) && (
            <div className="impact-comparison-section">
              {/* BEFORE Block */}
              <div className="comparison-block before-block">
                <h5 className="block-title">📊 {t('before') || 'Before'}</h5>
                <p className="block-subtitle">{t('matches_evaluated') || 'Matches'}: {beforeData.reduce((sum, d) => sum + d.total_games, 0)}</p>
                
                {beforeData.length > 0 ? (
                  <div className="comparison-table-wrapper">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>{t('map') || 'Map'}</th>
                          <th>{t('faction') || 'Faction'}</th>
                          <th colSpan={3} style={{ textAlign: 'center' }}>{t('matchup') || 'Matchup'}</th>
                          <th>{t('winrate') || 'Win Rate'}</th>
                          <th>{t('games') || 'Games'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beforeData.map((data, idx) => (
                          <tr key={`before-${idx}`}>
                            <td className="map-name">{data.map_name}</td>
                            <td className="faction-name">{data.faction_name}</td>
                            <td style={{ textAlign: 'right' }}>{data.faction_name}</td>
                            <td style={{ textAlign: 'center' }}>{t('vs') || 'vs'}</td>
                            <td style={{ textAlign: 'left' }}>{data.opponent_faction_name}</td>
                            <td className={`winrate ${getChangeColorClass(data.winrate)}`}>
                              {data.winrate.toFixed(1)}%
                            </td>
                            <td className="games">{data.total_games}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="no-data">{t('no_data_available') || 'No data available'}</p>
                )}
              </div>

              {/* AFTER Block */}
              <div className="comparison-block after-block">
                <h5 className="block-title">📈 {t('after') || 'After'}</h5>
                <p className="block-subtitle">{t('matches_evaluated') || 'Matches'}: {afterData.reduce((sum, d) => sum + d.total_games, 0)}</p>
                
                {afterData.length > 0 ? (
                  <div className="comparison-table-wrapper">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>{t('map') || 'Map'}</th>
                          <th>{t('faction') || 'Faction'}</th>
                          <th colSpan={3} style={{ textAlign: 'center' }}>{t('matchup') || 'Matchup'}</th>
                          <th>{t('winrate') || 'Win Rate'}</th>
                          <th>{t('games') || 'Games'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {afterData.map((data, idx) => (
                          <tr key={`after-${idx}`}>
                            <td className="map-name">{data.map_name}</td>
                            <td className="faction-name">{data.faction_name}</td>
                            <td style={{ textAlign: 'right' }}>{data.faction_name}</td>
                            <td style={{ textAlign: 'center' }}>{t('vs') || 'vs'}</td>
                            <td style={{ textAlign: 'left' }}>{data.opponent_faction_name}</td>
                            <td className={`winrate ${getChangeColorClass(data.winrate)}`}>
                              {data.winrate.toFixed(1)}%
                            </td>
                            <td className="games">{data.total_games}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="no-data">{t('no_data_available') || 'No data available'}</p>
                )}
              </div>
            </div>
          )}

          {!loading && !error && beforeData.length === 0 && afterData.length === 0 && (
            <p className="no-data">{t('no_data_available') || 'No data available for the selected event'}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default BalanceEventImpactPanel;
