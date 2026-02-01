import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { userService, adminService } from '../services/api';
import MainLayout from '../components/MainLayout';

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
  const [userStatusFilter, setUserStatusFilter] = useState('all'); // 'all', 'active', 'blocked'
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);

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
    applyFilters(value, userStatusFilter);
  };

  const handleStatusFilterChange = (status: string) => {
    setUserStatusFilter(status);
    applyFilters(searchNIC, status);
  };

  const applyFilters = (nicValue: string, statusValue: string) => {
    let filtered = users;

    // Filter by nickname
    if (nicValue.trim() !== '') {
      const lowerSearch = nicValue.toLowerCase();
      filtered = filtered.filter((user) => user.nickname.toLowerCase().includes(lowerSearch));
    }

    // Filter by status
    if (statusValue === 'blocked') {
      filtered = filtered.filter((user) => user.is_blocked === true);
    } else if (statusValue === 'active') {
      filtered = filtered.filter((user) => user.is_blocked === false);
    }

    setFilteredUsers(filtered);
  };

  const confirmAction = async () => {
    if (!selectedUser) return;

    try {
      setError('');
      setMessage('');

      switch (actionType) {
        case 'resendEmail':
          await adminService.resendVerificationEmail(selectedUser.id);
          setMessage(t('admin.verification_email_sent', 'Verification email sent successfully'));
          break;
        case 'block':
          await adminService.blockUser(selectedUser.id);
          setMessage(t('admin.user_blocked', { nickname: selectedUser.nickname }));
          break;
        case 'unblock':
          await adminService.unlockAccount(selectedUser.id);
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
          setTempPassword(result.data.tempPassword);
          // DO NOT clear selectedUser here, we need it for the password modal
          setShowPasswordModal(true);
          setShowModal(false);
          setActionType('');
          return; // Exit early to skip the code below
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
    return <MainLayout><div className="max-w-6xl mx-auto px-4 py-8"><p className="text-center text-gray-600">{t('loading')}</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">{t('admin_users_title')}</h1>

      {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</p>}
      {message && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{message}</p>}

      <section className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-600 text-sm font-semibold">{t('admin.total_users', 'Total Users')}</div>
          <div className="text-3xl font-bold text-gray-800 mt-2">{users.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-600 text-sm font-semibold">{t('admin.blocked_users', 'Blocked Users')}</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{users.filter(u => u.is_blocked).length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-600 text-sm font-semibold">{t('admin.active_users', 'Active Users')}</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{users.filter(u => !u.is_blocked).length}</div>
        </div>
      </section>

      <section className="mb-6">
        <button
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          onClick={handleRecalculateAllStats}
          disabled={recalculatingStats}
        >
          {recalculatingStats ? t('admin.recalculating') : t('admin.recalculate_all_stats')}
        </button>
      </section>

      <section>
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder={t('admin.search_by_nic')}
              value={searchNIC}
              onChange={(e) => handleSearchNIC(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <select 
              value={userStatusFilter} 
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="all">{t('admin.filter_all_users', 'All Users')}</option>
              <option value="active">{t('admin.filter_active', 'Active')}</option>
              <option value="blocked">{t('admin.filter_blocked', 'Blocked')}</option>
            </select>
          </div>
          <span className="text-sm text-gray-600">
            {t('showing_count', { count: filteredUsers.length, total: users.length, page: 1, totalPages: 1 })}
          </span>
        </div>

        {filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white shadow-md rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_nickname')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_email')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">Email Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">Password Reset</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_elo')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_level')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_status')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_role')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_actions')}</th>
                </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const emailExpires = user.email_verification_expires ? new Date(user.email_verification_expires).toLocaleString() : '';
                const pwResetExpires = user.password_reset_expires ? new Date(user.password_reset_expires).toLocaleString() : '';
                
                return (
                <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{user.nickname}</td>
                  <td className="px-4 py-3 text-gray-700">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.email_verified ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        ✅ Verified
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        ⏳ Pending {emailExpires && `(${emailExpires})`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.password_reset_pending ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                        🔑 Pending {pwResetExpires && `(${pwResetExpires})`}
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{user.elo_rating || 1200}</td>
                  <td className="px-4 py-3 text-gray-700">{user.level || t('level_novice')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_blocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {user.is_blocked ? t('status_blocked') : t('status_active')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.is_admin ? t('role_admin') : t('role_user')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {!user.email_verified && (
                        <button
                          className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                          onClick={() => handleAction(user, 'resendEmail')}
                        >
                          Resend Email
                        </button>
                      )}
                      {user.is_blocked ? (
                        <button
                          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                          onClick={() => handleAction(user, 'unblock')}
                        >
                          {t('btn_unblock')}
                        </button>
                      ) : (
                        <button
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          onClick={() => handleAction(user, 'block')}
                        >
                          {t('btn_block')}
                        </button>
                      )}
                      {user.is_admin ? (
                        <button
                          className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                          onClick={() => handleAction(user, 'removeAdmin')}
                        >
                          {t('btn_remove_admin')}
                        </button>
                      ) : (
                        <button
                          className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
                          onClick={() => handleAction(user, 'makeAdmin')}
                        >
                          {t('btn_make_admin')}
                        </button>
                      )}
                      <button
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={() => handleAction(user, 'resetPassword')}
                      >
                        {t('btn_reset_password')}
                      </button>
                      <button
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        onClick={() => handleConfirmDelete(user)}
                      >
                        {t('btn_delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="text-center py-8 text-gray-600">{t('no_data')}</p>
        )}
      </section>

      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {actionType === 'resendEmail' && 'Resend Verification Email'}
              {actionType === 'delete' && t('admin.confirm_delete_title')}
              {actionType === 'block' && t('admin.confirm_block_title')}
              {actionType === 'unblock' && t('admin.confirm_unblock_title', 'Unblock User')}
              {actionType === 'resetPassword' && t('admin.confirm_reset_password_title')}
            </h3>
            <p className="text-gray-700 mb-6">
              {actionType === 'resendEmail' && `Resend verification email to ${selectedUser.nickname}?`}
              {actionType === 'delete' && t('admin.confirm_delete', { nickname: selectedUser.nickname })}
              {actionType === 'block' && t('admin.confirm_block', { nickname: selectedUser.nickname })}
              {actionType === 'unblock' && `Are you sure you want to unblock ${selectedUser.nickname}?`}
              {actionType === 'resetPassword' && t('admin.confirm_reset_password', { nickname: selectedUser.nickname })}
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600" onClick={() => setShowModal(false)}>
                {t('btn_cancel')}
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={confirmAction}>
                {t('btn_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Password Reset Successful</h3>
            <p className="text-gray-700 mb-4">Temporary password for <strong>{selectedUser.nickname}</strong>:</p>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={tempPassword} 
                readOnly 
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  setPasswordCopied(true);
                  setTimeout(() => setPasswordCopied(false), 2000);
                }}
              >
                {passwordCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">User must change this password on their next login.</p>
            <div className="flex justify-end">
              <button 
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedUser(null);
                  setActionType('');
                  fetchUsers();
                }}
              >
                Done
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
