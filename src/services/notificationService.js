import { supabase } from '@/lib/supabaseClient';

export const notificationService = {
  async listUnread({ organizationId, userId, limit = 5 }) {
    if (!organizationId || !userId) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, priority, target_user_id, entity_type, entity_id, read_at, created_at')
      .eq('organization_id', organizationId)
      .is('read_at', null)
      .or(`target_user_id.is.null,target_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(Math.max(50, limit * 5));

    if (error) throw error;
    const broadcasts = (data ?? []).filter(n => !n.target_user_id).map(n => n.id);
    if (!broadcasts.length) return data ?? [];
    const receipts = await supabase.from('notification_reads').select('notification_id')
      .eq('organization_id', organizationId).eq('user_id', userId)
      .in('notification_id', broadcasts);
    if (receipts.error) throw receipts.error;
    const seen = new Set((receipts.data ?? []).map(row => row.notification_id));
    return data.filter(n => n.target_user_id || !seen.has(n.id)).slice(0, limit);
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
