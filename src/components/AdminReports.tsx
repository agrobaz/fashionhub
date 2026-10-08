import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Report = {
  id: string;
  reporter_id: string | null;
  shoe_id: string | null;
  shop_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: err } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setReports((data ?? []) as Report[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(
    reportId: string,
    status: Report["status"],
  ) {
    setBusyId(reportId);
    setError("");

    const { error: err } = await supabase.rpc(
      "admin_update_report",
      {
        p_report_id: reportId,
        p_status: status,
      },
    );

    if (err) {
      setError(err.message);
    } else {
      await load();
    }

    setBusyId(null);
  }

  async function moderateShoe(
    shoeId: string,
    available: boolean,
  ) {
    setBusyId(shoeId);
    setError("");

    const { error: err } = await supabase.rpc(
      "admin_moderate_shoe",
      {
        p_shoe_id: shoeId,
        p_available: available,
      },
    );

    if (err) {
      setError(err.message);
    } else {
      await load();
    }

    setBusyId(null);
  }

  if (loading) {
    return (
      <div className="pad">
        <p className="muted">Loading reports...</p>
      </div>
    );
  }

  const open = reports.filter((r) => r.status === "open").length;
  const reviewing = reports.filter((r) => r.status === "reviewing").length;
  const resolved = reports.filter((r) => r.status === "resolved").length;
  const dismissed = reports.filter((r) => r.status === "dismissed").length;

  return (
    <section className="card">
      <div className="card-body">
        <div className="top">
          <div>
            <div className="eyebrow">Moderation</div>
            <h2>Reports</h2>
            <p className="muted">
              Review reports submitted by ShoeHub users.
            </p>
          </div>

          <button
            className="btn small ghost"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="stats">
          <div className="stat">
            <strong>{open}</strong>
            <span>Open</span>
          </div>

          <div className="stat">
            <strong>{reviewing}</strong>
            <span>Reviewing</span>
          </div>

          <div className="stat">
            <strong>{resolved}</strong>
            <span>Resolved</span>
          </div>

          <div className="stat">
            <strong>{dismissed}</strong>
            <span>Dismissed</span>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="empty-market card">
            <h3>No reports yet</h3>
            <p className="muted">
              User reports will appear here.
            </p>
          </div>
        ) : (
          <div className="grid">
            {reports.map((report) => (
              <article className="card" key={report.id}>
                <div className="card-body">
                  <div className="top">
                    <div>
                      <strong>{report.reason}</strong>

                      <p className="muted small">
                        {new Date(report.created_at).toLocaleString()}
                      </p>
                    </div>

                    <span className="badge">
                      {report.status}
                    </span>
                  </div>

                  {report.details && (
                    <div className="box">
                      <strong>Details</strong>
                      <p>{report.details}</p>
                    </div>
                  )}

                  {report.shoe_id && (
                    <p className="muted small">
                      Shoe: {report.shoe_id}
                    </p>
                  )}

                  {report.shop_id && (
                    <p className="muted small">
                      Store: {report.shop_id}
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 12,
                    }}
                  >
                    {report.status === "open" && (
                      <button
                        className="btn small"
                        disabled={busyId === report.id}
                        onClick={() =>
                          void updateStatus(
                            report.id,
                            "reviewing",
                          )
                        }
                      >
                        Start review
                      </button>
                    )}

                    {(report.status === "open" ||
                      report.status === "reviewing") && (
                      <>
                        <button
                          className="btn small"
                          disabled={busyId === report.id}
                          onClick={() =>
                            void updateStatus(
                              report.id,
                              "resolved",
                            )
                          }
                        >
                          Resolve
                        </button>

                        <button
                          className="btn small ghost"
                          disabled={busyId === report.id}
                          onClick={() =>
                            void updateStatus(
                              report.id,
                              "dismissed",
                            )
                          }
                        >
                          Dismiss
                        </button>
                      </>
                    )}

                    {report.shoe_id &&
                      (report.status === "open" ||
                        report.status === "reviewing") && (
                        <button
                          className="btn small ghost"
                          disabled={busyId === report.shoe_id}
                          onClick={() =>
                            void moderateShoe(
                              report.shoe_id as string,
                              false,
                            )
                          }
                        >
                          Hide listing
                        </button>
                      )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
