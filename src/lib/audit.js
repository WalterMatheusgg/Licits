import { base44 } from '@/api/base44Client';

export async function logAudit(action, entityType = '', entityId = '', details = '') {
  try {
    const user = await base44.auth.me().catch(() => null);
    await base44.entities.AuditLog.create({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      user_email: user?.email || '',
      user_name: user?.full_name || '',
    });
  } catch (e) {
    // audit logging should never break the main flow
  }
}