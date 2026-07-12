-- Schema do banco "financas" — gestor-financeiro-api
--
-- Extraído diretamente do servidor de produção (Moto G6 Plus, MariaDB 12.3.2)
-- via `SHOW CREATE TABLE gastos` em 2026-07-07. Reflete o schema real, não uma
-- suposição — se o schema mudar no servidor, regenere este arquivo com o
-- mesmo comando e atualize aqui.

CREATE DATABASE IF NOT EXISTS financas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_uca1400_ai_ci;

USE financas;

CREATE TABLE IF NOT EXISTS gastos (
  id        INT(11)       NOT NULL AUTO_INCREMENT,
  telefone  VARCHAR(30)   NOT NULL DEFAULT '',
  descricao VARCHAR(255)  DEFAULT NULL,
  categoria VARCHAR(50)   NOT NULL DEFAULT 'Outros',
  valor     DECIMAL(10,2) DEFAULT NULL,
  data      TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_telefone (telefone),
  KEY idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Índices em telefone/data aplicados em 2026-07-07 (produção já tinha só a PK).
-- Consultas de routes/api/gastos/index.js filtram e ordenam por essas colunas.

-- Tabela de metas (teto de gasto mensal por categoria), adicionada em 2026-07-11
-- para a reforma de front-end. Upsert por (telefone, categoria) — ver
-- routes/api/metas/index.js.
CREATE TABLE IF NOT EXISTS metas (
  telefone   VARCHAR(30)   NOT NULL,
  categoria  VARCHAR(50)   NOT NULL,
  valor_teto DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (telefone, categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Como recriar o banco do zero em outro ambiente/celular:
--   mysql -u root -p < schema.sql

-- ===== Feature 4 — Receitas (2026-07-12) =====
-- Estende gastos com o conceito de tipo (despesa/receita). Default 'despesa' garante
-- retrocompatibilidade total: todos os lançamentos existentes passam a ser 'despesa' automaticamente.
-- Não renomeamos a tabela para 'lançamentos' — risco alto de quebrar rotas em produção.
--
-- Para aplicar no servidor (sem senha):
--   mysql -u root financas -e "ALTER TABLE gastos ADD COLUMN tipo ENUM('despesa','receita') NOT NULL DEFAULT 'despesa' AFTER categoria; ALTER TABLE gastos ADD KEY idx_telefone_tipo_data (telefone, tipo, data);"
ALTER TABLE gastos
  ADD COLUMN tipo ENUM('despesa','receita') NOT NULL DEFAULT 'despesa' AFTER categoria;

ALTER TABLE gastos ADD KEY idx_telefone_tipo_data (telefone, tipo, data);

