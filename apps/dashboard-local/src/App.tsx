import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import LoginPage from "./pages/LoginPage";
import Layout from "./components/Layout";
import OverviewPage from "./pages/OverviewPage";
import AgentsPage from "./pages/AgentsPage";
import AgentDetailPage from "./pages/AgentDetailPage";
import ProvidersPage from "./pages/ProvidersPage";
import ProviderDetailPage from "./pages/ProviderDetailPage";
import CostsPage from "./pages/CostsPage";
import AlertsPage from "./pages/AlertsPage";
import LogsPage from "./pages/LogsPage";
import IncidentPage from "./pages/IncidentPage";
import IncidentsPage from "./pages/IncidentsPage";
import OpenClawPage from "./pages/OpenClawPage";
import SettingsPage from "./pages/SettingsPage";
import { ConnectionProvider } from "./contexts/ConnectionContext";

export default function App() {
  return (
    <BrowserRouter>
      <ConnectionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard><Layout /></AuthGuard>}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/:agentId" element={<AgentDetailPage />} />
            <Route path="/providers" element={<ProvidersPage />} />
            <Route path="/providers/:name" element={<ProviderDetailPage />} />
            <Route path="/costs" element={<CostsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/events" element={<LogsPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/incidents/:eventId" element={<IncidentPage />} />
            <Route path="/openclaw" element={<OpenClawPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </ConnectionProvider>
    </BrowserRouter>
  );
}
