-- init.sql — executado pelo MySQL 8 no primeiro start do container
-- Responsabilidade: criar o usuário radar_app sem GRANTs ainda.
-- Os GRANTs são aplicados pela migration 006 (após as tabelas existirem),
-- pois MySQL 8.4 não permite GRANT em tabelas que não existem.
-- O database "radar" é criado automaticamente pela variável MYSQL_DATABASE.

CREATE USER IF NOT EXISTS 'radar_app'@'%' IDENTIFIED BY 'radar_secret';
