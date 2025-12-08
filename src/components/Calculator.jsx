import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faTimes, 
  faMinus, 
  faHistory, 
  faTrashAlt, 
  faCalculator, 
  faBackspace, 
  faEquals 
} from "@fortawesome/free-solid-svg-icons";
import * as math from "mathjs";

const Calculator = ({ isOpen, onClose }) => {
  const [position, setPosition] = useState({ x: 60, y: 150 });
  const [input, setInput] = useState("");
  const [liveResult, setLiveResult] = useState("");
  const [history, setHistory] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const nodeRef = useRef(null);
  const inputRef = useRef(null);
  const historyEndRef = useRef(null);

  // --- Auto-scroll history to bottom when it updates ---
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [history]);

  // --- Live Calculation Effect ---
  useEffect(() => {
    if (!input.trim()) {
      setLiveResult("");
      return;
    }
    try {
      const res = math.evaluate(input);
      // Only show result if it's a number and valid
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) { 
         const formatted = math.format(res, { precision: 12, lowerExp: -9, upperExp: 9 });
         setLiveResult(formatted);
      } else {
         setLiveResult("");
      }
    } catch (e) {
      setLiveResult("");
    }
  }, [input]);

  // --- Drag Logic (Robust) ---
  const handleMouseDown = (e) => {
    // CRITICAL FIX: Stop drag if clicking a button or input controls
    if (
        e.target.closest('button') || 
        e.target.closest('.calc-keypad-container') ||
        e.target.closest('.calc-input-section')
    ) return;

    setIsDragging(true);
    const rect = nodeRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        // Simple boundary check could be added here
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // --- Calculator Logic ---
  const handleEvaluate = () => {
    if (!input.trim()) return;
    
    let finalRes = liveResult;
    
    // If live calc failed (e.g. incomplete expression), try valid eval or catch error
    if (!finalRes) {
        try {
            const res = math.evaluate(input);
            finalRes = math.format(res, { precision: 14 });
        } catch(e) {
            finalRes = "Error";
        }
    }

    // Add to history
    setHistory(prev => [...prev, { expression: input, result: finalRes }]);
    
    // Set input to result for chaining (unless error)
    setInput(finalRes === "Error" ? "" : finalRes); 
    setLiveResult(""); 
    
    // Re-focus input
    setTimeout(() => {
        if(inputRef.current) {
            inputRef.current.focus();
            // Move cursor to end
            inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
        }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleEvaluate();
    }
  };

  const insertToken = (token, cursorOffset = 0) => {
    const el = inputRef.current;
    if (!el) {
        setInput(prev => prev + token);
        return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = input;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setInput(before + token + after);
    
    setTimeout(() => {
        el.focus();
        const newPos = start + token.length + cursorOffset;
        el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleBackspace = () => {
      const el = inputRef.current;
      if (!el) return;
      
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = input;

      if (start === end) {
          if (start === 0) return;
          setInput(text.substring(0, start - 1) + text.substring(end));
          setTimeout(() => el.setSelectionRange(start - 1, start - 1), 0);
      } else {
          setInput(text.substring(0, start) + text.substring(end));
          setTimeout(() => el.setSelectionRange(start, start), 0);
      }
      el.focus();
  };

  // Safe clear history that prevents event bubbling issues
  const clearHistory = (e) => {
      e.stopPropagation();
      setHistory([]);
  };

  if (!isOpen) return null;

  // --- Minimized View ---
  if (isMinimized) {
    return (
      <div 
        className="floating-tool-min"
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
        ref={nodeRef}
      >
        <FontAwesomeIcon icon={faCalculator} />
        <span>Calc</span>
        <div className="tool-controls">
          <button onClick={() => setIsMinimized(false)}><FontAwesomeIcon icon={faHistory} /></button>
          <button onClick={onClose}><FontAwesomeIcon icon={faTimes} /></button>
        </div>
      </div>
    );
  }

  // --- Full View ---
  return (
    <div 
      className="floating-tool calculator-window"
      style={{ left: position.x, top: position.y }}
      ref={nodeRef}
      onMouseDown={handleMouseDown} // Drag handler on parent
    >
      {/* Header */}
      <div className="tool-header">
        <div className="header-title">
            <FontAwesomeIcon icon={faCalculator} style={{marginRight: '8px', color: 'var(--primary-color)'}}/>
            Scientific Calc
        </div>
        <div className="tool-controls">
          <button onClick={clearHistory} title="Clear History Tape">
            <FontAwesomeIcon icon={faTrashAlt} />
          </button>
          <div className="v-divider"></div>
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}><FontAwesomeIcon icon={faMinus} /></button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }}><FontAwesomeIcon icon={faTimes} /></button>
        </div>
      </div>

      <div className="calc-body">
        
        {/* 1. History Tape (Flexible Height) */}
        <div className="calc-history-container">
            {history.length === 0 ? (
                <div className="history-empty-state">
                    <FontAwesomeIcon icon={faHistory} style={{marginBottom: '8px', fontSize: '1.5rem', opacity: 0.3}} />
                    <p>History Tape</p>
                    <span>Calculations will appear here. <br/>Click any past result to reuse it.</span>
                </div>
            ) : (
                <div className="calc-history-list">
                    {history.map((item, idx) => (
                        <div key={idx} className="history-item" onClick={() => insertToken(item.result)}>
                            <div className="hist-expr">{item.expression} =</div>
                            <div className="hist-res">{item.result}</div>
                        </div>
                    ))}
                    <div ref={historyEndRef} />
                </div>
            )}
        </div>

        {/* 2. Live Input (Fixed Height) */}
        <div className="calc-input-section">
            {liveResult && <div className="live-preview-overlay">{liveResult}</div>}
            <input 
                ref={inputRef}
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
                autoFocus
                spellCheck={false}
            />
        </div>

        {/* 3. Keypad (Fixed Height) */}
        <div className="calc-keypad-container">
            {/* Scientific Rows */}
            <div className="key-row scientific">
                <button onClick={() => insertToken('sin(', -1)} className="btn-func">sin</button>
                <button onClick={() => insertToken('cos(', -1)} className="btn-func">cos</button>
                <button onClick={() => insertToken('tan(', -1)} className="btn-func">tan</button>
                <button onClick={() => insertToken('log(', -1)} className="btn-func">log</button>
                <button onClick={() => insertToken('ln(', -1)} className="btn-func">ln</button>
            </div>
            <div className="key-row scientific">
                <button onClick={() => insertToken('^')} className="btn-func">x^y</button>
                <button onClick={() => insertToken('sqrt(', -1)} className="btn-func">√</button>
                <button onClick={() => insertToken('(')} className="btn-func">(</button>
                <button onClick={() => insertToken(')')} className="btn-func">)</button>
                <button onClick={() => insertToken('pi')} className="btn-const">π</button>
            </div>

            {/* Numpad & Ops */}
            <div className="main-grid">
                <div className="numpad">
                    <button onClick={() => insertToken('7')}>7</button>
                    <button onClick={() => insertToken('8')}>8</button>
                    <button onClick={() => insertToken('9')}>9</button>
                    
                    <button onClick={() => insertToken('4')}>4</button>
                    <button onClick={() => insertToken('5')}>5</button>
                    <button onClick={() => insertToken('6')}>6</button>
                    
                    <button onClick={() => insertToken('1')}>1</button>
                    <button onClick={() => insertToken('2')}>2</button>
                    <button onClick={() => insertToken('3')}>3</button>
                    
                    <button onClick={() => insertToken('0')} className="zero-btn">0</button>
                    <button onClick={() => insertToken('.')}>.</button>
                </div>

                <div className="ops-pad">
                    <button onClick={() => { setInput(""); setLiveResult(""); inputRef.current?.focus(); }} className="btn-ac">AC</button>
                    <button onClick={handleBackspace} className="btn-del"><FontAwesomeIcon icon={faBackspace} /></button>
                    
                    <button onClick={() => insertToken('/')} className="btn-op">÷</button>
                    <button onClick={() => insertToken('*')} className="btn-op">×</button>
                    <button onClick={() => insertToken('-')} className="btn-op">−</button>
                    <button onClick={() => insertToken('+')} className="btn-op">+</button>
                    
                    <button onClick={handleEvaluate} className="btn-equals"><FontAwesomeIcon icon={faEquals} /></button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Calculator;