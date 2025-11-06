import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database/dbconfig.js';
import './scripts/reminders.js';
import electionInitializer from './scripts/initElections.js';
import rateLimit from 'express-rate-limit';

// Import des routes
import importRouter from './routes/import.js';
import activityStudentsRouter from './routes/activityStudents.js';
import uploadRouter from './routes/upload.js';
import uploadLocalRouter from './routes/uploadLocal.js'; // NOUVEAU: Upload local
import matriculesRouter from './routes/import.js';
import userLoginRouter from './routes/userLogin.js';
import userRegisterRouter from './routes/userRegister.js';
import adminRouter from './routes/admin.js';
import adminAuthRouter from './routes/adminAuth.js';
import candidatsRouter from './routes/candidats.js';
import studentsRouter from './routes/students.js';
import electionsRouter from './routes/elections.js';
import statsRouter from './routes/stats.js';
import activityRouter from './routes/activity.js';
import notificationsRouter from './routes/notifications.js';
import codesRouter from './routes/codes.js';
import votesRouter from './routes/votes.js';
import institutionRouter from './routes/institution.js';
import usersRouter from './routes/users.js';
import concoursRouter from './routes/concours.js';
import concoursAdminRouter from './routes/concours-admin.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 🔐 Trust proxy pour Render
app.set('trust proxy', 1);

// 🛡️ Middleware de rate limiting (fix IPv6)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max 100 requêtes par IP
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Trop de requêtes, réessayez plus tard.'
});
app.use(limiter);

// 📍 Log IP pour audit
app.use((req, res, next) => {
    console.log('IP détectée :', req.ip);
    next();
});

// 🔗 CORS - Configuration élargie pour production
const allowedOrigins = [
    'https://oeuvreuniversitaire.ucaobenin.org',
    'http://oeuvreuniversitaire.ucaobenin.org',
    'https://www.oeuvreuniversitaire.ucaobenin.org',
    'http://www.oeuvreuniversitaire.ucaobenin.org'
];

app.use(cors({
    origin: (origin, callback) => {
        console.log('🌍 Requête CORS reçue depuis:', origin);

        // Autoriser les requêtes sans origine (Postman, curl, etc.)
        if (!origin) {
            console.log('✅ CORS: Requête sans origine - AUTORISÉ');
            return callback(null, true);
        }

        // Vérifier si l'origine est dans la liste OU si elle contient vercel.app
        if (allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
            console.log('✅ CORS: Origine autorisée -', origin);
            callback(null, true);
        } else {
            console.warn('❌ CORS bloqué pour origine:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200,
    preflightContinue: false
}));

// Middleware de debogage CORS (apres le middleware CORS)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    console.log('En-tetes CORS ajoutes:', {
        'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials'),
        'Origine requete': origin
    });
    next();
});

// Middlewares de base
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Gestion explicite des requetes OPTIONS (preflight CORS)
app.options('*', (req, res) => {
    console.log('OPTIONS preflight recue pour:', req.url);
    res.status(200).end();
});

// Traitement periodique
electionInitializer.startPeriodicProcessing();

// 🩺 Health check
app.get('/api/health', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('SELECT 1');
        res.status(200).json({
            status: 'OK',
            message: 'Service is healthy',
            timestamp: new Date().toISOString(),
            database: 'MySQL connected'
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            message: 'Database not reachable',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// 🧭 Routes API
app.use('/api/import', importRouter);
app.use('/api/activities', activityStudentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/matricules', matriculesRouter);
app.use('/api/upload', uploadRouter); // Ancien système (ImgBB)
app.use('/api/upload-local', uploadLocalRouter); // NOUVEAU: Système local
app.use('/api/adminAuth', adminAuthRouter);
app.use('/api/admin', adminRouter);
app.use('/api/userLogin', userLoginRouter);
app.use('/api/userRegister', userRegisterRouter);
app.use('/api/students', studentsRouter);
app.use('/api/candidats', candidatsRouter);
app.use('/api/elections', electionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/codes', codesRouter);
app.use('/api/votes', votesRouter);
app.use('/api/institution', institutionRouter);
app.use('/api/public', concoursRouter);
app.use('/api/admin/concours', concoursAdminRouter);

// 🧪 Route de test
app.get('/api/test', (_req, res) => {
    res.json({
        message: 'API Vote UCAO opérationnelle',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: 'MySQL'
    });
});

// 🔍 Route de diagnostic config
app.get('/api/debug/config', async (req, res) => {
    try {
        // Test de connexion DB
        const connection = await pool.getConnection();

        let studentsCount = 0, electionsCount = 0, sampleElection = null;
        let errors = [];

        try {
            const [countResult] = await connection.query('SELECT COUNT(*) as total FROM etudiants');
            studentsCount = countResult[0].total;
        } catch (e) {
            errors.push(`students: ${e.message}`);
        }

        try {
            const [electionsCountResult] = await connection.query('SELECT COUNT(*) as total FROM elections');
            electionsCount = electionsCountResult[0].total;
        } catch (e) {
            errors.push(`elections count: ${e.message}`);
        }

        try {
            const [electionsTest] = await connection.query('SELECT id, titre, type FROM elections LIMIT 1');
            sampleElection = electionsTest[0] || null;
        } catch (e) {
            errors.push(`elections sample: ${e.message}`);
        }

        connection.release();

        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            config: {
                USE_MYSQL_PROXY: process.env.USE_MYSQL_PROXY || 'not set',
                MYSQL_PROXY_URL: process.env.MYSQL_PROXY_URL ? 'SET' : 'NOT SET',
                PROXY_SECRET: process.env.PROXY_SECRET ? 'SET (hidden)' : 'NOT SET',
                DB_HOST: process.env.DB_HOST ? 'SET' : 'NOT SET',
                DB_NAME: process.env.DB_NAME ? 'SET' : 'NOT SET',
                NODE_ENV: process.env.NODE_ENV || 'development'
            },
            database: {
                connected: true,
                studentsCount,
                electionsCount,
                sampleElection,
                errors: errors.length > 0 ? errors : undefined,
                poolType: pool.constructor.name || 'unknown'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            config: {
                USE_MYSQL_PROXY: process.env.USE_MYSQL_PROXY || 'not set',
                MYSQL_PROXY_URL: process.env.MYSQL_PROXY_URL ? 'SET' : 'NOT SET',
                PROXY_SECRET: process.env.PROXY_SECRET ? 'SET (hidden)' : 'NOT SET'
            },
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Gestion d’erreurs
app.use((err, req, res, next) => {
    console.error('Erreur serveur:', err);
    if (res && typeof res.status === 'function') {
        res.status(err.status || 500).json({
            message: process.env.NODE_ENV === 'production'
                ? 'Erreur interne du serveur'
                : err.message
        });
    } else {
        console.error('⚠️ res.status non disponible');
    }
});

// Démarrage serveur
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`✅ Serveur Vote UCAO démarré sur http://${HOST}:${PORT}`);
    console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Base de données: MySQL`);
    console.log(`📡 API disponible sur: http://${HOST}:${PORT}/api`);
    console.log(`🩺 Health check: http://${HOST}:${PORT}/api/health`);
});