import { supabase } from "../lib/supabase";

export async function logAdminActivity(
  action: string,
  targetType: string,
  targetId?: string | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase.rpc("admin_log_activity", {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId ?? null,
    p_details: details,
  });

  return error;
}
