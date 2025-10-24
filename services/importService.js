import pool from '../dbconfig.js';

export const importService = {
    async verifyAdmin(userId) {
        let connection;
        try {
            connection = await pool.getConnection();
            const [adminRows] = await connection.execute(
                'SELECT id FROM admins WHERE userId = ?',
                [userId]
            );
            return adminRows.length > 0;
        } finally {
            if (connection) await connection.release();
        }
    },

    async validerEtudiants(etudiants) {
        const donneesValides = [];
        const erreurs = [];

        for (let i = 0; i < etudiants.length; i++) {
            const etudiant = etudiants[i];
            const erreursEtudiant = [];

            // Vérifier qu'au moins un identifiant est fourni
            if (!etudiant.matricule) {
                erreursEtudiant.push('Matricule requis');
            }

            // Validation des champs obligatoires
            if (!etudiant.nom || etudiant.nom.trim().length === 0) {
                erreursEtudiant.push('Nom requis');
            }

            if (!etudiant.prenom || etudiant.prenom.trim().length === 0) {
                erreursEtudiant.push('Prénom requis');
            }

            if (!etudiant.ecole || etudiant.ecole.trim().length === 0) {
                erreursEtudiant.push('École requise');
            }

            if (!etudiant.filiere || etudiant.filiere.trim().length === 0) {
                erreursEtudiant.push('Filière requise');
            }

            if (!etudiant.annee || etudiant.annee < 1) {
                erreursEtudiant.push('Année valide requise (≥ 1)');
            }

            // Validation des formats
            if (etudiant.matricule && etudiant.matricule.length > 50) {
                erreursEtudiant.push('Matricule trop long (max 50 caractères)');
            }

            if (etudiant.whatsapp && etudiant.whatsapp.length > 30) {
                erreursEtudiant.push('Numéro WhatsApp trop long (max 30 caractères)');
            }

            if (etudiant.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(etudiant.email)) {
                    erreursEtudiant.push('Format d\'email invalide');
                }
            }

            if (erreursEtudiant.length === 0) {
                // Normaliser les données
                donneesValides.push({
                    matricule: etudiant.matricule ? etudiant.matricule.trim() : null,
                    nom: etudiant.nom.trim(),
                    prenom: etudiant.prenom.trim(),
                    ecole: etudiant.ecole.trim(),
                    filiere: etudiant.filiere.trim(),
                    annee: parseInt(etudiant.annee),
                    whatsapp: etudiant.whatsapp ? etudiant.whatsapp.trim() : null,
                    email: etudiant.email ? etudiant.email.trim().toLowerCase() : null
                });
            } else {
                erreurs.push({
                    ligne: i + 1,
                    donnees: etudiant,
                    erreurs: erreursEtudiant
                });
            }
        }

        return {
            donnees: donneesValides,
            erreurs: erreurs
        };
    },

    async verifierDoublons(etudiants) {
        let connection;
        const doublons = [];

        try {
            connection = await pool.getConnection();

            for (const etudiant of etudiants) {
                const conditions = [];
                const params = [];

                if (etudiant.matricule) {
                    conditions.push('matricule = ?');
                    params.push(etudiant.matricule);
                }

                if (etudiant.email) {
                    // Vérifier aussi les doublons d'email dans users
                    const [existingEmail] = await connection.execute(
                        'SELECT id FROM users WHERE email = ?',
                        [etudiant.email]
                    );
                    if (existingEmail.length > 0) {
                        doublons.push({
                            etudiant: etudiant,
                            existants: [{ type: 'email', value: etudiant.email }]
                        });
                        continue;
                    }
                }

                if (conditions.length === 0) continue;

                const query = `
                    SELECT id, matricule
                    FROM etudiants
                    WHERE ${conditions.join(' OR ')}
                `;

                const [existingRows] = await connection.execute(query, params);

                if (existingRows.length > 0) {
                    doublons.push({
                        etudiant: etudiant,
                        existants: existingRows
                    });
                }
            }

            return doublons;
        } finally {
            if (connection) await connection.release();
        }
    },

    async importerEtudiants(etudiants, updateExisting = false) {
        let connection;
        const importes = [];
        const misAJour = [];
        const echecs = [];

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            for (const etudiant of etudiants) {
                try {
                    // 1. Vérifier si l'étudiant existe déjà
                    const etudiantExistant = await this.trouverEtudiantExistant(connection, etudiant);

                    if (etudiantExistant) {
                        if (updateExisting) {
                            // METTRE À JOUR l'étudiant existant
                            const etudiantMAJ = await this.mettreAJourEtudiant(connection, etudiantExistant, etudiant);
                            misAJour.push(etudiantMAJ);
                        } else {
                            throw new Error('Étudiant déjà existant');
                        }
                    } else {
                        // CRÉER un nouvel étudiant
                        const nouvelEtudiant = await this.creerNouvelEtudiant(connection, etudiant);
                        importes.push(nouvelEtudiant);
                    }

                } catch (error) {
                    echecs.push({
                        etudiant: etudiant,
                        erreur: error.message
                    });
                }
            }

            await connection.commit();
            return { importes, misAJour, echecs };

        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.release();
        }
    },

    async trouverEtudiantExistant(connection, etudiant) {
        const conditions = [];
        const params = [];

        if (etudiant.matricule) {
            conditions.push('matricule = ?');
            params.push(etudiant.matricule);
        }

        if (conditions.length === 0) return null;

        const [existing] = await connection.execute(
            `SELECT e.*, u.id as user_id, u.email 
             FROM etudiants e 
             LEFT JOIN users u ON e.userId = u.id 
             WHERE ${conditions.join(' OR ')}`,
            params
        );

        return existing.length > 0 ? existing[0] : null;
    },

    async mettreAJourEtudiant(connection, etudiantExistant, nouvellesDonnees) {
        // 1. Trouver l'école et la filière
        const ecoleId = await this.trouverOuCreerEcole(connection, nouvellesDonnees.ecole);
        const filiereId = await this.trouverOuCreerFiliere(connection, nouvellesDonnees.filiere, ecoleId);

        // 2. Mettre à jour l'étudiant
        await connection.execute(
            `UPDATE etudiants 
             SET nom = ?, prenom = ?, annee = ?, ecoleId = ?, filiereId = ?, whatsapp = ?
             WHERE id = ?`,
            [
                nouvellesDonnees.nom,
                nouvellesDonnees.prenom,
                nouvellesDonnees.annee,
                ecoleId,
                filiereId,
                nouvellesDonnees.whatsapp,
                etudiantExistant.id
            ]
        );

        // 3. Mettre à jour l'email si fourni et différent
        if (nouvellesDonnees.email && nouvellesDonnees.email !== etudiantExistant.email) {
            // Vérifier que le nouvel email n'est pas déjà utilisé
            const [emailExists] = await connection.execute(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [nouvellesDonnees.email, etudiantExistant.user_id]
            );

            if (emailExists.length === 0) {
                await connection.execute(
                    'UPDATE users SET email = ? WHERE id = ?',
                    [nouvellesDonnees.email, etudiantExistant.user_id]
                );
            } else {
                console.warn(`Email ${nouvellesDonnees.email} déjà utilisé, conservation de l'ancien email`);
            }
        }

        return {
            id: etudiantExistant.id,
            userId: etudiantExistant.user_id,
            identifiantTemporaire: etudiantExistant.identifiantTemporaire,
            nom: nouvellesDonnees.nom,
            prenom: nouvellesDonnees.prenom,
            email: nouvellesDonnees.email || etudiantExistant.email,
            matricule: etudiantExistant.matricule,
            ecole: nouvellesDonnees.ecole,
            filiere: nouvellesDonnees.filiere,
            action: 'MIS_A_JOUR'
        };
    },

    async trouverOuCreerEcole(connection, nomEcole) {
        const [ecoleRows] = await connection.execute(
            'SELECT id FROM ecoles WHERE nom = ? AND actif = 1',
            [nomEcole]
        );

        if (ecoleRows.length > 0) {
            return ecoleRows[0].id;
        }

        // Créer l'école si elle n'existe pas
        const [result] = await connection.execute(
            'INSERT INTO ecoles (nom, actif, createdAt) VALUES (?, 1, NOW())',
            [nomEcole]
        );

        return result.insertId;
    },

    async trouverOuCreerFiliere(connection, nomFiliere, ecoleId) {
        const [filiereRows] = await connection.execute(
            'SELECT id FROM filieres WHERE nom = ? AND ecoleId = ? AND actif = 1',
            [nomFiliere, ecoleId]
        );

        if (filiereRows.length > 0) {
            return filiereRows[0].id;
        }

        // Créer la filière si elle n'existe pas
        const [result] = await connection.execute(
            'INSERT INTO filieres (nom, ecoleId, actif, createdAt) VALUES (?, ?, 1, NOW())',
            [nomFiliere, ecoleId]
        );

        return result.insertId;
    },

    async creerNouvelEtudiant(connection, etudiant) {
        // 1. Vérifier les doublons d'email dans users
        if (etudiant.email) {
            const [existingEmail] = await connection.execute(
                'SELECT id FROM users WHERE email = ?',
                [etudiant.email]
            );
            if (existingEmail.length > 0) {
                throw new Error('Email déjà utilisé par un autre utilisateur');
            }
        }

        // 2. Vérifier les doublons dans etudiants
        const conditions = [];
        const params = [];

        if (etudiant.matricule) {
            conditions.push('matricule = ?');
            params.push(etudiant.matricule);
        }

        if (conditions.length > 0) {
            const [existing] = await connection.execute(
                `SELECT id FROM etudiants WHERE ${conditions.join(' OR ')}`,
                params
            );
            if (existing.length > 0) {
                throw new Error('Étudiant déjà existant (doublon)');
            }
        }

        // 3. Trouver ou créer l'école
        const ecoleId = await this.trouverOuCreerEcole(connection, etudiant.ecole);

        // 4. Trouver ou créer la filière
        const filiereId = await this.trouverOuCreerFiliere(connection, etudiant.filiere, ecoleId);

        // 5. Générer un identifiant temporaire unique
        const identifiantTemporaire = this.genererIdentifiantTemporaire();

        // 6. Générer un email si non fourni
        const email = etudiant.email || `${etudiant.matricule || identifiantTemporaire}@ucao-temp.com`;

        // 7. Créer le COMPTE USER (avec email mais SANS MOT DE PASSE)
        const userId = this.genererUserId();

        await connection.execute(
            `INSERT INTO users (id, email, role, actif, createdAt) 
             VALUES (?, ?, 'ETUDIANT', TRUE, NOW())`,
            [userId, email]
        );

        // 8. Créer l'ÉTUDIANT (lié au user)
        const [result] = await connection.execute(
            `INSERT INTO etudiants 
             (userId, matricule, identifiantTemporaire, nom, prenom, annee, ecoleId, filiereId, whatsapp) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                etudiant.matricule,
                identifiantTemporaire,
                etudiant.nom,
                etudiant.prenom,
                etudiant.annee,
                ecoleId,
                filiereId,
                etudiant.whatsapp
            ]
        );

        return {
            id: result.insertId,
            userId: userId,
            identifiantTemporaire: identifiantTemporaire,
            nom: etudiant.nom,
            prenom: etudiant.prenom,
            email: email,
            matricule: etudiant.matricule,
            ecole: etudiant.ecole,
            filiere: etudiant.filiere,
            action: 'CRÉÉ'
        };
    },

    genererIdentifiantTemporaire() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `TEMP${timestamp}${random}`.toUpperCase();
    },

    genererUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
};