/**
 * Relatórios.jsx - Reaproveita a tela de relatórios das Frotas.
 *
 * Frotas e Fiscalização usam a MESMA tela. A diferenca esta nos tipos de
 * relatório disponiveis, que vem dos modelos do backend - não há motivo para
 * duplicar a tela so por causa do menu de origem.
 */
import RelatoriosFrotas from "./frotas/Relatorios.jsx"";

// Fiscalização e Frotas usam a mesma tela de relatórios: a diferenca fica nos
// tipos de relatório disponiveis, que vem do proprio modelo no backend.
export default RelatoriosFrotas;
