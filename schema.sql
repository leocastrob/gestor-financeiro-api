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

-- Como recriar o banco do zero em outro ambiente/celular:
--   mysql -u root -p < schema.sql
