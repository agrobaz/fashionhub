import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Activity = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export default function AdminActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadActivity() {
    setLoading(true);
    setError("");

    const { data, error: activityError } = await supabase
      .from("admin_activity_log")
      .select(
        "id, admin_id, action, target_type, target_id, details, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (activityError) {
      setError(activityError.message);
      setLoading(false);
      return;
    }

    setActivities((data as Activity[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadActivity();
  }, []);

  const query = search.trim().toLowerCase();

  const filtered = activities.filter((activity) => {
    if (!query) return true;

    return [
      activity.action,
      activity.target_type,
      activity.target_id,
      activity.admin_id,
      JSON.stringify(activity.details),
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
          <h2>Admin activity</h2>
          <p className="muted small">
            Security history for important platform actions.
          </p>
        </div>

        <button
          type="button"
          className="btn small ghost"
          onClick={() => void loadActivity()}
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
          placeholder="Search activity, action or target"
          aria-label="Search admin activity"
        />
      </div>

      {loading ? (
        <p className="muted">Loading activity...</p>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">
          <strong>No activity found.</strong>
          <p className="muted">
            Admin actions will appear here as they are recorded.
          </p>
        </div>
      ) : (
        <div className="admin-activity-list">
          {filtered.map((activity) => (
            <article
              className="admin-activity-card"
              key={activity.id}
            >
              <div className="admin-activity-icon">
                FH
              </div>

              <div className="admin-activity-info">
                <div className="admin-listing-title">
                  <h3>{activity.action}</h3>

                  <span className="badge">
                    {activity.target_type}
                  </span>
                </div>

                <p className="muted small">
                  Target:{" "}
                  {activity.target_id || "Platform"}
                </p>

                <p className="muted small">
                  Admin: {activity.admin_id}
                </p>

                <p className="muted small">
                  {new Date(
                    activity.created_at,
                  ).toLocaleString()}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
