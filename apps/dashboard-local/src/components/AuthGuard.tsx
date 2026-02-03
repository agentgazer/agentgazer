import { Navigate } from "react-router-dom";
import { getToken } from "../lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
