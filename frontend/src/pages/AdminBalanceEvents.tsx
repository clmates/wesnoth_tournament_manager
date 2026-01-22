import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';
import api from '../services/api';
import UserProfileNav from '../components/UserProfileNav';
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
  const [recalculatingSnapshots, setRecalculatingSnapshots] = useState(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState('');
  const [snapshotError, setSnapshotError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

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

      if (editingEventId) {
        // Update existing event
        await statisticsService.updateBalanceEvent(editingEventId, eventData as any);
        setSuccess(t('balance_event_updated_success') || 'Balance event updated successfully');
        setEditingEventId(null);
      } else {
        // Create new event
        await statisticsService.createBalanceEvent(eventData as any);
        setSuccess(t('balance_event_created_success') || 'Balance event created successfully');
      }

      setFormData({
        event_date: new Date().toISOString().split('T')[0],
        event_type: 'NERF',
        description: '',
        faction_id: '',
        map_id: '',
        patch_version: '',
        notes: '',
      });

      setShowModal(false);

      // Reload events
      const updatedEvents = await statisticsService.getBalanceEvents({ limit: 100 });
      setEvents(updatedEvents);
    } catch (err: any) {
      const errorMsg = editingEventId 
        ? (err.response?.data?.error || t('error_updating_balance_event') || 'Error updating balance event')
        : (err.response?.data?.error || t('error_creating_balance_event') || 'Error creating balance event');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditEvent = (event: any) => {
    setFormData({
      event_date: event.event_date.split('T')[0],
      event_type: event.event_type,
      description: event.description,
      faction_id: event.faction_id || '',
      map_id: event.map_id || '',
      patch_version: event.patch_version || '',
      notes: event.notes || '',
    });
    setEditingEventId(event.id);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEventId(null);
    setFormData({
      event_date: new Date().toISOString().split('T')[0],
      event_type: 'NERF',
      description: '',
      faction_id: '',
      map_id: '',
      patch_version: '',
      notes: '',
    });
    setError('');
    setSuccess('');
  };

  const handleRecalculateSnapshots = async () => {
    setRecalculatingSnapshots(true);
    setSnapshotError('');
    setSnapshotSuccess('');

    try {
      const response = await api.post('/admin/recalculate-snapshots', {
        eventId: null,
        recreateAll: true
      });
      
      const { totalSnapshotsCreated, beforeSnapshots, afterSnapshots } = response.data;
      
      setSnapshotSuccess(
        t('snapshots_recalculated_success') || 
        `Historical snapshots recalculated successfully.\nSnapshots created: ${totalSnapshotsCreated}\nMatches before: ${beforeSnapshots}\nMatches after: ${afterSnapshots}`
      );
    } catch (err: any) {
      setSnapshotError(err.response?.data?.error || t('error_recalculating_snapshots') || 'Error recalculating snapshots');
    } finally {
      setRecalculatingSnapshots(false);
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
    <>
      <UserProfileNav />
      <div className="admin-balance-events-container">
        <div className="page-header">
          <h1>{t('admin_balance_events') || 'Balance Events'}</h1>
        <button 
          onClick={() => setShowModal(true)} 
          className="btn-add-event"
          title={t('add_new_event') || 'Add new balance event'}
        >
          + {t('add_event') || 'Add Event'}
        </button>
      </div>

      <div className="balance-events-main">
        {/* Recalculate Snapshots Button */}
        <div className="events-section-controls">
          <button 
            type="button" 
            onClick={handleRecalculateSnapshots} 
            disabled={recalculatingSnapshots}
            className="btn-recalculate"
            title={t('recalculate_snapshots_tooltip') || 'Generate historical snapshots for balance event analysis'}
          >
            {recalculatingSnapshots 
              ? t('recalculating') || 'Recalculating...' 
              : t('recalculate_snapshots') || 'Recalculate Snapshots'
            }
          </button>
        </div>

        {snapshotSuccess && <div className="alert-success">{snapshotSuccess}</div>}
        {snapshotError && <div className="alert-error">{snapshotError}</div>}

        {/* Events Table */}
        {events.length === 0 ? (
          <div className="no-events-container">
            <p className="no-events">{t('no_balance_events') || 'No balance events found'}</p>
          </div>
        ) : (
          <div className="events-table-wrapper">
            <table className="events-table">
              <thead>
                <tr>
                  <th>{t('date') || 'Date'}</th>
                  <th>{t('event_type') || 'Type'}</th>
                  <th>{t('description') || 'Description'}</th>
                  <th>{t('faction') || 'Faction'}</th>
                  <th>{t('map') || 'Map'}</th>
                  <th>{t('patch_version') || 'Patch'}</th>
                  <th className="actions-col">{t('actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id} className={`event-row event-${event.event_type.toLowerCase()}`}>
                    <td className="date-cell">{new Date(event.event_date).toLocaleDateString()}</td>
                    <td className="type-cell">
                      <span className={`type-badge type-${event.event_type.toLowerCase()}`}>
                        {event.event_type}
                      </span>
                    </td>
                    <td className="description-cell" title={event.description}>
                      {event.description.length > 50 ? event.description.substring(0, 50) + '...' : event.description}
                    </td>
                    <td className="faction-cell">{event.faction_name || '-'}</td>
                    <td className="map-cell">{event.map_name || '-'}</td>
                    <td className="patch-cell">{event.patch_version || '-'}</td>
                    <td className="actions-cell">
                      <button 
                        onClick={() => handleEditEvent(event)}
                        className="btn-edit"
                        title={t('edit') || 'Edit event'}
                      >
                        ✎ {t('edit') || 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Create/Edit Form */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEventId ? t('edit_balance_event') || 'Edit Balance Event' : t('create_balance_event') || 'Create Balance Event'}</h2>
              <button onClick={handleCloseModal} className="btn-close">✕</button>
            </div>

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

              <div className="modal-footer">
                <button type="button" onClick={handleCloseModal} className="btn-cancel">
                  {t('cancel') || 'Cancel'}
                </button>
                <button type="submit" disabled={loading} className="btn-submit">
                  {loading 
                    ? (editingEventId ? t('updating') || 'Updating...' : t('creating') || 'Creating...') 
                    : (editingEventId ? t('update_event') || 'Update Event' : t('create_event') || 'Create Event')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default AdminBalanceEvents;
