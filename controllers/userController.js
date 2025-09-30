import userService from '../services/userService.js';
import pool from '../dbconfig.js';
class UserController {
    async register(req, res) {
        try {
            const {
                email, password, confirmPassword,
                nom, prenom, filiereId, ecoleId,
                annee, codeInscription, matricule,
                activities, whatsapp, additionalInfo
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

            // Validation optionnelle du WhatsApp
            if (whatsapp && !userService.validatePhone(whatsapp)) {
                return res.status(400).json({
                    success: false,
                    message: 'Format du numéro WhatsApp invalide.'
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

            // Vérifier que la filière appartient bien à l'école
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
                    codeInscription, whatsapp, additionalInfo, activities
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
                    matricule, whatsapp, additionalInfo, activities
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

            // Créer l'étudiant et récupérer l'ID réel
            const { tempId, studentId } = await userService.createFirstYearStudent(studentData, userId);

            // Marquer le code comme utilisé
            await userService.markCodeAsUsed(studentData.codeInscription, userId);

            // S'assurer que activities est un tableau valide
            const activities = Array.isArray(studentData.activities)
                ? studentData.activities.filter(activityId =>
                    activityId !== undefined &&
                    activityId !== null &&
                    !isNaN(parseInt(activityId)))
                : [];

            // CORRECTION : Utiliser le tableau filtré 'activities' au lieu de 'studentData.activities'
            if (activities.length > 0) {
                await this.insertStudentActivities(studentId, activities, connection);
            }

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
                        filiere: filiereRows[0]?.nom || null,
                        whatsapp: studentData.whatsapp || null,
                        additionalInfo: studentData.additionalInfo || null,
                        activities: activities // CORRECTION : Utiliser le tableau filtré
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

            // Mettre à jour l'étudiant existant avec les nouvelles données
            const tempId = await userService.updateStudent(
                {
                    ...studentData,
                    tempId: matriculeValidation.tempId,
                    whatsapp: studentData.whatsapp,
                    additionalInfo: studentData.additionalInfo
                },
                matriculeValidation.studentId,
                userId
            );

            // Insérer les activités sélectionnées
            if (studentData.activities && studentData.activities.length > 0) {
                await this.insertStudentActivities(matriculeValidation.studentId, studentData.activities, connection);
            }

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
                        filiere: filiereRows[0]?.nom || null,
                        whatsapp: studentData.whatsapp || null,
                        additionalInfo: studentData.additionalInfo || null,
                        activities: studentData.activities || []
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

    async insertStudentActivities(studentId, activities, connection) {
        // Vérifier que studentId est défini
        if (!studentId) {
            throw new Error("ID étudiant non défini.");
        }

        // Filtrer et valider les activités
        if (activities && Array.isArray(activities) && activities.length > 0) {
            // Filtrer les activités valides (non undefined, non null, nombres)
            const validActivities = activities.filter(activityId =>
                activityId !== undefined &&
                activityId !== null &&
                !isNaN(parseInt(activityId))
            );

            if (validActivities.length === 0) {
                console.log("Aucune activité valide à insérer");
                return;
            }

            // Vérifier d'abord que les activités existent
            const placeholders = validActivities.map(() => '?').join(',');
            const [existingActivities] = await connection.execute(
                `SELECT id FROM activities WHERE id IN (${placeholders}) AND actif = TRUE`,
                validActivities
            );

            if (existingActivities.length !== validActivities.length) {
                const existingIds = existingActivities.map(a => a.id);
                const invalidActivities = validActivities.filter(id => !existingIds.includes(id));
                console.warn("Activités invalides ignorées:", invalidActivities);
            }

            // Récupérer l'ID réel de l'étudiant
            const [studentRows] = await connection.execute(
                'SELECT id FROM etudiants WHERE identifiantTemporaire = ? OR id = ?',
                [studentId, studentId]
            );

            if (studentRows.length === 0) {
                throw new Error("Étudiant non trouvé.");
            }

            const realStudentId = studentRows[0].id;

            // Utiliser seulement les activités valides qui existent
            const validExistingActivities = validActivities.filter(activityId =>
                existingActivities.some(a => a.id === activityId)
            );

            if (validExistingActivities.length > 0) {
                // Insérer les activités
                const activityValues = validExistingActivities.map(activityId => [realStudentId, activityId]);
                await connection.query(
                    'INSERT INTO student_activities (student_id, activity_id) VALUES ?',
                    [activityValues]
                );

                console.log(`${validExistingActivities.length} activités insérées pour l'étudiant ${realStudentId}`);
            } else {
                console.log("Aucune activité valide à insérer après validation");
            }
        } else {
            console.log("Aucune activité fournie ou tableau vide");
        }
    }
}

export default new UserController();