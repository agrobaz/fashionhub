import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type AdminUser = {
  id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  country_code: string | null;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  user_roles?: {
    role: string;
  }[];
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");

    const { data, error: usersError } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        username,
        phone,
        country_code,
        is_active,
        onboarding_completed,
        created_at,
        user_roles(role)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (usersError) {
      setError(usersError.message);
      setLoading(false);
      return;
    }

    setUsers((data as AdminUser[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function setUserActive(userId: string, active: boolean) {
    setBusyId(userId);
    setError("");

    const { error: rpcError } = await supabase.rpc(
      "admin_set_user_active",
      {
        p_user_id: userId,
        p_is_active: active,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      setBusyId(null);
      return;
    }

    await loadUsers();
    setBusyId(null);
  }

  const query = search.trim().toLowerCase();

  const filtered = users.filter((user) => {
    if (!showInactive && !user.is_active) return false;

    if (!query) return true;

    const roleText = (user.user_roles ?? [])
      .map((role) => role.role)
      .join(" ");

    return [
      user.full_name,
      user.username,
      user.phone,
      user.id,
      roleText,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(query),
      );
  });

  return (
    <section className="admin-panel">
      <div className="section-head">
        <div>
          <h2>User management</h2>
          <p className="muted small">
            Manage FashionHub accounts and platform access.
          </p>
        </div>

        <button
          type="button"
          className="btn small ghost"
          onClick={() => void loadUsers()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="box admin-error">
          <p className="error">{error}</p>
        </div>
      )}

      <div className="admin-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users, usernames, phones or roles"
          aria-label="Search users"
        />

        <label className="admin-check">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) =>
              setShowInactive(event.target.checked)
            }
          />
          Show inactive
        </label>
      </div>

      {loading ? (
        <p className="muted">Loading users...</p>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">
          <strong>No users found.</strong>
          <p className="muted">
            Try another search or enable inactive users.
          </p>
        </div>
      ) : (
        <div className="admin-user-list">
          {filtered.map((user) => {
            const busy = busyId === user.id;

            const roles =
              user.user_roles?.map((role) => role.role) ?? [];

            return (
              <article className="admin-user-card" key={user.id}>
                <div className="admin-user-avatar">
                  {(user.full_name || user.username || "FH")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>

                <div className="admin-user-info">
                  <div className="admin-listing-title">
                    <h3>
                      {user.full_name ||
                        user.username ||
                        "FashionHub user"}
                    </h3>

                    <span
                      className={
                        user.is_active
                          ? "badge ok"
                          : "badge danger"
                      }
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <p className="muted small">
                    @{user.username || "username not set"}
                  </p>

                  <p className="muted small">
                    {user.phone
                      ? `${user.country_code || ""} ${user.phone}`
                      : "Phone not provided"}
                  </p>

                  <p className="muted small">
                    Roles:{" "}
                    {roles.length > 0
                      ? roles.join(", ")
                      : "user"}
                  </p>

                  <p className="muted small">
                    Joined{" "}
                    {new Date(
                      user.created_at,
                    ).toLocaleDateString()}
                  </p>
                </div>

                <div className="admin-actions">
                  {user.is_active ? (
                    <button
                      type="button"
                      className="btn small ghost"
                      disabled={busy}
                      onClick={() =>
                        void setUserActive(user.id, false)
                      }
                    >
                      {busy ? "Working..." : "Deactivate"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn small gold"
                      disabled={busy}
                      onClick={() =>
                        void setUserActive(user.id, true)
                      }
                    >
                      {busy ? "Working..." : "Activate"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
