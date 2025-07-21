import React, { useState } from "react";
import "./GroupsPage.css";

// Example data structure for multiple teams
const teamsData = [
  {
    name: "CHS Scio",
    members: [
      { name: "John Doe", isAdmin: true },
      { name: "Jane Smith", isAdmin: false },
      { name: "Sam Brown", isAdmin: false },
    ],
    primaryAdmin: "John Doe",
    memberCount: 32,
  },
  {
    name: "Mathletes",
    members: [
      { name: "Emily Lin", isAdmin: true },
      { name: "Sam Brown", isAdmin: false },
      { name: "Alex Kim", isAdmin: false },
    ],
    primaryAdmin: "Emily Lin",
    memberCount: 28,
  },
];

export default function GroupsPage() {
  // Assume user is Sam Brown
  const userName = "Sam Brown";
  const userTeams = teamsData
    .filter((team) => team.members.some((m) => m.name === userName))
    .map((team) => team.name);

  // Controlled state for the currently viewed team
  const [currentTeamName, setCurrentTeamName] = useState(userTeams[0]);
  const [teams, setTeams] = useState(teamsData);

  // Modal state for confirmation
  const [pendingAdmin, setPendingAdmin] = useState(null);

  // Find the current team object
  const currentTeam = teams.find((team) => team.name === currentTeamName);

  // Make a member admin after confirmation
  function handleMakeAdmin(memberName) {
    setPendingAdmin(memberName);
  }
  function confirmMakeAdmin() {
    setTeams((oldTeams) =>
      oldTeams.map((team) =>
        team.name === currentTeamName
          ? {
              ...team,
              members: team.members.map((m) =>
                m.name === pendingAdmin ? { ...m, isAdmin: true } : m
              ),
            }
          : team
      )
    );
    setPendingAdmin(null);
  }
  function cancelMakeAdmin() {
    setPendingAdmin(null);
  }

  return (
    <div className="groups-root">
      <div className="groups-header-row">
        <h1 className="groups-title">Your Teams</h1>
        <button className="create-team-btn">
          <span className="create-team-icon" role="img" aria-label="Create">
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="4" width="24" height="24" rx="6" stroke="#FFD600" strokeWidth="2" fill="none"/>
              <path d="M10 22L22 10" stroke="#FFD600" strokeWidth="2" strokeLinecap="round"/>
              <path d="M13 10H22V19" stroke="#FFD600" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          Create Team
        </button>
      </div>

      <div className="group-card">
        <div className="group-card-header">
          <div className="group-card-title">{currentTeam.name}</div>
          <div className="group-card-info">
            <span className="group-info-item">
              <span role="img" aria-label="members" className="group-info-icon">👥</span>
              {currentTeam.memberCount} Members
            </span>
            <span className="group-info-item">
              <span role="img" aria-label="admin" className="group-info-icon">✔️</span>
              {currentTeam.primaryAdmin}
            </span>
          </div>
        </div>
        <ul className="members-list">
          {currentTeam.members.map((member, idx) => (
            <li key={`${member.name}-${idx}`} className="member-item">
              <span>{member.name}</span>
              {member.isAdmin ? (
                <span className="admin-badge">Admin</span>
              ) : (
                <button
                  className="make-admin-btn"
                  onClick={() => handleMakeAdmin(member.name)}
                  disabled={pendingAdmin}
                >
                  Make Admin
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Modal confirmation for making admin */}
      {pendingAdmin && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <p>
              Are you sure you want to make <b>{pendingAdmin}</b> an admin?
            </p>
            <div style={{ display: "flex", gap: 20, marginTop: 18 }}>
              <button className="modal-btn modal-btn-no" onClick={cancelMakeAdmin}>
                No
              </button>
              <button className="modal-btn modal-btn-yes" onClick={confirmMakeAdmin}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="teams-footer">
        Teams you are in:&nbsp;
        {userTeams.map((teamName, i) => (
          <span
            key={teamName}
            className={`footer-team-link${teamName === currentTeamName ? " active" : ""}`}
            onClick={() => setCurrentTeamName(teamName)}
            style={{
              cursor: teamName !== currentTeamName ? "pointer" : "default",
              textDecoration: teamName !== currentTeamName ? "underline" : "none",
              marginRight: i < userTeams.length - 1 ? 8 : 0,
            }}
          >
            {teamName}
          </span>
        ))}
      </footer>
    </div>
  );
}