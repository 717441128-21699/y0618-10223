import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Home from "@/pages/Home";
import CVAnalysis from "@/pages/CVAnalysis";
import EISAnalysis from "@/pages/EISAnalysis";
import DischargeAnalysis from "@/pages/DischargeAnalysis";
import CompareAnalysis from "@/pages/CompareAnalysis";
import Navbar from "@/components/Navbar";

function AppContent() {
  const location = useLocation();
  const showNavbar = location.pathname !== "/";

  return (
    <div className="min-h-screen bg-slate-50">
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cv" element={<CVAnalysis />} />
        <Route path="/eis" element={<EISAnalysis />} />
        <Route path="/discharge" element={<DischargeAnalysis />} />
        <Route path="/compare" element={<CompareAnalysis />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
