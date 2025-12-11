/**
 * * A presentational component that renders the top metadata bar of the Analysis view.
 * * Displays:
 * - UUT Name, Analyst, Document Number, and Date.
 * - The "Session Overview" button.
 */

import React from "react";

const AnalysisHeader = ({ sessionData, onOpenOverview }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split("-");
    return `${month}/${day}/${year}`;
  };

  return (
    <div className="analysis-session-header">
      <div className="session-info-item">
        <span className="session-info-label">UUT</span>
        <span className="session-info-value">
          {sessionData.uutDescription || "N/A"}
        </span>
      </div>
      <div className="session-info-item">
        <span className="session-info-label">Analyst</span>
        <span className="session-info-value">
          {sessionData.analyst || "N/A"}
        </span>
      </div>
      <div className="session-info-item">
        <span className="session-info-label">Document</span>
        <span className="session-info-value">
          {sessionData.document || "N/A"}
        </span>
      </div>
      <div className="session-info-item">
        <span className="session-info-label">Date</span>
        <span className="session-info-value">
          {formatDate(sessionData.documentDate)}
        </span>
      </div>
      <button
        className="sidebar-action-button"
        onClick={onOpenOverview}
        title="View Session Overview"
        style={{
          marginLeft: "auto",
          height: "42px",
          padding: "0 30px",
          fontSize: "0.9rem",
          fontWeight: "700",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          letterSpacing: "1px",
          color: "var(--primary-color)",
          background: "var(--content-background)",
          border: "2px solid transparent",
          borderRadius: "50px",
          backgroundImage:
            "linear-gradient(var(--content-background), var(--content-background)), var(--border-gradient)",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          boxShadow: "var(--box-shadow-glow)",
          transition: "all 0.3s ease",
          cursor: "pointer",
          flexShrink: 0,
          minWidth: "fit-content",
        }}
      >
        Session Overview
      </button>
    </div>
  );
};

export default AnalysisHeader;