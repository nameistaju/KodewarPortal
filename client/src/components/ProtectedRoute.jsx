import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardLoader from "./DashboardLoader";

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <DashboardLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword || user.forcePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles) {
    const userRole = user.role?.toUpperCase();
    const isAllowed = allowedRoles.map((r) => r.toUpperCase()).includes(userRole);
    if (!isAllowed) {
      const fallbackPath = userRole === 'HR' ? '/hr' : '/dashboard';
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <Outlet />;
}
