# Curvas BESS — Energy Consumption Analysis

**Consultoria Baterias** | Battery Energy Storage System Analysis Tool

A web application for analyzing energy consumption and sizing Battery Energy Storage Systems (BESS).

## Features

- **CSV Data Import**: Upload energy consumption data (timestamp + power in kW) via drag-and-drop or file picker
- **Sample Data**: Load a 7-day simulated commercial load profile to explore the app instantly
- **Consumption Statistics**: Peak demand, average demand, minimum demand, total energy (kWh), load factor, and peak hour
- **Load Profile Chart**: Hourly average curve vs. last-day curve with optional peak target reference line
- **Load Duration Curve**: Visualize how often each demand level is exceeded
- **BESS Sizing Analysis**:
  - Set peak shaving target (kW)
  - Configure battery efficiency and depth of discharge
  - Get recommended capacity (kWh) and power (kW)
  - View optimal charge/discharge schedule

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## CSV Format

The app accepts CSV files with the following columns (case-insensitive, common synonyms supported):

| Column | Accepted names |
|--------|----------------|
| Timestamp | `timestamp`, `datetime`, `date`, `time`, `hora`, `dt`, `data` |
| Power (kW) | `power_kw`, `power`, `kw`, `potencia`, `potência`, `demand`, `demanda`, `load`, `carga`, `p` |

Example:
```csv
timestamp,power_kw
2024-01-01T00:00:00Z,120.5
2024-01-01T00:15:00Z,118.2
```

## Tech Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for bundling
- [Recharts](https://recharts.org/) for charts
- [PapaParse](https://www.papaparse.com/) for CSV parsing
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Lucide React](https://lucide.dev/) for icons

## Build

```bash
npm run build
```
