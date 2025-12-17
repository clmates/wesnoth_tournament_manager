import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import './AdminAudit.css';

interface AuditLog {
  id: string;
  event_type: string;
  user_id: string | null;
  username: string | null;
  ip_address: string;
  user_agent: string | null;
  details: Record<string, any>;
  created_at: string;
}

export default function AdminAudit() {
  const { isAdmin } = useAuthStore();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    eventType: '',
    username: '',
    ipAddress: '',
    daysBack: 7
  });
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if user is admin
  if (!isAdmin) {
    return <div className="audit-container error">Access denied. Admin only.</div>;
  }

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError('');

      // Build query params
      const params = new URLSearchParams();
      if (filters.eventType) params.append('eventType', filters.eventType);
      if (filters.username) params.append('username', filters.username);
      if (filters.ipAddress) params.append('ipAddress', filters.ipAddress);
      params.append('daysBack', filters.daysBack.toString());

      const response = await axios.get(`/api/admin/audit-logs?${params.toString()}`);
      setAuditLogs(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  // Delete selected logs
  const deleteSelectedLogs = async () => {
    if (selectedLogs.size === 0) {
      setError('Please select logs to delete');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const logIds = Array.from(selectedLogs);
      await axios.delete('/api/admin/audit-logs', {
        data: { logIds }
      });

      setAuditLogs(auditLogs.filter(log => !selectedLogs.has(log.id)));
      setSelectedLogs(new Set());
      setShowDeleteConfirm(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete logs');
    } finally {
      setLoading(false);
    }
  };

  // Delete all logs older than X days
  const deleteOldLogs = async () => {
    if (!window.confirm(`Delete all logs older than ${filters.daysBack} days?`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      await axios.delete('/api/admin/audit-logs/old', {
        data: { daysBack: filters.daysBack }
      });

      fetchAuditLogs();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete logs');
    } finally {
      setLoading(false);
    }
  };

  // Toggle log selection
  const toggleLogSelection = (id: string) => {
    const newSelected = new Set(selectedLogs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLogs(newSelected);
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedLogs.size === auditLogs.length) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(new Set(auditLogs.map(log => log.id)));
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get event type badge color
  const getEventTypeBadgeClass = (eventType: string) => {
    switch (eventType) {
      case 'LOGIN_SUCCESS':
        return 'badge-success';
      case 'LOGIN_FAILED':
        return 'badge-danger';
      case 'REGISTRATION':
        return 'badge-info';
      case 'ADMIN_ACTION':
        return 'badge-warning';
      case 'SECURITY_EVENT':
        return 'badge-critical';
      default:
        return 'badge-default';
    }
  };

  return (
    <div className="audit-container">
      <h1>🔒 Audit Logs</h1>

      {error && <div className="error-message">{error}</div>}

      {/* Filters */}
      <div className="filters-section">
        <h3>Filters</h3>
        <div className="filter-row">
          <input
            type="text"
            placeholder="Event Type (e.g., LOGIN_FAILED)"
            value={filters.eventType}
            onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
            className="filter-input"
          />
          <input
            type="text"
            placeholder="Username"
            value={filters.username}
            onChange={(e) => setFilters({ ...filters, username: e.target.value })}
            className="filter-input"
          />
          <input
            type="text"
            placeholder="IP Address"
            value={filters.ipAddress}
            onChange={(e) => setFilters({ ...filters, ipAddress: e.target.value })}
            className="filter-input"
          />
          <select
            value={filters.daysBack}
            onChange={(e) => setFilters({ ...filters, daysBack: parseInt(e.target.value) })}
            className="filter-select"
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button onClick={fetchAuditLogs} disabled={loading} className="btn btn-primary">
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="actions-section">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={selectedLogs.size === 0 || loading}
          className="btn btn-danger"
        >
          🗑️ Delete Selected ({selectedLogs.size})
        </button>
        <button
          onClick={deleteOldLogs}
          disabled={loading}
          className="btn btn-warning"
        >
          🧹 Delete Logs Older Than {filters.daysBack} Days
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>⚠️ Confirm Deletion</h3>
            <p>Delete {selectedLogs.size} selected log(s)? This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={deleteSelectedLogs}
                disabled={loading}
                className="btn btn-danger"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="logs-section">
        <h3>Logs ({auditLogs.length})</h3>

        {auditLogs.length === 0 ? (
          <div className="no-logs">No audit logs found</div>
        ) : (
          <div className="table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedLogs.size === auditLogs.length && auditLogs.length > 0}
                      onChange={toggleSelectAll}
                      className="checkbox"
                    />
                  </th>
                  <th>Time</th>
                  <th>Event Type</th>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className={selectedLogs.has(log.id) ? 'selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedLogs.has(log.id)}
                        onChange={() => toggleLogSelection(log.id)}
                        className="checkbox"
                      />
                    </td>
                    <td className="time">{formatTime(log.created_at)}</td>
                    <td>
                      <span className={`badge ${getEventTypeBadgeClass(log.event_type)}`}>
                        {log.event_type}
                      </span>
                    </td>
                    <td className="username">
                      {log.username || log.user_id || 'ANONYMOUS'}
                    </td>
                    <td className="ip">{log.ip_address}</td>
                    <td className="details">
                      <code>{JSON.stringify(log.details, null, 2)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
