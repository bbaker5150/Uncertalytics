import React, { useMemo, useState } from "react";
import { useTheme } from "../App";

// Use the factory to create a Plot component that uses the basic distribution
import Plotly from 'plotly.js-basic-dist';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);

let spareRandom = null;
function generateStandardNormal() {
  let val, u, v, s;
  if (spareRandom !== null) {
    val = spareRandom;
    spareRandom = null;
  } else {
    do {
      u = Math.random() * 2 - 1;
      v = Math.random() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    val = u * mul;
    spareRandom = v * mul;
  }
  return val;
}

const RiskScatterplot = ({ results, inputs }) => {
  const isDarkMode = useTheme();
  const [numPoints, setNumPoints] = useState(3000);

  // Define explicit colors based on theme
  const colors = useMemo(() => {
    return {
      good: isDarkMode ? "#28a745" : "#198754",   // Green
      bad: "#dc3545",                              // Red
      warning: "#ffc107",                          // Yellow/Orange
      primary: isDarkMode ? "#3b82f6" : "#007bff", // Blue
      pointBorder: isDarkMode ? "#121212" : "#ffffff", // Matches background for "halo" effect
    };
  }, [isDarkMode]);

  const plotData = useMemo(() => {
    if (!results || !inputs) return [];

    const { uUUT, uCal, ALow, AUp } = results;
    const { LLow, LUp } = inputs;

    // ... (Your existing calculation logic remains exactly the same) ...
    // Note: I'm omitting the repeated calculation logic for brevity, 
    // but keep your existing loop and data generation here.
    
    // --- RE-INSERTED LOOP FOR CONTEXT (Copy this part back in if replacing whole file) ---
    const mid = (LUp + LLow) / 2;
    const LUp_norm = LUp - mid;
    const LLow_norm = LLow - mid;
    const AUp_norm = AUp - mid;
    const ALow_norm = ALow - mid;

    const data = { CA: { x: [], y: [] }, FA: { x: [], y: [] }, FR: { x: [], y: [] }, CR: { x: [], y: [] } };

    for (let i = 0; i < numPoints; i++) {
      const z1 = generateStandardNormal();
      const z2 = generateStandardNormal();
      const trueError = uUUT * z1;
      const calError = uCal * z2;
      const measuredError = trueError + calError;
      const isGood = trueError > LLow_norm && trueError < LUp_norm;
      const isAccept = measuredError > ALow_norm && measuredError < AUp_norm;

      let category;
      if (isGood && isAccept) category = "CA";
      else if (isGood && !isAccept) category = "FR";
      else if (!isGood && isAccept) category = "FA";
      else category = "CR";

      data[category].x.push(trueError);
      data[category].y.push(measuredError);
    }
    // ----------------------------------------------------------------------------------

    const markerBase = { line: { color: colors.pointBorder, width: 0.5 } };
    const unit = results.nativeUnit || "Units";
    const hoverTemplate = `True: %{x:.4f} ${unit}<br>Meas: %{y:.4f} ${unit}<extra></extra>`;

    return [
      {
        ...data.CA,
        mode: "markers",
        type: "scatter",
        name: "Correct Accept",
        hovertemplate: hoverTemplate,
        marker: { ...markerBase, color: colors.good, size: 6, opacity: 0.5 },
      },
      {
        ...data.FA,
        mode: "markers",
        type: "scatter",
        name: "False Accept (PFA)",
        hovertemplate: hoverTemplate,
        marker: { ...markerBase, color: colors.bad, size: 8, opacity: 0.9 },
      },
      {
        ...data.FR,
        mode: "markers",
        type: "scatter",
        name: "False Reject (PFR)",
        hovertemplate: hoverTemplate,
        marker: { ...markerBase, color: colors.warning, size: 8, opacity: 0.9 },
      },
      {
        ...data.CR,
        mode: "markers",
        type: "scatter",
        name: "Correct Reject",
        hovertemplate: hoverTemplate,
        marker: { ...markerBase, color: colors.primary, size: 6, opacity: 0.5 },
      },
    ];
  }, [results, inputs, numPoints, colors]);

  const plotLayout = useMemo(() => {
    // ... (Your existing layout logic remains exactly the same) ...
    // Ensure you keep the layout logic you just approved in the previous step.
    const mid = (inputs.LUp + inputs.LLow) / 2;
    const LUp_norm = inputs.LUp - mid;
    const LLow_norm = inputs.LLow - mid;
    const AUp_norm = results.AUp - mid;
    const ALow_norm = results.ALow - mid;

    const xMargin = (LUp_norm - LLow_norm) * 0.7;
    const yMargin = (AUp_norm - ALow_norm) * 0.7;

    const x_outer_L = LLow_norm - xMargin;
    const x_outer_R = LUp_norm + xMargin;
    const y_outer_T = AUp_norm + yMargin;
    const y_outer_B = ALow_norm - yMargin;

    const unit = results.nativeUnit || "Units";
    const bgColor = isDarkMode ? "#1e1e1e" : "#ffffff";
    const txtColor = isDarkMode ? "#e0e0e0" : "#212529";
    const gridColor = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"; 
    const mutedTextColor = isDarkMode ? "#a0a0a0" : "#6c757d";
    const fontStack = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    const labelPositions = {
      CA: { x: 0, y: 0, text: "Correct Accept" },
      FA_Left: { x: (LLow_norm + x_outer_L) / 2, y: 0, text: "False Accept" },
      FA_Right: { x: (LUp_norm + x_outer_R) / 2, y: 0, text: "False Accept" },
      FR_Top: { x: 0, y: (AUp_norm + y_outer_T) / 2, text: "False Reject" },
      FR_Bottom: { x: 0, y: (ALow_norm + y_outer_B) / 2, text: "False Reject" },
      CR_TopLeft: { x: (LLow_norm + x_outer_L) / 2, y: (AUp_norm + y_outer_T) / 2, text: "Correct Reject" },
      CR_TopRight: { x: (LUp_norm + x_outer_R) / 2, y: (AUp_norm + y_outer_T) / 2, text: "Correct Reject" },
      CR_BotLeft: { x: (LLow_norm + x_outer_L) / 2, y: (ALow_norm + y_outer_B) / 2, text: "Correct Reject" },
      CR_BotRight: { x: (LUp_norm + x_outer_R) / 2, y: (ALow_norm + y_outer_B) / 2, text: "Correct Reject" },
    };

    const regionAnnotations = Object.values(labelPositions).map((pos) => ({
      ...pos,
      showarrow: false,
      font: { family: fontStack, color: mutedTextColor, size: 11, weight: "bold" },
      opacity: 0.5,
    }));

    const createLimitLabel = (x, y, text, color, xanchor, yanchor) => ({
        x, y, text,
        showarrow: false,
        xanchor, yanchor,
        font: { family: fontStack, color: color, size: 10, weight: "bold" },
        bgcolor: isDarkMode ? "rgba(30,30,30,0.8)" : "rgba(255,255,255,0.8)",
        borderpad: 2
    });

    const limitAnnotations = [
      createLimitLabel(LLow_norm, y_outer_T, `L-Tol (${LLow_norm.toPrecision(3)} ${unit})`, colors.primary, "center", "bottom"),
      createLimitLabel(LUp_norm, y_outer_T, `U-Tol (${LUp_norm.toPrecision(3)} ${unit})`, colors.primary, "center", "bottom"),
      createLimitLabel(x_outer_R, ALow_norm, `L-Acc (${ALow_norm.toPrecision(3)} ${unit})`, colors.warning, "left", "middle"),
      createLimitLabel(x_outer_R, AUp_norm, `U-Acc (${AUp_norm.toPrecision(3)} ${unit})`, colors.warning, "left", "middle"),
    ];

    return {
      title: { text: "Risk Scatterplot", font: { family: fontStack, size: 16, color: txtColor } },
      autosize: true,
      xaxis: {
        title: { text: `True UUT Error (${unit})`, font: { family: fontStack, size: 12 } },
        zeroline: true, zerolinecolor: gridColor, gridcolor: gridColor,
        tickfont: { family: fontStack, size: 10, color: mutedTextColor },
        range: [LLow_norm - xMargin * 1.2, LUp_norm + xMargin * 1.2],
      },
      yaxis: {
        title: { text: `Measured Error (${unit})`, font: { family: fontStack, size: 12 } },
        zeroline: true, zerolinecolor: gridColor, gridcolor: gridColor,
        tickfont: { family: fontStack, size: 10, color: mutedTextColor },
        range: [ALow_norm - yMargin * 1.2, AUp_norm + yMargin * 1.2],
      },
      shapes: [
        { type: "line", x0: LLow_norm, x1: LLow_norm, y0: y_outer_B, y1: y_outer_T, line: { color: colors.primary, width: 2, dash: "dash" } },
        { type: "line", x0: LUp_norm, x1: LUp_norm, y0: y_outer_B, y1: y_outer_T, line: { color: colors.primary, width: 2, dash: "dash" } },
        { type: "line", x0: x_outer_L, x1: x_outer_R, y0: ALow_norm, y1: ALow_norm, line: { color: colors.warning, width: 2, dash: "dot" } },
        { type: "line", x0: x_outer_L, x1: x_outer_R, y0: AUp_norm, y1: AUp_norm, line: { color: colors.warning, width: 2, dash: "dot" } },
      ],
      annotations: [...regionAnnotations, ...limitAnnotations],
      legend: { orientation: "h", y: -0.15, x: 0.5, xanchor: "center", bgcolor: "transparent", font: { family: fontStack, size: 11, color: txtColor } },
      paper_bgcolor: bgColor,
      plot_bgcolor: bgColor,
      margin: { t: 40, b: 60, l: 60, r: 40 },
      hovermode: "closest",
    };
  }, [results, inputs, isDarkMode, colors]);

  const plotConfig = useMemo(() => ({
      responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toggleSpikelines']
    }), []);

  return (
    <div className="scatterplot-container" style={{ height: "450px", width: "100%", position: "relative", marginTop: "1rem" }}>
       {/* Floating Control Overlay */}
       <div className="plot-floating-control">
          <label htmlFor="numPlotPoints">Simulated Points:</label>
          <input
            type="number"
            id="numPlotPoints"
            step="500"
            min="500"
            max="10000"
            value={numPoints}
            onChange={(e) => setNumPoints(Number(e.target.value))}
          />
       </div>
       <Plot
          data={plotData}
          layout={plotLayout}
          config={plotConfig}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler={true}
       />
    </div>
  );
};

export default RiskScatterplot;