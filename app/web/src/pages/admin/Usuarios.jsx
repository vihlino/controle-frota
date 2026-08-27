/**
 * Usuários.jsx - Quem acessa o sistema.
 * Escrita a mao porque senha exige tratamento proprio: criar acesso e trocar
 * senha sao ações separadas, e a senha nunca volta numa consulta.
 */
import { useEffect, useState } from "react";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Ações from "../../components/Ações.jsx";
import Modal from "../../components/Modal.jsx";
import { Texto, Selecao } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { dataHora } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

// Usuários tem tela propria porque a senha nunca trafega junto com o resto do
// cadastro: criar acesso e trocar senha sao ações separadas.
export default function Usuários() {
  const { podeVer } = useSessao();
  const lista = useLista("usuários", { busca: "", perfil: "", status: "" });
  const [perfis, setPerfis] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [criando, setCriando] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(null);
  const [formulario, setFormulario] = useState({ id_servidor: "", id_perfil: "", login: "", senha: "" });
  const [novaSenha, setNovaSenha] = useState("");
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("ADMIN_GERENCIAR_USUARIOS");

  useEffect(() => {
    api("/admin/perfis/opcoes").then(setPerfis).catch(() => {});
    api("/admin/servidores/opcoes").then(setServidores).catch(() => {});
  }, []);

  async function criar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      await api("/usuarios", {
        method: "POST",
        body: {
          ...formulario,
          id_servidor: Number(formulario.id_servidor),
          id_perfil: Number(formulario.id_perfil),
        },
      });
      setCriando(false);
      setFormulario({ id_servidor: "", id_perfil: "", login: "", senha: "" });
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
      await api(`/usuários/${trocandoSenha.id_usuario}`, {
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
      await api(`/usuários/${u.id_usuario}`, { method: "PUT", body: { status: !u.status } });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  async function trocarPerfil(u, idPerfil) {
    try {
      await api(`/usuários/${u.id_usuario}`, {
        method: "PUT",
        body: { id_perfil: Number(idPerfil) },
      });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  const colunas = [
    { chave: "nome", rotulo: "Servidor", ordenavel: true },
    { chave: "login", rotulo: "Login", ordenavel: true },
    { chave: "matricula", rotulo: "Matrícula" },
    { chave: "cargo_funcao", rotulo: "Cargo / Função" },
    { chave: "setor", rotulo: "Setor" },
    {
      chave: "perfil", rotulo: "Perfil", ordenavel: true,
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
      chave: "ultimo_acesso", rotulo: "Ultimo acesso", ordenavel: true,
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
        <Ações
          ações={[
            {
              rotulo: "Trocar senha",
              aoClicar: () => { setTrocandoSenha(u); setErroForm(""); },
            },
            {
              rotulo: u.status ? "Desativar acesso" : "Reativar acesso",
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
      descricao="Quem acessa o SITRA, com qual perfil e quando entrou pela ultima vez."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={() => setCriando(true)}>
            <Icone nome="user" tamanho={16} /> Novo usuário
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
          legenda="O acesso e criado a partir de um servidor ja cadastrado."
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
                       valor: s.id_servidor, rotulo: `${s.nome} - ${s.matrícula}`,
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
                   onChange={(e) => setFormulario((f) => ({ ...f, login: e.target.value }))} />
            <Texto rotulo="Senha inicial *" id="senha" type="password" required minLength={8}
                   value={formulario.senha}
                   onChange={(e) => setFormulario((f) => ({ ...f, senha: e.target.value }))} />
            <p className="modal__aviso campo--largo">
              A senha precisa ter ao menos 8 caracteres e deve ser trocada pelo
              usuário no primeiro acesso.
            </p>
          </form>
        </Modal>
      )}

      {trocandoSenha && (
        <Modal
          titulo="Trocar senha"
          legenda={`Definindo nova senha para ${trocandoSenha.nome}.`}
          aoFechar={() => setTrocandoSenha(null)}
          rodape={
            <>
              <button className="botao" onClick={() => setTrocandoSenha(null)}>Cancelar</button>
              <button className="botao botao--primario" form="form-senha" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar nova senha"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-senha" onSubmit={trocarSenha}>
            <Texto rotulo="Nova senha *" id="nova_senha" type="password" required minLength={8}
                   value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
