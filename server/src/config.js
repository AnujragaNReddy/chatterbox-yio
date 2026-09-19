export const PORT = process.env.PORT || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || 'chatterbox-dev-secret-change-me';
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

export const AVATAR_COLORS = [
  '#FF6B6B', '#F06595', '#CC5DE8', '#845EF7', '#5C7CFA',
  '#339AF0', '#22B8CF', '#20C997', '#51CF66', '#94D82D',
  '#FCC419', '#FF922B',
];

export function pickAvatarColor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
