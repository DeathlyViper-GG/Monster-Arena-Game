import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { installInspectGuard } from '@/lib/preventInspect';
import DevtoolsCurtain from '@/components/DevtoolsCurtain';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Mfa from '@/pages/Mfa';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Game from '@/pages/Game';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import Vpn from '@/pages/Vpn';
import CommunityLevels from '@/pages/CommunityLevels';
import LevelEditor from '@/pages/LevelEditor';
import LevelReview from '@/pages/LevelReview';

// Sends a signed-out visitor to the sign-in page, remembering the page they
// asked for so they land in the editor (or the review queue) once they are in.
const SignInRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
};

const AuthenticatedApp = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/mfa" element={<Mfa />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/levels" element={<CommunityLevels />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<SignInRedirect />} />}>
        <Route path="/vpn" element={<Vpn />} />
        <Route path="/editor" element={<LevelEditor />} />
        <Route path="/level-review" element={<LevelReview />} />
      </Route>
      <Route path="/" element={<Game />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  // Every page keeps the browser's right-click menu and the DevTools shortcuts
  // out of reach, exactly like the game page does.
  useEffect(() => installInspectGuard(), []);
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        {/* The seal over an open inspector now belongs to the whole app, not
            just the game page. */}
        <DevtoolsCurtain />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App