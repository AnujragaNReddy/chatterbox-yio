import { Check, CheckCheck } from 'lucide-react';
import { formatTime } from '../../utils/format.js';

export default function MessageBubble({ message, isMine, showSenderName, isRead }) {
  return (
    <div className={`bubble-row ${isMine ? 'mine' : 'theirs'}`}>
      <div className={`bubble ${isMine ? 'bubble-out' : 'bubble-in'}`}>
        {showSenderName && !isMine && <div className="bubble-sender" style={{ color: message.senderAvatarColor }}>{message.senderName}</div>}
        <span className="bubble-text">{message.content}</span>
        <span className="bubble-meta">
          {formatTime(message.createdAt)}
          {isMine && (isRead ? <CheckCheck size={15} className="tick tick-read" /> : <Check size={15} className="tick" />)}
        </span>
      </div>
    </div>
  );
}
