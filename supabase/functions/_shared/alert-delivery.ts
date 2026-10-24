// Pure policy helpers: reusable by the dispatcher and testable without Supabase/Resend.
export type AlertMember = { user_id: string; role: string; status: string };
export type AlertProfile = { id: string; email?: string | null; status: string };

export function permittedAlertUserIds(members: AlertMember[], fiscalUserId: string | null): string[] {
  return [...new Set(members
    .filter(m => m.status === 'active'
      && (m.role === 'organization_admin' || (m.user_id === fiscalUserId && ['fiscal', 'gestor', 'organization_admin'].includes(m.role))))
    .map(m => m.user_id))];
}

export function eligibleAlertRecipients(profiles: AlertProfile[], permittedIds: string[]): AlertProfile[] {
  const permitted = new Set(permittedIds);
  const seen = new Set<string>();
  return profiles.filter(p => {
    if (p.status !== 'active' || !permitted.has(p.id) || seen.has(p.id)
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || '')) return false;
    seen.add(p.id);
    return true;
  });
}

export function alertIdempotencyKey(alertId: string, userId: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(alertId) || !/^[a-f0-9-]{36}$/i.test(userId)) {
    throw Error('Invalid alert or recipient identifier');
  }
  return 'licits-' + alertId + '-' + userId;
}
