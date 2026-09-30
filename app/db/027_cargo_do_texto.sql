-- ============================================================
-- 027 - Servidor com cargo so em texto passa a ter o cargo cadastrado
-- ============================================================
--
-- A migracao 014 transformou o cargo em cadastro (tabela cargo) e ligou cada
-- servidor ao seu cargo pelo texto antigo de cargo_funcao. Mas ela so fez isso
-- UMA vez, no momento em que a tabela cargo nasceu vazia.
--
-- Servidores gravados DEPOIS so com o texto - pelo seed de exemplo antigo,
-- por uma importacao - ficaram com id_cargo nulo. Na tela parece tudo certo (a
-- coluna Cargo mostra o texto), mas nenhuma regra que depende do cargo os
-- enxerga: a tela de Fiscais, que lista quem tem cargo de Fiscal de Transito,
-- deixava de fora um fiscal com "Fiscal de Trânsito" escrito no cadastro.
--
-- Mesma regra da 014: compara ignorando acento e maiuscula, e o cargo preso
-- ao SETOR do servidor tem preferencia sobre o global de mesmo nome. Se nao
-- houver cargo compativel (um "Fiscal de Transito" lotado fora da
-- Fiscalizacao, onde esse cargo nao existe), o servidor fica como esta - a
-- migracao nao inventa cargo.
--
-- Idempotente: so toca em quem ainda tem id_cargo nulo.
UPDATE servidor s
   SET id_cargo = (
       SELECT c.id_cargo
         FROM cargo c
        WHERE unaccent_simples(c.nome) = unaccent_simples(s.cargo_funcao)
          AND (c.id_setor IS NULL OR c.id_setor = s.id_setor)
          AND c.status
        ORDER BY (c.id_setor IS NOT NULL) DESC
        LIMIT 1
   )
 WHERE s.id_cargo IS NULL
   AND s.cargo_funcao IS NOT NULL
   AND btrim(s.cargo_funcao) <> ''
   AND EXISTS (
       SELECT 1 FROM cargo c
        WHERE unaccent_simples(c.nome) = unaccent_simples(s.cargo_funcao)
          AND (c.id_setor IS NULL OR c.id_setor = s.id_setor)
          AND c.status
   );
