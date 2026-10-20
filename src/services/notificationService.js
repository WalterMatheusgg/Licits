import { supabase } from '@/lib/supabaseClient';

export const notificationService = {
  async listUnread({ organizationId, userId, limit = 5 }) {
    if (!organizationId || !userId) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, priority, entity_type, entity_id, read_at, created_at')
      .eq('organization_id', organizationId)
      .is('read_at', null)
      .or(`target_user_id.is.null,target_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },

  subscribe({ organizationId, onChange }) {
    if (!organizationId) return () => {};

    const channel = supabase
      .channel(`notifications:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `organization_id=eq.${organizationId}`,
        },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
