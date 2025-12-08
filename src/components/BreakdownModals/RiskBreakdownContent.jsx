import React from "react";
import Latex from "../Latex";

// --- Helper to display safe units ---
const SafeUnit = ({ unit }) => {
  const safe = unit === "%" ? "\\%" : unit || "units";
  return <>{safe}</>;
};

// ==========================================
// 1. KEY INPUTS BREAKDOWN
// ==========================================
export const InputsBreakdown = ({ results, inputs }) => {
  if (!results || !inputs) return null;

  const mid = (inputs.LUp + inputs.LLow) / 2;
  const LUp_symmetric = Math.abs(inputs.LUp - mid);
  const safeNativeUnit =
    results.nativeUnit === "%" ? "\\%" : results.nativeUnit || "units";
  const zScore = results.uDev > 0 ? LUp_symmetric / results.uDev : 0;
  const reliability = parseFloat(inputs.reliability);
  const p_cumulative = (1 + reliability) / 2;

  return (
    <div className="modal-body-scrollable">
      <div className="breakdown-step">
        <h5>
          Cal Process Error (u<sub>combined</sub>)
        </h5>
        <p>
          This value is the Combined Standard Uncertainty, calculated from the
          detailed budget.
        </p>
        <Latex>
          {`$$ u_{combined} = \\mathbf{${results.uCal.toPrecision(
            6
          )}} \\text{ ${safeNativeUnit}} $$`}
        </Latex>
      </div>

      <div className="breakdown-step">
        <h5>
          Observed (measured) UUT Error (&sigma;<sub>observed</sub>)
        </h5>
        <p>
          This value is calculated using the EOP reliability (REOP) and the
          Inverse Normal Distribution Function to determine a Z-Score. The
          Z-score (number of standard deviations) is found using the Inverse
          Normal CDF (`Φ⁻¹`, or `probit`) on the cumulative probability `p` (our
          REOP percentage).
        </p>
        <Latex>
          {`$$ p = (1 + R) / 2 = (1 + ${reliability}) / 2 = \\mathbf{${p_cumulative.toFixed(
            4
          )}} $$`}
        </Latex>
        <Latex>
          {`$$ Z_{\\text{score}} = \\Phi^{-1}(p) = \\Phi^{-1}(${p_cumulative.toFixed(
            4
          )}) = \\mathbf{${zScore.toPrecision(4)}} $$`}
        </Latex>
        <Latex>
          {`$$ \\sigma_{observed} = \\frac{L_{Upper}}{\\Phi^{-1}((1+R)/2)} = \\frac{${LUp_symmetric.toPrecision(
            6
          )}}{\\Phi^{-1}((1+${
            inputs.reliability
          })/2)} = \\mathbf{${results.uDev.toPrecision(
            6
          )}} \\text{ ${safeNativeUnit}} $$`}
        </Latex>
      </div>

      <div className="breakdown-step">
        <h5>
          UUT True Error (&sigma;<sub>uut</sub>)
        </h5>
        <p>
          The intrinsic error of the UUT, calculated by removing the calibration
          process uncertainty from the observed error.
        </p>
        <Latex>
          {`$$ \\sigma_{uut} = \\sqrt{\\sigma_{observed}^2 - u_{combined}^2} = \\sqrt{${results.uDev.toPrecision(
            6
          )}^2 - ${results.uCal.toPrecision(
            6
          )}^2} = \\mathbf{${results.uUUT.toPrecision(
            6
          )}} \\text{ ${safeNativeUnit}} $$`}
        </Latex>
      </div>

      <div className="breakdown-step">
        <h5>UUT Tolerance Limits (L)</h5>
        <p>The specified tolerance limits for the Unit Under Test (UUT).</p>
        <Latex>
          {`$$ L_{Low} = \\mathbf{${parseFloat(inputs.LLow).toPrecision(
            6
          )}} \\text{ ${safeNativeUnit}} $$`}
        </Latex>
        <Latex>
          {`$$ L_{Up} = \\mathbf{${parseFloat(inputs.LUp).toPrecision(
            6
          )}} \\text{ ${safeNativeUnit}} $$`}
        </Latex>
      </div>

      <div className="breakdown-step">
        <h5>Acceptance Limits (A)</h5>
        <p>
          Calculated by applying the Guard Band Multiplier to the tolerance
          limits.
        </p>
        <Latex>
          {`$$ A_{Low} = L_{Low} \\times G = ${parseFloat(
            inputs.LLow
          ).toPrecision(6)} \\times ${
            inputs.guardBandMultiplier
          } = \\mathbf{${results.ALow.toPrecision(
            6
          )}} \\text{ ${safeNativeUnit}} $$`}
        </Latex>
        <Latex>
          {`$$ A_{Up} = L_{Up} \\times G = ${parseFloat(inputs.LUp).toPrecision(
            6
          )} \\times ${
            inputs.guardBandMultiplier
          } = \\mathbf{${results.AUp.toPrecision(
            6
          )}} \\text{ ${safeNativeUnit}} $$`}
        </Latex>
      </div>

      <div className="breakdown-step">
        <h5>Correlation (ρ)</h5>
        <p>
          The statistical correlation between the UUT's true error value and the
          observed (measured) value.
        </p>
        <Latex>
          {`$$ \\rho = \\frac{\\sigma_{UUT}}{\\sigma_{observed}} = \\frac{${results.uUUT.toPrecision(
            6
          )}}{${results.uDev.toPrecision(
            6
          )}} = \\mathbf{${results.correlation.toPrecision(6)}} $$`}
        </Latex>
      </div>
    </div>
  );
};

// ==========================================
// 2. TUR BREAKDOWN
// ==========================================
export const TurBreakdown = ({ results, inputs }) => {
  if (!results || !inputs) return null;

  const safeNativeUnit =
    results.nativeUnit === "%" ? "\\%" : results.nativeUnit || "units";
  const uutToleranceSpan = inputs.LUp - inputs.LLow;
  const expandedUncertaintySpan = results.expandedUncertainty * 2;

  return (
    <div className="modal-body-scrollable">
      <div className="breakdown-step">
        <h5>Step 1: Formula</h5>
        <p>
          The Test Uncertainty Ratio (TUR) is the ratio of the tolerance span to
          the expanded measurement uncertainty span.
        </p>
        <Latex>
          {
            "$$ TUR = \\frac{\\text{UUT Tolerance Span}}{\\text{Expanded Measurement Uncertainty Span}} = \\frac{2L}{2U} $$"
          }
        </Latex>
      </div>
      <div className="breakdown-step">
        <h5>Step 2: Inputs</h5>
        <ul>
          <li>
            Tolerance Span (2L):{" "}
            <Latex>{`$$ L_{Upper} - L_{Lower} = ${inputs.LUp.toPrecision(
              6
            )} - (${inputs.LLow.toPrecision(
              6
            )}) = ${uutToleranceSpan.toPrecision(
              4
            )} \\text{ ${safeNativeUnit}} $$`}</Latex>
          </li>
          <li>
            Expanded Uncertainty Span (2U):{" "}
            <Latex>{`$$ 2 \\times U_{95} = 2 \\times ${results.expandedUncertainty.toPrecision(
              4
            )} = \\mathbf{${expandedUncertaintySpan.toPrecision(
              4
            )}} \\text{ ${safeNativeUnit}} $$`}</Latex>
          </li>
        </ul>
      </div>
      <div className="breakdown-step">
        <h5>Step 3: Final Calculation</h5>
        <Latex>{`$$ TUR = \\frac{${uutToleranceSpan.toPrecision(
          4
        )}}{${expandedUncertaintySpan.toPrecision(
          4
        )}} = \\mathbf{${results.tur.toFixed(4)}:1} $$`}</Latex>
      </div>
    </div>
  );
};

// ==========================================
// 3. TAR BREAKDOWN
// ==========================================
export const TarBreakdown = ({ results, inputs }) => {
  if (!results || !inputs) return null;

  const uutToleranceHigh = inputs.LUp;
  const uutToleranceLow = inputs.LLow;
  const uutToleranceSpan = uutToleranceHigh - uutToleranceLow;
  const uutNominalMid = (uutToleranceHigh + uutToleranceLow) / 2;

  const tmdeToleranceHighDev = results.tmdeToleranceHigh || 0;
  const tmdeToleranceLowDev = results.tmdeToleranceLow || 0;

  const tmdeToleranceHigh_Absolute = uutNominalMid + tmdeToleranceHighDev;
  const tmdeToleranceLow_Absolute = uutNominalMid + tmdeToleranceLowDev;

  const tmdeToleranceSpan = results.tmdeToleranceSpan;

  const uutBreakdown = results.uutBreakdownForTar || [];
  const tmdeBreakdown = results.tmdeBreakdownForTar || [];

  const safeNativeUnit =
    results.nativeUnit === "%" ? "\\%" : results.nativeUnit || "units";

  const uutSumString =
    uutBreakdown.length > 0
      ? uutBreakdown.map((comp) => comp.span.toPrecision(4)).join(" + ")
      : "0";
  const tmdeSumString =
    tmdeBreakdown.length > 0
      ? tmdeBreakdown.map((comp) => comp.span.toPrecision(4)).join(" + ")
      : "0";

  return (
    <div className="modal-body-scrollable">
      <div className="breakdown-step">
        <h5>Step 1: Formula</h5>
        <p>
          The Test Accuracy Ratio (TAR) is the ratio of the UUT's tolerance span
          to the TMDE's (Standard's) tolerance span.
        </p>
        <Latex>
          {
            "$$ TAR = \\frac{\\text{(UUT Tolerance High)} - \\text{(UUT Tolerance Low)}}{\\text{(TMDE Tolerance High)} - \\text{(TMDE Tolerance Low)}} $$"
          }
        </Latex>
      </div>
      <div className="breakdown-step">
        <h5>Step 2: Inputs</h5>
        <ul>
          <li>
            UUT Tolerance Span (Absolute Limits):
            <Latex>{`$$ (L_{Up}) - (L_{Low}) = ${uutToleranceHigh.toPrecision(
              6
            )} - (${uutToleranceLow.toPrecision(6)}) $$`}</Latex>
            {uutBreakdown.length > 0 ? (
              <ul
                className="result-breakdown"
                style={{
                  paddingLeft: "20px",
                  fontSize: "0.9rem",
                  margin: "5px 0",
                }}
              >
                {uutBreakdown.map((comp, index) => (
                  <li key={index} style={{ border: "none", padding: "2px 0" }}>
                    <span className="label">{comp.name}</span>
                    <span className="value">
                      {comp.span.toPrecision(4)} {safeNativeUnit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <em style={{ display: "block", margin: "5px 0" }}>
                (No UUT tolerance components found)
              </em>
            )}
            <Latex>{`$$ \\text{Total Span} = ${uutSumString} = \\mathbf{${uutToleranceSpan.toPrecision(
              4
            )}} \\text{ ${safeNativeUnit}} $$`}</Latex>
          </li>

          <li>
            TMDE Tolerance Span (Absolute Limits):
            <Latex>{`$$ (L_{Up}) - (L_{Low}) = ${tmdeToleranceHigh_Absolute.toPrecision(
              6
            )} - (${tmdeToleranceLow_Absolute.toPrecision(6)}) $$`}</Latex>
            {tmdeBreakdown.length > 0 ? (
              <ul
                className="result-breakdown"
                style={{
                  paddingLeft: "20px",
                  fontSize: "0.9rem",
                  margin: "5px 0",
                }}
              >
                {tmdeBreakdown.map((comp, index) => (
                  <li key={index} style={{ border: "none", padding: "2px 0" }}>
                    <span className="label">{comp.name}</span>
                    <span className="value">
                      {comp.span.toPrecision(4)} {safeNativeUnit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <em style={{ display: "block", margin: "5px 0" }}>
                (No TMDE tolerances found)
              </em>
            )}
            <Latex>{`$$ \\text{Total Span} = ${tmdeSumString} = \\mathbf{${tmdeToleranceSpan.toPrecision(
              4
            )}} \\text{ ${safeNativeUnit}} $$`}</Latex>
          </li>
        </ul>
      </div>
      <div className="breakdown-step">
        <h5>Step 3: Final Calculation</h5>
        <Latex>{`$$ TAR = \\frac{${uutToleranceSpan.toPrecision(
          4
        )}}{${tmdeToleranceSpan.toPrecision(
          4
        )}} = \\mathbf{${results.tar.toFixed(4)}:1} $$`}</Latex>
      </div>
    </div>
  );
};

// ==========================================
// 4. PFA BREAKDOWN
// ==========================================
export const PfaBreakdown = ({ results, inputs }) => {
  if (!results || !inputs) return null;

  const mid = (inputs.LUp + inputs.LLow) / 2;
  const LLow_norm = inputs.LLow - mid;
  const LUp_norm = inputs.LUp - mid;
  const ALow_norm = results.ALow - mid;
  const AUp_norm = results.AUp - mid;

  // Z-Scores (Normalized Limits)
  const z_x_low = LLow_norm / results.uUUT;
  const z_x_high = LUp_norm / results.uUUT; // The "true" positive Z-score for LUp
  const z_y_low = ALow_norm / results.uDev;
  const z_y_high = AUp_norm / results.uDev;

  const safeNativeUnit =
    results.nativeUnit === "%" ? "\\%" : results.nativeUnit || "units";

  return (
    <div className="modal-body-scrollable">
      <div className="breakdown-step">
        <h5>Step 1: Formula</h5>
        <p>
          The Probability of False Accept (PFA) is the sum of the probabilities
          in the two "False Accept" regions of the risk scatterplot. This is
          calculated using the Bivariate Normal Cumulative Distribution Function
          (Φ₂).
        </p>
        <Latex>{"$$ PFA = PFA_{Lower} + PFA_{Upper} $$"}</Latex>
      </div>
      <div className="breakdown-step">
        <h5>Step 2: Key Statistical Inputs</h5>
        <p>These values are derived from your budget and reliability settings.</p>
        <ul>
          <li>
            True UUT Error (σ<sub>uut</sub>):{" "}
            <strong>
              {results.uUUT.toPrecision(4)} {safeNativeUnit}
            </strong>
            <Latex>{`$$ \\sigma_{uut} = \\sqrt{\\sigma_{observed}^2 - u_{combined}^2} $$`}</Latex>
          </li>
          <li>
            Observed Error (σ<sub>obs</sub>):{" "}
            <strong>
              {results.uDev.toPrecision(4)} {safeNativeUnit}
            </strong>
            <Latex>{`$$ \\sigma_{observed} = \\frac{L_{Upper}}{\\Phi^{-1}((1+R)/2)} $$`}</Latex>
          </li>
          <li>
            Correlation (ρ):{" "}
            <Latex>{`$$ \\rho = \\frac{\\sigma_{uut}}{\\sigma_{obs}} = \\frac{${results.uUUT.toPrecision(
              4
            )}}{${results.uDev.toPrecision(
              4
            )}} = \\mathbf{${results.correlation.toFixed(4)}} $$`}</Latex>
          </li>
        </ul>
      </div>
      <div className="breakdown-step">
        <h5>Step 3: Normalized Limits (Z-Scores)</h5>
        <p>
          The limits are normalized by their respective standard deviations. (L
          = UUT Tolerance, A = Acceptance Limit)
        </p>
        <ul>
          <li>
            z<sub>x_low</sub> (True Error):{" "}
            <Latex>{`$$ \\frac{L_{Low}}{\\sigma_{uut}} = \\frac{${LLow_norm.toPrecision(
              4
            )}}{${results.uUUT.toPrecision(
              4
            )}} = \\mathbf{${z_x_low.toFixed(4)}} $$`}</Latex>
          </li>
          <li>
            z<sub>x_high</sub> (True Error):{" "}
            <Latex>{`$$ \\frac{L_{Up}}{\\sigma_{uut}} = \\frac{${LUp_norm.toPrecision(
              4
            )}}{${results.uUUT.toPrecision(
              4
            )}} = \\mathbf{${z_x_high.toFixed(4)}} $$`}</Latex>
          </li>
          <li>
            z<sub>y_low</sub> (Measured Error):{" "}
            <Latex>{`$$ \\frac{A_{Low}}{\\sigma_{obs}} = \\frac{${ALow_norm.toPrecision(
              4
            )}}{${results.uDev.toPrecision(
              4
            )}} = \\mathbf{${z_y_low.toFixed(4)}} $$`}</Latex>
          </li>
          <li>
            z<sub>y_high</sub> (Measured Error):{" "}
            <Latex>{`$$ \\frac{A_{Up}}{\\sigma_{obs}} = \\frac{${AUp_norm.toPrecision(
              4
            )}}{${results.uDev.toPrecision(
              4
            )}} = \\mathbf{${z_y_high.toFixed(4)}} $$`}</Latex>
          </li>
        </ul>
      </div>
      <div className="breakdown-step">
        <h5>Step 4: Bivariate Calculation</h5>
        <p>The probability for each tail (region) is calculated separately.</p>
        <p>
          <strong>Lower Tail Risk (PFA_Lower):</strong>
        </p>
        <Latex>
          {
            "$$ P(z_x < z_{x\\_low} \\text{ and } z_{y\\_low} < z_y < z_{y\\_high}) $$"
          }
        </Latex>
        <Latex>{`$$ = \\Phi_2(z_{x\\_low}, z_{y\\_high}, \\rho) - \\Phi_2(z_{x\\_low}, z_{y\\_low}, \\rho) $$`}</Latex>
        <Latex>{`$$ = \\Phi_2(${z_x_low.toFixed(2)}, ${z_y_high.toFixed(
          2
        )}, ${results.correlation.toFixed(2)}) - \\Phi_2(${z_x_low.toFixed(
          2
        )}, ${z_y_low.toFixed(2)}, ${results.correlation.toFixed(
          2
        )}) $$`}</Latex>
        <Latex>{`$$ = \\mathbf{${(results.pfa_term1 / 100).toExponential(
          4
        )}} $$`}</Latex>
        <p>
          <strong>Upper Tail Risk (PFA_Upper):</strong>
        </p>
        <Latex>
          {
            "$$ P(z_x > z_{x\\_high} \\text{ and } z_{y\\_low} < z_y < z_{y\\_high}) $$"
          }
        </Latex>
        <p>
          Calculated using symmetry:{" "}
          <Latex>{`$$ = P(z_x < -z_{x\\_high} \\text{ and } -z_{y\\_high} < z_y < -z_{y\\_low}) $$`}</Latex>
        </p>
        <Latex>{`$$ = \\Phi_2(-z_{x\\_high}, -z_{y\\_low}, \\rho) - \\Phi_2(-z_{x\\_high}, -z_{y\\_high}, \\rho) $$`}</Latex>
        <Latex>{`$$ = \\Phi_2(${-z_x_high.toFixed(2)}, ${-z_y_low.toFixed(
          2
        )}, ${results.correlation.toFixed(
          2
        )}) - \\Phi_2(${-z_x_high.toFixed(2)}, ${-z_y_high.toFixed(
          2
        )}, ${results.correlation.toFixed(2)}) $$`}</Latex>
        <Latex>{`$$ = \\mathbf{${(results.pfa_term2 / 100).toExponential(
          4
        )}} $$`}</Latex>
      </div>
      <div className="breakdown-step">
        <h5>Step 5: Final PFA</h5>
        <Latex>{`$$ PFA = PFA_{Lower} + PFA_{Upper} $$`}</Latex>
        <Latex>{`$$ = ${(results.pfa_term1 / 100).toExponential(4)} + ${(
          results.pfa_term2 / 100
        ).toExponential(4)} = \\mathbf{${(results.pfa / 100).toExponential(
          4
        )}} $$`}</Latex>
        <Latex>{`$$ \\text{Total PFA} = \\mathbf{${results.pfa.toFixed(
          4
        )}\\%} $$`}</Latex>
      </div>
    </div>
  );
};

// ==========================================
// 5. PFR BREAKDOWN
// ==========================================
export const PfrBreakdown = ({ results, inputs }) => {
  if (!results || !inputs) return null;

  const mid = (inputs.LUp + inputs.LLow) / 2;
  const LLow_norm = inputs.LLow - mid;
  const LUp_norm = inputs.LUp - mid;
  const ALow_norm = results.ALow - mid;
  const AUp_norm = results.AUp - mid;

  // Z-Scores (Normalized Limits)
  const z_x_low = LLow_norm / results.uUUT;
  const z_x_high = LUp_norm / results.uUUT;
  const z_y_low = ALow_norm / results.uDev;
  const z_y_high = AUp_norm / results.uDev;

  const safeNativeUnit =
    results.nativeUnit === "%" ? "\\%" : results.nativeUnit || "units";

  return (
    <div className="modal-body-scrollable">
      <div className="breakdown-step">
        <h5>Step 1: Formula</h5>
        <p>
          The Probability of False Reject (PFR) is the sum of the probabilities
          in the two "False Reject" regions of the risk scatterplot. This is
          calculated using the Bivariate Normal Cumulative Distribution Function
          (Φ₂).
        </p>
        <Latex>{"$$ PFR = PFR_{Lower} + PFR_{Upper} $$"}</Latex>
        <Latex>
          {
            "$$ PFR_{Lower} = P(L_{Low} < \\text{True} < L_{Up} \\text{ and Measured} < A_{Low}) $$"
          }
        </Latex>
        <Latex>
          {
            "$$ PFR_{Upper} = P(L_{Low} < \\text{True} < L_{Up} \\text{ and Measured} > A_{Up}) $$"
          }
        </Latex>
      </div>
      <div className="breakdown-step">
        <h5>Step 2: Key Statistical Inputs</h5>
        <p>These values are derived from your budget and reliability settings.</p>
        <ul>
          <li>
            True UUT Error (σ<sub>uut</sub>):{" "}
            <strong>
              {results.uUUT.toPrecision(4)} {safeNativeUnit}
            </strong>
            <Latex>{`$$ \\sigma_{uut} = \\sqrt{\\sigma_{observed}^2 - u_{combined}^2} $$`}</Latex>
          </li>
          <li>
            Observed Error (σ<sub>obs</sub>):{" "}
            <strong>
              {results.uDev.toPrecision(4)} {safeNativeUnit}
            </strong>
            <Latex>{`$$ \\sigma_{observed} = \\frac{L_{Upper}}{\\Phi^{-1}((1+R)/2)} $$`}</Latex>
          </li>
          <li>
            Correlation (ρ):{" "}
            <Latex>{`$$ \\rho = \\frac{\\sigma_{uut}}{\\sigma_{obs}} = \\frac{${results.uUUT.toPrecision(
              4
            )}}{${results.uDev.toPrecision(
              4
            )}} = \\mathbf{${results.correlation.toFixed(4)}} $$`}</Latex>
          </li>
        </ul>
      </div>
      <div className="breakdown-step">
        <h5>Step 3: Normalized Limits (Z-Scores)</h5>
        <p>
          The limits are normalized by their respective standard deviations. (L
          = UUT Tolerance, A = Acceptance Limit)
        </p>
        <ul>
          <li>
            z<sub>x_low</sub> (True Error):{" "}
            <Latex>{`$$ \\frac{L_{Low}}{\\sigma_{uut}} = \\frac{${LLow_norm.toPrecision(
              4
            )}}{${results.uUUT.toPrecision(
              4
            )}} = \\mathbf{${z_x_low.toFixed(4)}} $$`}</Latex>
          </li>
          <li>
            z<sub>x_high</sub> (True Error):{" "}
            <Latex>{`$$ \\frac{L_{Up}}{\\sigma_{uut}} = \\frac{${LUp_norm.toPrecision(
              4
            )}}{${results.uUUT.toPrecision(
              4
            )}} = \\mathbf{${z_x_high.toFixed(4)}} $$`}</Latex>
          </li>
          <li>
            z<sub>y_low</sub> (Measured Error):{" "}
            <Latex>{`$$ \\frac{A_{Low}}{\\sigma_{obs}} = \\frac{${ALow_norm.toPrecision(
              4
            )}}{${results.uDev.toPrecision(
              4
            )}} = \\mathbf{${z_y_low.toFixed(4)}} $$`}</Latex>
          </li>
          <li>
            z<sub>y_high</sub> (Measured Error):{" "}
            <Latex>{`$$ \\frac{A_{Up}}{\\sigma_{obs}} = \\frac{${AUp_norm.toPrecision(
              4
            )}}{${results.uDev.toPrecision(
              4
            )}} = \\mathbf{${z_y_high.toFixed(4)}} $$`}</Latex>
          </li>
        </ul>
      </div>
      <div className="breakdown-step">
        <h5>Step 4: Bivariate Calculation</h5>
        <p>The probability for each side (region) is calculated separately.</p>
        <p>
          <strong>Lower Side Risk (PFR_Lower):</strong>
        </p>
        <Latex>
          {
            "$$ P(z_{x\\_low} < z_x < z_{x\\_high} \\text{ and } z_y < z_{y\\_low}) $$"
          }
        </Latex>
        <Latex>{`$$ = \\Phi_2(z_{x\\_high}, z_{y\\_low}, \\rho) - \\Phi_2(z_{x\\_low}, z_{y\\_low}, \\rho) $$`}</Latex>
        <Latex>{`$$ = \\Phi_2(${z_x_high.toFixed(2)}, ${z_y_low.toFixed(
          2
        )}, ${results.correlation.toFixed(2)}) - \\Phi_2(${z_x_low.toFixed(
          2
        )}, ${z_y_low.toFixed(2)}, ${results.correlation.toFixed(
          2
        )}) $$`}</Latex>
        <Latex>{`$$ = \\mathbf{${(results.pfr_term1 / 100).toExponential(
          4
        )}} $$`}</Latex>
        <p>
          <strong>Upper Side Risk (PFR_Upper):</strong>
        </p>
        <Latex>
          {
            "$$ P(z_{x\\_low} < z_x < z_{x\\_high} \\text{ and } z_y > z_{y\\_high}) $$"
          }
        </Latex>
        <p>
          Calculated using symmetry:{" "}
          <Latex>{`$$ = P(-z_{x\\_high} < z_x < -z_{x\\_low} \\text{ and } z_y < -z_{y\\_high}) $$`}</Latex>
        </p>
        <Latex>{`$$ = \\Phi_2(-z_{x\\_low}, -z_{y\\_high}, \\rho) - \\Phi_2(-z_{x\\_high}, -z_{y\\_high}, \\rho) $$`}</Latex>
        <Latex>{`$$ = \\Phi_2(${-z_x_low.toFixed(2)}, ${-z_y_high.toFixed(
          2
        )}, ${results.correlation.toFixed(
          2
        )}) - \\Phi_2(${-z_x_high.toFixed(2)}, ${-z_y_high.toFixed(
          2
        )}, ${results.correlation.toFixed(2)}) $$`}</Latex>
        <Latex>{`$$ = \\mathbf{${(results.pfr_term2 / 100).toExponential(
          4
        )}} $$`}</Latex>
      </div>
      <div className="breakdown-step">
        <h5>Step 5: Final PFR</h5>
        <Latex>{`$$ PFR = PFR_{Lower} + PFR_{Upper} $$`}</Latex>
        <Latex>{`$$ = ${(results.pfr_term1 / 100).toExponential(4)} + ${(
          results.pfr_term2 / 100
        ).toExponential(4)} = \\mathbf{${(results.pfr / 100).toExponential(
          4
        )}} $$`}</Latex>
        <Latex>{`$$ \\text{Total PFR} = \\mathbf{${results.pfr.toFixed(
          4
        )}\\%} $$`}</Latex>
      </div>
    </div>
  );
};

// ==========================================
// 6. GUARDBAND BREAKDOWNS (Individual Exports)
// ==========================================
export const GBInputsBreakdown = ({ inputs }) => (
  <div className="modal-body-scrollable">
    <>
    <div className="breakdown-step">
      <h5>Uncertainty Requirements</h5>
      <p>
        These values are uncertainty requirements set on the Uncertainty Tool.
      </p>
      <Latex>{`$$ Measurement\\ Reliability\\ Target = \\mathbf{${
        inputs.measRelTarget * 100
      }}\\% $$`}</Latex>
      <Latex>{`$$ Measurement\\ Reliability\\ Calculated\\ Assumed = \\mathbf{${
        inputs.measrelCalcAssumed * 100
      }}\\% $$`}</Latex>
      <Latex>{`$$ PFA\\ Required = \\mathbf{${
        inputs.reqPFA * 100
      }}\\% $$`}</Latex>
      <Latex>{`$$ TUR\\ Required = \\mathbf{${inputs.reqTUR}} $$`}</Latex>
      <Latex>{`$$ Calibration\\ Interval = \\mathbf{${inputs.calibrationInt}} $$`}</Latex>
    </div>

    <div className="breakdown-step">
      <h5>Calculated TUR Value</h5>
      <p>
        The Test Uncertainty Ratio (TUR) is the ratio of the tolerance span to
        the expanded measurement uncertainty span.
      </p>
      <Latex>{`$$ TUR = \\mathbf{${inputs.turVal.toFixed(4)}:1} $$`}</Latex>
    </div>

    <div className="breakdown-step">
      <h5>
        Cal Process Error (u<sub>combined</sub>)
      </h5>
      <p>
        This value is the Combined Standard Uncertainty, calculated from the
        detailed budget.
      </p>
      <Latex>
        {`$$ u_{combined} = \\mathbf{${inputs.combUnc.toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
    </div>

    <div className="breakdown-step">
      <h5>Nominal Value</h5>
      <p>The is the current measurement point.</p>
      <Latex>
        {`$$ Nominal = \\mathbf{${parseFloat(inputs.nominal).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
    </div>

    <div className="breakdown-step">
      <h5>UUT Tolerance Limits</h5>
      <p>The specified tolerance limits for the Unit Under Test (UUT).</p>
      <Latex>
        {`$$ Lower = \\mathbf{${parseFloat(inputs.uutLower).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
      <Latex>
        {`$$ Upper = \\mathbf{${parseFloat(inputs.uutUpper).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
    </div>

    <div className="breakdown-step">
      <h5>TMDE Tolerance Limits</h5>
      <p>
        The specified tolerance limits for the Test, Measurement, and Diagnostic
        Equipment (TMDE).
      </p>
      <Latex>
        {`$$ Lower = \\mathbf{${parseFloat(inputs.tmdeLower).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
      <Latex>
        {`$$ Upper = \\mathbf{${parseFloat(inputs.tmdeUpper).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
    </div>
  </>
  </div>
);

export const GBLowBreakdown = ({ inputs, results }) => (
  <div className="modal-body-scrollable">
    <div className="breakdown-step">
        <h5>Step 1: Formula</h5>
        <p>
          The Lower Guardband Tolerance (GB Low) is the product of the UUT Lower Tolerance times the Gaurdband Multiplier. Acceptance Tolerance are lowered to meet the required PFA in the cases that the PFA is above the {(inputs.reqPFA ?? 0) * 100}% PFA threshold.
        </p>
        <Latex>{"$$ GB_{LOW} = L_{Lower} * GB_{MULTIPLIER} $$"}</Latex>
      </div>
      <div className="breakdown-step">
        <h5>Step 2: Key Statistical Inputs</h5>
        <p>These values are derived from your budget and reliability settings.</p>
        <ul>
          <li>
            True UUT Error (σ<sub>uut</sub>):{" "}
            <strong>
              {/* {results.uUUT.toPrecision(4)} {safeNativeUnit} */}
            </strong>
            <Latex>{`$$ \\sigma_{uut} = \\sqrt{\\sigma_{observed}^2 - u_{combined}^2} $$`}</Latex>
          </li>
          <li>
            Observed Error (σ<sub>obs</sub>):{" "}
            {/* <strong>
              {results.uDev.toPrecision(4)} {safeNativeUnit}
            </strong> */}
            <Latex>{`$$ \\sigma_{observed} = \\frac{L_{Upper}}{\\Phi^{-1}((1+R)/2)} $$`}</Latex>
          </li>
          <li>
            Correlation (ρ):{" "}
            {/* <Latex>{`$$ \\rho = \\frac{\\sigma_{uut}}{\\sigma_{obs}} = \\frac{${results.uUUT.toPrecision(
              4
            )}}{${results.uDev.toPrecision(
              4
            )}} = \\mathbf{${results.correlation.toFixed(4)}} $$`}</Latex> */}
          </li>
        </ul>
      </div>
      <div className="breakdown-step">
        <h5>Step 3: Normalized Limits (Z-Scores)</h5>
        <p>
          The limits are normalized by their respective standard deviations. (L
          = UUT Tolerance, A = Acceptance Limit)
        </p>
        <ul>
          <li>
            z<sub>x_low</sub> (True Error):{" "}
            {/* <Latex>{`$$ \\frac{L_{Low}}{\\sigma_{uut}} = \\frac{${LLow_norm.toPrecision(
              4
            )}}{${results.uUUT.toPrecision(
              4
            )}} = \\mathbf{${z_x_low.toFixed(4)}} $$`}</Latex> */}
          </li>
          <li>
            z<sub>x_high</sub> (True Error):{" "}
            {/* <Latex>{`$$ \\frac{L_{Up}}{\\sigma_{uut}} = \\frac{${LUp_norm.toPrecision(
              4
            )}}{${results.uUUT.toPrecision(
              4
            )}} = \\mathbf{${z_x_high.toFixed(4)}} $$`}</Latex> */}
          </li>
          <li>
            z<sub>y_low</sub> (Measured Error):{" "}
            {/* <Latex>{`$$ \\frac{A_{Low}}{\\sigma_{obs}} = \\frac{${ALow_norm.toPrecision(
              4
            )}}{${results.uDev.toPrecision(
              4
            )}} = \\mathbf{${z_y_low.toFixed(4)}} $$`}</Latex> */}
          </li>
          <li>
            z<sub>y_high</sub> (Measured Error):{" "}
            {/* <Latex>{`$$ \\frac{A_{Up}}{\\sigma_{obs}} = \\frac{${AUp_norm.toPrecision(
              4
            )}}{${results.uDev.toPrecision(
              4
            )}} = \\mathbf{${z_y_high.toFixed(4)}} $$`}</Latex> */}
          </li>
        </ul>
      </div>
      <div className="breakdown-step">
        <h5>Step 4: Bivariate Calculation</h5>
        <p>The probability for each tail (region) is calculated separately.</p>
        <p>
          <strong>Lower Tail Risk (PFA_Lower):</strong>
        </p>
        <Latex>
          {
            "$$ P(z_x < z_{x\\_low} \\text{ and } z_{y\\_low} < z_y < z_{y\\_high}) $$"
          }
        </Latex>
        <Latex>{`$$ = \\Phi_2(z_{x\\_low}, z_{y\\_high}, \\rho) - \\Phi_2(z_{x\\_low}, z_{y\\_low}, \\rho) $$`}</Latex>
        {/* <Latex>{`$$ = \\Phi_2(${z_x_low.toFixed(2)}, ${z_y_high.toFixed(
          2
        )}, ${results.correlation.toFixed(2)}) - \\Phi_2(${z_x_low.toFixed(
          2
        )}, ${z_y_low.toFixed(2)}, ${results.correlation.toFixed(
          2
        )}) $$`}</Latex> */}
        {/* <Latex>{`$$ = \\mathbf{${(results.pfa_term1 / 100).toExponential(
          4
        )}} $$`}</Latex> */}
        <p>
          <strong>Upper Tail Risk (PFA_Upper):</strong>
        </p>
        <Latex>
          {
            "$$ P(z_x > z_{x\\_high} \\text{ and } z_{y\\_low} < z_y < z_{y\\_high}) $$"
          }
        </Latex>
        <p>
          Calculated using symmetry:{" "}
          <Latex>{`$$ = P(z_x < -z_{x\\_high} \\text{ and } -z_{y\\_high} < z_y < -z_{y\\_low}) $$`}</Latex>
        </p>
        <Latex>{`$$ = \\Phi_2(-z_{x\\_high}, -z_{y\\_low}, \\rho) - \\Phi_2(-z_{x\\_high}, -z_{y\\_high}, \\rho) $$`}</Latex>
        {/* <Latex>{`$$ = \\Phi_2(${-z_x_high.toFixed(2)}, ${-z_y_low.toFixed(
          2
        )}, ${results.correlation.toFixed(
          2
        )}) - \\Phi_2(${-z_x_high.toFixed(2)}, ${-z_y_high.toFixed(
          2
        )}, ${results.correlation.toFixed(2)}) $$`}</Latex> */}
        {/* <Latex>{`$$ = \\mathbf{${(results.pfa_term2 / 100).toExponential(
          4
        )}} $$`}</Latex> */}
      </div>
      <div className="breakdown-step">
        <h5>Step 5: Final PFA</h5>
        <Latex>{`$$ PFA = PFA_{Lower} + PFA_{Upper} $$`}</Latex>
        {/* <Latex>{`$$ = ${(results.pfa_term1 / 100).toExponential(4)} + ${(
          results.pfa_term2 / 100
        ).toExponential(4)} = \\mathbf{${(results.pfa / 100).toExponential(
          4
        )}} $$`}</Latex> */}
        {/* <Latex>{`$$ \\text{Total PFA} = \\mathbf{${results.pfa.toFixed(
          4
        )}\\%} $$`}</Latex> */}
      </div>
  </div>
);

export const GBHighBreakdown = ({ inputs }) => (
  <div className="modal-body-scrollable">
    <Latex>
        {`$$ Upper = \\mathbf{${parseFloat(inputs.tmdeUpper).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
  </div>
);

export const GBPFABreakdown = ({ inputs }) => (
  <div className="modal-body-scrollable">
    <Latex>
        {`$$ Upper = \\mathbf{${parseFloat(inputs.tmdeUpper).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
  </div>
);

export const GBPFRBreakdown = ({ inputs }) => (
  <div className="modal-body-scrollable">
    <Latex>
        {`$$ Upper = \\mathbf{${parseFloat(inputs.tmdeUpper).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
  </div>
);

export const GBMultBreakdown = ({ inputs, results }) => {

  const safeNativeUnit =
    results.nativeUnit === "%" ? "\\%" : results.nativeUnit || "units";
  const uutToleranceUpper =
    (inputs.LUp ?? 0) - (results.gbInputs.nominal ?? 0);
  const gbUpper =
    (results.gbResults.GBUP ?? 0) - (results.gbInputs.nominal ?? 0);
  const reqPFA = results.gbInputs.reqPFA ?? 0;
  const nominal = results.gbInputs.nominal ?? 0;
  const gbUP = results.gbResults.GBUP ?? 0;
  const gbMult = results.gbResults.GBMULT ?? 0;
  const precise = 6;

  
  return (
    <div className="modal-body-scrollable">
      <div className="breakdown-step">
        <h5>Step 1: Formula</h5>
        <p>
          The Guardband Multiplier is the ratio of the UUT tolerance to
          the Guardbanded tolerance. Calculated by adjusting acceptance limits until required {reqPFA * 100}% PFA is met.
        </p>
        <Latex>
          {
            "$$ \\text{Guardband Multiplier} = \\frac{\\text{UUT Upper Tolerance}}{\\text{Guardband Upper Tolerance}} = \\frac{L_{Upper} - Nominal}{GB_{Upper} - Nominal} $$"
          }
        </Latex>
        <div className="breakdown-step">
          <h5>Step 2: Inputs</h5>
          <ul>
            <li>
              Upper Tolerance :{" "}
              <Latex>{`$$ L_{Upper} - Nominal = ${inputs.LUp.toPrecision(
                precise
              )} - (${nominal.toPrecision(
                precise
              )}) = ${uutToleranceUpper.toPrecision(
                precise
              )} \\text{ ${safeNativeUnit}} $$`}</Latex>
            </li>
            <li>
              Guardband Upper Tolerance :{" "}
              <Latex>{`$$ GB_{Upper} - Nominal = ${gbUP.toPrecision(4)} - ${nominal.toPrecision(precise)} 
              = \\mathbf{${gbUpper.toPrecision(precise)}} \\text{ ${safeNativeUnit}} $$`}</Latex>
            </li>
          </ul>
        </div>
        <div className="breakdown-step">
          <h5>Step 3: Final Calculation</h5>
          <Latex>{`$$ GB Multiplier = \\frac{${gbUpper.toPrecision(
            precise
          )}}{${uutToleranceUpper.toPrecision(
            precise
          )}} = \\mathbf{${gbMult.toFixed(precise)}} $$`}</Latex>
        </div>
      </div>
    </div>
  );
}

export const GBCalIntBreakdown = ({ inputs }) => (
  <div className="modal-body-scrollable">
    <Latex>
        {`$$ Upper = \\mathbf{${parseFloat(inputs.tmdeUpper).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
  </div>
);

export const NoGBCalIntBreakdown = ({ inputs }) => (
  <div className="modal-body-scrollable">
    <Latex>
        {`$$ Upper = \\mathbf{${parseFloat(inputs.tmdeUpper).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
  </div>
);

export const NoGBMeasRelBreakdown = ({ inputs }) => (
  <div className="modal-body-scrollable">
    <Latex>
        {`$$ Upper = \\mathbf{${parseFloat(inputs.tmdeUpper).toPrecision(
          6
        )}} \\text{ ${inputs.nominalUnit}} $$`}
      </Latex>
  </div>
);