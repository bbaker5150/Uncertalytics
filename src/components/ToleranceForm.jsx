import React, { useMemo, useEffect, useState, useRef } from "react";
import Select from "react-select";
import {
  unitSystem,
  errorDistributions,
} from "../utils/uncertaintyMath";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt, faPlus } from "@fortawesome/free-solid-svg-icons";

// --- Configuration for Unit Grouping ---
const unitCategories = {
  Voltage: ["V", "mV", "uV", "kV", "nV", "TV"],
  Current: ["A", "mA", "uA", "nA", "pA", "kA"],
  Resistance: ["Ohm", "kOhm", "MOhm", "mOhm", "GOhm", "TOhm"],
  Capacitance: ["F", "uF", "nF", "pF", "mF"],
  Inductance: ["H", "mH", "uH"],
  Frequency: ["Hz", "kHz", "MHz", "GHz", "THz"],
  Time: ["s", "ms", "us", "ns", "ps", "min", "hr", "day"],
  Temperature: ["Cel", "degF", "degC", "K"],
  Pressure: ["Pa", "kPa", "MPa", "psi", "bar", "mbar", "torr", "inHg"],
  Length: ["m", "cm", "mm", "um", "nm", "km", "in", "ft", "yd", "mi"],
  Mass: ["kg", "g", "mg", "ug", "lb", "oz"],
  Power: ["W", "mW", "kW", "MW", "dBm"],
};

// Helper to transform flat unit list into React-Select Grouped Options
const getCategorizedUnitOptions = (allUnits, referenceUnit) => {
  const options = [];
  const usedUnits = new Set();

  // 1. Prioritize Reference Unit (Smart Context)
  if (referenceUnit && allUnits.includes(referenceUnit)) {
    let refCategory = "Suggested";
    for (const [cat, units] of Object.entries(unitCategories)) {
      if (units.includes(referenceUnit)) {
        refCategory = cat;
        break;
      }
    }

    const categoryUnits = unitCategories[refCategory] || [referenceUnit];
    const prioritizedOptions = categoryUnits
      .filter((u) => allUnits.includes(u))
      .map((u) => {
        usedUnits.add(u);
        return { value: u, label: u };
      });

    options.push({ label: refCategory, options: prioritizedOptions });
  }

  // 2. Add remaining categories
  Object.entries(unitCategories).forEach(([label, units]) => {
    if (options.some((opt) => opt.label === label)) return;

    const groupOptions = units
      .filter((u) => allUnits.includes(u) && !usedUnits.has(u))
      .map((u) => {
        usedUnits.add(u);
        return { value: u, label: u };
      });

    if (groupOptions.length > 0) {
      options.push({ label, options: groupOptions });
    }
  });

  // 3. Catch-all for leftovers
  const leftovers = allUnits
    .filter((u) => !usedUnits.has(u) && !["%", "ppm", "dB", "ppb"].includes(u))
    .map((u) => ({ value: u, label: u }));

  if (leftovers.length > 0) {
    options.push({ label: "Other", options: leftovers });
  }

  return options;
};

// --- FIX: Restore minimal JS styles for Portal Z-Index ---
const portalStyle = {
  menuPortal: (base) => ({
    ...base,
    zIndex: 99999,
  }),
  menu: (base) => ({
    ...base,
    zIndex: 99999,
  }),
};

// --- Definitions ---
const componentDefinitions = {
  reading: {
    label: "Reading (e.g., % of Value)",
    defaultState: {
      high: "",
      low: "",
      unit: "%",
      distribution: "1.960",
      symmetric: true,
    },
  },
  readings_iv: {
    label: "Reading (IV)",
    defaultState: {
      high: "",
      low: "",
      unit: "", // Logic will auto-populate this from UUT
      distribution: "1.960",
      symmetric: true,
    },
  },
  range: {
    label: "Range (e.g., % of Full Scale)",
    defaultState: {
      value: "",
      high: "",
      low: "",
      unit: "%",
      distribution: "1.960",
      symmetric: true,
    },
  },
  floor: {
    label: "Floor (Absolute Value)",
    defaultState: {
      high: "",
      low: "",
      unit: "",
      distribution: "1.960",
      symmetric: true,
    },
  },
  db: {
    label: "dB Component",
    defaultState: {
      high: "",
      low: "",
      multiplier: 20,
      ref: 1,
      distribution: "1.960",
      symmetric: true,
    },
  },
};

const ToleranceForm = ({
  tolerance,
  setTolerance,
  isUUT,
  referencePoint,
  hideDistribution = false,
}) => {
  const [isAddComponentVisible, setAddComponentVisible] = useState(false);
  const addComponentRef = useRef(null);

  const allUnits = useMemo(() => Object.keys(unitSystem.units), []);

  const physicalUnitOptions = useMemo(() => {
    return getCategorizedUnitOptions(allUnits, referencePoint?.unit);
  }, [allUnits, referencePoint]);

  // UPDATED: Explicitly include PPB in the ratio options
  const ratioUnitOptions = useMemo(() => {
    return [
      { value: "%", label: "%" },
      { value: "ppm", label: "ppm" },
      { value: "ppb", label: "ppb" },
    ];
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        addComponentRef.current &&
        !addComponentRef.current.contains(event.target)
      ) {
        setAddComponentVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Auto-Update Units Hook ---
  useEffect(() => {
    if (!referencePoint?.unit) return;

    setTolerance((prev) => {
      let updated = false;
      const next = { ...prev };

      // Update Floor Units
      if (next.floor && !next.floor.unit) {
        next.floor = { ...next.floor, unit: referencePoint.unit };
        updated = true;
      }

      // Update Reading (IV) Units (NEW LOGIC)
      if (next.readings_iv && !next.readings_iv.unit) {
        next.readings_iv = { ...next.readings_iv, unit: referencePoint.unit };
        updated = true;
      }

      if (isUUT && !next.measuringResolutionUnit) {
        next.measuringResolutionUnit = referencePoint.unit;
        updated = true;
      }

      return updated ? next : prev;
    });
  }, [
    referencePoint,
    isUUT,
    setTolerance,
    tolerance.floor,
    tolerance.readings_iv, // Add dependency
    tolerance.measuringResolutionUnit,
  ]);

  const handleChange = (e) => {
    const { name, value, checked, dataset } = e.target;

    if (dataset.type === "misc") {
      setTolerance((prev) => ({ ...prev, [name]: value }));
      return;
    }

    const { field, componentKey } = dataset;

    setTolerance((prev) => {
      const newTol = { ...prev };
      const comp = { ...newTol[componentKey] };
      let newHigh = comp.high;
      let newLow = comp.low;
      let newSymmetric = comp.symmetric;

      if (field === "symmetric") newSymmetric = checked;
      else if (field === "high") newHigh = value;
      else if (field === "low") newLow = value;
      else comp[field] = value;

      if (newSymmetric) {
        if (field === "high" || (field === "symmetric" && newHigh)) {
          const highVal = parseFloat(newHigh);
          newLow = !isNaN(highVal) ? String(-highVal) : "";
        }
      }

      comp.high = newHigh;
      comp.low = newLow;
      comp.symmetric = newSymmetric;
      newTol[componentKey] = comp;
      return newTol;
    });
  };

  const handleSelectChange = (
    selectedOption,
    field,
    componentKey,
    isMisc = false
  ) => {
    const value = selectedOption ? selectedOption.value : "";

    const fakeEvent = {
      target: {
        name: isMisc ? field : undefined,
        value: value,
        dataset: {
          type: isMisc ? "misc" : undefined,
          field: field,
          componentKey: componentKey,
        },
      },
    };

    handleChange(fakeEvent);
  };

  const handleAddComponent = (componentKey) => {
    if (componentKey && !tolerance[componentKey]) {
      const newState = { ...componentDefinitions[componentKey].defaultState };

      if (!newState.unit) {
        if (referencePoint?.unit) {
          newState.unit = referencePoint.unit;
        } else if (componentKey === "floor" || componentKey === "readings_iv") {
          // Fallback if no reference point exists (grab first non-ratio unit)
          const validUnits = allUnits.filter(
            (u) => !["%", "ppm", "dB", "ppb"].includes(u)
          );
          if (validUnits.length > 0) {
            newState.unit = validUnits[0];
          }
        }
      }

      setTolerance((prev) => ({
        ...prev,
        [componentKey]: newState,
      }));
    }
    setAddComponentVisible(false);
  };

  const handleRemoveComponent = (key) => {
    setTolerance((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  };

  const renderComponentCard = (key) => {
    const componentData = tolerance[key];
    if (!componentData) return null;

    let content = null;
    const distributionOptions = errorDistributions.filter(
      (d) => d.label !== "Std. Uncertainty"
    );

    const commonFields = (
      <>
        <div className="input-group-asymmetric">
          <div>
            <label>Lower Limit</label>
            <input
              type="number"
              step="any"
              data-component-key={key}
              data-field="low"
              value={componentData.low || ""}
              onChange={handleChange}
              disabled={componentData.symmetric}
              placeholder="- value"
            />
          </div>
          <div>
            <label>Upper Limit</label>
            <input
              type="number"
              step="any"
              data-component-key={key}
              data-field="high"
              value={componentData.high || ""}
              onChange={handleChange}
              placeholder="+ value"
            />
          </div>
        </div>
        <div className="toggle-switch-container" style={{ margin: "15px 0" }}>
          <input
            type="checkbox"
            id={`symmetric_${key}_${tolerance.id || "new"}`}
            data-component-key={key}
            data-field="symmetric"
            className="toggle-switch-checkbox"
            checked={!!componentData.symmetric}
            onChange={handleChange}
          />
          <label
            className="toggle-switch-label"
            htmlFor={`symmetric_${key}_${tolerance.id || "new"}`}
          >
            <span className="toggle-switch-switch" />
          </label>
          <label
            htmlFor={`symmetric_${key}_${tolerance.id || "new"}`}
            className="toggle-option-label"
          >
            Symmetric Limits
          </label>
        </div>
      </>
    );

    const distributionSelect = !hideDistribution ? (
      <>
        <label>Distribution</label>
        <select
          data-component-key={key}
          data-field="distribution"
          value={componentData.distribution || "1.960"}
          onChange={handleChange}
        >
          {distributionOptions.map((dist) => (
            <option key={dist.value} value={dist.value}>
              {dist.label} (k={dist.value})
            </option>
          ))}
        </select>
      </>
    ) : null;

    const renderUnitSelect = (options) => {
      const flatOptions = options.flatMap((o) => (o.options ? o.options : o));
      const selectedValue = flatOptions.find(
        (opt) => opt.value === componentData.unit
      );

      return (
        <Select
          value={selectedValue || null}
          onChange={(opt) => handleSelectChange(opt, "unit", key)}
          options={options}
          className="react-select-container"
          classNamePrefix="react-select"
          placeholder="Select..."
          isSearchable={true}
          menuPortalTarget={document.body}
          menuPosition="fixed"
          styles={portalStyle}
        />
      );
    };

    switch (key) {
      case "reading":
        content = (
          <div className="config-stack">
            {commonFields}
            <label>Units</label>
            {renderUnitSelect(ratioUnitOptions)}
            {distributionSelect}
          </div>
        );
        break;
      case "readings_iv":
        // Behaves exactly like Floor: Physical Units, No Value input
        content = (
          <div className="config-stack">
            {commonFields}
            <label>Units</label>
            {renderUnitSelect(physicalUnitOptions)}
            {distributionSelect}
          </div>
        );
        break;
      case "range":
        content = (
          <div className="config-stack">
            <label>Range (FS) Value</label>
            <input
              type="number"
              step="any"
              data-component-key="range"
              data-field="value"
              value={componentData.value || ""}
              onChange={handleChange}
              placeholder="e.g., 100"
            />
            {commonFields}
            <label>Units</label>
            {renderUnitSelect(ratioUnitOptions)}
            {distributionSelect}
          </div>
        );
        break;
      case "floor":
        content = (
          <div className="config-stack">
            {commonFields}
            <label>Units</label>
            {renderUnitSelect(physicalUnitOptions)}
            {distributionSelect}
          </div>
        );
        break;
      case "db":
        content = (
          <div className="config-stack">
            {commonFields}
            <label>dB Equation Multiplier</label>
            <input
              type="number"
              step="any"
              data-component-key="db"
              data-field="multiplier"
              value={componentData.multiplier || 20}
              onChange={handleChange}
            />
            <label>dB Reference Value</label>
            <input
              type="number"
              step="any"
              data-component-key="db"
              data-field="ref"
              value={componentData.ref || 1}
              onChange={handleChange}
            />
            {distributionSelect}
          </div>
        );
        break;
      default:
        return null;
    }

    return (
      <div className="component-card" key={key}>
        <div className="component-header">
          <h5>{componentDefinitions[key].label}</h5>
          <button
            onClick={() => handleRemoveComponent(key)}
            className="remove-component-btn"
            title="Remove component"
          >
            <FontAwesomeIcon icon={faTrashAlt} />
          </button>
        </div>
        <div className="component-body">{content}</div>
      </div>
    );
  };

  const addedComponents = Object.keys(tolerance).filter(
    (key) => componentDefinitions[key]
  );
  const availableComponents = Object.keys(componentDefinitions).filter(
    (key) => !tolerance[key]
  );

  return (
    <>
      <div className="components-container">
        {addedComponents.length > 0 ? (
          addedComponents.map((key) => renderComponentCard(key))
        ) : (
          <div
            className="placeholder-content"
            style={{
              minHeight: "100px",
              margin: "10px 0",
              backgroundColor: "transparent",
            }}
          >
            <p>No tolerance components added.</p>
          </div>
        )}
      </div>

      <div className="add-component-wrapper" ref={addComponentRef}>
        {availableComponents.length > 0 && (
          <button
            className="add-component-button"
            onClick={() => setAddComponentVisible((prev) => !prev)}
            title="Add new tolerance component"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Add Component</span>
          </button>
        )}

        {isAddComponentVisible && availableComponents.length > 0 && (
          <div className="add-component-dropdown">
            <ul>
              {availableComponents.map((key) => (
                <li key={key} onClick={() => handleAddComponent(key)}>
                  {componentDefinitions[key].label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isUUT && (
        <div
          className="form-section"
          style={{
            marginTop: "20px",
            borderTop: "1px solid var(--border-color)",
            paddingTop: "20px",
          }}
        >
          <label>Measuring Resolution (Least Significant Digit)</label>
          <div
            className="input-with-unit"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px",
              gap: "10px",
            }}
          >
            <input
              type="number"
              step="any"
              name="measuringResolution"
              data-type="misc"
              value={tolerance.measuringResolution || ""}
              onChange={handleChange}
              placeholder="e.g., 1"
              style={{ width: "100%" }}
            />

            {/* Resolution Unit Selector */}
            <Select
              value={
                physicalUnitOptions
                  .flatMap((g) => (g.options ? g.options : g))
                  .find(
                    (opt) => opt.value === tolerance.measuringResolutionUnit
                  ) || null
              }
              onChange={(opt) =>
                handleSelectChange(opt, "measuringResolutionUnit", null, true)
              }
              options={physicalUnitOptions}
              className="react-select-container"
              classNamePrefix="react-select"
              placeholder="Unit"
              isSearchable={true}
              menuPortalTarget={document.body}
              menuPosition="fixed"
              styles={portalStyle}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ToleranceForm;