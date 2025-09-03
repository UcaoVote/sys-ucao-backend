// controllers/codeController.js
import { codeService } from '../services/codeService.js';
import { toInt } from '../helpers/codeHelpers.js';

export const codeController = {
    async getCodeList(req, res) {
        try {
            const pageNum = toInt(req.query.page, 1, 1, 1_000_000);
            const limitNum = toInt(req.query.limit, 10, 1, 100);
            const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
            const status = req.query.status === 'used' || req.query.status === 'unused' ? req.query.status : 'all';

            const { codes, total } = await codeService.getCodeList(search, status, pageNum, limitNum);
            const formattedCodes = codeService.formatCodes(codes);

            res.json({
                success: true,
                data: {
                    codes: formattedCodes,
                    pagination: {
                        current: pageNum,
                        total: Math.ceil(total / limitNum),
                        count: codes.length,
                        totalItems: total
                    }
                }
            });
        } catch (err) {
            console.error('Erreur liste codes:', err);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de la récupération des codes',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    },

    async generateCodes(req, res) {
        try {
            const qty = toInt(req.body.quantity, 1, 1, 100);
            const hours = toInt(req.body.expiresInHours, 24, 1, 720);
            const userId = req.user.id;

            const codes = await codeService.generateCodes(qty, hours, userId);

            res.status(201).json({
                success: true,
                message: qty > 1 ? `${qty} codes générés avec succès` : 'Code généré avec succès',
                data: { codes }
            });
        } catch (err) {
            console.error('Erreur génération code:', err);
            res.status(500).json({
                success: false,
                message: "Erreur serveur lors de la génération du code",
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
};