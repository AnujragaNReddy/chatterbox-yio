import { useState } from 'react';
import { MessageSquarePlus, LogOut, Search } from 'lucide-react';
import Avatar from '../common/Avatar.jsx';
import ThemeSwitcher from '../common/ThemeSwitcher.jsx';
import NewChatModal from './NewChatModal.jsx';
import { formatDayOrTime } from '../../utils/format.js';
import './Sidebar.css';

export default function Sidebar({ user, conversations, activeId, onSelect, onLogout, onStartDirect, onCreateGroup, presence }) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-me">
          <Avatar name={user.displayName} color={user.avatarColor} size={40} />
          <div className="sidebar-me-text">
            <span className="sidebar-me-name">{user.displayName}</span>
            <span className="sidebar-me-sub">@{user.username}</span>
          </div>
        </div>
        <div className="sidebar-actions">
          <button className="icon-btn" title="New chat" onClick={() => setShowModal(true)}>
            <MessageSquarePlus size={20} />
          </button>
          <ThemeSwitcher />
          <button className="icon-btn" title="Log out" onClick={onLogout}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="sidebar-search">
        <Search size={16} />
        <input placeholder="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="conversation-list">
        {filtered.length === 0 && (
          <div className="sidebar-empty">
            <p>No conversations yet.</p>
            <button className="btn" onClick={() => setShowModal(true)}>
              Start a chat
            </button>
          </div>
        )}
        {filtered.map((c) => {
          const other = c.otherUser;
          const online = other ? presence[other.id]?.isOnline ?? other.isOnline : false;
          return (
            <button
              key={c.id}
              className={`conversation-item ${activeId === c.id ? 'active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <Avatar name={c.name} color={c.avatarColor} isGroup={c.type === 'group'} online={online} />
              <div className="conversation-info">
                <div className="conversation-row">
                  <span className="conversation-name">{c.name}</span>
                  <span className="conversation-time">{formatDayOrTime(c.lastMessage?.createdAt)}</span>
                </div>
                <div className="conversation-row">
                  <span className="conversation-preview">
                    {c.lastMessage
                      ? `${c.type === 'group' && c.lastMessage.senderId !== user.id ? `${c.lastMessage.senderName.split(' ')[0]}: ` : ''}${c.lastMessage.content}`
                      : 'Say hello \u{1F44B}'}
                  </span>
                  {c.unreadCount > 0 && <span className="unread-badge">{c.unreadCount}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {showModal && (
        <NewChatModal
          onClose={() => setShowModal(false)}
          onStartDirect={onStartDirect}
          onCreateGroup={onCreateGroup}
        />
      )}
    </aside>
  );
}
