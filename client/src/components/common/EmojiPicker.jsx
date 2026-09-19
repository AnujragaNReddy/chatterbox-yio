import { useEffect, useRef } from 'react';

const EMOJIS = [
  '😀', '😂', '😅', '😊', '😍', '😘', '😜', '🤔', '😎', '🥳',
  '😢', '😭', '😡', '😱', '🙄', '😴', '🤗', '🤩', '🥺', '😇',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👋', '🤝', '✌️', '🤞',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🔥', '✨', '🎉',
  '🎂', '🍕', '☕', '🍺', '⚽', '🎮', '📷', '🎵', '🚀', '💯',
];

export default function EmojiPicker({ onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={ref}>
      {EMOJIS.map((e) => (
        <button type="button" key={e} onClick={() => onPick(e)}>
          {e}
        </button>
      ))}
    </div>
  );
}
