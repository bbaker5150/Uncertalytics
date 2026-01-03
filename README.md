# Uncertalytics

**Uncertalytics** is a professional-grade Measurement Uncertainty Analysis and Risk Assessment tool designed for metrology and calibration laboratories. Built on a modern technology stack (Electron, React 19, Vite), it provides a comprehensive suite for calculating uncertainty budgets, analyzing risk (PFA/PFR), and managing instrument specifications with precision and ease.

<p align="center">
  <img src="public/icon.png" alt="Uncertalytics Logo" width="120" />
</p>

## 🚀 Key Features

### 📊 Advanced Uncertainty Analysis

- **Uncertainty Budget Tables**: Complete breakdown of uncertainty components with support for various distributions (Normal, Rectangular, U-Shaped, etc.).
- **Auto-Calculations**: detailed sensitivity coefficients, degrees of freedom (Welch-Satterthwaite), and expanded uncertainty ($k=2$, $k=3$, custom).
- **Math Engine**: Powered by `mathjs` and `simple-statistics` for high-precision scientific computing.

### 🛡️ Risk Assessment & Mitigation

- **Risk Dashboards**: Visualize Probability of False Accept (PFA) and Probability of False Reject (PFR) in real-time.
- **Guard Banding**: Apply and visualize guard bands (ANSI/NCSL Z540.3 Method 5 & 6) to mitigate decision risk.
- **Monte Carlo Simulation**: (Planned/Integration ready) for validating GUM budgets.

### 🛠️ Instrument & Asset Management

- **Instrument Builder**: Create and edit complex instrument specifications with custom ranges and tolerance functions.
- **TMDE Management**: distinct handling of Test and Measurement Diagnostic Equipment (TMDE) vs. Unit Under Test (UUT).
- **Database Architecture**: Local database management for portable and secure data storage.

### 🎨 Modern & Responsive UI/UX

- **Theming Engine**: Switch between professional **Default**, data-centric **Orbital** (Dark Mode), and high-contrast **Cyberpunk** themes.
- **Visualizations**: Interactive Scatterplots, Contribution Charts, and Histograms using `recharts` and `plotly.js`.
- **Session Management**: Export/Import full analysis sessions to PDF/JSON for reporting and archiving.

---

## 💻 Technology Stack

Uncertalytics is built with cutting-edge web and desktop technologies:

- **Core**: [Electron](https://www.electronjs.org/), [React 19](https://react.dev/), [Vite](https://vitejs.dev/)
- **Visualizations**: [Plotly.js](https://plotly.com/javascript/), [Recharts](https://recharts.org/)
- **Math & Science**: [Math.js](https://mathjs.org/), [Simple Statistics](https://simple-statistics.github.io/)
- **PDF Generation**: [PDF-Lib](https://pdf-lib.js.org/)
- **Testing**: [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/)

---

## 🛠️ Installation & Development

### Prerequisites

- **Node.js**: (Version 18+ recommended)
- **npm**: (Included with Node.js)

### fast setup

1.  **Clone the repository**

    ```bash
    git clone https://github.com/your-org/uncertalytics.git
    cd uncertalytics
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Run in Development Mode** (Recommended)
    This runs React in a browser tab AND the Electron container simultaneously with hot-reloading.

    ```bash
    npm run electron:dev
    ```

4.  **Build for Production**
    Creates a distributable installer in the `release/` directory.
    ```bash
    npm run electron:build
    ```

### Other Scripts

- `npm start`: Run the Vite dev server (Browser only).
- `npm test`: Run unit tests with Vitest.
- `npm run coverage`: Generate test coverage report.

---

## 📂 Project Structure

```
Uncertalytics/
├── electron/           # Main process code (Electron)
├── src/
│   ├── components/     # Reusable UI components
│   ├── features/       # Core domain logic (Analysis, Instruments, etc.)
│   │   ├── analysis/   # Uncertainty & Risk engines
│   │   ├── instruments/# Instrument Builder & Management
│   │   └── session/    # Session state & persistence
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Math helpers, File I/O, Formatters
│   └── App.jsx         # Main Application Entry
└── ...
```

---

## 📝 License

Proprietary Software. All rights reserved.
