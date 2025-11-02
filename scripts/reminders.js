// scripts/reminders.js
import cron from 'node-cron';
import pool from '../database/dbconfig.js';
import NotificationService from '../services/notificationService.js';

// Tâche planifiée pour envoyer des rappels tous les jours à 9h
cron.schedule('0 9 * * *', async () => {
    try {
        console.log('Envoi des rappels de vote...');

        // Récupérer les élections en cours qui se terminent dans moins de 2 jours
        const [elections] = await pool.execute(`
      SELECT e.* 
      FROM elections e
      WHERE e.isActive = TRUE 
        AND e.dateFin BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 DAY)
        AND e.dateDebut <= NOW()
    `);

        for (const election of elections) {
            // Récupérer les étudiants qui n'ont pas encore voté
            const [nonVoters] = await pool.execute(`
        SELECT et.userId 
        FROM etudiants et
        JOIN users u ON et.userId = u.id
        WHERE u.actif = TRUE
          AND et.userId NOT IN (
            SELECT v.userId 
            FROM votes v 
            WHERE v.electionId = ?
          )
          AND (
            ? = 'UNIVERSITE' OR
            (? = 'ECOLE' AND et.ecole = ?) OR
            (? = 'SALLE' AND et.filiere = ? AND et.annee = ? AND et.ecole = ?)
          )
      `, [
                election.id,
                election.type,
                election.type, election.ecole,
                election.type, election.filiere, election.annee, election.ecole
            ]);

            // Envoyer des rappels aux étudiants qui n'ont pas voté
            if (nonVoters.length > 0) {
                await NotificationService.notifyVoteReminder(election, nonVoters);
                console.log(`Rappels envoyés pour l'élection ${election.titre}: ${nonVoters.length} étudiants`);
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi des rappels:', error);
    }
});

export default cron;