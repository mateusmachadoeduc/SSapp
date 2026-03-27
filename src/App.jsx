import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import AgendaPage from "./pages/AgendaPage";
import CadastrosPage from "./pages/CadastrosPage";
import MenuPage from "./pages/MenuPage";
import EstoquePage from "./pages/EstoquePage";
import VendasPage from "./pages/VendasPage";
import RelatoriosPage from "./pages/RelatoriosPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/agenda" replace />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/cadastros" element={<CadastrosPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/vendas" element={<VendasPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;