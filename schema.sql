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

-- ===== Feature 1 — Extrato bancário (2026-07-12) =====
-- Novas tabelas para log de importações e perfis de mapeamento CSV.
-- Novas colunas em gastos para rastreabilidade e deduplicação.

CREATE TABLE IF NOT EXISTS extratos_importados (
  id                INT NOT NULL AUTO_INCREMENT,
  telefone          VARCHAR(30)  NOT NULL,
  formato           ENUM('OFX','CSV') NOT NULL,
  nome_banco        VARCHAR(60)  DEFAULT NULL,
  total_linhas      INT NOT NULL DEFAULT 0,
  total_importadas  INT NOT NULL DEFAULT 0,
  total_duplicadas  INT NOT NULL DEFAULT 0,
  criado_em         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_telefone (telefone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS perfis_importacao_csv (
  telefone             VARCHAR(30)  NOT NULL,
  assinatura_cabecalho VARCHAR(64)  NOT NULL,
  nome_banco           VARCHAR(60)  DEFAULT NULL,
  coluna_data          VARCHAR(50)  NOT NULL,
  coluna_descricao     VARCHAR(50)  NOT NULL,
  coluna_valor         VARCHAR(50)  NOT NULL,
  formato_data         VARCHAR(20)  NOT NULL,
  separador_decimal    CHAR(1)      NOT NULL DEFAULT ',',
  criado_em            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (telefone, assinatura_cabecalho)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

ALTER TABLE gastos ADD COLUMN identificador_externo VARCHAR(64) NULL AFTER data;
ALTER TABLE gastos ADD COLUMN extrato_id INT NULL;
ALTER TABLE gastos ADD CONSTRAINT fk_gastos_extrato FOREIGN KEY (extrato_id) REFERENCES extratos_importados(id) ON DELETE SET NULL;
ALTER TABLE gastos ADD UNIQUE KEY uq_telefone_ident_externo (telefone, identificador_externo);
