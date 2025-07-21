import React from "react";
import "./Dashboard.css";
import CalendarWidget from "./widgets/CalendarWidget";

function Dashboard() {
  return (
    <div className="dashboard-root">
      <div className="dashboard-header-row">
        <h1 className="dashboard-title">Welcome NEPP User</h1>
        <span className="dashboard-profile-icon">
          <ProfileIcon />
        </span>
      </div>
      <div className="dashboard-main-widgets">
        <div className="dashboard-announcements widget-card">
          <div className="widget-title">Announcments</div>
          <div className="ann-body">
            Hi,<br />
            This is a Sample Message.<br />
            Here Team managers can post announments to the team and all team members can see it.
          </div>
          <div className="ann-footer">
            <span className="ann-author-icon">
              <ProfileIconSmall />
            </span>
            <span className="ann-author">Shayaan Dutt | Position</span>
          </div>
        </div>
        <div className="dashboard-side-widgets">
          <div className="dashboard-forms widget-card">
            <div className="widget-title">Your Forms</div>
            <div className="forms-body">
              Form Name<br />
              Due: 6/14<br />
              Ravin Singh
            </div>
          </div>
          <div className="dashboard-calendar widget-card">
            <div className="widget-title">Date: Upcoming Event</div>
            <CalendarWidget />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileIcon() {
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
      <circle cx="27" cy="27" r="27" fill="#FFD600"/>
      <circle cx="27" cy="20" r="10" fill="#232b36"/>
      <ellipse cx="27" cy="40" rx="16" ry="9" fill="#232b36"/>
    </svg>
  );
}

function ProfileIconSmall() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="11" fill="#FFD600"/>
      <circle cx="11" cy="8" r="4" fill="#232b36"/>
      <ellipse cx="11" cy="16" rx="7" ry="4" fill="#232b36"/>
    </svg>
  );
}

export default Dashboard;