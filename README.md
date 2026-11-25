# ClariPath LIMS

**ClariPath LIMS** is a modern, browser-based Clinical Laboratory Information & Management System designed for diagnostic clinics, pathology centers, and outpatient labs. It unifies patient registration, diagnostic test catalog pricing, order billing, specimen workflow tracking, structured result entry with automatic reference-range flagging, printable receipts and clinical lab reports, and persistent offline-first local storage with full JSON/CSV backup import and export.

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Architecture & Persistence](#architecture--persistence)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Getting Started](#getting-started)
7. [Available Scripts](#available-scripts)
8. [Core Workflows](#core-workflows)
9. [Backup & Data Schema](#backup--data-schema)
10. [Printing Support](#printing-support)
11. [Customization & Settings](#customization--settings)
12. [Author](#author)
13. [License](#license)

---

## Overview

Diagnostic laboratories require fast front-desk registration, accurate multi-parameter result reporting, transparent billing, and dependable record retention without complex server infrastructure. **ClariPath LIMS** runs completely in the browser with zero external backend dependencies:

- **Offline-First Persistence**: Automatically stores all patients, test catalogs, orders, payment histories, and lab settings in **IndexedDB** with a **`localStorage` mirror** and browser persistent storage pinning (`navigator.storage.persist()`).
- **Zero-Friction Portability**: Export the entire laboratory database to a versioned `.json` snapshot at any time, restore or merge backups from local files, and download `.csv` reports for spreadsheet analysis.
- **Print-Ready Clinical Documents**: Dedicated `@media print` layouts support both **A4 Full Invoices / Lab Reports** and **80mm Thermal POS Receipts**.

---

## Key Features

### 1. Laboratory Overview Dashboard
- **Real-Time KPI Strip**: Tracks Collected Revenue, Total Billed, Outstanding Balances, Active Lab Queue (including `STAT` urgent orders), Verified Reports, and Registered Patients with tabular numeric alignment.
- **7-Day Billing Volume Chart**: Interactive SVG bar chart showing daily order revenue and order counts across the past week.
- **Pending Bench Queue**: Prioritized list of unverified orders (`STAT` surfaced first) with one-click navigation directly to result entry.
- **Recent Orders Ledger**: Quick access to receipt and report printing directly from the dashboard.

### 2. Order Registration & Billing Desk
- **Quick Patient Lookup & Inline Registration**: Search existing patients by Name, Medical Record Number (`CP-1001+`), or Phone, or register a new patient directly inside the order workflow.
- **Categorized Diagnostic Test Picker**: Filter tests by category (`Hematology`, `Biochemistry`, `Lipid & Cardiac`, `Endocrinology`, `Urinalysis`, `Microbiology`, `Immunology`) or search by code/name.
- **Flexible Pricing & Billing**:
  - Override individual test prices per order when needed.
  - Apply **Flat** or **Percentage** discounts and configurable **Tax Rates**.
  - Record **Full Payment**, **Partial Deposit**, or **Unpaid** orders across multiple methods (`Cash`, `Card`, `Bank Transfer`, `Insurance`).
  - Toggle `Routine` vs. `STAT (Urgent)` priority and mark specimen collection immediately upon registration.
- **Save & Print Flow**: One-click **Save & Print Receipt** opens the receipt preview immediately after checkout.

### 3. Orders, Specimen Tracking & Payment Settlement
- **Workflow Stage Progression**: Filter and advance orders through `Pending` → `Sample Collected` → `In Progress` → `Verified`.
- **Balance Collection Modal**: Settle remaining dues on partial or unpaid orders while preserving a timestamped payment audit trail.
- **Order Search & Filtering**: Filter by workflow stage, payment state (`All`, `Paid`, `Balance Due`), or search across order numbers, patient details, and ordered tests.

### 4. Structured Results Entry & Automatic Flagging
- **Single-Analyte & Multi-Parameter Panels**: Supports both standalone assays (e.g., `HbA1c`, `Vitamin D`, `Dengue NS1`) and multi-analyte panels (e.g., `CBC`, `LFT`, `KFT`, `Lipid Profile`, `Thyroid Profile`, `Urinalysis`).
- **Dynamic Reference Interval Evaluation**:
  - Numeric inputs are automatically evaluated against `minNormal` and `maxNormal` thresholds and flagged as **`● Normal`**, **`▲ High`**, or **`▼ Low`**.
  - Qualitative inputs (`Positive`, `Reactive`, `Detected`, `Abnormal`, `Present`) are automatically flagged as **`● Abnormal`** when compared against negative/non-reactive intervals.
- **Technician & Pathologist Sign-Off**: Add bench remarks, clinical notes, and verify reports with the assigned pathologist name.

### 5. Patient Directory & Visit History
- **Automated MRN Sequencing**: Assigns sequential Medical Record Numbers (`CP-1001`, `CP-1002`, etc.).
- **Patient Profile Drawer**: Displays demographics, contact information, blood group, referring physician, total billed amount, outstanding balance, and complete diagnostic visit history with direct receipt/report print links.

### 6. Diagnostic Test Catalog & Pricing Manager
- **Pre-Loaded Clinical Catalog**: Ships with 17 standard diagnostic tests and panels (CBC, ESR, FBS, HbA1c, LFT, KFT, Lipid Profile, hs-CRP, Thyroid Profile, TSH, Vitamin D, Vitamin B12, Serum Ferritin, Urinalysis, Dengue NS1, Urine C/S, Rheumatoid Factor).
- **Custom Test & Panel Builder**: Create new single tests or multi-parameter panels, edit prices, update turnaround times (TAT), modify specimen types, and enable/disable tests without deleting historical orders.

### 7. Local Backup, Import/Export & Lab Settings
- **Full JSON Backup Export**: Downloads a structured `claripath-lims-backup-YYYY-MM-DD.json` snapshot containing settings, patients, test catalog, and orders.
- **Safe JSON Import**: Validates uploaded backup files, previews record counts before applying, and supports two import modes:
  - **Merge with Current Data** (adds new records and updates matching IDs without wiping unconflicting entries)
  - **Replace Entire Database** (full clean restore)
- **CSV Spreadsheet Exports**: Export **Patients (`.csv`)**, **Orders & Billing (`.csv`)**, and **Test Catalog (`.csv`)** for Excel, Google Sheets, or accounting workflows.
- **Multi-Currency & Lab Branding**: Customize Lab Name, Accreditation Tagline, License/CLIA Number, Address, Phone, Email, Currency Symbol (`$`, `Rs.`, `₹`, `€`, `£`, `AED`, `SAR`, or custom), Default Tax %, Default Receipt Format, Pathologist/Technologist names, and Receipt Footer Notes.

---

## Architecture & Persistence

ClariPath LIMS uses a resilient dual-layer client persistence architecture implemented in `src/lib/storage.ts`:

```text
┌────────────────────────────────────────────────────────┐
│                   React State (App.tsx)                │
└───────────────────────────┬────────────────────────────┘
                            │ commitState()
                            ▼
┌────────────────────────────────────────────────────────┐
│                saveDatabase(state)                     │
│  ┌──────────────────────┐   ┌───────────────────────┐  │
│  │ IndexedDB            │   │ localStorage Mirror   │  │
│  │ ClariPathLimsDB      │   │ claripath_lims_state  │  │
│  │ Store: labState      │   │ (Fallback Recovery)   │  │
│  └──────────────────────┘   └───────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

- **IndexedDB Primary Store**: Stores full structured JSON records in `ClariPathLimsDB` (`labState` object store, key `primary_v1`).
- **`localStorage` Mirror**: Synchronously mirrors state updates as a secondary recovery layer.
- **Persistent Storage Request**: Calls `navigator.storage.persist()` on startup to request eviction protection from the browser.

> **Note:** Because data is stored locally in your browser's IndexedDB, clearing browser site data for the origin will erase local records. Use **Backup & Settings → Download Full Backup (.JSON)** regularly to keep an external copy.

---

## Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`)
- **Typography**: `Plus Jakarta Sans` (Display), `DM Sans` (UI/Body), `JetBrains Mono` (Tabular Numbers, Codes & Measurements)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Storage**: Browser IndexedDB + `localStorage` fallback + File Blob Export/Import
- **Printing**: Native browser print engine (`window.print()`) with CSS `@media print` isolation

---

## Project Structure

```text
├── index.html                        # Entry HTML, metadata, and Google Fonts
├── metadata.json                     # Application metadata
├── package.json                      # Dependencies and npm scripts
├── tsconfig.json                     # TypeScript compiler configuration
├── vite.config.ts                    # Vite build & plugin configuration
└── src/
    ├── index.css                     # Tailwind v4 entry, font tokens, and @media print rules
    ├── main.tsx                      # React root mount
    ├── App.tsx                       # Main LIMS workspace shell, navigation, and state orchestration
    ├── types/
    │   └── lab.ts                    # Domain TypeScript interfaces (Patient, LabTest, LabOrder, etc.)
    ├── data/
    │   └── defaultCatalog.ts         # Default lab settings, 17 clinical tests/panels, and sample seed data
    ├── lib/
    │   └── storage.ts                # IndexedDB engine, backup JSON/CSV import-export, range evaluator
    └── components/
        ├── DashboardView.tsx         # Overview KPIs, 7-day SVG billing chart, bench queue, recent orders
        ├── OrdersView.tsx            # Order tracking, status updates, balance collection, print triggers
        ├── OrderBuilderModal.tsx     # New order & billing desk with inline patient registration
        ├── ResultsEntryModal.tsx     # Structured result entry with automatic High/Low/Abnormal flagging
        ├── PatientsView.tsx          # Patient directory, registration/edit modal, and visit history drawer
        ├── CatalogView.tsx           # Diagnostic test catalog, pricing, and multi-parameter panel editor
        ├── PrintPreviewModal.tsx     # A4 Receipt, 80mm Thermal POS Receipt, and A4 Diagnostic Report
        └── DataSettingsView.tsx      # JSON/CSV import-export, storage inspector, and lab profile settings
```

---

## Getting Started

### Prerequisites

- **Node.js** `v18.0.0` or higher (recommended `v20+` or `v22+`)
- **npm** `v9+`

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/khdxsohee/claripath-lims.git
   cd claripath-lims
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

   The app will start on `http://localhost:3000`.

4. **Build for production**

   ```bash
   npm run build
   npm run preview
   ```

---

## Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `dev` | `vite --port=3000 --host=0.0.0.0` | Starts the Vite development server on port `3000` |
| `build` | `vite build` | Compiles and bundles the production application into `dist/` |
| `preview` | `vite preview` | Serves the production `dist/` bundle locally for verification |
| `lint` | `tsc --noEmit` | Runs TypeScript type checking across the entire codebase |
| `clean` | `rm -rf dist server.js` | Removes build output artifacts |

---

## Core Workflows

### Registering a Patient & Creating an Order
1. Click **New Lab Order** in the top navigation bar.
2. Search for an existing patient or click **Register New Patient** to create one inline.
3. Select tests or diagnostic panels from the catalog (adjust prices if offering custom rates).
4. Configure Priority (`Routine` or `STAT`), Discount, Tax, and Payment Method.
5. Click **Save & Print Receipt** to record the order and open the printable receipt preview.

### Entering & Verifying Lab Results
1. Open **Orders & Billing** (or click **Enter Results** from the dashboard's **Pending Bench Queue**).
2. Input observed values for single tests or multi-parameter panels; abnormal values are flagged automatically (`▲ High`, `▼ Low`, `● Abnormal`).
3. Add optional bench interpretation remarks and click **Save & Verify Report** or **Verify & Print Report**.

### Backing Up & Restoring Data
1. Go to **Backup & Settings** in the sidebar.
2. Click **Download Full Backup (.JSON)** to save a complete local snapshot.
3. To restore on the same or another machine, click **Select Backup File (.JSON)**, review the record counts, and choose **Merge with Current Data** or **Replace Entire Database**.

---

## Backup & Data Schema

Exported `.json` backup files follow this validated structure:

```json
{
  "app": "ClariPath LIMS",
  "schemaVersion": 1,
  "exportedAt": "2026-11-25T10:00:00.000Z",
  "data": {
    "settings": { "...": "LabSettings" },
    "patients": [ "...Patient[]" ],
    "tests": [ "...LabTest[]" ],
    "orders": [ "...LabOrder[]" ]
  }
}
```

---

## Printing Support

ClariPath LIMS includes dedicated print stylesheets in `src/index.css` so that clicking **Print** hides all navigation chrome (`.no-print`) and formats only the selected document:

- **A4 Official Payment Receipt**: Full clinic header, deterministic SVG order barcode, patient demographics, itemized test table, payment history log, and authorized billing signature line.
- **80mm Thermal POS Receipt**: Compact monospace layout (`78mm` print container width) tailored for thermal receipt printers.
- **A4 Diagnostic Lab Report**: Clinical laboratory report grouped by test/panel, showing observed values, units, reference intervals, abnormal flags, clinical notes, and technologist + pathologist verification blocks.

---

## Customization & Settings

From **Backup & Settings → Laboratory Profile, Currency & Print Header**, you can customize:
- **Laboratory Identity**: Lab Name, Accreditation Tagline, CLIA/License Number, Address, Phone, Email
- **Financial Preferences**: Currency Symbol (presets for `USD`, `PKR`, `INR`, `EUR`, `GBP`, `AED`, `SAR`, or custom string) and Default Tax Rate (%)
- **Print Preferences**: Default Receipt Format (`A4` vs `80mm Thermal`), Verifying Pathologist Name & Title, Lab Technologist Name, and Receipt Footer Note

---

## Author

Developed and maintained by **[@khdxsohee](https://github.com/khdxsohee)**.

---

## License

This project is open source and available under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
