import React, { useMemo, useEffect, useRef } from "react";
import { useTheme } from "../App";

const PercentageBarGraph = ({ inputs }) => {
  const isDarkMode = useTheme();
  const plotContainer = useRef(null);

  const plotData = useMemo(() => {
    if (!inputs || typeof inputs !== "object") return [];

    const entries = Object.entries(inputs);
    const labels = entries.map(([key]) => key);
    const values = entries.map(([_, val]) => Number(val));

    const total = values.reduce((acc, val) => acc + val, 0);
    const percentages = total === 0 ? values.map(() => 0) : values.map((val) => (val / total) * 100);

    return [
      {
        x: percentages,
        y: labels,
        orientation: "h",
        type: "bar",
        width: 0.5,
        text: percentages.map((p) => `${p.toFixed(1)}%`),
        textposition: "auto",
        marker: { color: isDarkMode ? "#3b82f6" : "#007bff" },
      },
    ];
  }, [inputs, isDarkMode]);

  const plotLayout = useMemo(() => {
    const bgColor = isDarkMode ? "#1e1e1e" : "#ffffff";
    const txtColor = isDarkMode ? "#e0e0e0" : "#212529";
    const gridColor = isDarkMode ? "#424242" : "#dee2e6";

    return {
        title: "Error Source Uncertainty Influence",    
        autosize: true,
        xaxis: { title: "Percent Contribution To Combined Uncertainty", range: [0, 120], gridcolor: gridColor, ticksuffix: "%" },
        yaxis: { automargin: true, ticklabelpad: 100 },
        paper_bgcolor: bgColor,
        plot_bgcolor: bgColor,
        font: { color: txtColor },
    };
  }, [isDarkMode]);

  const plotConfig = useMemo(() => ({ responsive: true, displaylogo: false }), []);

  useEffect(() => {
    if (window.Plotly && plotContainer.current && plotData.length > 0) {
      window.Plotly.react(plotContainer.current, plotData, plotLayout, plotConfig);
    }
  }, [plotData, plotLayout, plotConfig]);

  return <div ref={plotContainer} className="bargraph-container"></div>;
};

export default PercentageBarGraph;
