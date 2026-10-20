import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { authService } from '@/services/authService';

const AuthContext = createContext(null);

const normalizeAuthError = (error) => {
  const message = error?.message || 'Não foi possível autenticar.';

  if (/invalid login credentials/i.test(message)) {
    return { type: 'invalid_credentials', message: 'E-mail ou senha incorretos.' };
  }

  if (/email not confirmed/i.test(message)) {
    return { type: 'email_not_confirmed', message: 'Confirme seu e-mail antes de entrar.' };
  }

  return { type: 'auth_error', message };
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const hydrationIdRef = useRef(0);

  const hydrateSession = useCallback(async (nextSession) => {
    const hydrationId = ++hydrationIdRef.current;
    setIsLoadingAuth(true);
    setAuthError(null);
    setSession(nextSession ?? null);

    if (!nextSession?.user) {
      setProfile(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }

    try {
      const nextProfile = await authService.getProfile(nextSession.user.id);
      if (hydrationId !== hydrationIdRef.current) return;

      if (!nextProfile) {
        setProfile(null);
        setAuthError({
          type: 'profile_missing',
          message: 'Seu perfil ainda não foi criado. Entre em contato com o administrador.',
        });
      } else if (nextProfile.status === 'blocked') {
        setProfile(nextProfile);
        setAuthError({
          type: 'user_blocked',
          message: 'Sua conta está bloqueada.',
        });
      } else if (nextProfile.status !== 'active') {
        setProfile(nextProfile);
        setAuthError({
          type: 'user_inactive',
          message: 'Sua conta não está ativa.',
        });
      } else {
        setProfile(nextProfile);
        authService.touchLastAccess(nextSession.user.id).catch((error) => {
          console.warn('Não foi possível atualizar o último acesso:', error);
        });
      }
    } catch (error) {
      if (hydrationId !== hydrationIdRef.current) return;
      console.error('Falha ao carregar perfil:', error);
      setProfile(null);
      setAuthError({
        type: 'profile_load_error',
        message: 'Não foi possível carregar seu perfil.',
      });
    } finally {
      if (hydrationId === hydrationIdRef.current) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    authService
      .getSession()
      .then((initialSession) => {
        if (mounted) return hydrateSession(initialSession);
        return null;
      })
      .catch((error) => {
        console.error('Falha ao restaurar sessão:', error);
        if (mounted) {
          setAuthError(normalizeAuthError(error));
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      });

    const { data } = authService.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        if (mounted) hydrateSession(nextSession);
      }, 0);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [hydrateSession]);

  const signIn = useCallback(async (email, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const data = await authService.signIn(email.trim(), password);
      await hydrateSession(data.session);
      return data;
    } catch (error) {
      const normalized = normalizeAuthError(error);
      setAuthError(normalized);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      throw Object.assign(error, { userMessage: normalized.message });
    }
  }, [hydrateSession]);

  const logout = useCallback(async () => {
    try {
      await authService.signOut();
    } finally {
      hydrationIdRef.current += 1;
      setSession(null);
      setProfile(null);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const resetPassword = useCallback((email) => {
    const redirectTo = `${window.location.origin}/update-password`;
    return authService.resetPassword(email.trim(), redirectTo);
  }, []);

  const updatePassword = useCallback((password) => {
    return authService.updatePassword(password);
  }, []);

  const updateProfile = useCallback(async (values) => {
    if (!session?.user?.id) throw new Error('Usuário não autenticado.');
    const updated = await authService.updateProfile(session.user.id, values);
    setProfile(updated);
    return updated;
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return null;
    const nextProfile = await authService.getProfile(session.user.id);
    setProfile(nextProfile);
    return nextProfile;
  }, [session?.user?.id]);

  const value = useMemo(() => ({
    session,
    authUser: session?.user ?? null,
    profile,
    user: profile
      ? { ...profile, auth_id: session?.user?.id, email: profile.email || session?.user?.email }
      : null,
    isAuthenticated: Boolean(session?.user && profile && profile.status === 'active' && !authError),
    isLoadingAuth,
    authChecked,
    authError,
    signIn,
    logout,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
    refreshSession: () => hydrateSession(session),
  }), [
    session,
    profile,
    authError,
    isLoadingAuth,
    authChecked,
    signIn,
    logout,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
    hydrateSession,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
};
