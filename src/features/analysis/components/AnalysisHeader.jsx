/**
 * * A presentational component that renders the top metadata bar of the Analysis view.
 * * Displays:
 * - UUT Name, Analyst, Document Number, and Date.
 * - The "Session Overview" button.
 */

import React from "react";

const AnalysisHeader = ({ sessionData, onEditSession }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split("-");
    return `${month}/${day}/${year}`;
  };

  return (
    <div 
      className="analysis-session-header"
      onClick={() => onEditSession && onEditSession("details")}
      style={{ 
        cursor: "pointer", 
      }}
      title="Click to edit session details"
    >
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
    </div>
  );
};

export default AnalysisHeader;