import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ChatPage from './pages/ChatPage.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (user) return <Navigate to="/chat" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
      <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
      <Route
        path="/chat"
        element={
          <RequireAuth>
            <SocketProvider>
              <ChatPage />
            </SocketProvider>
          </RequireAuth>
        }
      />
      {/* Where Yolo-Auth sends the browser back. AuthProvider reads the
          code out of the fragment on mount and clears it; by the time this
          renders there is nothing left to do but move along. The catch-all
          below would cover it, but a named route makes the contract with the
          auth service visible rather than incidental. */}
      <Route path="/auth/done" element={<Navigate to="/chat" replace />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
