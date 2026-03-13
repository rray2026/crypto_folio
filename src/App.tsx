import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AppLayout } from "./components/layout/AppLayout"
import Dashboard from "./pages/Dashboard"
import Transactions from "./pages/Transactions"
import Positions from "./pages/Positions"
import PositionDetails from "./pages/PositionDetails"
import TransactionDetails from "./pages/TransactionDetails"
import Settings from "./pages/Settings"
import Glossary from "./pages/Glossary"
import { useEffect } from "react"
import { useSettingsStore } from "./store/useSettingsStore"

function App() {
  const { theme } = useSettingsStore()

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

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/positions" element={<Positions />} />
          <Route path="/positions/:id" element={<PositionDetails />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/transactions/:id" element={<TransactionDetails />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/glossary" element={<Glossary />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
