import React from "react";

const NotificationModal = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>
        <h3>{title}</h3>
        <p style={{ textAlign: "left", whiteSpace: "pre-wrap" }}>{message}</p>
        <div className="modal-actions" style={{ justifyContent: "center" }}>
          <button className="button" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;