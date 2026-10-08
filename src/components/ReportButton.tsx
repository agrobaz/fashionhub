import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

type ReportTarget = {
  shoeId?: string;
  shopId?: string;
};

export default function ReportButton({
  shoeId,
  shopId,
}: ReportTarget) {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Scam or suspicious listing");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (!user) {
      setMessage("Please log in to report this.");
      return;
    }

    if (!shoeId && !shopId) {
      setMessage("Nothing to report.");
      return;
    }

    setBusy(true);
    setMessage("");

    const { error } = await supabase
      .from("reports")
      .insert({
        reporter_id: user.id,
        shoe_id: shoeId ?? null,
        shop_id: shopId ?? null,
        reason,
        details: details.trim() || null,
      });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Report submitted. Thank you.");
      setDetails("");
      setOpen(false);
    }

    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        className="btn small ghost"
        onClick={() => {
          if (!user) {
            setMessage("Please log in to report this.");
            return;
          }

          setOpen((value) => !value);
          setMessage("");
        }}
      >
        Report
      </button>

      {message && (
        <p className="muted small" style={{ marginTop: 8 }}>
          {message}
        </p>
      )}

      {open && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-body">
            <h3>Report listing</h3>

            <label>
              Reason
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              >
                <option>Scam or suspicious listing</option>
                <option>Wrong or misleading information</option>
                <option>Prohibited item</option>
                <option>Fake or counterfeit item</option>
                <option>Harassment or inappropriate content</option>
                <option>Other</option>
              </select>
            </label>

            <label style={{ marginTop: 12 }}>
              Details
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Tell us what is wrong..."
                rows={4}
                maxLength={1000}
                disabled={busy}
              />
            </label>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => void submit()}
                disabled={busy}
              >
                {busy ? "Submitting..." : "Submit report"}
              </button>

              <button
                type="button"
                className="btn ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
