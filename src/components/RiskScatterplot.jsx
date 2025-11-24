import React, { useMemo, useState } from "react";
import { useTheme } from "../App";

// Use the factory to create a Plot component that uses the basic distribution
// This ensures we don't need a CDN and keeps the bundle size smaller than the full Plotly
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

  const plotData = useMemo(() => {
    if (!results || !inputs) return [];

    const { uUUT, uCal, ALow, AUp } = results;
    const { LLow, LUp } = inputs;

    const mid = (LUp + LLow) / 2;
    const LUp_norm = LUp - mid;
    const LLow_norm = LLow - mid;
    const AUp_norm = AUp - mid;
    const ALow_norm = ALow - mid;

    const data = {
      CA: { x: [], y: [] },
      FA: { x: [], y: [] },
      FR: { x: [], y: [] },
      CR: { x: [], y: [] },
    };

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

    return [
      {
        ...data.CA,
        mode: "markers",
        type: "scatter",
        name: "Correct Accept",
        marker: { color: "var(--status-good)", size: 5, opacity: 0.5 },
      },
      {
        ...data.FA,
        mode: "markers",
        type: "scatter",
        name: "False Accept (PFA)",
        marker: { color: "var(--status-bad)", size: 5, opacity: 0.7 },
      },
      {
        ...data.FR,
        mode: "markers",
        type: "scatter",
        name: "False Reject (PFR)",
        marker: { color: "var(--status-warning)", size: 5, opacity: 0.7 },
      },
      {
        ...data.CR,
        mode: "markers",
        type: "scatter",
        name: "Correct Reject",
        marker: { color: "var(--text-color-muted)", size: 5, opacity: 0.3 },
      },
    ];
  }, [results, inputs, numPoints]);

  const plotLayout = useMemo(() => {
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
    const gridColor = isDarkMode ? "#424242" : "#dee2e6";
    const mutedTextColor = isDarkMode ? "#a0a0a0" : "#6c757d";
    const primaryColor = isDarkMode ? "#3b82f6" : "#007bff";
    const warningColor = "#ffc107";

    const labelPositions = {
      CA: { x: 0, y: 0, text: "Correct Accept" },
      FA_Left: { x: (LLow_norm + x_outer_L) / 2, y: 0, text: "False Accept" },
      FA_Right: { x: (LUp_norm + x_outer_R) / 2, y: 0, text: "False Accept" },
      FR_Top: { x: 0, y: (AUp_norm + y_outer_T) / 2, text: "False Reject" },
      FR_Bottom: { x: 0, y: (ALow_norm + y_outer_B) / 2, text: "False Reject" },
      CR_TopLeft: {
        x: (LLow_norm + x_outer_L) / 2,
        y: (AUp_norm + y_outer_T) / 2,
        text: "Correct Reject",
      },
      CR_TopRight: {
        x: (LUp_norm + x_outer_R) / 2,
        y: (AUp_norm + y_outer_T) / 2,
        text: "Correct Reject",
      },
      CR_BotLeft: {
        x: (LLow_norm + x_outer_L) / 2,
        y: (ALow_norm + y_outer_B) / 2,
        text: "Correct Reject",
      },
      CR__BotRight: {
        x: (LUp_norm + x_outer_R) / 2,
        y: (ALow_norm + y_outer_B) / 2,
        text: "Correct Reject",
      },
    };

    const regionAnnotations = Object.values(labelPositions).map((pos) => ({
      ...pos,
      showarrow: false,
      font: { color: mutedTextColor, size: 10, weight: "bold" },
      opacity: 0.6,
    }));

    const limitAnnotations = [
      {
        x: LLow_norm,
        y: y_outer_T,
        text: `UUT L-Tol (${LLow_norm.toPrecision(3)} ${unit})`,
        showarrow: false,
        xanchor: "center",
        yanchor: "bottom",
        font: { color: primaryColor, size: 9 },
      },
      {
        x: LUp_norm,
        y: y_outer_T,
        text: `UUT U-Tol (${LUp_norm.toPrecision(3)} ${unit})`,
        showarrow: false,
        xanchor: "center",
        yanchor: "bottom",
        font: { color: primaryColor, size: 9 },
      },
      {
        x: x_outer_R,
        y: ALow_norm,
        text: `L-Accept (${ALow_norm.toPrecision(3)} ${unit})`,
        showarrow: false,
        xanchor: "left",
        yanchor: "middle",
        font: { color: warningColor, size: 9 },
      },
      {
        x: x_outer_R,
        y: AUp_norm,
        text: `U-Accept (${AUp_norm.toPrecision(3)} ${unit})`,
        showarrow: false,
        xanchor: "left",
        yanchor: "middle",
        font: { color: warningColor, size: 9 },
      },
    ];

    return {
      title: "Risk Scatterplot",
      autosize: true,
      xaxis: {
        title: `True UUT Error (${unit})`,
        zeroline: true,
        zerolinecolor: gridColor,
        gridcolor: gridColor,
        range: [LLow_norm - xMargin * 1.2, LUp_norm + xMargin * 1.2],
      },
      yaxis: {
        title: `Measured Error (${unit})`,
        zeroline: true,
        zerolinecolor: gridColor,
        gridcolor: gridColor,
        range: [ALow_norm - yMargin * 1.2, AUp_norm + yMargin * 1.2],
      },
      shapes: [
        {
          type: "line",
          x0: LLow_norm,
          x1: LLow_norm,
          y0: y_outer_B,
          y1: y_outer_T,
          line: { color: primaryColor, width: 2, dash: "dash" },
        },
        {
          type: "line",
          x0: LUp_norm,
          x1: LUp_norm,
          y0: y_outer_B,
          y1: y_outer_T,
          line: { color: primaryColor, width: 2, dash: "dash" },
        },
        {
          type: "line",
          x0: x_outer_L,
          x1: x_outer_R,
          y0: ALow_norm,
          y1: ALow_norm,
          line: { color: warningColor, width: 2, dash: "dot" },
        },
        {
          type: "line",
          x0: x_outer_L,
          x1: x_outer_R,
          y0: AUp_norm,
          y1: AUp_norm,
          line: { color: warningColor, width: 2, dash: "dot" },
        },
      ],
      annotations: [...regionAnnotations, ...limitAnnotations],
      legend: {
        orientation: "h",
        y: -0.2,
        x: 0.5,
        xanchor: "center",
        bgcolor: "transparent",
      },
      paper_bgcolor: bgColor,
      plot_bgcolor: bgColor,
      font: {
        color: txtColor,
      },
      margin: { t: 40, b: 40, l: 60, r: 40 },
    };
  }, [results, inputs, isDarkMode]);

  const plotConfig = useMemo(
    () => ({
      responsive: true,
      displaylogo: false,
    }),
    []
  );

  return (
    <React.Fragment>
      <div className="risk-inputs-container" style={{ paddingBottom: "0", marginTop: "1rem" }}>
        <div className="form-section">
          <label htmlFor="numPlotPoints">Simulated Points</label>
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
      </div>

      <div className="scatterplot-container" style={{ height: "400px", width: "100%" }}>
        <Plot
          data={plotData}
          layout={plotLayout}
          config={plotConfig}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler={true}
        />
      </div>
    </React.Fragment>
  );
};

export default RiskScatterplot;