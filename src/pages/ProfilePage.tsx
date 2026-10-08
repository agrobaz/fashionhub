import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name ?? "",
  );
  const [newPassword, setNewPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!user) {
    return null;
  }

  const accountType =
    user.user_metadata?.account_type === "seller"
      ? "Seller"
      : "Buyer";

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }

    setSavingName(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
      },
    });

    setSavingName(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Your name has been updated.");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }

    setSavingPassword(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNewPassword("");
    setMessage("Your password has been changed.");
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <div className="eyebrow">Account settings</div>
          <h1>Your profile</h1>
          <p className="muted">
            Manage your ShoeHub account information and security.
          </p>
        </div>

        <Link to="/buyer" className="btn ghost">
          ← My account
        </Link>
      </div>

      {error && (
        <div className="box">
          <p className="error">{error}</p>
        </div>
      )}

      {message && (
        <div className="box profile-success">
          <strong>{message}</strong>
        </div>
      )}

      <div className="profile-grid">
        <section className="box profile-card">
          <div className="profile-icon">👤</div>

          <h2>Account information</h2>
          <p className="muted">
            Your login email and account type.
          </p>

          <div className="profile-info">
            <div>
              <span>Email</span>
              <strong>{user.email}</strong>
            </div>

            <div>
              <span>Account type</span>
              <strong>{accountType}</strong>
            </div>

            <div>
              <span>Member since</span>
              <strong>
                {new Date(user.created_at).toLocaleDateString()}
              </strong>
            </div>
          </div>
        </section>

        <section className="box profile-card">
          <div className="profile-icon">✏️</div>

          <h2>Personal details</h2>
          <p className="muted">
            Update the name shown on your ShoeHub account.
          </p>

          <form onSubmit={updateName} className="form">
            <label className="field">
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </label>

            <button
              type="submit"
              className="btn"
              disabled={savingName}
            >
              {savingName ? "Saving..." : "Save name"}
            </button>
          </form>
        </section>

        <section className="box profile-card">
          <div className="profile-icon">🔐</div>

          <h2>Password</h2>
          <p className="muted">
            Choose a new password for your ShoeHub account.
          </p>

          <form onSubmit={updatePassword} className="form">
            <label className="field">
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                placeholder="At least 8 characters"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            <button
              type="submit"
              className="btn"
              disabled={savingPassword}
            >
              {savingPassword ? "Changing..." : "Change password"}
            </button>
          </form>
        </section>

        <section className="box profile-card danger-card">
          <div className="profile-icon">🚪</div>

          <h2>Sign out</h2>
          <p className="muted">
            Sign out of your ShoeHub account on this device.
          </p>

          <button
            type="button"
            className="btn danger"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
