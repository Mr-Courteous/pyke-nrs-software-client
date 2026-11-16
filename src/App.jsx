import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Invoices from './pages/Invoices';
import Companies from './pages/Companies';
import ProductCodes from './pages/ProductCodes';
import CustomerDetails from './pages/CustomerDetails';
import Connections from './pages/Connections';
import Users from './pages/Users';

/** One <Route> per nav item in components/Sidebar.jsx. Every route except /login needs a signed-in user. */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/invoices" replace />} />
          <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
          <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
          <Route path="/customer-details" element={<ProtectedRoute><CustomerDetails /></ProtectedRoute>} />
          <Route path="/product-codes" element={<ProtectedRoute><ProductCodes /></ProtectedRoute>} />
          <Route path="/connections" element={<ProtectedRoute role="ADMIN"><Connections /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute role="ADMIN"><Users /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
