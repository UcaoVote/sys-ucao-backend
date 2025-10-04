// reconstruct-mysql-schema.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Pour obtenir __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MySQLSchemaReconstructor {
    constructor(backendPath) {
        this.backendPath = backendPath;
        this.tables = {};
        this.foreignKeys = [];
    }

    // Analyse uniquement le schema.sql principal
    analyzeSQLSchema() {
        const schemaFile = path.join(this.backendPath, 'database/schema.sql');
        if (fs.existsSync(schemaFile)) {
            console.log(`📖 Analyse de database/schema.sql...`);
            this.analyzeSQLFile(schemaFile);
        }
    }

    analyzeSQLFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');

            // Détection des CREATE TABLE
            const createTableRegex = /CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?\s*\(([^;]+)\)/gi;
            let match;

            while ((match = createTableRegex.exec(content)) !== null) {
                const tableName = match[1];
                const tableDefinition = match[2];

                this.parseTableDefinition(tableName, tableDefinition, filePath);
            }

            // Détection des clés étrangères
            const alterTableRegex = /ALTER TABLE `?(\w+)`?\s*ADD (?:CONSTRAINT `?\w+`? )?FOREIGN KEY \(`?(\w+)`?\) REFERENCES `?(\w+)`?\(`?(\w+)`?\)/gi;
            let alterMatch;

            while ((alterMatch = alterTableRegex.exec(content)) !== null) {
                this.foreignKeys.push({
                    table: alterMatch[1],
                    column: alterMatch[2],
                    referencesTable: alterMatch[3],
                    referencesColumn: alterMatch[4],
                    file: filePath
                });
            }

        } catch (error) {
            console.log(`❌ Erreur lecture ${filePath}:`, error.message);
        }
    }

    parseTableDefinition(tableName, definition, filePath) {
        const columns = [];
        const lines = definition.split('\n').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            // Ignore les contraintes de table
            if (line.startsWith('PRIMARY KEY') ||
                line.startsWith('FOREIGN KEY') ||
                line.startsWith('UNIQUE KEY') ||
                line.startsWith('KEY ') ||
                line.startsWith('CONSTRAINT')) {
                continue;
            }

            // Extrait le nom de colonne et le type
            const columnMatch = line.match(/^`?(\w+)`?\s+([^(]+)(?:\(([^)]+)\))?/);
            if (columnMatch) {
                const columnName = columnMatch[1];
                let columnType = columnMatch[2].toUpperCase().trim();
                const size = columnMatch[3];

                if (size) {
                    columnType += `(${size})`;
                }

                const constraints = [];

                if (line.includes('NOT NULL')) constraints.push('NOT NULL');
                if (line.includes('AUTO_INCREMENT')) constraints.push('AUTO_INCREMENT');
                if (line.includes('PRIMARY KEY')) constraints.push('PRIMARY KEY');
                if (line.includes('UNIQUE')) constraints.push('UNIQUE');

                const defaultMatch = line.match(/DEFAULT\s+([^\s,]+)/i);
                if (defaultMatch) {
                    constraints.push(`DEFAULT ${defaultMatch[1]}`);
                }

                columns.push({
                    name: columnName,
                    type: columnType,
                    constraints: constraints
                });
            }
        }

        if (columns.length > 0) {
            this.tables[tableName] = {
                columns: columns,
                file: filePath,
                type: 'sql'
            };
        }
    }

    // Analyse les ROUTES (très important)
    analyzeRoutes() {
        const routesPath = path.join(this.backendPath, 'routes');
        if (!fs.existsSync(routesPath)) return;

        const routeFiles = fs.readdirSync(routesPath);

        console.log(`🛣️  Analyse des routes (${routeFiles.length} fichiers)...`);

        routeFiles.forEach(file => {
            if (file.endsWith('.js')) {
                this.analyzeRouteFile(path.join(routesPath, file));
            }
        });
    }

    analyzeRouteFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const filename = path.basename(filePath, '.js');

            // Détection des tables dans les routes
            this.detectTablesInCode(content, filePath, `routes/${filename}`);

            // Détection des opérations CRUD
            this.detectOperationsInCode(content, filePath);

        } catch (error) {
            console.log(`❌ Erreur lecture route ${filePath}:`, error.message);
        }
    }

    // Analyse les contrôleurs
    analyzeControllers() {
        const controllersPath = path.join(this.backendPath, 'controllers');
        if (!fs.existsSync(controllersPath)) return;

        const controllerFiles = fs.readdirSync(controllersPath);

        console.log(`🎮 Analyse des contrôleurs (${controllerFiles.length} fichiers)...`);

        controllerFiles.forEach(file => {
            if (file.endsWith('.js')) {
                this.analyzeControllerFile(path.join(controllersPath, file));
            }
        });
    }

    analyzeControllerFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const filename = path.basename(filePath, '.js');

            this.detectTablesInCode(content, filePath, `controllers/${filename}`);
            this.detectOperationsInCode(content, filePath);

        } catch (error) {
            console.log(`❌ Erreur lecture contrôleur ${filePath}:`, error.message);
        }
    }

    // Analyse les services
    analyzeServices() {
        const servicesPath = path.join(this.backendPath, 'services');
        if (!fs.existsSync(servicesPath)) return;

        const serviceFiles = fs.readdirSync(servicesPath);

        console.log(`🔧 Analyse des services (${serviceFiles.length} fichiers)...`);

        serviceFiles.forEach(file => {
            if (file.endsWith('.js')) {
                this.analyzeServiceFile(path.join(servicesPath, file));
            }
        });
    }

    analyzeServiceFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const filename = path.basename(filePath, '.js');

            this.detectTablesInCode(content, filePath, `services/${filename}`);
            this.detectOperationsInCode(content, filePath);

            // Détection des structures de données dans les services
            this.detectDataStructures(content, filePath);

        } catch (error) {
            console.log(`❌ Erreur lecture service ${filePath}:`, error.message);
        }
    }

    // Détection générique des tables dans le code
    detectTablesInCode(content, filePath, context) {
        const sqlPatterns = [
            /(?:SELECT\s+.+\s+FROM|from)\s+`?(\w+)`?/gi,
            /INSERT\s+INTO\s+`?(\w+)`?/gi,
            /UPDATE\s+`?(\w+)`?/gi,
            /DELETE\s+FROM\s+`?(\w+)`?/gi,
            /FROM\s+`?(\w+)`?/gi,
            /JOIN\s+`?(\w+)`?/gi,
            /tableName['"]?\s*:\s*['"](\w+)['"]/gi,
            /table:\s*['"](\w+)['"]/gi
        ];

        sqlPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const tableName = match[1];
                if (tableName && this.isValidTableName(tableName)) {
                    this.registerTable(tableName, filePath, 'detected', context);
                }
            }
        });
    }

    // Détection des opérations dans le code
    detectOperationsInCode(content, filePath) {
        const operationPatterns = {
            SELECT: /SELECT[^;]*FROM[^;]*`?(\w+)`?[^;]*/gi,
            INSERT: /INSERT\s+INTO[^;]*`?(\w+)`?[^;]*/gi,
            UPDATE: /UPDATE[^;]*`?(\w+)`?[^;]*/gi,
            DELETE: /DELETE\s+FROM[^;]*`?(\w+)`?[^;]*/gi
        };

        for (const [operation, pattern] of Object.entries(operationPatterns)) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const tableName = match[1];
                if (tableName && this.isValidTableName(tableName)) {
                    if (!this.tables[tableName].operations) {
                        this.tables[tableName].operations = [];
                    }
                    // Évite les doublons
                    if (!this.tables[tableName].operations.includes(operation)) {
                        this.tables[tableName].operations.push(operation);
                    }
                }
            }
        }
    }

    // Détection des structures de données (pour inférer les colonnes)
    detectDataStructures(content, filePath) {
        const dataPatterns = [
            /(?:const|let|var)\s+(\w+Data|\w+Fields)\s*=\s*\{[^}]+\}/g,
            /(?:\.create\(|\.update\(|\.insert\()\s*\{([^}]+)\}/g,
            /(?:body|params|fields)\s*:\s*\{([^}]+)\}/g
        ];

        dataPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const dataStructure = match[0];
                this.inferColumnsFromData(dataStructure, filePath);
            }
        });
    }

    inferColumnsFromData(dataStructure, filePath) {
        // Extraction des champs depuis les structures de données
        const fieldMatches = dataStructure.match(/(\w+)\s*:/g);
        if (fieldMatches) {
            const tableName = this.guessTableNameFromContext(filePath);
            if (tableName) {
                fieldMatches.forEach(fieldMatch => {
                    const fieldName = fieldMatch.replace(':', '').trim();
                    this.addColumnToTable(tableName, fieldName, 'VARCHAR(255)', [], filePath);
                });
            }
        }
    }

    // Méthodes utilitaires
    isValidTableName(tableName) {
        const excluded = ['require', 'module', 'exports', 'console', 'function', 'const', 'let', 'var'];
        return tableName.length > 2 && !excluded.includes(tableName.toLowerCase());
    }

    registerTable(tableName, filePath, type, context) {
        if (!this.tables[tableName]) {
            this.tables[tableName] = {
                columns: [],
                file: filePath,
                type: type,
                context: context
            };
        }
    }

    addColumnToTable(tableName, columnName, columnType, constraints, filePath) {
        if (!this.tables[tableName]) {
            this.registerTable(tableName, filePath, 'inferred', 'auto-detected');
        }

        const existingColumn = this.tables[tableName].columns.find(col => col.name === columnName);
        if (!existingColumn) {
            this.tables[tableName].columns.push({
                name: columnName,
                type: columnType,
                constraints: constraints
            });
        }
    }

    guessTableNameFromContext(filePath) {
        const filename = path.basename(filePath, '.js');

        const mapping = {
            // Routes
            'users': 'users',
            'userLogin': 'users',
            'userRegister': 'users',
            'candidats': 'candidates',
            'elections': 'elections',
            'votes': 'votes',
            'students': 'students',
            'activity': 'activities',
            'activityStudents': 'activity_students',
            'codes': 'codes',
            'notifications': 'notifications',
            'stats': 'statistics',

            // Contrôleurs
            'userController': 'users',
            'authController': 'users',
            'voteController': 'votes',
            'electionManager': 'elections',
            'candidatManager': 'candidates',
            'studentManager': 'students',
            'activityController': 'activities',

            // Services
            'userService': 'users',
            'voteService': 'votes',
            'electionRoundService': 'elections'
        };

        return mapping[filename] || this.pluralize(filename);
    }

    pluralize(word) {
        if (word.endsWith('y')) {
            return word.slice(0, -1) + 'ies';
        }
        if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') ||
            word.endsWith('ch') || word.endsWith('sh')) {
            return word + 'es';
        }
        return word + 's';
    }

    // Génération du schéma SQL
    generateSQLSchema() {
        let sql = `-- Schéma MySQL reconstruit automatiquement\n`;
        sql += `-- Généré le: ${new Date().toISOString()}\n`;
        sql += `-- Source: Analyse des routes, contrôleurs et services\n\n`;

        // Tables
        for (const [tableName, tableInfo] of Object.entries(this.tables)) {
            sql += `-- Table: ${tableName}\n`;
            sql += `-- Source: ${tableInfo.context || path.relative(this.backendPath, tableInfo.file)}\n`;
            sql += `-- Type: ${tableInfo.type}\n`;

            if (tableInfo.operations) {
                sql += `-- Opérations: ${tableInfo.operations.join(', ')}\n`;
            }

            sql += `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n`;

            // Colonne ID par défaut si aucune colonne n'est détectée
            if (tableInfo.columns.length === 0) {
                sql += `  \`id\` INT PRIMARY KEY AUTO_INCREMENT`;
            } else {
                const columnsSQL = tableInfo.columns.map(col => {
                    let colSQL = `  \`${col.name}\` ${col.type}`;
                    if (col.constraints.length > 0) {
                        colSQL += ' ' + col.constraints.join(' ');
                    }
                    return colSQL;
                });
                sql += columnsSQL.join(',\n');
            }

            sql += '\n);\n\n';
        }

        return sql;
    }

    // Génère un rapport détaillé
    generateReport() {
        const report = {
            summary: {
                totalTables: Object.keys(this.tables).length,
                totalColumns: Object.values(this.tables).reduce((sum, table) => sum + table.columns.length, 0),
                tablesByType: {
                    sql: Object.values(this.tables).filter(t => t.type === 'sql').length,
                    detected: Object.values(this.tables).filter(t => t.type === 'detected').length,
                    inferred: Object.values(this.tables).filter(t => t.type === 'inferred').length
                }
            },
            tables: this.tables,
            sqlSchema: this.generateSQLSchema()
        };

        return report;
    }

    // Scan complet
    scanBackend() {
        console.log('🔍 Début de l\'analyse du backend...\n');

        this.analyzeSQLSchema();
        this.analyzeRoutes();      // PRIORITÉ aux routes
        this.analyzeControllers();
        this.analyzeServices();

        console.log('\n✅ Analyse terminée!');
    }
}

// Utilisation
const main = () => {
    const backendPath = process.argv[2] || '.';

    if (!fs.existsSync(backendPath)) {
        console.log('❌ Chemin invalide!');
        process.exit(1);
    }

    const reconstructor = new MySQLSchemaReconstructor(backendPath);

    console.log('🚀 Reconstruction du schéma MySQL depuis les routes/controllers/services...\n');
    reconstructor.scanBackend();

    const report = reconstructor.generateReport();

    // Sauvegarde des fichiers
    fs.writeFileSync('mysql-schema-report.json', JSON.stringify(report, null, 2));
    fs.writeFileSync('mysql-schema-reconstructed.sql', report.sqlSchema);

    console.log('\n📊 RAPPORT FINAL:');
    console.log(`   - Tables détectées: ${report.summary.totalTables}`);
    console.log(`   - Colonnes totales: ${report.summary.totalColumns}`);
    console.log(`   - Types de détection:`);
    console.log(`        • Définies en SQL: ${report.summary.tablesByType.sql}`);
    console.log(`        • Détectées dans le code: ${report.summary.tablesByType.detected}`);
    console.log(`        • Inférées: ${report.summary.tablesByType.inferred}`);

    console.log('\n📋 LISTE DES TABLES:');
    Object.keys(report.tables).forEach(table => {
        const tableInfo = report.tables[table];
        console.log(`   - ${table} (${tableInfo.columns.length} colonnes, ${tableInfo.type})`);
        if (tableInfo.operations) {
            console.log(`     Opérations: ${tableInfo.operations.join(', ')}`);
        }
    });

    console.log('\n📁 FICHIERS GÉNÉRÉS:');
    console.log('   - mysql-schema-report.json (rapport détaillé)');
    console.log('   - mysql-schema-reconstructed.sql (schéma SQL)');
};

// Lancement si exécuté directement
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export default MySQLSchemaReconstructor;