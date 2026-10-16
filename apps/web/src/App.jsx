import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, homePathFor, useAuth } from "./auth/AuthContext";
import AuthPage from "./pages/auth/AuthPage";
import CustomerApp from "./pages/customer/CustomerApp";
import SupplierApp from "./pages/supplier/SupplierApp";

/*
 * Role-based routing. The server enforces roles on every API call; these
 * guards just send people to the screens that belong to their account.
 */
function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="full-screen-center">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homePathFor(user)} replace />;
  return children;
}

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homePathFor(user) : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route
          path="/customer/*"
          element={
            <RequireRole role="CUSTOMER">
              <CustomerApp />
            </RequireRole>
          }
        />
        <Route
          path="/supplier/*"
          element={
            <RequireRole role="SUPPLIER">
              <SupplierApp />
            </RequireRole>
          }
        />
        <Route path="*" element={<Landing />} />
      </Routes>
    </AuthProvider>
  );
}
