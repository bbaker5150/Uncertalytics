import React from 'react';

const SessionInfo = ({ sessionData, onSessionChange, onSaveToFile }) => {
  if (!sessionData) {
    return (
        <div className="placeholder-content">
            <h3>No Session Selected</h3>
            <p>Select or create a new session from the sidebar to begin.</p>
        </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    // When the equipmentName changes, we also update the session's friendly 'name' for the sidebar
    const updatedName = name === 'equipmentName' && value ? `MUA: ${value}` : sessionData.name;
    onSessionChange({ ...sessionData, [name]: value, name: updatedName });
  };

  return (
    <div className="content-area" style={{paddingTop: '0', border: 'none', boxShadow: 'none'}}>
      <h3>Session Information & Notes</h3>
      <p>This section provides a place to identify the equipment, analyst, and organization for this analysis session. This information will be used to label reports.</p>
      
      <div className="config-grid" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
        <div className='form-section'>
          <label>Equipment Name</label>
          <input type="text" name="equipmentName" value={sessionData.equipmentName} onChange={handleChange} placeholder="e.g., Fluke 8588A" />
          
          <label>Analyst</label>
          <input type="text" name="analyst" value={sessionData.analyst} onChange={handleChange} placeholder="Your Name"/>
          
          <label>Organization</label>
          <input type="text" name="organization" value={sessionData.organization} onChange={handleChange} placeholder="Your Organization"/>
        </div>
        <div className='form-section'>
          <label>Analysis Notes</label>
          <textarea 
            name="notes" 
            value={sessionData.notes} 
            onChange={handleChange} 
            rows="8"
            placeholder="Record analysis notes here..."
          ></textarea>
        </div>
      </div>

      <div className="modal-actions" style={{ justifyContent: 'flex-start', paddingLeft: '5px' }}>
         <button className="button" onClick={onSaveToFile}>
           Save Session to File (.json)
         </button>
      </div>
    </div>
  );
};

export default SessionInfo;