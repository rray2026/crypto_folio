# CryptoFolio

A high-performance, privacy-focused crypto portfolio tracker built with React and TypeScript. Unlike traditional trackers, CryptoFolio stores all your sensitive trade data locally in your browser using IndexedDB, ensuring complete privacy and zero server-side dependency.

## ✨ Key Features

- **Privacy First**: No account required. All data stays on your machine.
- **Strategic Analysis**: Group transactions into **Primary** (for total PnL) and **Shadow** (for "what-if" analysis) positions.
- **Precise Metrics**: Real-time calculation of Weighted Average Price, ROI, and Win Rate.
- **Modern UX**: Stunning dashboard with high-density performance summaries and fluid layout.
- **Offline Capable**: Works entirely client-side, with optional price sync from public APIs.

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
3. **Run Tests**:
   ```bash
   npm run test
   ```

## 🛠 Tech Stack

- **Framework**: React 19 + Vite
- **Language**: TypeScript
- **Database**: Dexie.js (IndexedDB)
- **State**: Zustand
- **Styling**: Tailwind CSS + Shadcn/UI
- **Icons**: Lucide-React

## 📖 Documentation | 文档

Detailed documentation is available in the [**`docs/`**](docs/README.md) directory:

- [**User Guides**](docs/guides/01-market-watch.md): Step-by-step instructions for market tracking, import, and strategies.
- [**Technical Architecture**](docs/architecture.md): Deep dive into data models and the metric engine.
- [**Deployment**](docs/deployment.md): How to deploy your own instance.

---
*Developed with ❤️ for the Crypto Community.*
