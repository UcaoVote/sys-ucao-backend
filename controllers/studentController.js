// controllers/studentController.js
import { studentService } from '../services/studentService.js';
import { parseIntSafe } from '../helpers/validateQueryParams.js';

export const studentController = {
    async updateStudentStatus(req, res) {
        try {
            const { id } = req.params;
            const { actif } = req.body;

            if (actif === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Le champ "actif" est requis'
                });
            }

            const updatedUser = await studentService.updateStudentStatus(id, actif);

            return res.json({
                success: true,
                message: `Étudiant ${actif ? 'activé' : 'désactivé'} avec succès`,
                data: {
                    id: updatedUser.id,
                    email: updatedUser.email,
                    actif: updatedUser.actif,
                    etudiant: {
                        id: updatedUser.etudiantId,
                        nom: updatedUser.nom,
                        prenom: updatedUser.prenom,
                        filiere: updatedUser.filiere,
                        annee: updatedUser.annee,
                        ecole: updatedUser.ecole,
                        matricule: updatedUser.matricule
                    }
                }
            });
        } catch (error) {
            if (error.message === 'Étudiant non trouvé') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            console.error('Error updating student status:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de la modification du statut',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    async resetStudentAccess(req, res) {
        try {
            const { studentId } = req.params;
            const result = await studentService.resetStudentAccess(studentId);

            return res.json({
                success: true,
                message: 'Accès réinitialisés avec succès',
                data: {
                    temporaryIdentifiant: result.temporaryIdentifiant,
                    temporaryPassword: result.temporaryPassword,
                    expirationDate: result.expirationDate,
                    requirePasswordChange: true,
                    student: {
                        id: studentId,
                        nom: result.student.nom,
                        prenom: result.student.prenom,
                        matricule: result.student.matricule,
                        email: result.student.email
                    }
                }
            });
        } catch (error) {
            if (error.message === 'Étudiant non trouvé') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            console.error('Erreur réinitialisation accès:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la réinitialisation des accès',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    async findStudentByMatricule(req, res) {
        try {
            const { matricule } = req.params;
            const student = await studentService.findStudentByMatricule(matricule);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Étudiant non trouvé'
                });
            }

            return res.json({
                success: true,
                data: {
                    id: student.id,
                    nom: student.nom,
                    prenom: student.prenom,
                    matricule: student.matricule,
                    codeInscription: student.codeInscription,
                    identifiantTemporaire: student.identifiantTemporaire,
                    filiere: student.filiere,
                    annee: student.annee,
                    ecole: student.ecole,
                    photoUrl: student.photoUrl,
                    email: student.email,
                    actif: student.actif,
                    createdAt: student.createdAt,
                    status: student.actif ? 'Actif' : 'Inactif'
                }
            });
        } catch (error) {
            console.error('Erreur recherche étudiant:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la recherche étudiant',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    async findStudentByCode(req, res) {
        try {
            const { code } = req.params;
            const student = await studentService.findStudentByCode(code);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Étudiant non trouvé avec ce code d\'inscription'
                });
            }

            return res.json({
                success: true,
                data: {
                    id: student.id,
                    nom: student.nom,
                    prenom: student.prenom,
                    matricule: student.matricule,
                    codeInscription: student.codeInscription,
                    identifiantTemporaire: student.identifiantTemporaire,
                    filiere: student.filiere,
                    annee: student.annee,
                    ecole: student.ecole,
                    photoUrl: student.photoUrl,
                    email: student.email,
                    actif: student.actif,
                    createdAt: student.createdAt,
                    status: student.actif ? 'Actif' : 'Inactif'
                }
            });
        } catch (error) {
            console.error('Erreur recherche étudiant par code:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la recherche étudiant',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },


    async getStudents(req, res) {
        try {
            // 🔍 Validation sécurisée des paramètres
            const page = parseIntSafe(req.query.page, 1);
            const limit = parseIntSafe(req.query.limit, 10);
            const filiere = req.query.filiere || null;
            const annee = parseIntSafe(req.query.annee);
            const ecole = req.query.ecole || null;
            const status = req.query.status || null;
            const search = req.query.search || null;

            // 📦 Appel du service avec paramètres validés
            const { students, total } = await studentService.getStudents(
                page, limit, filiere, annee, ecole, status, search
            );

            // 🧩 Formatage des données
            const formattedStudents = students.map(s => ({
                id: s.id,
                nom: s.nom,
                prenom: s.prenom,
                identifiantTemporaire: s.identifiantTemporaire,
                email: s.email,
                filiere: s.filiere,
                annee: s.annee,
                status: s.actif ? 'Actif' : 'Inactif',
                matricule: s.matricule,
                ecole: s.ecole,
                codeInscription: s.codeInscription,
                photoUrl: s.photoUrl,
                actif: s.actif
            }));

            // ✅ Réponse JSON structurée
            res.json({
                success: true,
                data: {
                    students: formattedStudents,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (err) {
            console.error('Erreur récupération étudiants:', err);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    },


    async getStudentStats(req, res) {
        try {
            const { filiere, annee, ecole } = req.query;
            const studentsRows = await studentService.getStudentStats(filiere, annee, ecole);

            const totalStudents = studentsRows.length;
            const activeStudents = studentsRows.filter(s => s.actif).length;
            const inactiveStudents = totalStudents - activeStudents;
            const activationRate = totalStudents ? ((activeStudents / totalStudents) * 100).toFixed(2) : '0.00';

            const filiereStats = {};
            studentsRows.forEach(student => {
                if (!filiereStats[student.filiere]) {
                    filiereStats[student.filiere] = { total: 0, active: 0 };
                }
                filiereStats[student.filiere].total++;
                if (student.actif) filiereStats[student.filiere].active++;
            });

            const anneeStats = {};
            studentsRows.forEach(student => {
                if (!anneeStats[student.annee]) {
                    anneeStats[student.annee] = { total: 0, active: 0 };
                }
                anneeStats[student.annee].total++;
                if (student.actif) anneeStats[student.annee].active++;
            });

            res.json({
                success: true,
                data: {
                    total: totalStudents,
                    active: activeStudents,
                    inactive: inactiveStudents,
                    activationRate: parseFloat(activationRate),
                    byFiliere: filiereStats,
                    byAnnee: anneeStats
                }
            });
        } catch (err) {
            console.error('Erreur récupération statistiques:', err);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
};