import { supabase } from '@/lib/supabaseClient';

const MEMBERSHIP_SELECT = `
  id,
  organization_id,
  role,
  status,
  invited_at,
  accepted_at,
  organization:organizations!inner(
    id,
    name,
    legal_name,
    cnpj,
    email,
    phone,
    city,
    state,
    status,
    settings
  )
`;

export const organizationService = {
  async listActiveMemberships(userId) {
    const { data, error } = await supabase
      .from('organization_members')
      .select(MEMBERSHIP_SELECT)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).filter(
      (membership) => membership.organization?.status === 'active'
    );
  },

  async isPlatformAdmin() {
    const { data, error } = await supabase.rpc('is_platform_admin');
    if (error) throw error;
    return Boolean(data);
  },
};
