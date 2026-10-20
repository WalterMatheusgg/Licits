import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { organizationService } from '@/services/organizationService';

const OrganizationContext = createContext(null);

const ROLE_PERMISSIONS = {
  organization_admin: [
    'organizations.manage',
    'members.manage',
    'contracts.manage',
    'fiscal.write',
    'operational.write',
    'audit.view',
  ],
  gestor: ['contracts.manage', 'fiscal.write', 'operational.write'],
  fiscal: ['fiscal.write', 'operational.write'],
  operacional: ['operational.write'],
  visualizador: [],
};

const storageKey = (userId) => `licits.activeOrganizationId.${userId}`;

export const OrganizationProvider = ({ children }) => {
  const { authUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => { queryClient.clear(); }, [authUser?.id, queryClient]);
  const [memberships, setMemberships] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [organizationError, setOrganizationError] = useState(null);

  const refreshOrganizations = useCallback(async () => {
    if (!isAuthenticated || !authUser?.id) {
      setMemberships([]);
      setPendingInvitations([]);
      setActiveOrganizationIdState(null);
      setIsPlatformAdmin(false);
      setOrganizationError(null);
      setIsLoadingOrganizations(false);
      return [];
    }

    setIsLoadingOrganizations(true);
    setOrganizationError(null);

    try {
      const [nextMemberships, pending, platformAdmin] = await Promise.all([
        organizationService.listActiveMemberships(authUser.id),
        organizationService.listPendingInvitations(authUser.id),
        organizationService.isPlatformAdmin(),
      ]);

      setMemberships(nextMemberships);
      setPendingInvitations(pending);
      setIsPlatformAdmin(platformAdmin);

      const savedId = window.localStorage.getItem(storageKey(authUser.id));
      const savedIsValid = nextMemberships.some(
        (membership) => membership.organization_id === savedId
      );
      const nextId = savedIsValid
        ? savedId
        : nextMemberships[0]?.organization_id ?? null;

      setActiveOrganizationIdState(nextId);
      if (nextId) window.localStorage.setItem(storageKey(authUser.id), nextId);
      else window.localStorage.removeItem(storageKey(authUser.id));

      return nextMemberships;
    } catch (error) {
      console.error('Falha ao carregar organizações:', error);
      setMemberships([]);
      setPendingInvitations([]);
      setActiveOrganizationIdState(null);
      setOrganizationError('Não foi possível carregar suas organizações.');
      return [];
    } finally {
      setIsLoadingOrganizations(false);
    }
  }, [authUser?.id, isAuthenticated]);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  const acceptInvitation = useCallback(async (organizationId) => {
    await organizationService.acceptInvitation(organizationId);
    return refreshOrganizations();
  }, [refreshOrganizations]);

  const selectOrganization = useCallback((organizationId) => {
    const membership = memberships.find(
      (item) => item.organization_id === organizationId
    );
    if (!membership) throw new Error('Organização indisponível para este usuário.');

    queryClient.clear(); // Não reutilizar cache entre organizações.
    setActiveOrganizationIdState(organizationId);
    if (authUser?.id) {
      window.localStorage.setItem(storageKey(authUser.id), organizationId);
    }
  }, [memberships, authUser?.id, queryClient]);

  const activeMembership = useMemo(
    () => memberships.find((item) => item.organization_id === activeOrganizationId) ?? null,
    [memberships, activeOrganizationId]
  );

  const activeOrganization = activeMembership?.organization ?? null;
  const role = activeMembership?.role ?? null;
  const permissions = useMemo(() => {
    if (isPlatformAdmin) return new Set(['*']);
    return new Set(ROLE_PERMISSIONS[role] ?? []);
  }, [isPlatformAdmin, role]);

  const can = useCallback((permission) => (
    permissions.has('*') || permissions.has(permission)
  ), [permissions]);

  const hasRole = useCallback((roles) => {
    if (isPlatformAdmin) return true;
    const accepted = Array.isArray(roles) ? roles : [roles];
    return accepted.includes(role);
  }, [isPlatformAdmin, role]);

  const value = useMemo(() => ({
    memberships,
    pendingInvitations,
    acceptInvitation,
    organizations: memberships.map((item) => item.organization),
    activeMembership,
    activeOrganization,
    activeOrganizationId,
    role,
    isPlatformAdmin,
    isLoadingOrganizations,
    organizationError,
    hasOrganizations: memberships.length > 0,
    selectOrganization,
    refreshOrganizations,
    can,
    hasRole,
  }), [
    memberships,
    pendingInvitations,
    acceptInvitation,
    activeMembership,
    activeOrganization,
    activeOrganizationId,
    role,
    isPlatformAdmin,
    isLoadingOrganizations,
    organizationError,
    selectOrganization,
    refreshOrganizations,
    can,
    hasRole,
  ]);

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization deve ser usado dentro de OrganizationProvider.');
  }
  return context;
};
