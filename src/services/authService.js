import { supabase } from '@/lib/supabaseClient';

const PROFILE_FIELDS = 'id, full_name, email, phone, avatar_path, status, last_access_at, created_at, updated_at';

export const authService = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPassword(email, redirectTo) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  async updatePassword(password) {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return data.user;
  },

  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateProfile(userId, values) {
    const allowed = ['full_name', 'phone', 'avatar_path', 'last_access_at'];
    const payload = Object.fromEntries(
      Object.entries(values).filter(([key]) => allowed.includes(key))
    );

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select(PROFILE_FIELDS)
      .single();

    if (error) throw error;
    return data;
  },

  async touchLastAccess(userId) {
    const { error } = await supabase
      .from('profiles')
      .update({
        last_access_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
  },
};
