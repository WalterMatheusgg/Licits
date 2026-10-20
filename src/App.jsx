import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider } from '@/lib/AuthContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import OrganizationGate from '@/components/auth/OrganizationGate';
import RequirePermission from '@/components/auth/RequirePermission';
import PageNotFound from '@/lib/PageNotFound';

import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/auth/Login';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import UpdatePassword from '@/pages/auth/UpdatePassword';
import Dashboard from '@/pages/Dashboard';
import Contracts from '@/pages/Contracts';
import ContractDetail from '@/pages/ContractDetail';
import ContractTable from '@/pages/ContractTable';
import Documents from '@/pages/Documents';
import Fiscal from '@/pages/Fiscal';
import MapBrazil from '@/pages/MapBrazil';
import Notifications from '@/pages/Notifications';
import AIAssistant from '@/pages/AIAssistant';
import Users from '@/pages/Users';
import Audit from '@/pages/Audit';
import AlertsEmail from '@/pages/AlertsEmail';
import Contacts from '@/pages/Contacts';
import AdminRequests from '@/pages/AdminRequests';
import PriceRegistrations from '@/pages/PriceRegistrations';
import ContractAnalytics from '@/pages/ContractAnalytics';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/update-password" element={<UpdatePassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<OrganizationGate />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/contracts/:id" element={<ContractDetail />} />
            <Route path="/contract-table" element={<ContractTable />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/fiscal" element={<Fiscal />} />
            <Route path="/map" element={<MapBrazil />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route element={<RequirePermission permission="members.manage" />}>
              <Route path="/users" element={<Users />} />
              <Route path="/admin-requests" element={<AdminRequests />} />
            </Route>
            <Route element={<RequirePermission permission="audit.view" />}>
              <Route path="/audit" element={<Audit />} />
            </Route>
            <Route path="/alerts-email" element={<AlertsEmail />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/price-registrations" element={<PriceRegistrations />} />
            <Route path="/contracts/:id/analytics" element={<ContractAnalytics />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AuthProvider>
          <OrganizationProvider>
            <AppRoutes />
            <Toaster />
          </OrganizationProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
