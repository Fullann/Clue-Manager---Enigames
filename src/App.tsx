/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCreateClue from "./pages/AdminCreateClue";
import AdminEditClue from "./pages/AdminEditClue";
import AdminClueDetails from "./pages/AdminClueDetails";
import AdminBulkPrint from "./pages/AdminBulkPrint";
import AdminSettings from "./pages/AdminSettings";
import PublicClueView from "./pages/PublicClueView";
import { ThemeProvider } from "./components/ThemeProvider";

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/print" element={<AdminBulkPrint />} />
          <Route path="/admin/clues/new" element={<AdminCreateClue />} />
          <Route path="/admin/clues/:id/edit" element={<AdminEditClue />} />
          <Route path="/admin/clues/:id" element={<AdminClueDetails />} />
          <Route path="/c/:id" element={<PublicClueView />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
