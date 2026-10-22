import { lazy, Suspense } from 'react';
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
import LoadingScreen from '@/components/auth/LoadingScreen';
import AppErrorBoundary from '@/components/common/AppErrorBoundary';

import AppLayout from '@/components/layout/AppLayout';
const Login = lazy(() => import('@/pages/auth/Login'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const UpdatePassword = lazy(() => import('@/pages/auth/UpdatePassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Contracts = lazy(() => import('@/pages/Contracts'));
const ContractDetail = lazy(() => import('@/pages/ContractDetail'));
const ContractTable = lazy(() => import('@/pages/ContractTable'));
const Documents = lazy(() => import('@/pages/Documents'));
const Fiscal = lazy(() => import('@/pages/Fiscal'));
const MapBrazil = lazy(() => import('@/pages/MapBrazil'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const AIAssistant = lazy(() => import('@/pages/AIAssistant'));
const Users = lazy(() => import('@/pages/Users'));
const Audit = lazy(() => import('@/pages/Audit'));
const AlertsEmail = lazy(() => import('@/pages/AlertsEmail'));
const Contacts = lazy(() => import('@/pages/Contacts'));
const AdminRequests = lazy(() => import('@/pages/AdminRequests'));
const PriceRegistrations = lazy(() => import('@/pages/PriceRegistrations'));
const ContractAnalytics = lazy(() => import('@/pages/ContractAnalytics'));

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
            <AppErrorBoundary>
              <Suspense fallback={<LoadingScreen message="Carregando módulo do Licits..." />}>
                <AppRoutes />
              </Suspense>
            </AppErrorBoundary>
            <Toaster />
          </OrganizationProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
