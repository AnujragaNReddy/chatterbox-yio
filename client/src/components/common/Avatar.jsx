import { Users } from 'lucide-react';
import { initials } from '../../utils/format.js';

export default function Avatar({ name, color = '#888', size = 44, isGroup = false, online = false }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        className="avatar"
        style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
      >
        {isGroup ? <Users size={size * 0.5} /> : initials(name)}
      </div>
      {online && (
        <span
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: '50%',
            background: 'var(--online-dot)',
            border: '2px solid var(--bg-sidebar)',
          }}
        />
      )}
    </div>
  );
}
