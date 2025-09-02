import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { testConnection } from './config/database.js';

// Import des routes
import notificationRoutes from './routes/notifications.js';
import activityRouter from './routes/activity.js';
import adminRouter from './routes/admin.js';
import adminRegisterRouter from './routes/adminRegister.js';
import adminLoginRouter from './routes/adminLogin.js';
import candidatsRouter from './routes/candidats.js';
import electionRouter from './routes/election.js';
import studentsRouter from './routes/students.js';
import uploadRouter from './routes/upload.js';
import userLoginRouter from './routes/userLogin.js';
import usersRouter from './routes/users.js';
import voteRouter from './routes/vote.js';
import userRegisterRouter from './routes/userRegister.js';
import matriculesRouter from './routes/matricules.js';
import codesRouter from './routes/codes.js';
import statsRouter from './routes/stats.js';

// Configuration
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Test de connexion DB au démarrage
testConnection();

// Configuration CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://sys-voteucao-frontend-64pi.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Middlewares de base
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Dossier statique pour les uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== ROUTE HEALTH CHECK ====================
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

// ==================== ROUTES API ====================
app.use('/api/notifications', notificationRoutes);
app.use('/api/adminRegister', adminRegisterRouter);
app.use('/api/adminLogin', adminLoginRouter);
app.use('/api/admin', adminRouter);
app.use('/api/students', studentsRouter);
app.use('/api/candidats', candidatsRouter);
app.use('/api/election', electionRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/userLogin', userLoginRouter);
app.use('/api/users', usersRouter);
app.use('/api/vote', voteRouter);
app.use('/api/userRegister', userRegisterRouter);
app.use('/api/matricules', matriculesRouter);
app.use('/api/codes', codesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/activity', activityRouter);

// Route de test
app.get('/api/test', (_req, res) => {
    res.json({
        message: 'API Vote UCAO opérationnelle',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: 'MySQL'
    });
});

// Gestion des routes non trouvées
app.use('/api/*', (req, res) => {
    res.status(404).json({
        message: 'Route API non trouvée',
        path: req.originalUrl
    });
});

// Middleware de gestion d'erreurs global 
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

// Démarrage du serveur
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`✅ Serveur Vote UCAO démarré sur http://${HOST}:${PORT}`);
    console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Base de données: MySQL`);
    console.log(`📡 API disponible sur: http://${HOST}:${PORT}/api`);
    console.log(`🩺 Health check: http://${HOST}:${PORT}/api/health`);
});
