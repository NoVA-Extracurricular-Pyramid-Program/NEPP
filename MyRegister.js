import React, { useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function MyRegister({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const requireRole = () => {
    if (!role) {
      setErr("Please select Student or Creator before signing up.");
      return false;
    }
    return true;
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!requireRole()) return;
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCred.user.uid), { role });
      setLoading(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      setLoading(false);
      setErr(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setErr(null);
    if (!requireRole()) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await setDoc(doc(db, "users", result.user.uid), { role });
      setLoading(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      setLoading(false);
      setErr(error.message);
    }
  };

  return (
    <div style={{
      minHeight: 440,
      minWidth: 340,
      background: "#181e2a",
      borderRadius: 16,
      boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
      padding: 36,
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <h2 style={{ color: "#FFD600", marginBottom: 18, fontWeight: 900, fontSize: 32 }}>
        Create your account
      </h2>
      <form onSubmit={handleSignUp} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 13 }}>
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
          autoComplete="new-password"
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

        {/* --- THIS IS THE ROLE SELECTION --- */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          marginTop: 16,
          marginBottom: 10,
          background: "#232c3d",
          padding: "10px 0",
          borderRadius: 8
        }}>
          <label style={{
            color: "#FFD600", fontWeight: 700, fontSize: 16, cursor: "pointer"
          }}>
            <input
              type="radio"
              name="role"
              value="student"
              checked={role === "student"}
              onChange={() => setRole("student")}
              style={{ marginRight: 6 }}
              required
            />
            Student
          </label>
          <label style={{
            color: "#FFD600", fontWeight: 700, fontSize: 16, cursor: "pointer"
          }}>
            <input
              type="radio"
              name="role"
              value="creator"
              checked={role === "creator"}
              onChange={() => setRole("creator")}
              style={{ marginRight: 6 }}
              required
            />
            Creator
          </label>
        </div>
        {/* --- END OF ROLE SELECTION --- */}

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
          {loading ? "Signing Up..." : "Sign Up"}
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
        Sign Up with Google
      </button>
      {err && <div style={{ color: "#ff4c4c", marginTop: 8, fontWeight: 600 }}>{err}</div>}
    </div>
  );
}