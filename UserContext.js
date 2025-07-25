import React from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export default function SignIn() {
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      alert("Sign-in failed: " + error.message);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "#222"
    }}>
      <div style={{
        background: "#fff",
        padding: 40,
        borderRadius: 10,
        boxShadow: "0 2px 12px #0003",
        textAlign: "center"
      }}>
        <h1>Sign in to NEPP</h1>
        <button
          onClick={handleGoogleSignIn}
          style={{
            marginTop: 30,
            padding: "12px 32px",
            borderRadius: 8,
            border: "none",
            background: "#4285F4",
            color: "#fff",
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 12
          }}
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png"
            alt="Google"
            style={{ width: 28, height: 28, background: "#fff", borderRadius: "100%" }}
          />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}