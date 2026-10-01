/**
 * Usuários.jsx - Quem acessa o sistema.
 * Escrita a mao porque senha exige tratamento proprio: criar acesso e trocar
 * senha sao ações separadas, e a senha nunca volta numa consulta.
 */
import { useEffect, useState } from "react";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import Modal from "../../components/Modal.jsx";
import RegrasSenha from "../../components/RegrasSenha.jsx";
import { Texto, Selecao } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { dataHora } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";
import { senhaAceita, TAMANHO_MINIMO } from "../../lib/regrasSenha.js";
import { cpf as mascaraCpf } from "../../lib/mascaras.js";

// Usuários tem tela propria porque a senha nunca trafega junto com o resto do
// cadastro: criar acesso e trocar senha sao ações separadas.
export default function Usuários() {
  const { podeVer, usuario } = useSessao();
  const lista = useLista("usuarios", { busca: "", perfil: "", status: "" });
  const [perfis, setPerfis] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [criando, setCriando] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(null);
  const [formulario, setFormulario] = useState({ id_servidor: "", id_perfil: "", login: "" });
  // O usuario que acabou de ser criado, para o resumo "Novo usuario SITRA".
  const [criado, setCriado] = useState(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("ADMIN_GERENCIAR_USUARIOS");

  useEffect(() => {
    api("/admin/perfis/opcoes").then((r) => setPerfis(Array.isArray(r) ? r : [])).catch(() => {});
    api("/admin/servidores/opcoes")
      // Array.isArray: uma resposta fora do formato esperado faria
      // `servidores.map` derrubar a tela inteira, e o .catch abaixo nao pega
      // isso - ele so ve falha de rede.
      .then((r) => setServidores(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

  async function criar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      const novo = await api("/usuarios", {
        method: "POST",
        body: {
          ...formulario,
          id_servidor: Number(formulario.id_servidor),
          id_perfil: Number(formulario.id_perfil),
        },
      });
      setCriando(false);
      setFormulario({ id_servidor: "", id_perfil: "", login: "" });
      setCriado(novo);
      lista.recarregar();
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      await api(`/usuarios/${trocandoSenha.id_usuario}`, {
        method: "PUT",
        body: { senha: novaSenha },
      });
      setTrocandoSenha(null);
      setNovaSenha("");
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarSituação(u) {
    const acao = u.status ? "desativar" : "reativar";
    if (!confirm(`Deseja ${acao} o acesso de ${u.nome}?`)) return;
    try {
      await api(`/usuarios/${u.id_usuario}`, { method: "PUT", body: { status: !u.status } });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  async function trocarPerfil(u, idPerfil) {
    try {
      await api(`/usuarios/${u.id_usuario}`, {
        method: "PUT",
        body: { id_perfil: Number(idPerfil) },
      });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  const colunas = [
    { chave: "nome", cortar: true, rotulo: "Servidor", ordenavel: true },
    { chave: "login", rotulo: "Login", ordenavel: true },
    { chave: "matricula", rotulo: "Matrícula" },
    { chave: "cargo_funcao", cortar: true, rotulo: "Cargo / Função" },
    { chave: "setor", cortar: true, rotulo: "Setor" },
    {
      chave: "perfil", cortar: true, rotulo: "Perfil", ordenavel: true,
      render: (u) =>
        podeGerenciar ? (
          <select
            className="selecao-embutida"
            value={u.id_perfil}
            onChange={(e) => trocarPerfil(u, e.target.value)}
          >
            {perfis.map((p) => (
              <option key={p.id_perfil} value={p.id_perfil}>{p.nome}</option>
            ))}
          </select>
        ) : (
          u.perfil
        ),
    },
    {
      chave: "ultimo_acesso", rotulo: "Último acesso", ordenavel: true,
      render: (u) => (u.ultimo_acesso ? dataHora(u.ultimo_acesso) : "Nunca acessou"),
    },
    {
      chave: "status", rotulo: "Situação",
      render: (u) => (
        <Selo texto={u.status ? "Ativo" : "Inativo"} tom={u.status ? "verde" : "vermelho"} />
      ),
    },
  ];

  if (podeGerenciar) {
    colunas.push({
      chave: "ações", rotulo: "Ações",
      render: (u) => (
        <Acoes
          acoes={[
            {
              rotulo: "Trocar senha", icone: "alterar-senha",
              aoClicar: () => { setTrocandoSenha(u); setNovaSenha(""); setErroForm(""); },
            },
            {
              rotulo: u.status ? "Desativar acesso" : "Reativar acesso",
              icone: u.status ? "inativos" : "check",
              perigo: u.status,
              aoClicar: () => alternarSituação(u),
            },
          ]}
        />
      ),
    });
  }

  return (
    <PaginaLista
      trilha={[{ rotulo: "Administração" }, { rotulo: "Usuários" }]}
      titulo="Usuários"
      descricao="Quem acessa o SITRA, com qual perfil e quando entrou pela última vez."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={() => setCriando(true)}>
            <Icone nome="user" tamanho={15} /> Novo usuário
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(u) => u.id_usuario}
      unidade="usuários"
      vazio="Nenhum usuário encontrado."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Nome, login ou matrícula"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Perfil" id="perfil" vazio="Todos"
                   opcoes={perfis.map((p) => ({ valor: p.id_perfil, rotulo: p.nome }))}
                   value={lista.filtros.perfil}
                   onChange={(e) => lista.alterarFiltro("perfil", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todos"
                   opcoes={[
                     { valor: "true", rotulo: "Ativo" },
                     { valor: "false", rotulo: "Inativo" },
                   ]}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
        </>
      }
    >
      {criando && (
        <Modal
          titulo="Novo usuário"
          legenda="O acesso é criado a partir de um servidor já cadastrado."
          aoFechar={() => setCriando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setCriando(false)}>Cancelar</button>
              <button className="botao botao--primario" form="form-usuário" disabled={salvando}>
                {salvando ? "Criando..." : "Criar usuário"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-usuário" className="formulario-grade" onSubmit={criar}>
            <Selecao rotulo="Servidor *" id="id_servidor" required vazio="Selecione" largo
                     opcoes={servidores.map((s) => ({
                       valor: s.id_servidor, rotulo: `${s.nome} - ${s.matricula}`,
                     }))}
                     value={formulario.id_servidor}
                     onChange={(e) =>
                       setFormulario((f) => ({ ...f, id_servidor: e.target.value }))} />
            <Selecao rotulo="Perfil *" id="id_perfil" required vazio="Selecione"
                     opcoes={perfis.map((p) => ({ valor: p.id_perfil, rotulo: p.nome }))}
                     value={formulario.id_perfil}
                     onChange={(e) =>
                       setFormulario((f) => ({ ...f, id_perfil: e.target.value }))} />
            <Texto rotulo="Login *" id="login" required value={formulario.login}
                   placeholder="Ex.: joao.silva" onChange={(e) => setFormulario((f) => ({ ...f, login: e.target.value }))} />
            {/* Sem campo de senha: a inicial e sempre o CPF do servidor
                (usuarios.js). O administrador nao inventa nem combina senha. */}
            <p className="modal__aviso campo--largo">
              A senha inicial será o CPF do servidor, só os números. No primeiro
              acesso, o sistema pede para a pessoa criar a própria senha.
            </p>
          </form>
        </Modal>
      )}

      {criado && (
        /*
         * O resumo do acesso recem-criado: tudo o que o administrador precisa
         * passar para a pessoa, numa tela so. Do tamanho da confirmacao de
         * senha - e uma ficha curta, nao um formulario.
         */
        <Modal
          titulo="Novo usuário SITRA"
          largura={420}
          aoFechar={() => setCriado(null)}
          rodape={
            <button className="botao botao--primario" onClick={() => setCriado(null)}>
              Fechar
            </button>
          }
        >
          <dl className="resumo-usuario">
            <div><dt>Nome completo</dt><dd>{criado.nome}</dd></div>
            <div><dt>CPF</dt><dd>{mascaraCpf(criado.cpf)}</dd></div>
            <div><dt>Matrícula</dt><dd>{criado.matricula || "-"}</dd></div>
            <div><dt>Login</dt><dd>{criado.login}</dd></div>
            <div>
              <dt>Senha inicial</dt>
              <dd>{criado.cpf}</dd>
              <dd className="resumo-usuario__nota">
                O CPF, só os números. No primeiro acesso a pessoa cria a própria senha.
              </dd>
            </div>
          </dl>
        </Modal>
      )}

      {trocandoSenha && (
        /*
         * Do tamanho da confirmacao de senha ("Salvar alteracoes"), e nao do
         * formulario de cadastro: e um campo so. Na largura de formulario
         * (760px) a janela ficava quase toda vazia em volta de uma caixa de
         * senha.
         */
        <Modal
          titulo="Trocar senha"
          largura={420}
          aoFechar={() => setTrocandoSenha(null)}
          rodape={
            <>
              <button className="botao" onClick={() => setTrocandoSenha(null)}>Cancelar</button>
              <button className="botao botao--primario" form="form-senha"
                      disabled={salvando || !senhaAceita(novaSenha, trocandoSenha.login)}>
                <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
              </button>
            </>
          }
        >
          <form id="form-senha" onSubmit={trocarSenha} className="confirmar-senha">
            {/* A mesma montagem da confirmacao de senha: a frase no corpo, e
                nao como legenda do titulo, e o campo com a largura de uma senha. */}
            <p className="confirmar-senha__texto confirmar-senha__texto--centro">
              Definindo nova senha para <strong>{trocandoSenha.nome}</strong>.
            </p>
            {erroForm && <div className="login__erro">{erroForm}</div>}
            <div className="campo--senha">
              <Texto rotulo="Nova senha *" id="nova_senha" type="password" required minLength={TAMANHO_MINIMO}
                     autoFocus value={novaSenha} placeholder={`Mínimo de ${TAMANHO_MINIMO} caracteres`}
                     onChange={(e) => setNovaSenha(e.target.value)} />
            </div>
            <RegrasSenha senha={novaSenha} login={trocandoSenha.login} />
            {/* O aviso so vale para a senha de OUTRA pessoa: quem troca a
                propria senha aqui nao e obrigado a trocar de novo (usuarios.js). */}
            {trocandoSenha.id_usuario !== usuario?.id_usuario && (
              <p className="confirmar-senha__texto confirmar-senha__texto--centro">
                No próximo acesso, {trocandoSenha.nome} vai precisar criar uma
                senha própria.
              </p>
            )}
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
