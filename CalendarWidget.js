import React, { useState } from "react";
import "./CalendarWidget.css";

function CalendarWidget() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function isToday(day) {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  }

  function handlePrevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }
  function handleNextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  return (
    <div className="calendar-widget">
      <div className="calendar-header">
        <button className="calendar-arrow" onClick={handlePrevMonth}>&lt;</button>
        <span className="calendar-month">{monthNames[month]} {year}</span>
        <button className="calendar-arrow" onClick={handleNextMonth}>&gt;</button>
      </div>
      <div className="calendar-grid">
        {["S","M","T","W","T","F","S"].map(d => (
          <div className="calendar-cell calendar-day" key={d}>{d}</div>
        ))}
        {Array(firstDay).fill(null).map((_, i) => (
          <div className="calendar-cell" key={"empty-"+i}></div>
        ))}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i+1;
          const todayClass = isToday(day) ? " today" : "";
          return (
            <div
              className={`calendar-cell calendar-date${todayClass}`}
              key={day}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CalendarWidget;