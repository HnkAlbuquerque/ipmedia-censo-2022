import { useEffect, useState } from 'react';
import { buscarMunicipios, descreverErro, obterMunicipio } from '../api/client';
import type { MunicipioDetalhe, Sugestao } from '../api/tipos';
import Autocomplete from '../components/Autocomplete';
import CartoesMunicipio from '../components/CartoesMunicipio';

type Detalhe =
  | { estado: 'inicial' }
  | { estado: 'carregando'; sugestao: Sugestao }
  | { estado: 'erro'; sugestao: Sugestao; mensagem: string }
  | { estado: 'pronto'; municipio: MunicipioDetalhe };

/** Tela 1: busca de município por nome e cartões com os agregados. */
export default function BuscaMunicipio() {
  const [selecionada, setSelecionada] = useState<Sugestao | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe>({ estado: 'inicial' });

  useEffect(() => {
    if (!selecionada) return;
    const controle = new AbortController();
    setDetalhe({ estado: 'carregando', sugestao: selecionada });
    obterMunicipio(selecionada.cdMun, controle.signal).then(
      (municipio) => {
        // Seleção trocada antes da resposta: a anterior não pode sobrescrever a nova.
        if (controle.signal.aborted) return;
        setDetalhe({ estado: 'pronto', municipio });
      },
      (e: unknown) => {
        if (controle.signal.aborted) return;
        setDetalhe({ estado: 'erro', sugestao: selecionada, mensagem: descreverErro(e) });
      },
    );
    return () => controle.abort();
  }, [selecionada]);

  return (
    <>
      <h2>Busca de município</h2>
      <p className="contexto">
        Digite parte do nome de um município e escolha na lista para ver população, setores
        censitários, área, densidade e distribuição por sexo do Censo 2022.
      </p>

      <Autocomplete
        rotulo="Município"
        placeholder="Ex.: São Paulo"
        buscar={buscarMunicipios}
        aoSelecionar={setSelecionada}
      />

      {detalhe.estado === 'carregando' && (
        <p className="estado" role="status">
          Carregando dados de {detalhe.sugestao.nome} - {detalhe.sugestao.uf.sigla}...
        </p>
      )}
      {detalhe.estado === 'erro' && (
        <p className="estado estado--erro" role="alert">
          Não foi possível carregar os dados de {detalhe.sugestao.nome} -{' '}
          {detalhe.sugestao.uf.sigla}. {detalhe.mensagem}
        </p>
      )}
      {detalhe.estado === 'pronto' && <CartoesMunicipio municipio={detalhe.municipio} />}
    </>
  );
}
