import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

function renderizarEm(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('mostra o título e os dois links de navegação', () => {
    renderizarEm('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Censo 2022' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Busca de município' })).toHaveAttribute('href', '/municipio');
    expect(screen.getByRole('link', { name: 'Busca por estado' })).toHaveAttribute('href', '/estado');
  });

  it('redireciona / para /municipio', () => {
    renderizarEm('/');

    expect(screen.getByRole('heading', { level: 2, name: 'Busca de município' })).toBeInTheDocument();
  });

  it('renderiza a busca por estado em /estado', () => {
    renderizarEm('/estado');

    expect(screen.getByRole('heading', { level: 2, name: 'Busca por estado' })).toBeInTheDocument();
  });
});
