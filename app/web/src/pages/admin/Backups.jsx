/**
 * Backups.jsx - O que o SITRA realmente sabe sobre a guarda dos dados.
 *
 * POR QUE ESTA TELA NAO PROMETE UM BACKUP
 * ---------------------------------------
 * O painel de TI mostrava "Ultimo backup: hoje, 03:00 - 2,45 GB". Aqueles
 * valores estavam escritos fixos na tela. Nao havia - e nao ha - nenhuma
 * rotina de backup no SITRA; a palavra "backup" nao aparecia uma vez sequer
 * na API. Um gestor de TI lendo aquele cartao concluiria que os dados da CMTT
 * estavam salvos, e so descobriria o contrario no dia em que precisasse deles.
 *
 * Entao esta tela mostra so o que da para medir agora - tamanho do banco,
 * volume de registros, maiores tabelas - e diz com todas as letras quem guarda
 * a copia hoje. Um "Gerar backup" que nao gera nada seria o mesmo engano com
 * outra roupa.
 */
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import { api } from "../../lib/api.js";
import { numero } from "../../lib/formato.js";

export default function Backups() {
  const { definirCabecalho } = useOutletContext();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api("/sistema").then(setDados).catch((e) => setErro(e.message));
  }, []);

  if (erro) return <div className="cartao vazio">{erro}</div>;
  if (!dados) return <div className="cartao vazio">Carregando...</div>;

  const { banco, volumes, maioresTabelas, backup } = dados;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Backups e dados</h1>
          <p>Situação do banco de dados e da guarda das informações.</p>
        </div>
      </div>

      <div className="aviso-forte">
        <Icone nome="alert-triangle" tamanho={20} />
        <div>
          <strong>O SITRA não executa backup.</strong>
          <p>{backup.observacao}</p>
          <p>
            Responsável pela cópia hoje: <strong>{backup.responsavel}</strong>.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="cartao kpi">
          <span className="kpi__icone"><Icone nome="administracao-alt" tamanho={24} /></span>
          <div>
            <div className="kpi__rotulo">Tamanho do banco</div>
            <div className="kpi__valor">{banco.tamanho}</div>
            <div className="kpi__nota">{banco.nome}</div>
          </div>
        </div>
        <div className="cartao kpi">
          <span className="kpi__icone"><Icone nome="calendar" tamanho={24} /></span>
          <div>
            <div className="kpi__rotulo">Fuso do banco</div>
            <div className="kpi__valor" style={{ fontSize: "20px" }}>{banco.fuso}</div>
            <div className="kpi__nota">Horário usado em todo registro</div>
          </div>
        </div>
        <div className="cartao kpi">
          <span className="kpi__icone"><Icone nome="documentacao" tamanho={24} /></span>
          <div>
            <div className="kpi__rotulo">Versão</div>
            <div className="kpi__valor" style={{ fontSize: "20px" }}>{banco.versao}</div>
            <div className="kpi__nota">Servidor de banco de dados</div>
          </div>
        </div>
      </div>

      <div className="grade-2">
        <Cartao titulo="Volume de registros">
          <p className="cartao__nota">
            Serve para notar uma perda: uma contagem que cai de um dia para o
            outro é sinal de que algo aconteceu.
          </p>
          <div className="rolagem-x">
            <table className="tabela">
              <thead><tr><th>Informação</th><th>Registros</th></tr></thead>
              <tbody>
                {volumes.map((v) => (
                  <tr key={v.entidade}>
                    <td>{v.entidade}</td>
                    <td><strong>{numero(v.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>

        <Cartao titulo="Maiores tabelas">
          <p className="cartao__nota">
            Onde o espaço está sendo usado — útil antes de ele faltar.
          </p>
          <div className="rolagem-x">
            <table className="tabela">
              <thead><tr><th>Tabela</th><th>Espaço</th></tr></thead>
              <tbody>
                {maioresTabelas.map((t) => (
                  <tr key={t.tabela}>
                    <td>{t.tabela}</td>
                    <td>{t.tamanho}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      </div>
    </>
  );
}
