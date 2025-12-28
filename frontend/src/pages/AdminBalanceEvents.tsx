import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';
import api from '../services/api';
import '../styles/AdminBalanceEvents.css';

interface Faction {
  id: string;
  name: string;
}

interface GameMap {
  id: string;
  name: string;
}

const AdminBalanceEvents: React.FC = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    event_date: new Date().toISOString().split('T')[0],
    event_type: 'NERF' as const,
    description: '',
    faction_id: '',
    map_id: '',
    patch_version: '',
    notes: '',
  });

  const [factions, setFactions] = useState<Faction[]>([]);
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [factionsResponse, mapsResponse, eventsData] = await Promise.all([
          api.get('/public/factions'),
          api.get('/public/maps'),
          statisticsService.getBalanceEvents({ limit: 100 }),
        ]);
        
        setFactions(factionsResponse.data);
        setMaps(mapsResponse.data);
        setEvents(eventsData);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    loadData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? '' : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const eventData = {
        ...formData,
        faction_id: formData.faction_id || undefined,
        map_id: formData.map_id || undefined,
        patch_version: formData.patch_version || undefined,
        notes: formData.notes || undefined,
      };

      const response = await statisticsService.createBalanceEvent(eventData as any);
      
      setSuccess(t('balance_event_created_success') || 'Balance event created successfully');
      setFormData({
        event_date: new Date().toISOString().split('T')[0],
        event_type: 'NERF',
        description: '',
        faction_id: '',
        map_id: '',
        patch_version: '',
        notes: '',
      });

      // Reload events
      const updatedEvents = await statisticsService.getBalanceEvents({ limit: 100 });
      setEvents(updatedEvents);
    } catch (err: any) {
      setError(err.response?.data?.error || t('error_creating_balance_event') || 'Error creating balance event');
    } finally {
      setLoading(false);
    }
  };

  const eventTypeColors: { [key: string]: string } = {
    BUFF: 'buff',
    NERF: 'nerf',
    REWORK: 'rework',
    HOTFIX: 'hotfix',
    GENERAL_BALANCE_CHANGE: 'general',
  };

  return (
    <div className="admin-balance-events-container">
      <h1>{t('admin_balance_events') || 'Balance Events'}</h1>

      <div className="balance-events-content">
        {/* Form Section */}
        <div className="form-section">
          <h2>{t('create_balance_event') || 'Create Balance Event'}</h2>
          
          {success && <div className="alert-success">{success}</div>}
          {error && <div className="alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="balance-event-form">
            <div className="form-group">
              <label>{t('event_date') || 'Event Date'} *</label>
              <input
                type="date"
                name="event_date"
                value={formData.event_date}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>{t('event_type') || 'Event Type'} *</label>
              <select
                name="event_type"
                value={formData.event_type}
                onChange={handleInputChange}
                required
              >
                <option value="BUFF">{t('buff') || 'Buff'}</option>
                <option value="NERF">{t('nerf') || 'Nerf'}</option>
                <option value="REWORK">{t('rework') || 'Rework'}</option>
                <option value="HOTFIX">{t('hotfix') || 'Hotfix'}</option>
                <option value="GENERAL_BALANCE_CHANGE">{t('general_balance_change') || 'General Balance Change'}</option>
              </select>
            </div>

            <div className="form-group">
              <label>{t('description') || 'Description'} *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder={t('description_placeholder') || 'Describe the balance change...'}
                required
                rows={4}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('faction') || 'Faction'} ({t('optional') || 'optional'})</label>
                <select
                  name="faction_id"
                  value={formData.faction_id}
                  onChange={handleInputChange}
                >
                  <option value="">--- {t('none') || 'None'} ---</option>
                  {factions.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('map') || 'Map'} ({t('optional') || 'optional'})</label>
                <select
                  name="map_id"
                  value={formData.map_id}
                  onChange={handleInputChange}
                >
                  <option value="">--- {t('none') || 'None'} ---</option>
                  {maps.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('patch_version') || 'Patch Version'} ({t('optional') || 'optional'})</label>
                <input
                  type="text"
                  name="patch_version"
                  value={formData.patch_version}
                  onChange={handleInputChange}
                  placeholder="e.g., 1.5.0"
                />
              </div>

              <div className="form-group">
                <label>{t('notes') || 'Notes'} ({t('optional') || 'optional'})</label>
                <input
                  type="text"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder={t('additional_notes') || 'Additional notes...'}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? t('creating') || 'Creating...' : t('create_event') || 'Create Event'}
            </button>
          </form>
        </div>

        {/* Events List Section */}
        <div className="events-section">
          <h2>{t('recent_balance_events') || 'Recent Balance Events'}</h2>
          
          {events.length === 0 ? (
            <p className="no-events">{t('no_balance_events') || 'No balance events found'}</p>
          ) : (
            <div className="events-list">
              {events.map(event => (
                <div key={event.id} className={`event-card ${eventTypeColors[event.event_type] || ''}`}>
                  <div className="event-header">
                    <span className="event-type">{event.event_type}</span>
                    <span className="event-date">{new Date(event.event_date).toLocaleDateString()}</span>
                    {event.patch_version && <span className="patch-version">{event.patch_version}</span>}
                  </div>
                  
                  <p className="event-description">{event.description}</p>
                  
                  <div className="event-meta">
                    {event.faction_name && <span className="faction-tag">{event.faction_name}</span>}
                    {event.map_name && <span className="map-tag">{event.map_name}</span>}
                    {event.created_by_name && <span className="created-by">by {event.created_by_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBalanceEvents;
