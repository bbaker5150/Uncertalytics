import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faList,
  faRadio,
  faHistory,
  faStickyNote,
  faRightLeft,
  faSave,
  faFolderOpen,
  faQuestionCircle,
  faPalette,
  faRotate
} from "@fortawesome/free-solid-svg-icons";

const HeaderToolbox = ({
  isToolboxCollapsed,
  setIsToolboxCollapsed,
  isOverviewOpen,
  setIsOverviewOpen,
  isInstrumentBuilderOpen,
  setIsInstrumentBuilderOpen,
  isTraceabilityOpen,
  setIsTraceabilityOpen,
  isNotepadOpen,
  setIsNotepadOpen,
  isConverterOpen,
  setIsConverterOpen,
  handleSaveToFile,
  handleLoadFromFile,
  isHelpOpen,
  setIsHelpOpen,
  currentTheme,
  setCurrentTheme,
  isDarkMode,
  setIsDarkMode,
  dbPath,
  disconnectDatabase,
  selectDatabaseFolder
}) => {
  // Initial state uses null to indicate "use CSS centering"
  // Once the user drags, we switch to absolute pixel positioning relative to the parent (.app-pro-header)
  const [position, setPosition] = useState(null); 
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const toolboxRef = useRef(null);

  const [isVertical, setIsVertical] = useState(false);

  useEffect(() => {
    const handleThemeKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setShowThemeSelector(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleThemeKey);
    return () => window.removeEventListener('keydown', handleThemeKey);
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleMouseMove = (e) => {
      if (isDragging && toolboxRef.current && toolboxRef.current.offsetParent) {
        // Calculate new position relative to the offsetParent (the header)
        const parentRect = toolboxRef.current.offsetParent.getBoundingClientRect();
        
        let newX = e.clientX - parentRect.left - dragOffset.x;
        let newY = e.clientY - parentRect.top - dragOffset.y;
        
        // Optional: constrain to parent bounds? User said "within the borders" initially, 
        // but dragging usually allows freedom. We'll just set the position.
        
        setPosition({ x: newX, y: newY });
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e) => {
    // Prevent dragging if clicking a button, input, or interactive element
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select") || e.target.closest("label") || e.target.closest(".theme-selector-item")) {
      return;
    }
    
    if (toolboxRef.current) {
        const rect = toolboxRef.current.getBoundingClientRect();
        
        // If this is the FIRST drag (position is null), calculate current relative position
        // so we don't jump.
        if (position === null && toolboxRef.current.offsetParent) {
            const parentRect = toolboxRef.current.offsetParent.getBoundingClientRect();
            // Current relative X/Y = (Current Rect Left - Parent Rect Left)
            const currentRelX = rect.left - parentRect.left;
            const currentRelY = rect.top - parentRect.top;
            
            setPosition({ x: currentRelX, y: currentRelY });
            
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
            setIsDragging(true);
            return;
        }

        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setIsDragging(true);
    }
  };

  const handleThemeSelect = (themeValue) => {
    setCurrentTheme(themeValue);
    setShowThemeSelector(false);
  };

  const themeOptions = [
    { value: 'default', label: 'Default' },
    { value: 'theme-cyberpunk', label: 'Cyberpunk' },
    { value: 'theme-stranger', label: 'Stranger Things' },
    { value: 'theme-orbital', label: 'Orbit' }
  ];

  return (
    <div 
        ref={toolboxRef}
        className={`header-toolbox ${isToolboxCollapsed ? "collapsed" : ""} ${isVertical ? "vertical" : ""} ${isDragging ? "dragging" : ""}`}
        style={{
            position: "absolute", // Changed from fixed to absolute to scroll with content
            // If position is null:
            // left: 50% (center of relative parent)
            // top: 50% -> adjusted to 47% to visually center against bottom padding
            left: position ? position.x : "50%",
            top: position ? position.y : "20%",
            // Center itself perfectly initially
            transform: position ? "none" : "translate(-50%, -50%)",
            zIndex: 9999,
            cursor: isDragging ? "grabbing" : "grab",
            transition: isDragging ? "none" : "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" 
        }}
        onMouseDown={handleMouseDown}
    >
      <button 
        className="toolbox-toggle-btn"
        onClick={() => setIsToolboxCollapsed(!isToolboxCollapsed)}
        title={isToolboxCollapsed ? "Expand Toolbar" : "Collapse Toolbar"}
      >
        <FontAwesomeIcon icon={isToolboxCollapsed ? (isVertical ? faChevronRight : faChevronLeft) : (isVertical ? faChevronLeft : faChevronRight)} />
      </button>

      <div className="toolbox-content">
        {/* Group 0: Orientation Toggle */}
        <div className="toolbox-group">
            <button
                className="toolbox-button"
                onClick={() => setIsVertical(!isVertical)}
                title={isVertical ? "Switch to Horizontal" : "Switch to Vertical"}
            >
                <FontAwesomeIcon icon={faRotate} style={{ transform: isVertical ? "rotate(90deg)" : "none" }} />
            </button>
        </div>

        <div className="toolbox-divider"></div>

        {/* Group 1: View / Overview */}
        <div className="toolbox-group">
          <button
            className={`toolbox-button ${isOverviewOpen ? "active" : ""}`}
            onClick={() => setIsOverviewOpen(!isOverviewOpen)}
            title="Session Overview"
          >
            <FontAwesomeIcon icon={faList} />
          </button>
        </div>

        <div className="toolbox-divider"></div>

        {/* Group 2: Instruments & Tools */}
        <div className="toolbox-group">
          <button
            className={`toolbox-button ${isInstrumentBuilderOpen ? "active" : ""}`}
            onClick={() => setIsInstrumentBuilderOpen(!isInstrumentBuilderOpen)}
            title="Instrument Builder"
          >
            <FontAwesomeIcon icon={faRadio} />
          </button>
          <button
            className={`toolbox-button ${isTraceabilityOpen ? "active" : ""}`}
            onClick={() => setIsTraceabilityOpen(!isTraceabilityOpen)}
            title="Reverse Traceability Tool"
          >
            <FontAwesomeIcon icon={faHistory} />
          </button>
          <button
            className={`toolbox-button ${isNotepadOpen ? "active" : ""}`}
            onClick={() => setIsNotepadOpen(!isNotepadOpen)}
            title="Session Notes"
          >
            <FontAwesomeIcon icon={faStickyNote} />
          </button>
          <button
            className={`toolbox-button ${isConverterOpen ? "active" : ""}`}
            onClick={() => setIsConverterOpen(!isConverterOpen)}
            title="Unit Converter"
          >
            <FontAwesomeIcon icon={faRightLeft} />
          </button>
        </div>

        <div className="toolbox-divider"></div>

        {/* Group 3: File Operations */}
        <div className="toolbox-group">
          <button
            className="toolbox-button"
            onClick={handleSaveToFile}
            title="Export to PDF"
          >
            <FontAwesomeIcon icon={faSave} />
          </button>

          <label
            className="toolbox-button"
            htmlFor="load-session-pdf-main"
            title="Import PDF"
          >
            <FontAwesomeIcon icon={faFolderOpen} />
          </label>
          <input
            type="file"
            id="load-session-pdf-main"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={handleLoadFromFile}
          />
        </div>

        <div className="toolbox-divider"></div>

        {/* Group 4: System / Help / Theme */}
        <div className="toolbox-group" style={{ position: 'relative' }}> 

          <button 
             className={`toolbox-button ${showThemeSelector ? "active" : ""}`}
             onClick={() => setShowThemeSelector(!showThemeSelector)}
             title="Change Theme"
          >
             <FontAwesomeIcon icon={faPalette} />
          </button>
          
          {showThemeSelector && (
            <div className="theme-selector-minimal" style={{ 
                position: 'absolute', 
                top: isVertical ? '0' : '100%', 
                left: isVertical ? '100%' : '50%',
                transform: isVertical ? 'translateX(10px)' : 'translateX(-50%)',
                marginTop: isVertical ? '0' : '10px',
                zIndex: 10001,
                background: 'var(--content-background)', 
                padding: '8px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '4px',
                boxShadow: 'var(--box-shadow-glow)',
                minWidth: '150px'
            }}>
              {themeOptions.map(option => (
                <div 
                  key={option.value}
                  className={`theme-selector-item ${currentTheme === option.value ? 'selected' : ''}`}
                  onClick={() => handleThemeSelect(option.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: currentTheme === option.value ? '700' : '500',
                    color: currentTheme === option.value ? 'var(--primary-color)' : 'var(--text-color)',
                    background: currentTheme === option.value ? 'var(--primary-color-light)' : 'transparent',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onMouseEnter={(e) => {
                    if (currentTheme !== option.value) {
                       e.currentTarget.style.backgroundColor = 'var(--background-color)';
                    }
                  }}
                  onMouseLeave={(e) => {
                     if (currentTheme !== option.value) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                     }
                  }}
                >
                  {option.label}
                  {currentTheme === option.value && <span style={{ fontSize: '0.7rem' }}>●</span>}
                </div>
              ))}
            </div>
          )}

          {currentTheme === 'theme-stranger' && !isDarkMode ? (
            <div
              className="stranger-hint"
              onClick={() => setIsDarkMode(true)}
              title="Enter the Upside Down"
              style={{ marginLeft: '10px' }}
            >
              <span>ENTER THE UPSIDE DOWN</span>
            </div>
          ) : (
            <button
              className={`toolbox-button ${isDarkMode ? "active" : ""}`}
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Toggle Dark Mode"
            >
              <div className={`moon-toggle ${isDarkMode ? "is-dark" : ""}`}></div>
            </button>
          )}
        </div>
        
        <div className="toolbox-divider"></div>

        {/* Group 5: Connection Status */}
        <div className="toolbox-group">
            <button
              className={`status-pill ${dbPath ? "connected" : "disconnected"}`}
              onClick={dbPath ? disconnectDatabase : selectDatabaseFolder}
              title={dbPath ? `Connected: ${dbPath}` : "Connect to Database"}
            >
              <span className="status-dot"></span>
              <span className="status-text">
                {dbPath ? isVertical ? "" : "Connected" : isVertical ? "" : "Local"}
              </span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default HeaderToolbox;
