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
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Observação: não existem índices além da chave primária — consultas por
-- telefone (routes/api/gastos/index.js) e por mês/ano fazem full table scan.
-- Hoje (18 registros) é irrelevante; ver MELHORIAS.md para quando adicionar
-- índices em `telefone` e `data`.

-- Como recriar o banco do zero em outro ambiente/celular:
--   mysql -u root -p < schema.sql
