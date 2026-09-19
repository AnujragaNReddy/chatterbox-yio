import { useEffect, useState } from 'react';
import { X, Search, Users, User } from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Avatar from '../common/Avatar.jsx';
import './NewChatModal.css';

export default function NewChatModal({ onClose, onStartDirect, onCreateGroup }) {
  const { token } = useAuth();
  const [mode, setMode] = useState('direct');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .listUsers(token, query)
        .then(({ users: list }) => setUsers(list))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [token, query]);

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleUserClick(userId) {
    if (mode === 'group') return toggleSelect(userId);
    setBusy(true);
    setError('');
    try {
      await onStartDirect(userId);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || selectedIds.length === 0) return;
    setBusy(true);
    setError('');
    try {
      await onCreateGroup(groupName.trim(), selectedIds);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'direct' ? 'New chat' : 'New group'}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          <button className={mode === 'direct' ? 'active' : ''} onClick={() => setMode('direct')}>
            <User size={16} /> Direct message
          </button>
          <button className={mode === 'group' ? 'active' : ''} onClick={() => setMode('group')}>
            <Users size={16} /> Group
          </button>
        </div>

        {mode === 'group' && (
          <div className="field" style={{ padding: '0 20px' }}>
            <input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className="modal-search">
          <Search size={16} />
          <input
            placeholder="Search people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {error && <p className="error-text" style={{ padding: '0 20px' }}>{error}</p>}

        <div className="modal-list">
          {loading && <div className="modal-empty">Searching...</div>}
          {!loading && users.length === 0 && <div className="modal-empty">No people found</div>}
          {!loading &&
            users.map((u) => (
              <button key={u.id} className="modal-user-row" disabled={busy} onClick={() => handleUserClick(u.id)}>
                <Avatar name={u.displayName} color={u.avatarColor} size={40} online={u.isOnline} />
                <div className="modal-user-info">
                  <span className="modal-user-name">{u.displayName}</span>
                  <span className="modal-user-sub">@{u.username}</span>
                </div>
                {mode === 'group' && (
                  <span className={`checkbox ${selectedIds.includes(u.id) ? 'checked' : ''}`} />
                )}
              </button>
            ))}
        </div>

        {mode === 'group' && (
          <div className="modal-footer">
            <button
              className="btn"
              style={{ width: '100%' }}
              disabled={busy || !groupName.trim() || selectedIds.length === 0}
              onClick={handleCreateGroup}
            >
              Create group ({selectedIds.length} member{selectedIds.length === 1 ? '' : 's'})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
