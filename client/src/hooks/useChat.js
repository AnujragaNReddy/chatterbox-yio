import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

function upsertConversation(list, conversation) {
  const rest = list.filter((c) => c.id !== conversation.id);
  return [conversation, ...rest];
}

export function useChat() {
  const { token, user } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [typingByConv, setTypingByConv] = useState({});
  const [presence, setPresence] = useState({});
  const [readReceipts, setReadReceipts] = useState({});

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const refreshConversations = useCallback(() => {
    if (!token) return;
    setLoadingConversations(true);
    api
      .listConversations(token)
      .then(({ conversations: list }) => {
        setConversations(list);
        const nextPresence = {};
        list.forEach((c) => {
          if (c.otherUser) nextPresence[c.otherUser.id] = { isOnline: c.otherUser.isOnline, lastSeen: c.otherUser.lastSeen };
        });
        setPresence((prev) => ({ ...prev, ...nextPresence }));
      })
      .finally(() => setLoadingConversations(false));
  }, [token]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const loadMessages = useCallback(
    async (conversationId) => {
      if (!token || messagesByConv[conversationId]) return;
      const { messages } = await api.listMessages(token, conversationId);
      setMessagesByConv((prev) => ({ ...prev, [conversationId]: messages }));
    },
    [token, messagesByConv]
  );

  const selectConversation = useCallback(
    async (conversationId) => {
      setActiveId(conversationId);
      await loadMessages(conversationId);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
      socket?.emit('conversation:read', { conversationId });
      api.markConversationRead(token, conversationId).catch(() => {});
    },
    [loadMessages, socket, token]
  );

  useEffect(() => {
    if (!socket) return;

    const onMessageNew = (message) => {
      setMessagesByConv((prev) => {
        const existing = prev[message.conversationId] || [];
        if (existing.some((m) => m.id === message.id)) return prev;
        return { ...prev, [message.conversationId]: [...existing, message] };
      });

      setConversations((prev) => {
        const conv = prev.find((c) => c.id === message.conversationId);
        const isActive = activeIdRef.current === message.conversationId;
        const isMine = message.senderId === user?.id;
        const updated = conv
          ? {
              ...conv,
              lastMessage: { id: message.id, content: message.content, senderId: message.senderId, senderName: message.senderName, createdAt: message.createdAt },
              unreadCount: isActive || isMine ? 0 : (conv.unreadCount || 0) + 1,
            }
          : null;
        if (!updated) return prev;
        return upsertConversation(prev, updated);
      });

      if (activeIdRef.current === message.conversationId && message.senderId !== user?.id) {
        socket.emit('conversation:read', { conversationId: message.conversationId });
      }
    };

    const onConversationNew = (conversation) => {
      setConversations((prev) => upsertConversation(prev, conversation));
      socket.emit('conversation:join', { conversationId: conversation.id });
    };

    const onTyping = ({ conversationId, userId, isTyping }) => {
      setTypingByConv((prev) => {
        const set = new Set(prev[conversationId] || []);
        if (isTyping) set.add(userId);
        else set.delete(userId);
        return { ...prev, [conversationId]: set };
      });
    };

    const onPresence = ({ userId, isOnline, lastSeen }) => {
      setPresence((prev) => ({ ...prev, [userId]: { isOnline, lastSeen: lastSeen ?? prev[userId]?.lastSeen } }));
    };

    const onMessageRead = ({ conversationId, readerId, upToMessageId }) => {
      setReadReceipts((prev) => ({
        ...prev,
        [conversationId]: { ...(prev[conversationId] || {}), [readerId]: upToMessageId },
      }));
    };

    socket.on('message:new', onMessageNew);
    socket.on('conversation:new', onConversationNew);
    socket.on('typing', onTyping);
    socket.on('presence:update', onPresence);
    socket.on('message:read', onMessageRead);

    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('conversation:new', onConversationNew);
      socket.off('typing', onTyping);
      socket.off('presence:update', onPresence);
      socket.off('message:read', onMessageRead);
    };
  }, [socket, user?.id]);

  const sendMessage = useCallback(
    (content) => {
      if (!socket || !activeId || !content.trim()) return;
      socket.emit('message:send', { conversationId: activeId, content }, (response) => {
        if (response?.error) console.error('Send failed:', response.error);
      });
    },
    [socket, activeId]
  );

  const setTyping = useCallback(
    (isTyping) => {
      if (!socket || !activeId) return;
      socket.emit('typing', { conversationId: activeId, isTyping });
    },
    [socket, activeId]
  );

  const startDirectChat = useCallback(
    async (userId) => {
      const { conversation } = await api.openDirectConversation(token, userId);
      setConversations((prev) => upsertConversation(prev, conversation));
      socket?.emit('conversation:join', { conversationId: conversation.id });
      await selectConversation(conversation.id);
      return conversation;
    },
    [token, socket, selectConversation]
  );

  const createGroup = useCallback(
    async (name, memberIds) => {
      const { conversation } = await api.createGroup(token, { name, memberIds });
      setConversations((prev) => upsertConversation(prev, conversation));
      socket?.emit('conversation:join', { conversationId: conversation.id });
      await selectConversation(conversation.id);
      return conversation;
    },
    [token, socket, selectConversation]
  );

  const activeConversation = conversations.find((c) => c.id === activeId) || null;
  const activeMessages = activeId ? messagesByConv[activeId] || [] : [];
  const activeTypingUserIds = activeId ? [...(typingByConv[activeId] || [])].filter((id) => id !== user?.id) : [];

  return {
    conversations,
    loadingConversations,
    activeId,
    activeConversation,
    activeMessages,
    activeTypingUserIds,
    presence,
    readReceipts,
    selectConversation,
    sendMessage,
    setTyping,
    startDirectChat,
    createGroup,
    refreshConversations,
  };
}
