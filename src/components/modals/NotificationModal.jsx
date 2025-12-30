import ReactDOM from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { useFloatingWindow } from "../../hooks/useFloatingWindow";

const NotificationModal = ({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText,
  cancelText,
  isIconConfirm,
  isFloating = false // New prop
}) => {
  // --- Floating Logic ---
  const { position, handleMouseDown } = useFloatingWindow({
      isOpen,
      defaultWidth: 400,
      defaultHeight: 250
  });

  if (!isOpen) return null;

  // --- Render Content Helper ---
  const modalContent = (
      <div 
        className={isFloating ? "modal-content floating-window-content" : "modal-content"}
        style={isFloating ? {
            position: 'fixed',
            top: position.y,
            left: position.x,
            margin: 0,
            zIndex: 9999,
            width: '400px',
            maxWidth: '90vw',
            boxShadow: 'var(--box-shadow-glow)',
            border: '1px solid var(--border-color)'
        } : {}}
      >
        {isFloating && (
            <div
                onMouseDown={handleMouseDown}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '10px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'move',
                    userSelect: 'none'
                }}
            >
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: 'var(--status-warning)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
                <button onClick={onClose} className="modal-close-button" style={{ position: 'static', marginLeft: 'auto', transform: 'none' }}>
                  &times;
                </button>
            </div>
        )}

        {!isFloating && (
            <>
                <button onClick={onClose} className="modal-close-button">
                &times;
                </button>
                <h3>{title}</h3>
            </>
        )}

        <div style={{ textAlign: "left", whiteSpace: "pre-wrap", fontSize: '0.95rem', lineHeight: '1.5' }}>
          {message}
        </div>

        <div className="modal-actions" style={{ justifyContent: "flex-end", marginTop: '20px', gap: '10px' }}>
          {/* Logic: If onConfirm exists, show Two Buttons. Otherwise, just show OK. */}
          {onConfirm ? (
            <>
              {cancelText !== null && (
                <button className="button button-secondary" onClick={onClose}>
                  {cancelText || "Cancel"}
                </button>
              )}
              <button 
                className={isIconConfirm ? "modal-icon-button primary" : "button button-primary"} 
                onClick={onConfirm}
                title={confirmText || "Confirm"}
              >
                {isIconConfirm ? <FontAwesomeIcon icon={faCheck} /> : (confirmText || "Confirm")}
              </button>
            </>
          ) : (
             // Only show OK button for non-floating or if explicitly desired. 
             // For floating, we have the 'X', but 'OK' is also good for acknowledgment.
            <button className="button" onClick={onClose}>
              OK
            </button>
          )}
        </div>
      </div>
  );

  if (isFloating) {
      return ReactDOM.createPortal(modalContent, document.body);
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      {modalContent}
    </div>
  );
};

export default NotificationModal;