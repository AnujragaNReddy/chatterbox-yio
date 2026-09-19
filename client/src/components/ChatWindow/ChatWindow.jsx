import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Smile, MessageCircle } from 'lucide-react';
import Avatar from '../common/Avatar.jsx';
import MessageBubble from '../common/MessageBubble.jsx';
import EmojiPicker from '../common/EmojiPicker.jsx';
import { formatDayOrTime, formatLastSeen } from '../../utils/format.js';
import './ChatWindow.css';

function dateKey(iso) {
  return new Date(iso.replace(' ', 'T') + 'Z').toDateString();
}

export default function ChatWindow({ conversation, messages, currentUser, typingUserIds, presence, readReceipts, onSend, onTyping }) {
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversation?.id]);

  useEffect(() => {
    setDraft('');
    setShowEmoji(false);
  }, [conversation?.id]);

  const groups = useMemo(() => {
    const out = [];
    let currentDay = null;
    for (const m of messages) {
      const key = dateKey(m.createdAt);
      if (key !== currentDay) {
        out.push({ type: 'day', key, label: formatDayOrTime(m.createdAt) });
        currentDay = key;
      }
      out.push({ type: 'message', message: m });
    }
    return out;
  }, [messages]);

  if (!conversation) {
    return (
      <div className="chat-window empty">
        <MessageCircle size={72} strokeWidth={1} />
        <h2>ChatterBox</h2>
        <p>Select a conversation or start a new one to begin messaging.</p>
      </div>
    );
  }

  const other = conversation.otherUser;
  const otherPresence = other ? presence[other.id] : null;
  const isOnline = other ? otherPresence?.isOnline ?? other.isOnline : false;
  const isTyping = typingUserIds.length > 0;

  let subtitle = '';
  if (conversation.type === 'group') {
    subtitle = isTyping ? 'typing...' : `${conversation.members.length} members`;
  } else if (isTyping) {
    subtitle = 'typing...';
  } else if (isOnline) {
    subtitle = 'online';
  } else if (other) {
    subtitle = formatLastSeen(otherPresence?.lastSeen ?? other.lastSeen);
  }

  function handleChange(e) {
    setDraft(e.target.value);
    onTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  }

  function handleSend(e) {
    e?.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
    onTyping(false);
    clearTimeout(typingTimeout.current);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group chats don't render per-member read receipts, so only direct chats show the blue double-tick.
  const otherReadUpTo = other ? readReceipts?.[other.id] ?? 0 : 0;

  return (
    <div className="chat-window">
      <header className="chat-header">
        <Avatar name={conversation.name} color={conversation.avatarColor} isGroup={conversation.type === 'group'} online={isOnline} />
        <div className="chat-header-text">
          <span className="chat-header-name">{conversation.name}</span>
          <span className={`chat-header-sub ${isTyping ? 'is-typing' : ''}`}>{subtitle}</span>
        </div>
      </header>

      <div className="chat-messages">
        {groups.map((item, idx) =>
          item.type === 'day' ? (
            <div className="day-separator" key={`day-${item.key}-${idx}`}>
              <span>{item.label}</span>
            </div>
          ) : (
            <MessageBubble
              key={item.message.id}
              message={item.message}
              isMine={item.message.senderId === currentUser.id}
              showSenderName={conversation.type === 'group'}
              isRead={item.message.id <= otherReadUpTo}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSend}>
        <div className="emoji-wrap">
          <button type="button" className="icon-btn" onClick={() => setShowEmoji((v) => !v)}>
            <Smile size={22} />
          </button>
          {showEmoji && <EmojiPicker onPick={(emoji) => setDraft((d) => d + emoji)} onClose={() => setShowEmoji(false)} />}
        </div>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Type a message"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className="icon-btn send-btn" disabled={!draft.trim()}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
