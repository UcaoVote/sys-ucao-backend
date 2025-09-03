// controllers/statsController.js
import { statsService } from '../services/statsService.js';

export const statsController = {
    async getGeneralStats(req, res) {
        try {
            const { period = '30', electionId } = req.query;
            const data = await statsService.getGeneralStats(period, electionId);
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Erreur stats générales:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    async getVotesStats(req, res) {
        try {
            const { period = '30', electionId } = req.query;
            const data = await statsService.getVotesStats(period, electionId);
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Erreur stats votes:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    async getDistributionStats(req, res) {
        try {
            const { electionId } = req.query;

            if (!electionId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID d\'élection requis'
                });
            }

            const data = await statsService.getDistributionStats(electionId);
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Erreur distribution votes:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    async getHourlyStats(req, res) {
        try {
            const { period = '7', electionId } = req.query;
            const data = await statsService.getHourlyStats(period, electionId);
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Erreur stats horaires:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    async getComparisonStats(req, res) {
        try {
            const { period = '365' } = req.query;
            const data = await statsService.getComparisonStats(period);
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Erreur comparaison élections:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    async getParticipationStats(req, res) {
        try {
            const data = await statsService.getParticipationStats();
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Erreur stats participation:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};