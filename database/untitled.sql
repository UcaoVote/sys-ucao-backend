INSERT INTO `untitled_name` (`Field`, `Type`, `Null`, `Key`, `Default`, `Extra`) VALUES
('id', 'int', 'NO', 'PRI', NULL, 'auto_increment');
INSERT INTO `untitled_name` (`Field`, `Type`, `Null`, `Key`, `Default`, `Extra`) VALUES
('activity_id', 'int', 'NO', 'MUL', NULL, '');
INSERT INTO `untitled_name` (`Field`, `Type`, `Null`, `Key`, `Default`, `Extra`) VALUES
('nom', 'varchar(100)', 'NO', '', NULL, '');
INSERT INTO `untitled_name` (`Field`, `Type`, `Null`, `Key`, `Default`, `Extra`) VALUES
('description', 'text', 'YES', '', NULL, ''),
('actif', 'tinyint(1)', 'YES', '', '1', ''),
('icone', 'varchar(100)', 'YES', '', NULL, ''),
('created_at', 'datetime', 'YES', '', 'CURRENT_TIMESTAMP', 'DEFAULT_GENERATED'),
('updated_at', 'datetime', 'YES', '', 'CURRENT_TIMESTAMP', 'DEFAULT_GENERATED on update CURRENT_TIMESTAMP');