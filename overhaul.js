const prefixMap = {
  yotta: 1e24, Y: 1e24,
  zetta: 1e21, Z: 1e21,
  exa: 1e18,   E: 1e18,
  peta: 1e15,  P: 1e15,
  tera: 1e12,  T: 1e12,
  giga: 1e9,   G: 1e9,
  mega: 1e6,   M: 1e6,
  kilo: 1e3,   k: 1e3,
  hecto: 1e2,  h: 1e2,
  deca: 1e1,   da: 1e1,
  deci: 1e-1,  d: 1e-1,
  centi: 1e-2, c: 1e-2,
  milli: 1e-3, m: 1e-3,
  micro: 1e-6, u: 1e-6, μ: 1e-6,
  nano: 1e-9,  n: 1e-9,
  pico: 1e-12, p: 1e-12,
  femto: 1e-15,f: 1e-15,
  atto: 1e-18, a: 1e-18,
  zepto: 1e-21,z: 1e-21,
  yocto: 1e-24,y: 1e-24
};

// just some food for thought, here is a prefix map, we probably could've used this to make an easier calculateuncertaintyfromtoleranceobject instead of the one we had
// and then on derived units to utilize uncertainty for both units and use the final calculated uncertainty and map it back into this.
// calculate uncertainty from tolerance object may be hard to maintain

   // function PFAMgrRewrite(nominal, average, lowerTolerance, upperTolerance, measurementUncertainty, measurementReliability, resultTUR, requiredTUR) {

    //   // Tolerance Information

    //   // Passes Values to Nominal, Average, LowerTolerance, UpperTolerance
    //   const toleranceTypes = ["UpThreshold","AltUpThreshold","LowThreshold","AltLowThreshold","NotThreshold"];
    //   let tolInfo = "";
    //   const noUpper = isNaN(upperTolerance);
    //   const noLower = isNaN(lowerTolerance);
    //   if (noLower && noUpper) return;

    //   if( noLower ){
    //     if(isNaN(nominal)) nominal = upperTolerance
    //     if(isNaN(average)) {
    //       average = nominal
    //       tolInfo = toleranceTypes[1]
    //     } else {
    //       tolInfo = toleranceTypes[0]
    //     }
    //   } else if ( noUpper ) {
    //     if(isNaN(nominal)) nominal = lowerTolerance
    //     if(isNaN(average)) {
    //       average = nominal
    //       tolInfo = toleranceTypes[3]
    //     } else {
    //       tolInfo = toleranceTypes[2]
    //     }
    //   } else {
    //     if (upperTolerance <= lowerTolerance) return;
    //     nominal = ( upperTolerance + lowerTolerance ) / 2;
    //     if(!isNaN(average) && nominal !== average){
    //       if(upperTolerance > average && lowerTolerance < average){
    //         nominal = average;
    //       }
    //     }
    //     lowerTolerance = lowerTolerance - nominal;
    //     upperTolerance = upperTolerance - nominal;
    //     tolInfo = toleranceTypes[4]
    //   }

    //   // Risk Information

    //   // Checks UNC and REL if they're real values
    //   if( (isNaN(measurementUncertainty)) || (isNaN(measurementReliability)) ) return;
      
    //   // Calibration Reliability with TUR

    //   // Changes our Reliability based on our TUR value

    //   // PFA Calculation

    //   // Calculate PFA using bivariate normal distribution

    //   if (tolInfo === "NotThreshold") {
    //     dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
    //     if (dUUTUnc <= 0) return ["","","","","",""];
    //     result = PFA(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dTolLow, dTolUp);

    //   } else if (tolInfo === "UpThreshold") {
    //     dUUTUnc = uutUncUL(dMeasRel, dMeasUnc, dAvg, dTolUp);
    //     if (dUUTUnc <= 0) return ["","","","","",""];
    //     result = PFAUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dTolUp);

    //   } else if (tolInfo === "LowThreshold") {
    //     dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dTolLow);
    //     if (dUUTUnc <= 0) return ["","","","","",""];
    //     result = PFALL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dTolLow);

    //   } else {
    //     result = ["","","","","",""];
    //   }

    //   if (dUUTUnc <= measurementUncertainty / 10) {
    //     result = ["","","","","",""];
    //   }

    //   return result;
    // };

   // function calcTUR(nominal, average, lowerTolerance, upperTolerance, measurementUncertainty) {

    //   const validateNumber = val => isNaN(val) ? 0 : parseFloat(val);

    //   if (isNaN(measurementUncertainty)) {
    //     return "";
    //   } else {
    //     measurementUncertainty = validateNumber(measurementUncertainty);
    //   }

    //   const toleranceTypes = ["UpThreshold","AltUpThreshold","LowThreshold","AltLowThreshold","NotThreshold"];

    //   let tolInfo = "";
    //   const noUpper = isNaN(upperTolerance);
    //   const noLower = isNaN(lowerTolerance);
    //   if (noLower && noUpper) return;

    //   if( noLower ){
    //     if(isNaN(nominal)) nominal = upperTolerance
    //     if(isNaN(average)) {
    //       average = nominal
    //       tolInfo = toleranceTypes[1]
    //     } else {
    //       tolInfo = toleranceTypes[0]
    //     }
    //   } else if ( noUpper ) {
    //     if(isNaN(nominal)) nominal = lowerTolerance
    //     if(isNaN(average)) {
    //       average = nominal
    //       tolInfo = toleranceTypes[3]
    //     } else {
    //       tolInfo = toleranceTypes[2]
    //     }
    //   } else {
    //     if (upperTolerance <= lowerTolerance) return;
    //     nominal = ( upperTolerance + lowerTolerance ) / 2;
    //     if(!isNaN(average) && nominal !== average){
    //       if(upperTolerance > average && lowerTolerance < average){
    //         nominal = average;
    //       }
    //     }
    //     lowerTolerance = lowerTolerance - nominal;
    //     upperTolerance = upperTolerance - nominal;
    //     tolInfo = toleranceTypes[4]
    //   }

    //   if (tolInfo === "NotThreshold") {
    //     return Math.abs((upperTolerance - lowerTolerance) / (2 * measurementUncertainty));
    //   } else if (tolInfo === "LowThreshold") {
    //     return Math.abs((average - lowerTolerance) / measurementUncertainty);
    //   } else if (tolInfo === "UpThreshold") {
    //     return Math.abs((upperTolerance - average) / measurementUncertainty);
    //   } else {
    //     return "";
    //   }
    // };

const calculateRiskMetrics = useCallback(() => {
    // --- Get all initial inputs ---
    const LLow = parseFloat(riskInputs.LLow);
    const LUp = parseFloat(riskInputs.LUp);
    const initial_reliability = parseFloat(sessionData.uncReq.reliability) / 100;
    const reqTur = parseFloat(sessionData.uncReq.neededTUR); // This is 'rngReqTUR'
    const guardBandMultiplier = 1;

    // --- Validation Checks (Existing) ---
    if (isNaN(LLow) || isNaN(LUp) || LUp <= LLow) {
      setNotification({
        title: "Invalid Input",
        message: "Enter valid UUT tolerance limits.",
      });
      return;
    }
    if (isNaN(initial_reliability) || initial_reliability <= 0 || initial_reliability >= 1) {
      setNotification({
        title: "Invalid Input",
        message: "Enter valid reliability (e.g., 0.95).",
      });
      return;
    }
    if (!calcResults) {
      setNotification({
        title: "Calculation Required",
        message: "Uncertainty budget must be calculated first.",
      });
      return;
    }
    
    const nominalUnit = uutNominal?.unit;
    const targetUnitInfo = unitSystem.units[nominalUnit];

    if (!targetUnitInfo || isNaN(targetUnitInfo.to_si)) {
      setNotification({
        title: "Calculation Error",
        message: `Invalid UUT unit (${nominalUnit}) for risk analysis.`,
      });
      return;
    }

    // --- Get VBA-equivalent variables ---
    const uCal_Base = calcResults.combined_uncertainty_absolute_base;
    const uCal_Native = uCal_Base / targetUnitInfo.to_si; // This is dMeasUnc
    
    const mid = (LUp + LLow) / 2;
    const LLow_norm = LLow - mid; // This is dTolLow
    const LUp_norm = LUp - mid;   // This is dTolUp
    const LUp_symmetric = Math.abs(LUp_norm); // Used for symmetric UUTunc logic

    const U_Base = calcResults.expanded_uncertainty_absolute_base;
    const U_Native = U_Base / targetUnitInfo.to_si;
    const turResult = (LUp - LLow) / (2 * U_Native); // This is dTUR
    
    // 'CalRelwTUR' Logic

    
    let adjusted_reliability = initial_reliability; // This is dMeasRel

    // Check if a Required TUR is set and valid
    if (reqTur > 0 && !isNaN(reqTur) && !isNaN(turResult)) {
      // dCalUnc = dMeasUnc * dTUR / dReqTur
      // Calculate the 'assumed' calibration uncertainty needed to meet the ReqTUR
      const dCalUnc = uCal_Native * turResult / reqTur;

      // dBiasUnc = UUTunc(dMeasRel, dCalUnc, dTolLow, dTolUp)
      // We use the *initial_reliability* and the *assumed* dCalUnc to find the bias
      const uDev_temp = LUp_symmetric / probit((1 + initial_reliability) / 2);
      const uUUT2_temp = uDev_temp ** 2 - dCalUnc ** 2;
      const dBiasUnc = (uUUT2_temp <= 0) ? 0 : Math.sqrt(uUUT2_temp);
      
      // dDevUnc = Sqr(dMeasUnc^2 + dBiasUnc^2)
      // Calculate a new 'observed' deviation using the *actual* uCal and the *assumed* bias
      const dDevUnc = Math.sqrt(uCal_Native ** 2 + dBiasUnc ** 2);
      
      // dMeasRel = vbNormSDist(dTolUp / dDevUnc) - vbNormSDist(dTolLow / dDevUnc)
      // Overwrite the reliability with the new adjusted value
      if (dDevUnc > 0) {
        adjusted_reliability = CumNorm(LUp_norm / dDevUnc) - CumNorm(LLow_norm / dDevUnc);
      }
    }

    // --- Resume calculation using the 'adjusted_reliability' ---
    const uDev = LUp_symmetric / probit((1 + adjusted_reliability) / 2);
    const uUUT2 = uDev ** 2 - uCal_Native ** 2;
    
    let uUUT = 0;
    if (uUUT2 <= 0) {
      if (reqTur > 0) { // Only show this warning if the adjustment was made
        setNotification({
          title: "Calc Warning",
          message: `uCal (${uCal_Native.toFixed(
            3
          )}) exceeds uDev (${uDev.toFixed(
            3
          )}) for adjusted reliability ${adjusted_reliability.toFixed(4)}. UUT unc treated as zero.`,
        });
      }
      uUUT = 0;
    } else {
      uUUT = Math.sqrt(uUUT2);
    }

    const ALow = LLow * guardBandMultiplier;
    const AUp = LUp * guardBandMultiplier;
    const correlation = uUUT === 0 || uDev === 0 ? 0 : uUUT / uDev;
    
    // Normalized Acceptance Limits
    const ALow_norm = ALow - mid;
    const AUp_norm = AUp - mid;

    // PFA Calculation
    const pfa_term1 =
      bivariateNormalCDF(LLow_norm / uUUT, AUp_norm / uDev, correlation) -
      bivariateNormalCDF(LLow_norm / uUUT, ALow_norm / uDev, correlation);
    const pfa_term2 =
      bivariateNormalCDF(-LUp_norm / uUUT, -ALow_norm / uDev, correlation) -
      bivariateNormalCDF(-LUp_norm / uUUT, -AUp_norm / uDev, correlation);
    const pfaResult =
      isNaN(pfa_term1) || isNaN(pfa_term2) ? 0 : pfa_term1 + pfa_term2;

    // PFR Calculation
    const pfr_term1 =
      bivariateNormalCDF(LUp_norm / uUUT, ALow_norm / uDev, correlation) -
      bivariateNormalCDF(LLow_norm / uUUT, ALow_norm / uDev, correlation);
    const pfr_term2 =
      bivariateNormalCDF(-LLow_norm / uUUT, -AUp_norm / uDev, correlation) -
      bivariateNormalCDF(-LUp_norm / uUUT, -AUp_norm / uDev, correlation);
    const pfrResult =
      isNaN(pfr_term1) || isNaN(pfr_term2) ? 0 : pfr_term1 + pfr_term2;

    // --- TAR Calculation ---
    const uutBreakdownResult = calculateUncertaintyFromToleranceObject(
      uutToleranceData,
      uutNominal
    );
    const uutSpecComponents = uutBreakdownResult.breakdown.filter(
      (comp) => comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
    );

    const uutName = sessionData.uutDescription || "UUT";

    const uutBreakdownForTar = uutSpecComponents.map((comp) => {
      const nominalValue = parseFloat(uutNominal.value);
      const highDeviation = comp.absoluteHigh - nominalValue;
      const lowDeviation = comp.absoluteLow - nominalValue;
      const span = highDeviation - lowDeviation;
      return {
        name: `${uutName} - ${comp.name}`,
        span: span,
      };
    });
    
    const tmdeBreakdownForTar = [];
    let missingTmdeRef = false;
    let tmdeToleranceHigh_Native = 0;
    let tmdeToleranceLow_Native = 0;

    if (tmdeTolerancesData.length > 0) {
      const tmdeTotals = tmdeTolerancesData.reduce(
        (acc, tmde) => {
          if (!tmde.measurementPoint || !tmde.measurementPoint.value) {
            missingTmdeRef = true;
            return acc;
          }

          const { breakdown: tmdeBreakdown } =
            calculateUncertaintyFromToleranceObject(tmde, tmde.measurementPoint);
          const tmdeNominal = parseFloat(tmde.measurementPoint.value);

          const tmdeSpecComponents = tmdeBreakdown.filter(
            (comp) =>
              comp.absoluteHigh !== undefined && comp.absoluteLow !== undefined
          );
          if (tmdeSpecComponents.length === 0) return acc;

          let totalTmdeHighDevInUutNative = 0;
          let totalTmdeLowDevInUutNative = 0;

          const tmdeUnitInfo = unitSystem.units[tmde.measurementPoint.unit];
          if (!tmdeUnitInfo || isNaN(tmdeUnitInfo.to_si)) {
            missingTmdeRef = true;
            return acc;
          }

          tmdeSpecComponents.forEach((comp) => {
            const highDev = comp.absoluteHigh - tmdeNominal;
            const lowDev = comp.absoluteLow - tmdeNominal;
            const compSpan = highDev - lowDev;

            const compSpanInBase = compSpan * tmdeUnitInfo.to_si;
            const compSpanInUutNative = compSpanInBase / targetUnitInfo.to_si;

            if (compSpanInUutNative > 0) {
              tmdeBreakdownForTar.push({
                name: `${tmde.name || "TMDE"} - ${comp.name}`,
                span: compSpanInUutNative,
              });
            }

            const highDevInBase = highDev * tmdeUnitInfo.to_si;
            const highDevInUutNative = highDevInBase / targetUnitInfo.to_si;

            const lowDevInBase = lowDev * tmdeUnitInfo.to_si;
            const lowDevInUutNative = lowDevInBase / targetUnitInfo.to_si;

            totalTmdeHighDevInUutNative += highDevInUutNative;
            totalTmdeLowDevInUutNative += lowDevInUutNative;
          });

          const quantity = parseInt(tmde.quantity, 10) || 1;
          acc.totalHigh += totalTmdeHighDevInUutNative * quantity;
          acc.totalLow += totalTmdeLowDevInUutNative * quantity;

          return acc;
        },
        { totalHigh: 0, totalLow: 0 }
      );

      tmdeToleranceHigh_Native = tmdeTotals.totalHigh;
      tmdeToleranceLow_Native = tmdeTotals.totalLow;
    }

    const tmdeToleranceSpan_Native =
      tmdeToleranceHigh_Native - tmdeToleranceLow_Native;

    if (missingTmdeRef) {
      setNotification({
        title: "Missing Info",
        message: "TMDE missing measurement point for TAR calculation.",
      });
    } else if (tmdeToleranceSpan_Native === 0 && LUp - LLow > 0) {
      if (riskInputs.LUp && riskInputs.LLow) {
        setNotification({
          title: "Missing Component",
          message: "Could not find TMDE tolerances for TAR.",
        });
      }
    }
    
    const tarResult =
      tmdeToleranceSpan_Native !== 0
        ? (LUp - LLow) / tmdeToleranceSpan_Native
        : 0;

    const gbResults = calcGuardBand(turResult);

    // --- Final Results Object ---
    const newRiskMetrics = {
      LLow: LLow,
      LUp: LUp,
      tur: turResult,
      tar: tarResult,
      pfa: pfaResult * 100,
      pfr: pfrResult * 100,
      pfa_term1: (isNaN(pfa_term1) ? 0 : pfa_term1) * 100,
      pfa_term2: (isNaN(pfa_term2) ? 0 : pfa_term2) * 100,
      pfr_term1: (isNaN(pfr_term1) ? 0 : pfr_term1) * 100,
      pfr_term2: (isNaN(pfr_term2) ? 0 : pfr_term2) * 100,
      uCal: uCal_Native,
      uUUT: uUUT,
      uDev: uDev,
      correlation,
      ALow: ALow,
      AUp: AUp,
      expandedUncertainty: U_Native,
      tmdeToleranceSpan: tmdeToleranceSpan_Native,
      tmdeToleranceHigh: tmdeToleranceHigh_Native,
      tmdeToleranceLow: tmdeToleranceLow_Native,
      uutBreakdownForTar: uutBreakdownForTar,
      tmdeBreakdownForTar: tmdeBreakdownForTar,
      nativeUnit: nominalUnit,
      gbResults: gbResults
    };

    setRiskResults(newRiskMetrics);
    onDataSave({ riskMetrics: newRiskMetrics });

  }, [
    riskInputs.LLow,
    riskInputs.LUp,
    sessionData,
    uutNominal,
    calcResults,
    uutToleranceData,
    tmdeTolerancesData,
    setNotification,
    onDataSave,
    setRiskResults
  ]);

  const calcGuardBand = (turResult) => {
    const LLow = parseFloat(riskInputs.LLow);
    const LUp = parseFloat(riskInputs.LUp);
    const pfaRequired = parseFloat(sessionData.uncReq.reqPFA)/100;
    const reliability = parseFloat(sessionData.uncReq.reliability)/100;
    const calInt = parseFloat(sessionData.uncReq.calInt);
    const measRelCalc = parseFloat(sessionData.uncReq.measRelCalcAssumed)/100;
    const turNeeded = parseFloat(sessionData.uncReq.neededTUR);

    function GetGBInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel, rngGBLow, rngGBUp) {
      const isNotNumeric = val => isNaN(parseFloat(val));
      const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel, bIsThreshold] = getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel);

      let dGBLow = vbaNbrValidate(rngGBLow);
      let dGBUp = vbaNbrValidate(rngGBUp);

      if (dGBLow === 0 && dGBUp === 0) {
        return sRiskType;
      }

      if (!bIsThreshold) {
        dGBLow = dGBLow - dNominal;
        dGBUp = dGBUp - dNominal;
      }

      return [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp];
    }


    function getTolInfo(rngNominal, rngAvg, rngTolLow, rngTolUp) {
      const isNotNumeric = val => isNaN(parseFloat(val));
      const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);
      const bNoNominal = isNotNumeric(rngNominal);
      const bNoAvg = isNotNumeric(rngAvg);
      const bNoTolLow = isNotNumeric(rngTolLow);
      const bNoTolUp = isNotNumeric(rngTolUp);
      if (bNoTolLow && bNoTolUp) return ["Fail"];
      let dNominal = vbaNbrValidate(rngNominal);
      let dAvg = vbaNbrValidate(rngAvg);
      let dTolLow = vbaNbrValidate(rngTolLow);
      let dTolUp = vbaNbrValidate(rngTolUp);
      const bIsThreshold = (bNoTolLow && !bNoTolUp) || (bNoTolUp && !bNoTolLow);
      if (bIsThreshold) {
        if (bNoTolLow) {
          if (bNoNominal) dNominal = dTolUp;
          if (bNoAvg) {
            dAvg = dNominal;
            return ["AltUpThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
          } else {
            return ["UpThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
          }
        } else if (bNoTolUp) {
          if (bNoNominal) dNominal = dTolLow;

          if (bNoAvg) {
            dAvg = dNominal;
            return ["AltLowThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
          } else {
            return ["LowThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
          }
        }
      } else {
        if (dTolLow >= dTolUp) return ["Fail"];
        dNominal = (dTolLow + dTolUp) / 2;
        if (!bNoAvg && dNominal !== dAvg) {
          if (dAvg > dTolLow && dAvg < dTolUp) {
            dNominal = dAvg;
          }
        }
        dTolLow = dTolLow - dNominal;
        dTolUp = dTolUp - dNominal;
        return ["NotThreshold", dNominal, dAvg, dTolLow, dTolUp, bIsThreshold];
      }
    }


    function getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel) {
      const isNotNumeric = val => isNaN(parseFloat(val));
      const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp, bIsThreshold] = getTolInfo(rngNominal, rngAvg, rngTolLow, rngTolUp);
      
      const bNoMeasUnc = isNotNumeric(rngMeasUnc);
      const bNoMeasRel = isNotNumeric(rngMeasRel);

      if (bNoMeasUnc || bNoMeasRel) {
          return ["Fail"];
      }

      const dMeasUnc = vbaNbrValidate(rngMeasUnc);
      const dMeasRel = vbaNbrValidate(rngMeasRel);

      return [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel, bIsThreshold];
    } 

    function pfaGBMult(req, uUUT, uCal, LLow, LUp) {

      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const REOP = vbNormSDist(LUp / uDev) - vbNormSDist(LLow / uDev);

      return RInAccGBMult(req, REOP, uCal, LLow, LUp);
    }

    function pfaLLGBMult(req, uUUT, uCal, avg, LLow) {

      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const REOP = vbNormSDist((avg - LLow) / uDev);

      return RInAccLLGBMult(req, REOP, uCal, avg, LLow);
    }

    function PFAULGBMult(req, uUUT, uCal, avg, LUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const REOP = vbNormSDist((LUp - avg) / uDev);

      return RInAccULGBMult(req, REOP, uCal, avg, LUp);
    }


    function uutUnc(r, uCal, LLow, LUp) {
      const Mid = (LUp + LLow) / 2;
      LUp = Math.abs(LUp - Mid);
      LLow = -Math.abs(LLow - Mid);

      const uDev = LUp / vbNormSInv((1 + r) / 2);

      const uUUT2 = Math.pow(uDev, 2) - Math.pow(uCal, 2);
      const uUUT = uUUT2 <= 0 ? 0 : Math.sqrt(uUUT2);

      return uUUT;
    }

    function uutUncLL(r, uCal, Avg, LLow) {
      let uDev, uUUT, uUUT2;

      if (LLow > Avg) {
        const temp = Avg;
        Avg = LLow;
        LLow = temp;
      }

      uDev = (LLow - Avg) / vbNormSInv(1 - r);

      uUUT2 = Math.pow(uDev, 2) - Math.pow(uCal, 2);
      uUUT = uUUT2 <= 0 ? 0 : Math.sqrt(uUUT2);

      return uUUT;
    }

    function UUTuncUL(r, uCal, avg, LUp) {
      if (LUp < avg) {
        const temp = avg;
        avg = LUp;
        LUp = temp;
      }

      const uDev = (LUp - avg) / vbNormSInv(r);

      const uUUT2 = Math.pow(uDev, 2) - Math.pow(uCal, 2);
      const uUUT = uUUT2 <= 0 ? 0 : Math.sqrt(uUUT2);

      return uUUT;
    }

    function PHID(z) {
      const P = [
        220.206867912376,
        221.213596169931,
        112.079291497871,
        33.912866078383,
        6.37396220353165,
        0.700383064443688,
        0.0352624965998911
      ];

      const Q = [
        440.413735824752,
        793.826512519948,
        637.333633378831,
        296.564248779674,
        86.7807322029461,
        16.064177579207,
        1.75566716318264,
        0.0883883476483184
      ];

      const CUTOFF = 8;
      const ZABS = Math.abs(z);
      let p;

      if (ZABS > CUTOFF) {
        p = 0;
      } else {
        const EXPNTL = Math.exp(-Math.pow(ZABS, 2) / 2);

        const numerator =
          ((((((P[6] * ZABS + P[5]) * ZABS + P[4]) * ZABS + P[3]) * ZABS + P[2]) * ZABS + P[1]) * ZABS + P[0]);

        const denominator =
          (((((((Q[7] * ZABS + Q[6]) * ZABS + Q[5]) * ZABS + Q[4]) * ZABS + Q[3]) * ZABS + Q[2]) * ZABS + Q[1]) * ZABS + Q[0]);

        p = EXPNTL * numerator / denominator;
      }

      return z > 0 ? 1 - p : p;
    }


    function PHIDInv(p) {
      const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
                138.357751867269, -30.6647980661472, 2.50662827745924];
      const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
                66.8013118877197, -13.2806815528857];
      const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
                -2.54973253934373, 4.37466414146497, 2.93816398269878];
      const d = [0.00778469570904146, 0.32246712907004, 2.445134137143,
                3.75440866190742];

      const pLow = 0.02425;
      const pHigh = 1 - pLow;

      if (p <= 0 || p >= 1) {
        throw new Error("Argument out of bounds");
      }

      let q, r;

      if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
      } else if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
              (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
      } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
      }
    }

    function CumNorm(x) {
      const XAbs = Math.abs(x);
      let Build, Exponential;

      if (XAbs > 37) {
        return 0;
      }

      Exponential = Math.exp(-Math.pow(XAbs, 2) / 2);

      if (XAbs < 7.07106781186547) {
        Build = 3.52624965998911e-2 * XAbs + 0.700383064443688;
        Build = Build * XAbs + 6.37396220353165;
        Build = Build * XAbs + 33.912866078383;
        Build = Build * XAbs + 112.079291497871;
        Build = Build * XAbs + 221.213596169931;
        Build = Build * XAbs + 220.206867912376;
        let numerator = Exponential * Build;

        Build = 8.83883476483184e-2 * XAbs + 1.75566716318264;
        Build = Build * XAbs + 16.064177579207;
        Build = Build * XAbs + 86.7807322029461;
        Build = Build * XAbs + 296.564248779674;
        Build = Build * XAbs + 637.333633378831;
        Build = Build * XAbs + 793.826512519948;
        Build = Build * XAbs + 440.413735824752;

        return x > 0 ? 1 - numerator / Build : numerator / Build;
      } else {
        Build = XAbs + 0.65;
        Build = XAbs + 4 / Build;
        Build = XAbs + 3 / Build;
        Build = XAbs + 2 / Build;
        Build = XAbs + 1 / Build;

        const result = Exponential / Build / 2.506628274631;
        return x > 0 ? 1 - result : result;
      }
    }

    function vbNormSDist(ZVal) {
      return CumNorm(ZVal);
    }

    function InvNormalDistribution(y0) {
      const Expm2 = 0.135335283236613;
      const S2Pi = 2.506628274631;
      const MaxRealNumber = Number.MAX_VALUE;

      if (y0 <= 0) return -MaxRealNumber;
      if (y0 >= 1) return MaxRealNumber;

      let y = y0;
      let code = 1;

      if (y > 1 - Expm2) {
        y = 1 - y;
        code = 0;
      }

      if (y > Expm2) {
        y -= 0.5;
        const y2 = y * y;

        let P0 = -59.9633501014108;
        P0 = 98.0010754186 + y2 * P0;
        P0 = -56.676285746907 + y2 * P0;
        P0 = 13.931260938728 + y2 * P0;
        P0 = -1.23916583867381 + y2 * P0;

        let Q0 = 1;
        Q0 = 1.95448858338142 + y2 * Q0;
        Q0 = 4.67627912898882 + y2 * Q0;
        Q0 = 86.3602421390891 + y2 * Q0;
        Q0 = -225.462687854119 + y2 * Q0;
        Q0 = 200.260212380061 + y2 * Q0;
        Q0 = -82.0372256168333 + y2 * Q0;
        Q0 = 15.9056225126212 + y2 * Q0;
        Q0 = -1.1833162112133 + y2 * Q0;

        let x = y + y * y2 * P0 / Q0;
        return x * S2Pi;
      }

      let x = Math.sqrt(-2 * Math.log(y));
      const x0 = x - Math.log(x) / x;
      const z = 1 / x;
      let x1;

      if (x < 8) {
        let P1 = 4.05544892305962;
        P1 = 31.5251094599894 + z * P1;
        P1 = 57.1628192246421 + z * P1;
        P1 = 44.0805073893201 + z * P1;
        P1 = 14.6849561928858 + z * P1;
        P1 = 2.1866330685079 + z * P1;
        P1 = -(1.40256079171354 * 0.1) + z * P1;
        P1 = -(3.50424626827848 * 0.01) + z * P1;
        P1 = -(8.57456785154685 * 0.0001) + z * P1;

        let Q1 = 1;
        Q1 = 15.7799883256467 + z * Q1;
        Q1 = 45.3907635128879 + z * Q1;
        Q1 = 41.3172038254672 + z * Q1;
        Q1 = 15.0425385692908 + z * Q1;
        Q1 = 2.50464946208309 + z * Q1;
        Q1 = -(1.42182922854788 * 0.1) + z * Q1;
        Q1 = -(3.80806407691578 * 0.01) + z * Q1;
        Q1 = -(9.33259480895457 * 0.0001) + z * Q1;

        x1 = z * P1 / Q1;
      } else {
        let P2 = 3.23774891776946;
        P2 = 6.91522889068984 + z * P2;
        P2 = 3.93881025292474 + z * P2;
        P2 = 1.33303460815808 + z * P2;
        P2 = 0.201485389549179 + z * P2;
        P2 = 0.012371663481782 + z * P2;
        P2 = 0.000301581553508235 + z * P2;
        P2 = 0.00000265806974686738 + z * P2;
        P2 = 0.00000000623974539184983 + z * P2;

        let Q2 = 1;
        Q2 = 6.02427039364742 + z * Q2;
        Q2 = 3.67983563856161 + z * Q2;
        Q2 = 1.37702099489081 + z * Q2;
        Q2 = 0.216236993594497 + z * Q2;
        Q2 = 0.0134204006088543 + z * Q2;
        Q2 = 0.000328014464682128 + z * Q2;
        Q2 = 0.00000289247864745381 + z * Q2;
        Q2 = 0.00000000679019408009981 + z * Q2;

        x1 = z * P2 / Q2;
      }

      x = x0 - x1;
      return code !== 0 ? -x : x;
    }

    function vbNormSInv(p) {
      return InvNormalDistribution(p);
    }

    function RInAccGBMult(req, REOP, uCal, LLow, LUp) {
      const precision = 0.00001;
      let GBMult = 1;
      let AUp = LUp;
      let ALow = LLow;

      let uUUT = uutUnc(REOP, uCal, ALow, AUp);
      let [EstPFA] = PFA(uUUT, uCal, LLow, LUp, ALow, AUp);

      if (EstPFA > req) {
        let change = 0.05;

        do {
          GBMult -= change;
          AUp = LUp * GBMult;
          ALow = LLow * GBMult;
          uUUT = uutUnc(REOP, uCal, ALow, AUp);
          [EstPFA] = PFA(uUUT, uCal, LLow, LUp, ALow, AUp);
        } while (EstPFA > req);

        do {
          change /= 2;
          GBMult += EstPFA < req ? change : -change;
          AUp = LUp * GBMult;
          ALow = LLow * GBMult;
          uUUT = uutUnc(REOP, uCal, ALow, AUp);
          [EstPFA] = PFA(uUUT, uCal, LLow, LUp, ALow, AUp);
        } while (!(EstPFA >= req - precision && EstPFA <= req));
      }

      return GBMult;
    }

    function RInAccULGBMult(req, REOP, uCal, avg, LUp) {
      const precision = 0.00001;
      let GBMult = 1;
      let AUp = LUp;

      let uUUT = UUTuncUL(REOP, uCal, avg, AUp);
      let [EstPFA] = PFAUL(uUUT, uCal, avg, LUp, AUp);

      if (EstPFA > req) {
        let change = 0.05;

        do {
          GBMult -= change;
          AUp = (LUp - avg) * GBMult + avg;
          uUUT = UUTuncUL(REOP, uCal, avg, AUp);
          [EstPFA] = PFAUL(uUUT, uCal, avg, LUp, AUp);
        } while (EstPFA > req);

        do {
          change /= 2;
          GBMult += EstPFA < req ? change : -change;
          AUp = (LUp - avg) * GBMult + avg;
          uUUT = UUTuncUL(REOP, uCal, avg, AUp);
          [EstPFA] = PFAUL(uUUT, uCal, avg, LUp, AUp);
        } while (!(EstPFA >= req - precision && EstPFA <= req));
      }

      return GBMult;
    }

    function PFAIter(sRiskType, dMeasRel,dAvg,dTolLow,dTolUp,dMeasUnc) {
      let dUUTUnc;

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
        if (dUUTUnc <= 0) return -1;
        return PFA(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dTolLow, dTolUp);
      }

      if (sRiskType === "UpThreshold") {
        dUUTUnc = UUTuncUL(dMeasRel, dMeasUnc, dAvg, dTolUp);
        if (dUUTUnc <= 0) return -1;
        return PFAUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dTolUp);
      }

      if (sRiskType === "LowThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dTolLow);
        if (dUUTUnc <= 0) return -1;
        return PFALL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dTolLow);
      }

      return -1;
    }


    function PFA(uUUT, uCal, LLow, LUp, ALow, AUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = bivariateNormalCDF(LLow / uUUT, AUp / uDev, cor) -
                    bivariateNormalCDF(LLow / uUUT, ALow / uDev, cor);

      const term2 = bivariateNormalCDF(-LUp / uUUT, -ALow / uDev, cor) -
                    bivariateNormalCDF(-LUp / uUUT, -AUp / uDev, cor);
      return [term1 + term2, term1, term2];
    }

    function PFALL(uUUT, uCal, avg, LLow, ALow) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = vbNormSDist((LLow - avg) / uUUT);
      const term2 = bivariateNormalCDF((LLow - avg) / uUUT, (ALow - avg) / uDev, cor);

      return [term1 - term2, term1, term2];
    }

    function PFAUL(uUUT, uCal, avg, LUp, AUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = vbNormSDist((LUp - avg) / uUUT);
      const term2 = bivariateNormalCDF(-(LUp - avg) / uUUT, -(AUp - avg) / uDev, cor);

      return [1 - term1 - term2, term1, term2];
    }

    function PFR(uUUT, uCal, LLow, LUp, ALow, AUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = bivariateNormalCDF(LUp / uUUT, ALow / uDev, cor) -
                    bivariateNormalCDF(LLow / uUUT, ALow / uDev, cor);

      const term2 = bivariateNormalCDF(-LLow / uUUT, -AUp / uDev, cor) -
                    bivariateNormalCDF(-LUp / uUUT, -AUp / uDev, cor);

      return [term1 + term2, term1, term2];
    }

    function PFRLL(uUUT, uCal, avg, LLow, ALow) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = vbNormSDist((LLow - avg) / uUUT);
      const term2 = bivariateNormalCDF(-(LLow - avg) / uUUT, -(ALow - avg) / uDev, cor);

      return [1 - term1 - term2, term1, term2];
    }

    function PFRUL(uUUT, uCal, avg, LUp, AUp) {
      const uDev = Math.sqrt(Math.pow(uUUT, 2) + Math.pow(uCal, 2));
      const cor = uUUT / uDev;

      const term1 = vbNormSDist((LUp - avg) / uUUT);
      const term2 = bivariateNormalCDF((LUp - avg) / uUUT, (AUp - avg) / uDev, cor);

      return [term1 - term2, term1, term2];
    }

    function RInAccLLGBMult(req, REOP, uCal, avg, LLow) {
      const precision = 0.00001;
      let GBMult = 1;
      let ALow = LLow;

      let uUUT = uutUncLL(REOP, uCal, avg, ALow);
      let [EstPFA] = PFALL(uUUT, uCal, avg, LLow, ALow);

      if (EstPFA > req) {
        let change = 0.05;

        do {
          GBMult -= change;
          ALow = avg - (avg - LLow) * GBMult;
          uUUT = uutUncLL(REOP, uCal, avg, ALow);
          [EstPFA] = PFALL(uUUT, uCal, avg, LLow, ALow);
        } while (EstPFA > req);

        do {
          change /= 2;
          GBMult += EstPFA < req ? change : -change;
          ALow = avg - (avg - LLow) * GBMult;
          uUUT = uutUncLL(REOP, uCal, avg, ALow);
          [EstPFA] = PFALL(uUUT, uCal, avg, LLow, ALow);
        } while (!(EstPFA >= req - precision && EstPFA <= req));
      }

      return GBMult;
    }

    function gbLowMgr(rngReq, rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel) {
      const isNotNumeric = val => isNaN(parseFloat(val));
      const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel] = getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel);

      const dReq = vbaNbrValidate(rngReq);

      let dUUTUnc, GBMult;

      if (sRiskType === "NotThreshold") {
          dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
          if (dUUTUnc <= 0) {
              return "";
          } else {
              GBMult = pfaGBMult(dReq, dUUTUnc, dMeasUnc, dTolLow, dTolUp);
              return dNominal + dTolLow * GBMult;
          }
      } else if (sRiskType === "LowThreshold") {
          dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dTolLow);
          if (dUUTUnc <= 0) {
              return "";
          } else {
              GBMult = pfaLLGBMult(dReq, dUUTUnc, dMeasUnc, dAvg, dTolLow);
              return dAvg - (dAvg - dTolLow) * GBMult;
          }
      } else if (sRiskType === "AltLowThreshold") {
          return dTolLow - PHIDInv(dReq) * dMeasUnc;
      } else {
          return "";
      }
    }
    
    function gbUpMgr(rngReq, rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel) {
      const isNotNumeric = val => isNaN(parseFloat(val));
      const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel] = getRiskInfo(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel);

      const dReq = vbaNbrValidate(rngReq);

      let dUUTUnc, GBMult;

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dTolLow, dTolUp);
        if (dUUTUnc <= 0) {
          return "";
        } else {
          GBMult = pfaGBMult(dReq, dUUTUnc, dMeasUnc, dTolLow, dTolUp);
          return dTolUp * GBMult + dNominal;
        }
      } else if (sRiskType === "UpThreshold") {
        dUUTUnc = UUTuncUL(dMeasRel, dMeasUnc, dAvg, dTolUp);
        if (dUUTUnc <= 0) {
          return "";
        } else {
          GBMult = PFAULGBMult(dReq, dUUTUnc, dMeasUnc, dAvg, dTolUp);
          return (dTolUp - dAvg) * GBMult + dAvg;
        }
      } else if (sRiskType === "AltUpThreshold") {
        return dTolUp + PHIDInv(dReq) * dMeasUnc;
      } else {
        return "";
      }
    }

    function GBMultMgr(rngReq, rngNominal, rngAvg, rngTolLow, rngTolUp, rngGBLow, rngGBUp) {
      const isNotNumeric = val => isNaN(parseFloat(val));
      const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);

      const [sRiskType, dNominal, dAvg, dTolLow, dTolUp] = getTolInfo(rngNominal, rngAvg, rngTolLow, rngTolUp);

      const dReq = vbaNbrValidate(rngReq);
      const dGBLow = vbaNbrValidate(rngGBLow);
      const dGBUp = vbaNbrValidate(rngGBUp);

      if (dGBLow === 0 && dGBUp === 0) {
        return "";
      }

      let GBMult;

      if (sRiskType === "NotThreshold") {
        GBMult = Math.abs(dTolUp) > 0
          ? Math.abs(dGBUp - dNominal) / Math.abs(dTolUp)
          : "";
      } else if (sRiskType === "UpThreshold") {
        GBMult = Math.abs(dTolUp - dAvg) > 0
          ? Math.abs(dGBUp - dAvg) / Math.abs(dTolUp - dAvg)
          : "";
      } else if (sRiskType === "LowThreshold") {
        GBMult = Math.abs(dAvg - dTolLow) > 0
          ? Math.abs(dAvg - dGBLow) / Math.abs(dAvg - dTolLow)
          : "";
      } else {
        GBMult = "";
      }

      return GBMult;
    }

    function PFAwGBMgr(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel, rngGBLow, rngGBUp) {
      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = GetGBInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel,
        rngGBLow,
        rngGBUp
      );

      if (dGBLow === 0 && dGBUp === 0) {
        return "";
      }

      let dUUTUnc;

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dGBLow, dGBUp);
        if (dUUTUnc <= 0) return "";
        return PFA(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dGBLow, dGBUp);
      }

      if (sRiskType === "UpThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dGBUp);
        if (dUUTUnc <= 0) return "";
        return PFAUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dGBUp);
      }

      if (sRiskType === "LowThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dGBLow);
        if (dUUTUnc <= 0) return "";
        return PFALL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dGBLow);
      }

      if (sRiskType === "AltUpThreshold") {
        return PHID((dGBUp - dTolUp) / dMeasUnc);
      }

      if (sRiskType === "AltLowThreshold") {
        return PHID((dTolLow - dGBLow) / dMeasUnc);
      }

      return "";
    }

    function PFRwGBMgr(rngNominal, rngAvg, rngTolLow, rngTolUp, rngMeasUnc, rngMeasRel, rngGBLow, rngGBUp) {
      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = GetGBInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel,
        rngGBLow,
        rngGBUp
      );

      if (dGBLow === 0 && dGBUp === 0) {
        return "";
      }

      let dUUTUnc;

      if (sRiskType === "NotThreshold") {
        dUUTUnc = uutUnc(dMeasRel, dMeasUnc, dGBLow, dGBUp);
        if (dUUTUnc <= 0) return "";
        return PFR(dUUTUnc, dMeasUnc, dTolLow, dTolUp, dGBLow, dGBUp);
      }

      if (sRiskType === "UpThreshold") {
        dUUTUnc = UUTuncUL(dMeasRel, dMeasUnc, dAvg, dGBUp);
        if (dUUTUnc <= 0) return "";
        return PFRUL(dUUTUnc, dMeasUnc, dAvg, dTolUp, dGBUp);
      }

      if (sRiskType === "LowThreshold") {
        dUUTUnc = uutUncLL(dMeasRel, dMeasUnc, dAvg, dGBLow);
        if (dUUTUnc <= 0) return "";
        return PFRLL(dUUTUnc, dMeasUnc, dAvg, dTolLow, dGBLow);
      }

      return "";
    }

    function CalIntwGBMgr(
      rngNominal,
      rngAvg,
      rngTolLow,
      rngTolUp,
      rngMeasUnc,
      rngReqRel,
      rngMeasRel,
      rngGBLow,
      rngGBUp,
      rngTUR,
      rngReqTUR,
      rngInt
    ) {
      const isNotNumeric = val => isNaN(parseFloat(val));
      const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = GetGBInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel,
        rngGBLow,
        rngGBUp
      );

      const dReqRel = vbaNbrValidate(rngReqRel);
      const dTUR = vbaNbrValidate(rngTUR);
      const dReqTur = vbaNbrValidate(rngReqTUR);
      const dInt = vbaNbrValidate(rngInt);

      if (dGBLow === 0 && dGBUp === 0) {
        return "";
      }

      if (
        sRiskType !== "NotThreshold" &&
        sRiskType !== "UpThreshold" &&
        sRiskType !== "LowThreshold"
      ) {
        return "";
      }

      let dObsRel;
      if (dReqTur > 0) {
        const dTstRUnc = dMeasUnc * dTUR / dReqTur;
        dObsRel = ObsRel(sRiskType, dTstRUnc, dMeasRel,dAvg,dTolLow,dTolUp,dMeasUnc);
      } else {
        dObsRel = dMeasRel;
      }

      const dPredRel = PredRel(sRiskType, dMeasUnc, dReqRel,dAvg,dTolLow,dTolUp,dMeasUnc,dGBLow,dGBUp);
      const dPredInt = Math.log(dPredRel) / Math.log(dObsRel) * dInt;

      return dPredInt > 0 ? dPredInt : "";
    }

    function ObsRel(sRiskType, dCalUnc, dMeasRel, dAvg,dTolLow,dTolUp,dMeasUnc) {
      let dBiasUnc, dDevUnc;

      if (sRiskType === "NotThreshold") {
        dBiasUnc = uutUnc(dMeasRel, dCalUnc, dTolLow, dTolUp);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return vbNormSDist(dTolUp / dDevUnc) - vbNormSDist(dTolLow / dDevUnc);
      }

      if (sRiskType === "UpThreshold") {
        dBiasUnc = UUTuncUL(dMeasRel, dCalUnc, dAvg, dTolUp);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return vbNormSDist((dTolUp - dAvg) / dDevUnc);
      }

      if (sRiskType === "LowThreshold") {
        dBiasUnc = uutUncLL(dMeasRel, dCalUnc, dAvg, dTolLow);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return 1 - vbNormSDist((dTolLow - dAvg) / dDevUnc);
      }

      return 0;
    }

    function PredRel(sRiskType, dCalUnc, dMeasRel,dAvg,dTolLow,dTolUp,dMeasUnc,dGBLow,dGBUp) {
      let dBiasUnc, dDevUnc;

      if (sRiskType === "NotThreshold") {
        dBiasUnc = uutUnc(dMeasRel, dCalUnc, dGBLow, dGBUp);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return vbNormSDist(dTolUp / dDevUnc) - vbNormSDist(dTolLow / dDevUnc);
      }

      if (sRiskType === "UpThreshold") {
        dBiasUnc = UUTuncUL(dMeasRel, dCalUnc, dAvg, dGBUp);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return vbNormSDist((dTolUp - dAvg) / dDevUnc);
      }

      if (sRiskType === "LowThreshold") {
        dBiasUnc = uutUncLL(dMeasRel, dCalUnc, dAvg, dGBLow);
        dDevUnc = Math.sqrt(Math.pow(dMeasUnc, 2) + Math.pow(dBiasUnc, 2));
        return 1 - vbNormSDist((dTolLow - dAvg) / dDevUnc);
      }

      return 0;
    }

    function CalIntMgr(
      rngNominal,
      rngAvg,
      rngTolLow,
      rngTolUp,
      rngMeasUnc,
      rngReqRel,
      rngMeasRel,
      rngTUR,
      rngReqTUR,
      rngInt,
      rngReqPFA
    ) {

      const isNotNumeric = val => isNaN(parseFloat(val));
      const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = getRiskInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel
      );

      const dTUR = vbaNbrValidate(rngTUR);
      const dReqTur = vbaNbrValidate(rngReqTUR);
      const dInt = vbaNbrValidate(rngInt);
      const dReqRel = vbaNbrValidate(rngReqRel);
      const dReqPFA = vbaNbrValidate(rngReqPFA);

      let dObsRel;
      if (dReqTur > 0) {
        const dTstRUnc = dMeasUnc * dTUR / dReqTur;
        dObsRel = ObsRel(sRiskType, dTstRUnc, dMeasRel, dAvg,dTolLow,dTolUp,dMeasUnc);
      } else {
        dObsRel = dMeasRel;
      }

      let [dPFA] = PFAIter(sRiskType, dObsRel,dAvg,dTolLow,dTolUp,dMeasUnc);
      if (dPFA === -1) return "";

      if (dPFA <= dReqPFA) {
        return Math.log(dReqRel) / Math.log(dObsRel) * dInt;
      }

      let dPredRel = 1 - Math.abs(1 - dObsRel) / 2;
      [dPFA] = PFAIter(sRiskType, dPredRel,dAvg,dTolLow,dTolUp,dMeasUnc);

      let dChg = dPFA < dReqPFA
        ? -Math.abs(dPredRel - dObsRel)
        : Math.abs(dPredRel - dObsRel);

      let lIter = 1;
      while (Math.abs(dPFA - dReqPFA) >= 0.00001 && lIter < 20) {
        dChg = dPFA < dReqPFA ? -Math.abs(dChg) / 2 : Math.abs(dChg) / 2;
        dPredRel += dChg;
        [dPFA] = PFAIter(sRiskType, dPredRel,dAvg,dTolLow,dTolUp,dMeasUnc);
        lIter++;
      }

      if (dPredRel < dReqRel) {
        dPredRel = dReqRel;
        [dPFA] = PFAIter(sRiskType, dPredRel,dAvg,dTolLow,dTolUp,dMeasUnc);
      }

      return dPFA === -1 ? "" : Math.log(dPredRel) / Math.log(dObsRel) * dInt;
    }

    function CalRelMgr(
      rngNominal,
      rngAvg,
      rngTolLow,
      rngTolUp,
      rngMeasUnc,
      rngReqRel,
      rngMeasRel,
      rngTUR,
      rngReqTUR,
      rngInt,
      rngReqPFA
    ) {
      const isNotNumeric = val => isNaN(parseFloat(val));
      const vbaNbrValidate = val => isNotNumeric(val) ? 0 : parseFloat(val);

      const [sRiskType,dNominal,dAvg,dTolLow,dTolUp,dMeasUnc,dMeasRel,dGBLow,dGBUp] = getRiskInfo(
        rngNominal,
        rngAvg,
        rngTolLow,
        rngTolUp,
        rngMeasUnc,
        rngMeasRel
      );

      const dTUR = vbaNbrValidate(rngTUR);
      const dReqTur = vbaNbrValidate(rngReqTUR);
      const dInt = vbaNbrValidate(rngInt);
      const dReqRel = vbaNbrValidate(rngReqRel);
      const dReqPFA = vbaNbrValidate(rngReqPFA);

      let dObsRel;
      if (dReqTur > 0) {
        const dTstRUnc = dMeasUnc * dTUR / dReqTur;
        dObsRel = ObsRel(sRiskType, dTstRUnc, dMeasRel, dAvg,dTolLow,dTolUp,dMeasUnc);
      } else {
        dObsRel = dMeasRel;
      }

      let [dPFA] = PFAIter(sRiskType, dObsRel);
      if (dPFA === -1) return "";

      if (dPFA <= dReqPFA) return dReqRel;

      let dPredRel = 1 - Math.abs(1 - dObsRel) / 2;
      [dPFA] = PFAIter(sRiskType, dPredRel);

      let dChg = dPFA < dReqPFA
        ? -Math.abs(dPredRel - dObsRel)
        : Math.abs(dPredRel - dObsRel);

      let lIter = 1;
      while (Math.abs(dPFA - dReqPFA) >= 0.00001 && lIter < 20) {
        dChg = dPFA < dReqPFA ? -Math.abs(dChg) / 2 : Math.abs(dChg) / 2;
        dPredRel += dChg;
        [dPFA] = PFAIter(sRiskType, dPredRel);
        lIter++;
      }

      if (dPredRel < dReqRel) {
        dPredRel = dReqRel;
        [dPFA] = PFAIter(sRiskType, dPredRel);
      }

      return dPFA === -1 ? "" : dPredRel;
    }

    function resDwn(dVal, dRes) {
      if (dRes <= 0) {
        return dVal;
      }
      if (dVal === 0) {
        return dVal;
      }
      let x = Math.floor(dVal / dRes) * dRes;
      const dZero = 0.000001;
      if (Math.abs(Math.trunc(dVal / dRes) - (dVal / dRes)) > dZero) {
        if (dVal > 0) {
          x = x + dRes;
        }
      }
      return x;
    }

    function resUp(dVal, dRes) {
      if (dRes <= 0) {
        return dVal;
      }
      if (dVal === 0) {
        return dVal;
      }
      let x = Math.trunc(dVal / dRes) * dRes;
      const dZero = 0.000001;
      if (Math.abs(Math.trunc(dVal / dRes) - (dVal / dRes)) > dZero) {
        if (dVal < 0) {
          x = x - dRes;
        }
      }
      return x;
    }

    let gbLow = resDwn(gbLowMgr(pfaRequired, uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability),parseFloat(testPointData.uutTolerance.measuringResolution));
    let gbHigh = resUp(gbUpMgr(pfaRequired, uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability),parseFloat(testPointData.uutTolerance.measuringResolution));
    let gbMult = GBMultMgr(pfaRequired, uutNominal.value, 0, LLow, LUp, gbLow, gbHigh);
    let [gbPFA, gbPFAT1, gbPFAT2] = PFAwGBMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, gbLow, gbHigh);
    let [gbPFR, gbPFRT1, gbPFRT2] = PFRwGBMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, gbLow, gbHigh);
    let gbCalInt = CalIntwGBMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, measRelCalc, gbLow, gbHigh, turResult, turNeeded, calInt);
    let nogbCalInt = CalIntMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, measRelCalc, turResult, turNeeded, calInt, pfaRequired);
    let nogbMeasRel = CalRelMgr(uutNominal.value, 0, LLow, LUp, calcResults.combined_uncertainty_absolute_base, reliability, measRelCalc, turResult, turNeeded, calInt, pfaRequired);
    return {GBLOW: gbLow, GBUP: gbHigh, GBMULT: gbMult * 100, GBPFA: gbPFA * 100, GBPFAT1: gbPFAT1 * 100, GBPFAT2: gbPFAT2 * 100, GBPFR: gbPFR * 100, GBPFRT1: gbPFRT1 * 100, GBPFRT2: gbPFRT2 * 100, GBCALINT: gbCalInt, NOGBCALINT: nogbCalInt, NOGBMEASREL: nogbMeasRel * 100};
  };