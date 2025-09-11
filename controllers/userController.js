import userService from '../services/userService.js';
import pool from '../dbconfig.js';
class UserController {

    async register(req, res) {
        try {
            const {
                email, password, confirmPassword,
                nom, prenom, filiereId, ecoleId,
                annee, codeInscription, matricule
            } = req.body;

            // Validation des champs obligatoires
            if (!email || !password || !confirmPassword || !nom || !prenom || !filiereId || !ecoleId || !annee) {
                return res.status(400).json({
                    success: false,
                    message: 'Tous les champs obligatoires sont requis.'
                });
            }

            // Validation des mots de passe identiques
            if (password !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Les mots de passe ne correspondent pas.'
                });
            }

            const anneeInt = Number.parseInt(annee, 10);
            if (!Number.isInteger(anneeInt) || anneeInt < 1 || anneeInt > 3) {
                return res.status(400).json({
                    success: false,
                    message: "L'année doit être entre 1 et 3."
                });
            }

            // Validation des formats
            if (!userService.validateEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Format email invalide.'
                });
            }

            if (!userService.validatePassword(password)) {
                return res.status(400).json({
                    success: false,
                    message: 'Le mot de passe doit contenir 8+ caractères, 1 majuscule, 1 chiffre et 1 caractère spécial.'
                });
            }

            if (!userService.validateText(nom) || !userService.validateText(prenom)) {
                return res.status(400).json({
                    success: false,
                    message: 'Le nom et prénom ne doivent pas contenir de caractères spéciaux.'
                });
            }

            // Vérifier si l'email existe déjà
            const emailExists = await userService.checkEmailExists(email);
            if (emailExists) {
                return res.status(409).json({
                    success: false,
                    message: "Cet email est déjà utilisé."
                });
            }

            // Vérifier que la filière appartient bien à l’école
            const filiereValide = await userService.checkFiliereInEcole(filiereId, ecoleId);
            if (!filiereValide) {
                return res.status(400).json({
                    success: false,
                    message: "La filière sélectionnée n'appartient pas à l'école choisie."
                });
            }

            let result;

            // 1ère année : code d'inscription
            if (anneeInt === 1) {
                if (!codeInscription) {
                    return res.status(400).json({
                        success: false,
                        message: "Code d'inscription requis pour la 1ère année."
                    });
                }

                result = await this.handleFirstYearRegistration({
                    email, password, nom, prenom,
                    filiereId, ecoleId, annee: anneeInt,
                    codeInscription
                });
            }
            // 2e/3e année : matricule
            else {
                if (!matricule) {
                    return res.status(400).json({
                        success: false,
                        message: 'Matricule requis pour les années supérieures.'
                    });
                }

                result = await this.handleUpperYearRegistration({
                    email, password, nom, prenom,
                    filiereId, ecoleId, annee: anneeInt,
                    matricule
                });
            }

            res.status(201).json(result);
        } catch (error) {
            console.error('Erreur inscription:', error);
            res.status(500).json({
                success: false,
                message: 'Une erreur serveur est survenue.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }


    async handleFirstYearRegistration(studentData) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Valider le code d'inscription
            const codeValidation = await userService.validateRegistrationCode(studentData.codeInscription);
            if (!codeValidation.valid) {
                throw new Error(codeValidation.message);
            }

            // Créer l'utilisateur
            const userId = await userService.createUser(studentData);

            // Créer l'étudiant
            const tempId = await userService.createFirstYearStudent(studentData, userId);

            // Marquer le code comme utilisé
            await userService.markCodeAsUsed(studentData.codeInscription, userId);

            await connection.commit();

            // Récupérer les noms en clair
            const [ecoleRows] = await connection.execute(`SELECT nom FROM ecoles WHERE id = ?`, [studentData.ecoleId]);
            const [filiereRows] = await connection.execute(`SELECT nom FROM filieres WHERE id = ?`, [studentData.filiereId]);

            return {
                success: true,
                message: "Inscription réussie.",
                data: {
                    student: {
                        id: userId,
                        nom: studentData.nom,
                        prenom: studentData.prenom,
                        identifiantTemporaire: tempId,
                        annee: studentData.annee,
                        ecole: ecoleRows[0]?.nom || null,
                        filiere: filiereRows[0]?.nom || null
                    }
                }
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            await connection.release();
        }
    }

    async handleUpperYearRegistration(studentData) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Valider le matricule
            const matriculeValidation = await userService.validateMatricule(studentData.matricule);
            if (!matriculeValidation.valid) {
                throw new Error(matriculeValidation.message);
            }

            // Créer l'utilisateur
            const userId = await userService.createUser(studentData);

            // Mettre à jour l'étudiant existant
            const tempId = await userService.updateStudent(
                { ...studentData, tempId: matriculeValidation.tempId },
                matriculeValidation.studentId,
                userId
            );

            await connection.commit();

            // Récupérer les noms en clair
            const [ecoleRows] = await connection.execute(`SELECT nom FROM ecoles WHERE id = ?`, [studentData.ecoleId]);
            const [filiereRows] = await connection.execute(`SELECT nom FROM filieres WHERE id = ?`, [studentData.filiereId]);

            return {
                success: true,
                message: 'Inscription réussie.',
                data: {
                    student: {
                        id: userId,
                        nom: studentData.nom,
                        prenom: studentData.prenom,
                        matricule: studentData.matricule,
                        identifiantTemporaire: tempId,
                        annee: studentData.annee,
                        ecole: ecoleRows[0]?.nom || null,
                        filiere: filiereRows[0]?.nom || null
                    }
                }
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            await connection.release();
        }
    }

}

export default new UserController();