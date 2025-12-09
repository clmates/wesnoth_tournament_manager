import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { userService, adminService } from '../services/api';
import MainLayout from '../components/MainLayout';
import '../styles/Admin.css';

const AdminUsers: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuthStore();
  
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [searchNIC, setSearchNIC] = useState('');
  const [recalculatingStats, setRecalculatingStats] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/');
      return;
    }

    fetchUsers();
  }, [isAuthenticated, isAdmin, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminService.getAllUsers();
      setUsers(res.data || []);
      setFilteredUsers(res.data || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('Error loading users');
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchNIC = (value: string) => {
    setSearchNIC(value);
    if (value.trim() === '') {
      setFilteredUsers(users);
    } else {
      const lowerSearch = value.toLowerCase();
      setFilteredUsers(
        users.filter((user) => user.nickname.toLowerCase().includes(lowerSearch))
      );
    }
  };

  const confirmAction = async () => {
    if (!selectedUser) return;

    try {
      setError('');
      setMessage('');

      switch (actionType) {
        case 'block':
          await adminService.blockUser(selectedUser.id);
          setMessage(`User ${selectedUser.nickname} blocked successfully`);
          break;
        case 'unblock':
          await adminService.unblockUser(selectedUser.id);
          setMessage(`User ${selectedUser.nickname} unblocked successfully`);
          break;
        case 'makeAdmin':
          await adminService.makeAdmin(selectedUser.id);
          setMessage(`User ${selectedUser.nickname} promoted to admin`);
          break;
        case 'removeAdmin':
          await adminService.removeAdmin(selectedUser.id);
          setMessage(`User ${selectedUser.nickname} removed from admin`);
          break;
        case 'delete':
          await adminService.deleteUser(selectedUser.id);
          setMessage(`User ${selectedUser.nickname} deleted successfully`);
          break;
        case 'resetPassword':
          const result = await adminService.forceResetPassword(selectedUser.id);
          setMessage(`Password reset successful. Temporary password: ${result.data.tempPassword}`);
          break;
      }

      setShowModal(false);
      setSelectedUser(null);
      setActionType('');
      
      // Refresh users list
      fetchUsers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Action failed');
    }
  };

  const handleAction = (user: any, action: string) => {
    setSelectedUser(user);
    setActionType(action);
    setShowModal(true);
  };

  const handleConfirmDelete = (user: any) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      handleAction(user, 'delete');
    }
  };

  const handleRecalculateAllStats = async () => {
    if (
      !window.confirm(
        'This will recalculate all player ELO ratings and statistics from scratch by replaying all matches. This may take a moment. Continue?'
      )
    ) {
      return;
    }

    try {
      setRecalculatingStats(true);
      setError('');
      setMessage('');
      const res = await adminService.recalculateAllStats();
      setMessage(
        `Stats recalculated successfully! Processed ${res.data.matchesProcessed} matches and updated ${res.data.usersUpdated} users.`
      );
      // Refresh users list
      fetchUsers();
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to recalculate stats');
    } finally {
      setRecalculatingStats(false);
    }
  };

  if (loading) {
    return <MainLayout><div className="admin-container"><p>Loading...</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="admin-container">
      <h1>User Management</h1>

      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <section className="admin-actions">
        <button
          className="btn-recalculate-stats"
          onClick={handleRecalculateAllStats}
          disabled={recalculatingStats}
        >
          {recalculatingStats ? 'Recalculating...' : '🔄 Recalculate All Stats'}
        </button>
      </section>

      <section className="users-management">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by NIC (Nickname)..."
            value={searchNIC}
            onChange={(e) => handleSearchNIC(e.target.value)}
            className="search-input"
          />
          <span className="results-count">
            Showing {filteredUsers.length} of {users.length} users
          </span>
        </div>

        {filteredUsers.length > 0 ? (
          <table className="users-table">
            <thead>
              <tr>
                <th>Nickname</th>
                <th>Email</th>
                <th>ELO</th>
                <th>Level</th>
                <th>Status</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.nickname}</td>
                  <td>{user.email}</td>
                  <td>{user.elo_rating || 1200}</td>
                  <td>{user.level || 'Novato'}</td>
                  <td>
                    <span className={`status ${user.is_blocked ? 'blocked' : 'active'}`}>
                      {user.is_blocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <span className={`role ${user.is_admin ? 'admin' : 'user'}`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="actions">
                    {user.is_blocked ? (
                      <button
                        className="btn-unblock"
                        onClick={() => handleAction(user, 'unblock')}
                      >
                        Unblock
                      </button>
                    ) : (
                      <button
                        className="btn-block"
                        onClick={() => handleAction(user, 'block')}
                      >
                        Block
                      </button>
                    )}
                    {user.is_admin ? (
                      <button
                        className="btn-remove-admin"
                        onClick={() => handleAction(user, 'removeAdmin')}
                      >
                        Remove Admin
                      </button>
                    ) : (
                      <button
                        className="btn-make-admin"
                        onClick={() => handleAction(user, 'makeAdmin')}
                      >
                        Make Admin
                      </button>
                    )}
                    <button
                      className="btn-reset"
                      onClick={() => handleAction(user, 'resetPassword')}
                    >
                      Reset Password
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleConfirmDelete(user)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No users found</p>
        )}
      </section>

      {showModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Action</h3>
            <p>
              {actionType === 'block' && `Are you sure you want to block ${selectedUser.nickname}?`}
              {actionType === 'unblock' && `Are you sure you want to unblock ${selectedUser.nickname}?`}
              {actionType === 'makeAdmin' && `Are you sure you want to make ${selectedUser.nickname} an admin?`}
              {actionType === 'removeAdmin' && `Are you sure you want to remove ${selectedUser.nickname} from admin?`}
              {actionType === 'delete' && `Are you sure you want to delete ${selectedUser.nickname}? This cannot be undone.`}
              {actionType === 'resetPassword' && `Are you sure you want to force password reset for ${selectedUser.nickname}?`}
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={confirmAction}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </MainLayout>
  );
};

export default AdminUsers;
