import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AppLayout } from "./components/layout/AppLayout"
import Dashboard from "./pages/Dashboard"
import Transactions from "./pages/Transactions"
import Positions from "./pages/Positions"
import PositionDetails from "./pages/PositionDetails"
import TransactionDetails from "./pages/TransactionDetails"
import Settings from "./pages/Settings"
import TradingPairs from "./pages/TradingPairs"
import Glossary from "./pages/Glossary"
import Debug from "./pages/Debug"
import AssetDetails from "./pages/AssetDetails"
import Funds from "./pages/Funds"
import FundDetails from "./pages/FundDetails"
import TradingSimulator from "./pages/TradingSimulator"
import { useEffect } from "react"
import { useSettingsStore } from "./store/useSettingsStore"

function App() {
  const { theme, themeColor } = useSettingsStore()

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (themeColor && themeColor !== "blue") {
      root.setAttribute("data-theme-color", themeColor);
    } else {
      root.removeAttribute("data-theme-color");
    }
  }, [themeColor]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/positions" element={<Positions />} />
          <Route path="/positions/:id" element={<PositionDetails />} />
          <Route path="/positions/:id/simulator" element={<TradingSimulator />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/transactions/:id" element={<TransactionDetails />} />
          <Route path="/assets/:symbol" element={<AssetDetails />} />
          <Route path="/funds" element={<Funds />} />
          <Route path="/funds/:id" element={<FundDetails />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/trading-pairs" element={<TradingPairs />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="/debug" element={<Debug />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
