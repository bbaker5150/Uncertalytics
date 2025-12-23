import React from "react";

const NotificationModal = ({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText,
  cancelText
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content">
        <button onClick={onClose} className="modal-close-button">
          &times;
        </button>

        <h3>{title}</h3>
        <div style={{ textAlign: "left", whiteSpace: "pre-wrap", fontSize: '0.95rem', lineHeight: '1.5' }}>
          {message}
        </div>

        <div className="modal-actions" style={{ justifyContent: "flex-end", marginTop: '20px', gap: '10px' }}>
          {/* Logic: If onConfirm exists, show Two Buttons. Otherwise, just show OK. */}
          {onConfirm ? (
            <>
              <button className="button button-secondary" onClick={onClose}>
                {cancelText || "Cancel"}
              </button>
              <button className="button button-primary" onClick={onConfirm}>
                {confirmText || "Confirm"}
              </button>
            </>
          ) : (
            <button className="button" onClick={onClose}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;