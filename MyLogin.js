import React, { useState } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./firebase";

export default function MyLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetStatus, setResetStatus] = useState("");

  const handleLogIn = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      setLoading(false);
      setErr(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setLoading(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      setLoading(false);
      setErr(error.message);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setErr(null);
    setResetStatus("");
    if (!email) {
      setErr("Please enter your email to reset password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetStatus(
        "Reset email sent! Please check your inbox and your spam/junk folder."
      );
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <div style={{
      minHeight: 340,
      minWidth: 340,
      background: "#181e2a",
      borderRadius: 16,
      boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
      padding: 36,
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <h2 style={{ color: "#FFD600", marginBottom: 24, fontWeight: 900, fontSize: 32 }}>
        Welcome back!
      </h2>
      {!showForgot ? (
        <>
          <form onSubmit={handleLogIn} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              autoComplete="username"
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1.5px solid #232c3d",
                fontSize: 18,
                background: "#232c3d",
                color: "#fff",
                outline: "none",
                transition: "border 0.2s",
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="current-password"
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1.5px solid #232c3d",
                fontSize: 18,
                background: "#232c3d",
                color: "#fff",
                outline: "none",
                transition: "border 0.2s",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 10,
                padding: "12px 0",
                background: loading ? "#FFD600aa" : "#FFD600",
                color: "#101622",
                border: "none",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 20,
                cursor: loading ? "wait" : "pointer",
                boxShadow: "0 2px 6px rgba(255,214,0,0.14)",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Logging In..." : "Log In"}
            </button>
          </form>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "12px 0",
              background: "#fff",
              color: "#101622",
              border: "1.5px solid #FFD600",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 18,
              cursor: loading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png" alt="Google" style={{width:24, height:24, marginRight:8}} />
            Log In with Google
          </button>
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            style={{
              marginTop: 18,
              background: "none",
              border: "none",
              color: "#FFD600",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            Forgot Password?
          </button>
        </>
      ) : (
        <form onSubmit={handlePasswordReset} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              padding: 12,
              borderRadius: 8,
              border: "1.5px solid #232c3d",
              fontSize: 18,
              background: "#232c3d",
              color: "#fff"
            }}
          />
          <button
            type="submit"
            style={{
              marginTop: 10,
              padding: "12px 0",
              background: "#FFD600",
              color: "#101622",
              border: "none",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            Send Password Reset Email
          </button>
          <button
            type="button"
            onClick={() => { setShowForgot(false); setResetStatus(""); setErr(null); }}
            style={{
              marginTop: 8,
              background: "none",
              border: "none",
              color: "#FFD600",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            ← Back to login
          </button>
        </form>
      )}
      {err && <div style={{ color: "#ff4c4c", marginTop: 8, fontWeight: 600 }}>{err}</div>}
      {resetStatus && <div style={{ color: "#6fcf97", marginTop: 8, fontWeight: 600 }}>{resetStatus}</div>}
    </div>
  );
}