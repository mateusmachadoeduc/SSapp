import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import "./MainLayout.css";

function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menu"
          >
            ☰
          </button>

          <div className="brand-inline">
            <img src="/logo-ss.png" alt="SS Society" className="brand-inline-logo" />
            <div className="brand-inline-text">
              <span className="brand-main">SSapp</span>
              <span className="brand-sub">Society & Cozinha</span>
            </div>
          </div>
        </div>
      </header>

      <div className="app-body">
        {menuOpen && <div className="backdrop" onClick={closeMenu}></div>}

        <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <img src="/logo-ss.png" alt="SS Society" className="sidebar-logo" />
              <div className="sidebar-brand-text">
                <h2 className="logo">SSapp</h2>
                <p className="logo-subtitle">Gestão do Campo e Cozinha</p>
              </div>
            </div>

            <button
              className="close-menu"
              onClick={closeMenu}
              aria-label="Fechar menu"
            >
              ×
            </button>
          </div>

          <nav className="menu">
            <p className="menu-title">Campo</p>

            <NavLink to="/agenda" className="menu-link" onClick={closeMenu}>
              Agenda
            </NavLink>

            <NavLink to="/cadastros" className="menu-link" onClick={closeMenu}>
              Cadastros
            </NavLink>

            <p className="menu-title">Cozinha</p>

            <NavLink to="/menu" className="menu-link" onClick={closeMenu}>
              Menu / Cardápios
            </NavLink>

            <NavLink to="/estoque" className="menu-link" onClick={closeMenu}>
              Estoque
            </NavLink>

            <NavLink to="/vendas" className="menu-link" onClick={closeMenu}>
              Vendas
            </NavLink>

            <NavLink to="/relatorios" className="menu-link" onClick={closeMenu}>
              Relatórios
            </NavLink>
          </nav>
        </aside>

        <main className="content">
          <div className="content-card">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;