import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import MyRegister from "./MyRegister";
import MyLogin from "./MyLogin";
import Dashboard from "./Dashboard";
import Resources from "./Resources";
import GroupsPage from "./GroupsPage"; // <-- use your new page!

// Dummy icon components for sidebar 
function DashboardIcon() { return <span>🏠</span>; }
function GroupsIcon() { return <span>👥</span>; }
function ResourcesIcon() { return <span>📚</span>; }
function QuizzesIcon() { return <span>📝</span>; }
function EventsIcon() { return <span>📅</span>; }
function AnnouncementsIcon() { return <span>📢</span>; }
function VerifiedIcon() { return <span>✔️</span>; }

const SIDEBAR_TABS = [
  { key: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { key: "groups", label: "Groups", icon: <GroupsIcon /> },
  { key: "resources", label: "Resources", icon: <ResourcesIcon /> },
  { key: "quizzes", label: "Quizzes", icon: <QuizzesIcon /> },
  { key: "events", label: "Events", icon: <EventsIcon /> },
  { key: "announcements", label: "Announcements", icon: <AnnouncementsIcon /> },
];

// --- Tutorial Modal, show only after sign up
function TutorialModal({ onClose }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.88)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "#101b28", borderRadius: 18, padding: 36, width: 460, maxWidth: "90vw", color: "#FFD600", boxShadow: "0 2px 24px #000",
        textAlign: "center"
      }}>
        <h1 style={{ color: "#FFD600", fontWeight: 900, fontSize: 36, marginBottom: 16 }}>Welcome to NEPP!</h1>
        <p style={{ fontSize: 20, marginBottom: 18 }}>
          Here’s a quick guide:
        </p>
        <ol style={{ color: "#fff", textAlign: "left", fontSize: 18, margin: "0 0 18px 0", paddingLeft: 24 }}>
          <li><b>Dashboard:</b> Overview of your activity, events, and progress.</li>
          <li><b>Groups:</b> Join or create a team to collaborate with others.</li>
          <li><b>Resources:</b> Access study material and guides.</li>
          <li><b>Quizzes:</b> Test your knowledge and track your improvement.</li>
          <li><b>Events:</b> See upcoming competitions and activities.</li>
          <li><b>Announcements:</b> Stay updated with the latest news.</li>
          <li><b>Your Profile:</b> Click your email at the bottom left to view and edit your info.</li>
        </ol>
        <button
          style={{
            background: "#FFD600",
            color: "#101622",
            border: "none",
            borderRadius: 8,
            padding: "12px 28px",
            fontWeight: 700,
            fontSize: 20,
            cursor: "pointer",
            marginTop: 10,
          }}
          onClick={onClose}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}

// 
function Quizzes() {
  return <div style={{ color: "#fff", padding: 40 }}>Quizzes Page (Placeholder)</div>;
}
function Events() {
  return <div style={{ color: "#fff", padding: 40 }}>Events Page (Placeholder)</div>;
}
function Announcements() {
  return <div style={{ color: "#fff", padding: 40 }}>Announcements Page (Placeholder)</div>;
}

function getTutorialKey(email) {
  return `nepp_tutorial_seen:${email}`;
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // Used to track if user just signed up, for tutorial
  const [justSignedUpEmail, setJustSignedUpEmail] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Always go to dashboard on login
      if (u) setPage("dashboard");
    });
    return () => unsub();
  }, []);

  // Show tutorial only after sign up
  useEffect(() => {
    if (user && justSignedUpEmail === user.email) {
      const key = getTutorialKey(user.email);
      if (!localStorage.getItem(key)) {
        setShowTutorial(true);
        localStorage.setItem(key, "yes");
      }
      setJustSignedUpEmail(null);
    }
  }, [user, justSignedUpEmail]);

  if (!user) {
    if (!authMode) {
      return (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginTop:"10vh"}}>
          <h1>Welcome to NEPP!</h1>
          <div style={{display:"flex",gap:24,marginTop:30}}>
            <button
              style={{padding:"14px 36px",fontSize:22,background:"#FFD600",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer"}}
              onClick={() => setAuthMode("login")}
            >
              Log In
            </button>
            <button
              style={{padding:"14px 36px",fontSize:22,background:"#111722",color:"#FFD600",border:"2px solid #FFD600",borderRadius:10,fontWeight:700,cursor:"pointer"}}
              onClick={() => setAuthMode("signup")}
            >
              Sign Up
            </button>
          </div>
        </div>
      );
    }
    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginTop:"10vh"}}>
        {authMode === "login" ? (
          <>
            <MyLogin onSuccess={() => setAuthMode(null)} />
            <p>
              Don't have an account?{" "}
              <button onClick={() => setAuthMode("signup")} style={{background:"none",border:"none",color:"#FFD600",fontWeight:700,cursor:"pointer"}}>Sign Up</button>
            </p>
            <button onClick={() => setAuthMode(null)} style={{marginTop:12}}>← Back</button>
          </>
        ) : (
          <>
            {/* onSuccess: setJustSignedUpEmail triggers tutorial after signup */}
            <MyRegister onSuccess={(email) => { setAuthMode("login"); setJustSignedUpEmail(email); }} />
            <p>
              Already have an account?{" "}
              <button onClick={() => setAuthMode("login")} style={{background:"none",border:"none",color:"#FFD600",fontWeight:700,cursor:"pointer"}}>Log In</button>
            </p>
            <button onClick={() => setAuthMode(null)} style={{marginTop:12}}>← Back</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="nepp-root">
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={process.env.PUBLIC_URL + "/nepp-logo.png"} alt="NEPP Logo" />
        </div>
        <nav className="sidebar-nav">
          {SIDEBAR_TABS.map((tab) => (
            <div
              key={tab.key}
              className={`sidebar-item${page === tab.key ? " active" : ""}`}
              onClick={() => setPage(tab.key)}
            >
              <span className="sidebar-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <div>
            <span className="sidebar-user-name">{user.email}</span>
            <div className="sidebar-user-verified">Verified NEPP User</div>
          </div>
          <span className="sidebar-user-badge"><VerifiedIcon /></span>
        </div>
      </aside>
      <main className="main-content">
        <button
          style={{
            position: "absolute",
            top: 20,
            right: 30,
            background: "#FFD600",
            color: "#101622",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontWeight: 600,
            cursor: "pointer",
            zIndex: 10,
          }}
          onClick={() => signOut(auth)}
        >
          Log Out
        </button>
        {page === "dashboard" && <Dashboard />}
        {page === "groups" && <GroupsPage />} {/* <-- Your new Groups page! */}
        {page === "resources" && <Resources />}
        {page === "quizzes" && <Quizzes />}
        {page === "events" && <Events />}
        {page === "announcements" && <Announcements />}
      </main>
    </div>
  );
}