import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { userService } from '../services/api';

interface User {
  id: string;
  nickname: string;
  elo_rating: number;
}

interface OpponentSelectorProps {
  value: string;
  onChange: (userId: string, user: User | null) => void;
}

const OpponentSelector: React.FC<OpponentSelectorProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await userService.getAllUsers();
        const users = response.data?.data || response.data || [];
        setAllUsers(Array.isArray(users) ? users : []);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filter users based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = allUsers.filter(user =>
        user.nickname.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredUsers(filtered);
      setIsOpen(true);
    } else {
      setFilteredUsers(allUsers);
      setIsOpen(false);
    }
  }, [inputValue, allUsers]);

  // Keep UI in sync when parent-controlled value (userId) changes
  useEffect(() => {
    if (!allUsers.length) return;
    if (value) {
      const u = allUsers.find(u => u.id === value) || null;
      setSelectedUser(u);
      setInputValue(u?.nickname || '');
    } else {
      setSelectedUser(null);
      setInputValue('');
    }
  }, [value, allUsers]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setInputValue(user.nickname);
    onChange(user.id, user);
    setIsOpen(false);
  };

  const handleClear = () => {
    setInputValue('');
    setSelectedUser(null);
    onChange('', null);
    setIsOpen(false);
  };

  return (
    <div className="opponent-selector">
      <div className="input-wrapper">
        <input
          ref={inputRef}
          type="text"
          placeholder={t('opponent_selector.placeholder')}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue && setIsOpen(true)}
          className="opponent-input"
        />
        {selectedUser && (
          <button
            type="button"
            className="clear-button"
            onClick={handleClear}
            title={t('opponent_selector.clear_title')}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && filteredUsers.length > 0 && (
        <div ref={dropdownRef} className="opponent-dropdown">
          {filteredUsers.slice(0, 10).map(user => (
            <div
              key={user.id}
              className={`opponent-item ${selectedUser?.id === user.id ? 'selected' : ''}`}
              onClick={() => handleSelectUser(user)}
            >
              <div className="opponent-info">
                <span className="opponent-nickname">{user.nickname}</span>
                <span className="opponent-elo">ELO: {user.elo_rating || 'N/A'}</span>
              </div>
            </div>
          ))}
          {filteredUsers.length > 10 && (
            <div className="opponent-item-info">
              {t('opponent_selector.showing', { current: 10, total: filteredUsers.length })}
            </div>
          )}
        </div>
      )}

      {isOpen && inputValue && filteredUsers.length === 0 && (
        <div className="opponent-dropdown">
          <div className="opponent-item-empty">
            {t('opponent_selector.no_players')}
          </div>
        </div>
      )}

      {loading && <div className="loading-text">{t('opponent_selector.loading')}</div>}
    </div>
  );
};

export default OpponentSelector;
