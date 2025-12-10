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
          setMessage(t('admin.user_blocked', { nickname: selectedUser.nickname }));
          break;
        case 'unblock':
          await adminService.unblockUser(selectedUser.id);
          setMessage(t('admin.user_unblocked', { nickname: selectedUser.nickname }));
          break;
        case 'makeAdmin':
          await adminService.makeAdmin(selectedUser.id);
          setMessage(t('admin.user_promoted', { nickname: selectedUser.nickname }));
          break;
        case 'removeAdmin':
          await adminService.removeAdmin(selectedUser.id);
          setMessage(t('admin.user_demoted', { nickname: selectedUser.nickname }));
          break;
        case 'delete':
          await adminService.deleteUser(selectedUser.id);
          setMessage(t('admin.user_deleted', { nickname: selectedUser.nickname }));
          break;
        case 'resetPassword':
          const result = await adminService.forceResetPassword(selectedUser.id);
          setMessage(t('admin.password_reset_success', { tempPassword: result.data.tempPassword }));
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
    if (window.confirm(t('admin.confirm_delete_warning'))) {
      handleAction(user, 'delete');
    }
  };

  const handleRecalculateAllStats = async () => {
    if (!window.confirm(t('admin.recalculate_confirm'))) {
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
    return <MainLayout><div className="admin-container"><p>{t('loading')}</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="admin-container">
      <h1>{t('admin_users_title')}</h1>

      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <section className="admin-actions">
        <button
          className="btn-recalculate-stats"
          onClick={handleRecalculateAllStats}
          disabled={recalculatingStats}
        >
          {recalculatingStats ? t('admin.recalculating') : t('admin.recalculate_all_stats')}
        </button>
      </section>

      <section className="users-management">
        <div className="search-container">
          <input
            type="text"
            placeholder={t('admin.search_by_nic')}
            value={searchNIC}
            onChange={(e) => handleSearchNIC(e.target.value)}
            className="search-input"
          />
          <span className="results-count">
            {t('showing_count', { count: filteredUsers.length, total: users.length, page: 1, totalPages: 1 })}
          </span>
        </div>

        {filteredUsers.length > 0 ? (
          <table className="users-table">
            <thead>
              <tr>
                  <th>{t('label_nickname')}</th>
                  <th>{t('label_email')}</th>
                  <th>{t('label_elo')}</th>
                  <th>{t('label_level')}</th>
                  <th>{t('label_status')}</th>
                  <th>{t('label_role')}</th>
                  <th>{t('label_actions')}</th>
                </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.nickname}</td>
                  <td>{user.email}</td>
                  <td>{user.elo_rating || 1200}</td>
                  <td>{user.level || t('level_novice')}</td>
                  <td>
                    <span className={`status ${user.is_blocked ? 'blocked' : 'active'}`}>
                      {user.is_blocked ? t('status_blocked') : t('status_active')}
                    </span>
                  </td>
                  <td>
                    <span className={`role ${user.is_admin ? 'admin' : 'user'}`}>
                      {user.is_admin ? t('role_admin') : t('role_user')}
                    </span>
                  </td>
                  <td className="actions">
                    {user.is_blocked ? (
                      <button
                        className="btn-unblock"
                        onClick={() => handleAction(user, 'unblock')}
                      >
                        {t('btn_unblock')}
                      </button>
                    ) : (
                      <button
                        className="btn-block"
                        onClick={() => handleAction(user, 'block')}
                      >
                        {t('btn_block')}
                      </button>
                    )}
                    {user.is_admin ? (
                      <button
                        className="btn-remove-admin"
                        onClick={() => handleAction(user, 'removeAdmin')}
                      >
                        {t('btn_remove_admin')}
                      </button>
                    ) : (
                      <button
                        className="btn-make-admin"
                        onClick={() => handleAction(user, 'makeAdmin')}
                      >
                        {t('btn_make_admin')}
                      </button>
                    )}
                    <button
                      className="btn-reset"
                      onClick={() => handleAction(user, 'resetPassword')}
                    >
                      {t('btn_reset_password')}
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleConfirmDelete(user)}
                    >
                      {t('btn_delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{t('no_data')}</p>
        )}
      </section>

      {showModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
              <h3>{t('admin.confirm_action_title')}</h3>
              <p>
                {actionType === 'block' && t('admin.confirm_block', { nickname: selectedUser.nickname })}
                {actionType === 'unblock' && t('admin.confirm_unblock', { nickname: selectedUser.nickname })}
                {actionType === 'makeAdmin' && t('admin.confirm_make_admin', { nickname: selectedUser.nickname })}
                {actionType === 'removeAdmin' && t('admin.confirm_remove_admin', { nickname: selectedUser.nickname })}
                {actionType === 'delete' && t('admin.confirm_delete', { nickname: selectedUser.nickname })}
                {actionType === 'resetPassword' && t('admin.confirm_reset_password', { nickname: selectedUser.nickname })}
              </p>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setShowModal(false)}>
                  {t('btn_cancel')}
                </button>
                <button className="btn-confirm" onClick={confirmAction}>
                  {t('btn_confirm')}
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
