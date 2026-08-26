/**
 * Relatorios.jsx - Reaproveita a tela de relatorios das Frotas.
 *
 * Frotas e Fiscalizacao usam a MESMA tela. A diferenca esta nos tipos de
 * relatorio disponiveis, que vem dos modelos do backend - nao ha motivo para
 * duplicar a tela so por causa do menu de origem.
 */
import RelatoriosFrotas from "./frotas/Relatorios.jsx";

// Fiscalizacao e Frotas usam a mesma tela de relatorios: a diferenca fica nos
// tipos de relatorio disponiveis, que vem do proprio modelo no backend.
export default RelatoriosFrotas;
