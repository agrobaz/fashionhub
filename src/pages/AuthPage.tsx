import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Mode = "login" | "register";
type AccountType = "buyer" | "seller";

export default function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");
  const [accountType, setAccountType] = useState<AccountType>("buyer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        if (!fullName.trim()) {
          throw new Error("Enter your full name.");
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              account_type: accountType,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (!data.user) {
          throw new Error("Account could not be created.");
        }

        if (!data.session) {
          throw new Error(
            "Account created, but automatic login is unavailable. Make sure Confirm email is OFF in Supabase.",
          );
        }

        navigate(accountType === "seller" ? "/seller" : "/buyer");
        return;
      }

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        throw signInError;
      }

      const type = data.user?.user_metadata?.account_type;

      navigate(type === "seller" ? "/seller" : "/buyer");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="splash">
        <img src="/logo.png" alt="FashionHub logo" />
        <h1>
          Shoe<span>Hub</span>
        </h1>
        <p className="muted">
          New and second-hand shoes from local sellers
        </p>
      </div>

      <div className="seg">
        <button
          type="button"
          className={mode === "login" ? "on" : ""}
          onClick={() => {
            setMode("login");
            setError("");
            setMessage("");
          }}
        >
          Login
        </button>

        <button
          type="button"
          className={mode === "register" ? "on" : ""}
          onClick={() => {
            setMode("register");
            setError("");
            setMessage("");
          }}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form">
        {mode === "register" && (
          <label className="field">
            Full name
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              placeholder="Amina Nakato"
              required
            />
          </label>
        )}

        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="name@email.com"
            required
          />
        </label>

        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>

        {mode === "register" && (
          <div className="seg">
            <button
              type="button"
              className={accountType === "buyer" ? "on" : ""}
              onClick={() => setAccountType("buyer")}
            >
              I'm buying
            </button>

            <button
              type="button"
              className={accountType === "seller" ? "on" : ""}
              onClick={() => setAccountType("seller")}
            >
              I'm selling
            </button>
          </div>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="ok" role="status">
            {message}
          </p>
        )}

        <button type="submit" className="btn gold" disabled={loading}>
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Login"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}

