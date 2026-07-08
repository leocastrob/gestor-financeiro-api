-- Schema do banco "financas" — gestor-financeiro-api
--
-- Este arquivo foi reconstruído a partir do uso das colunas no código-fonte
-- (plugins/whatsapp.js e routes/api/gastos/index.js), já que o banco original
-- não tinha nenhum schema versionado. Antes de confiar 100% nele, recomenda-se
-- validar contra o banco real do servidor rodando:
--   SHOW CREATE TABLE gastos;
-- e ajustar este arquivo se houver diferenças (tamanhos de campo, índices etc.).

CREATE DATABASE IF NOT EXISTS financas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE financas;

CREATE TABLE IF NOT EXISTS gastos (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  telefone   VARCHAR(20)   NOT NULL,
  descricao  VARCHAR(255)  NOT NULL,
  valor      DECIMAL(10,2) NOT NULL,
  categoria  VARCHAR(50)   NOT NULL DEFAULT 'Outros',
  data       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_telefone (telefone),
  KEY idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Como recriar o banco do zero em outro ambiente/celular:
--   mysql -u root -p < schema.sql
