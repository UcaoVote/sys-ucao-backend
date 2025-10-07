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
            if (!etudiant.matricule && !etudiant.codeInscription) {
                erreursEtudiant.push('Matricule ou code d\'inscription requis');
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

            if (etudiant.codeInscription && etudiant.codeInscription.length > 50) {
                erreursEtudiant.push('Code d\'inscription trop long (max 50 caractères)');
            }

            if (etudiant.whatsapp && etudiant.whatsapp.length > 30) {
                erreursEtudiant.push('Numéro WhatsApp trop long (max 30 caractères)');
            }

            if (erreursEtudiant.length === 0) {
                // Normaliser les données
                donneesValides.push({
                    matricule: etudiant.matricule ? etudiant.matricule.trim() : null,
                    codeInscription: etudiant.codeInscription ? etudiant.codeInscription.trim() : null,
                    nom: etudiant.nom.trim(),
                    prenom: etudiant.prenom.trim(),
                    ecole: etudiant.ecole.trim(),
                    filiere: etudiant.filiere.trim(),
                    annee: parseInt(etudiant.annee),
                    whatsapp: etudiant.whatsapp ? etudiant.whatsapp.trim() : null,
                    email: etudiant.email ? etudiant.email.trim() : null
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

                if (etudiant.codeInscription) {
                    conditions.push('codeInscription = ?');
                    params.push(etudiant.codeInscription);
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
                    SELECT id, matricule, codeInscription 
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

    async importerEtudiants(etudiants) {
        let connection;
        const importes = [];
        const echecs = [];

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            for (const etudiant of etudiants) {
                try {
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
                    if (etudiant.codeInscription) {
                        conditions.push('codeInscription = ?');
                        params.push(etudiant.codeInscription);
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

                    // 3. Trouver l'école par nom
                    const [ecoleRows] = await connection.execute(
                        'SELECT id FROM ecoles WHERE nom = ? AND actif = 1',
                        [etudiant.ecole]
                    );

                    if (ecoleRows.length === 0) {
                        throw new Error(`École "${etudiant.ecole}" non trouvée`);
                    }

                    const ecoleId = ecoleRows[0].id;

                    // 4. Trouver la filière par nom et école
                    const [filiereRows] = await connection.execute(
                        'SELECT id FROM filieres WHERE nom = ? AND ecoleId = ? AND actif = 1',
                        [etudiant.filiere, ecoleId]
                    );

                    if (filiereRows.length === 0) {
                        throw new Error(`Filière "${etudiant.filiere}" non trouvée dans l'école "${etudiant.ecole}"`);
                    }

                    const filiereId = filiereRows[0].id;

                    // 5. Générer un identifiant temporaire unique
                    const identifiantTemporaire = this.genererIdentifiantTemporaire();

                    // 6. Générer un email si non fourni
                    const email = etudiant.email || `${etudiant.matricule || etudiant.codeInscription || identifiantTemporaire}@ucao-temp.com`;

                    // 7. Créer le COMPTE USER (avec email mais SANS MOT DE PASSE)
                    const userId = this.genererUserId();

                    // IMPORTANT: On ne met pas de password, l'étudiant le définira à la première connexion
                    await connection.execute(
                        `INSERT INTO users (id, email, role, actif, createdAt) 
                     VALUES (?, ?, 'ETUDIANT', TRUE, NOW())`,
                        [userId, email]
                    );

                    // 8. Créer l'ÉTUDIANT (lié au user)
                    const [result] = await connection.execute(
                        `INSERT INTO etudiants 
                     (userId, matricule, codeInscription, identifiantTemporaire, nom, prenom, annee, ecoleId, filiereId, whatsapp) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            userId,
                            etudiant.matricule,
                            etudiant.codeInscription,
                            identifiantTemporaire,
                            etudiant.nom,
                            etudiant.prenom,
                            etudiant.annee,
                            ecoleId,
                            filiereId,
                            etudiant.whatsapp
                        ]
                    );

                    importes.push({
                        id: result.insertId,
                        userId: userId,
                        identifiantTemporaire: identifiantTemporaire,
                        nom: etudiant.nom,
                        prenom: etudiant.prenom,
                        email: email,
                        matricule: etudiant.matricule,
                        codeInscription: etudiant.codeInscription,
                        ecole: etudiant.ecole,
                        filiere: etudiant.filiere
                    });

                } catch (error) {
                    echecs.push({
                        etudiant: etudiant,
                        erreur: error.message
                    });
                }
            }

            await connection.commit();
            return { importes, echecs };

        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) await connection.release();
        }
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