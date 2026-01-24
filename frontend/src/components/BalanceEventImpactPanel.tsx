import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';

interface BalanceEventImpactProps {
  eventId?: string;
  onEventChange?: (eventId: string | null) => void;
  onComparisonDataChange?: (before: AggregatedData[], after: AggregatedData[]) => void;
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
  map_id?: string;
  map_name: string;
  faction_id?: string;
  faction_name: string;
  opponent_faction_id?: string;
  opponent_faction_name: string;
  winrate: number;
  total_games: number;
  wins: number;
  losses: number;
}

const BalanceEventImpactPanel: React.FC<BalanceEventImpactProps> = ({ eventId, onEventChange, onComparisonDataChange }) => {
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
      console.log(`[BalanceEventImpactPanel] Loading impact for event: ${id}`);
      const data = await statisticsService.getEventImpact(id);
      console.log(`[BalanceEventImpactPanel] Received ${data.length} rows from backend`);
      
      // Convert string values to numbers if needed
      const convertedData = data.map((item: any) => ({
        ...item,
        winrate: typeof item.winrate === 'string' ? parseFloat(item.winrate) : item.winrate,
        total_games: typeof item.total_games === 'string' ? parseInt(item.total_games) : item.total_games,
        wins: typeof item.wins === 'string' ? parseInt(item.wins) : item.wins,
        losses: typeof item.losses === 'string' ? parseInt(item.losses) : item.losses,
        days_since_event: typeof item.days_since_event === 'string' ? parseInt(item.days_since_event) : item.days_since_event,
      }));
      console.log(`[BalanceEventImpactPanel] Sample data:`, convertedData.slice(0, 2));
      setImpactData(convertedData);
      
      // Aggregate data before and after event
      if (selectedEvent) {
        const eventDate = new Date(selectedEvent.event_date).getTime();
        console.log(`[BalanceEventImpactPanel] Event date: ${selectedEvent.event_date}`);
        
        const before = convertedData.filter((d: ImpactData) => new Date(d.snapshot_date).getTime() < eventDate);
        const after = convertedData.filter((d: ImpactData) => new Date(d.snapshot_date).getTime() >= eventDate);
        
        console.log(`[BalanceEventImpactPanel] Before: ${before.length} snapshots, After: ${after.length} snapshots`);
        
        // Aggregate before data
        const beforeAgg = aggregateData(before);
        setBeforeData(beforeAgg);
        
        // Aggregate after data
        const afterAgg = aggregateData(after);
        setAfterData(afterAgg);
        
        console.log(`[BalanceEventImpactPanel] Before aggregated: ${beforeAgg.length} records, After aggregated: ${afterAgg.length} records`);
        
        // Notify parent component
        onComparisonDataChange?.(beforeAgg, afterAgg);
      }
    } catch (err: any) {
      console.error(`[BalanceEventImpactPanel] Error loading impact:`, err);
      setError(err.response?.data?.error || t('error_loading_impact') || 'Error loading impact data');
      setImpactData([]);
      setBeforeData([]);
      setAfterData([]);
    } finally {
      setLoading(false);
    }
  };

  const aggregateData = (snapshots: ImpactData[]): AggregatedData[] => {
    // Take the LATEST snapshot for each combination (don't sum historical snapshots)
    // Each snapshot already contains cumulative stats
    const aggregated = new Map<string, ImpactData>();
    
    snapshots.forEach(snapshot => {
      const key = `${snapshot.map_id}|${snapshot.faction_id}|${snapshot.opponent_faction_id}`;
      const current = aggregated.get(key);
      
      // Keep the one with most games (latest snapshot in the period)
      if (!current || snapshot.total_games > current.total_games) {
        aggregated.set(key, snapshot);
      }
    });
    
    console.log(`[BalanceEventImpactPanel.aggregateData] Received ${snapshots.length} snapshots, aggregated to ${aggregated.size} unique matchups`);
    console.log(`   Date range: ${snapshots.length > 0 ? snapshots[0].snapshot_date + ' to ' + snapshots[snapshots.length - 1].snapshot_date : 'N/A'}`);
    
    return Array.from(aggregated.values()).map(snapshot => ({
      map_id: snapshot.map_id,
      map_name: snapshot.map_name,
      faction_id: snapshot.faction_id,
      faction_name: snapshot.faction_name,
      opponent_faction_id: snapshot.opponent_faction_id,
      opponent_faction_name: snapshot.opponent_faction_name,
      winrate: snapshot.winrate,
      total_games: snapshot.total_games,
      wins: snapshot.wins,
      losses: snapshot.losses,
    })).sort((a, b) => b.total_games - a.total_games);
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
    <div className="w-full bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">{t('select_balance_event') || 'Select Balance Event'}</h3>
        
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800">{t('event_details') || 'Event Details'}</h4>
            <span 
              className="px-3 py-1 rounded-full text-white text-sm font-semibold"
              style={{ background: eventTypeColor[selectedEvent.event_type] || '#3498db' }}
            >
              {selectedEvent.event_type}
            </span>
          </div>
          
          <p className="text-gray-700 mb-4">{selectedEvent.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedEvent.faction_name && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-600">{t('faction') || 'Faction'}:</span>
                <span className="text-gray-800">{selectedEvent.faction_name}</span>
              </div>
            )}
            {selectedEvent.map_name && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-600">{t('map') || 'Map'}:</span>
                <span className="text-gray-800">{selectedEvent.map_name}</span>
              </div>
            )}
            {selectedEvent.patch_version && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-600">{t('patch_version') || 'Patch'}:</span>
                <span className="text-gray-800">{selectedEvent.patch_version}</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-600">{t('date') || 'Date'}:</span>
              <span className="text-gray-800">{new Date(selectedEvent.event_date).toLocaleDateString()}</span>
            </div>
          </div>

          {loading && <div className="mt-4 text-center text-gray-500">{t('loading') || 'Loading...'}</div>}
          {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}
        </div>
      )}
    </div>
  );
};

export default BalanceEventImpactPanel;
