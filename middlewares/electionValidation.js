import validationService from '../services/validationService.js';

export const validateCandidature = async (req, res, next) => {
    try {
        const { electionId } = req.body;
        const userId = req.user.id;

        if (!electionId) {
            return res.status(400).json({
                success: false,
                message: 'ID d\'élection requis'
            });
        }

        const isEligible = await validationService.checkCandidatureEligibility(userId, electionId);

        if (!isEligible) {
            let message = 'Non éligible pour cette élection';

            // Message spécifique selon la phase
            const [electionRows] = await pool.execute(
                'SELECT phase, delegueType FROM elections WHERE id = ?',
                [electionId]
            );

            if (electionRows.length > 0) {
                const election = electionRows[0];
                if (election.phase === 'PHASE2') {
                    message = `Non éligible : Vous devez être responsable de salle en Licence ${election.delegueType === 'PREMIER' ? '3' : '2'}`;
                } else if (election.phase === 'PHASE3') {
                    message = `Non éligible : Vous devez être ${election.delegueType === 'PREMIER' ? '1er' : '2ème'} délégué d'école`;
                }
            }

            return res.status(403).json({
                success: false,
                message
            });
        }

        next();
    } catch (error) {
        console.error('Erreur validation candidature:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur de validation'
        });
    }
};

export const validateVoting = async (req, res, next) => {
    try {
        const { electionId } = req.body;
        const userId = req.user.id;

        if (!electionId) {
            return res.status(400).json({
                success: false,
                message: 'ID d\'élection requis'
            });
        }

        const canVote = await validationService.checkVotingEligibility(userId, electionId);

        if (!canVote) {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à voter pour cette élection'
            });
        }

        next();
    } catch (error) {
        console.error('Erreur validation vote:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur de validation'
        });
    }
};