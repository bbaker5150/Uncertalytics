import React from "react";
import * as Breakdowns from "./RiskBreakdownContent";

const RiskBreakdownModal = ({ isOpen, onClose, modalType, data }) => {
  if (!isOpen || !data) return null;
  const { results, inputs } = data;

  const MODAL_CONFIG = {
    inputs:    { title: "Key Inputs Breakdown", Component: Breakdowns.InputsBreakdown },
    tur:       { title: "TUR Calculation Breakdown", Component: Breakdowns.TurBreakdown },
    tar:       { title: "TAR Calculation Breakdown", Component: Breakdowns.TarBreakdown },
    pfa:       { title: "PFA Calculation Breakdown", Component: Breakdowns.PfaBreakdown },
    pfr:       { title: "PFR Calculation Breakdown", Component: Breakdowns.PfrBreakdown },
    gbinputs:  { title: "GB Inputs Breakdown", Component: Breakdowns.GBInputsBreakdown },
    gblow:     { title: "GB Low Breakdown", Component: Breakdowns.GBLowBreakdown },
    gbhigh:    { title: "GB High Breakdown", Component: Breakdowns.GBHighBreakdown },
    gbpfa:     { title: "GB PFA Breakdown", Component: Breakdowns.GBPFABreakdown },
    gbpfr:     { title: "GB PFR Breakdown", Component: Breakdowns.GBPFRBreakdown },
    gbmult:    { title: "GB Multiplier Breakdown", Component: Breakdowns.GBMultBreakdown },
    gbcalint:  { title: "GB Cal Interval Breakdown", Component: Breakdowns.GBCalIntBreakdown },
    calint:    { title: "No GB Cal Interval Breakdown", Component: Breakdowns.NoGBCalIntBreakdown },
    measrel:   { title: "No GB Meas Rel Breakdown", Component: Breakdowns.NoGBMeasRelBreakdown },
  };

  const config = MODAL_CONFIG[modalType];
  if (!config) return null;

  const { title, Component } = config;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content breakdown-modal-content">
        <button onClick={onClose} className="modal-close-button">&times;</button>
        <h3>{title}</h3>
        <Component results={results} inputs={inputs} />
      </div>
    </div>
  );
};

export default RiskBreakdownModal;