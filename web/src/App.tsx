import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import BuscaMunicipio from './pages/BuscaMunicipio';
import BuscaUf from './pages/BuscaUf';

export default function App() {
  return (
    <>
      <header className="cabecalho">
        <h1>Censo 2022</h1>
        <nav className="navegacao">
          <NavLink to="/municipio">Busca de município</NavLink>
          <NavLink to="/estado">Busca por estado</NavLink>
        </nav>
      </header>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Navigate to="/municipio" replace />} />
          <Route path="/municipio" element={<BuscaMunicipio />} />
          <Route path="/estado" element={<BuscaUf />} />
          <Route path="*" element={<Navigate to="/municipio" replace />} />
        </Routes>
      </main>
    </>
  );
}
