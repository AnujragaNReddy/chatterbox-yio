import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../hooks/useChat.js';
import Sidebar from '../components/Sidebar/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow/ChatWindow.jsx';

export default function ChatPage() {
  const { user, logout } = useAuth();
  const {
    conversations,
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
  } = useChat();

  return (
    <div className="app-shell">
      <div className="app-window">
        <Sidebar
          user={user}
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onLogout={logout}
          onStartDirect={startDirectChat}
          onCreateGroup={createGroup}
          presence={presence}
        />
        <ChatWindow
          conversation={activeConversation}
          messages={activeMessages}
          currentUser={user}
          typingUserIds={activeTypingUserIds}
          presence={presence}
          readReceipts={activeConversation ? readReceipts[activeConversation.id] || {} : {}}
          onSend={sendMessage}
          onTyping={setTyping}
        />
      </div>
    </div>
  );
}
