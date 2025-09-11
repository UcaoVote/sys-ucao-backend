import pool from '../dbconfig.js';
import { randomUUID } from 'crypto';
class NotificationService {
    // Envoyer une notification à un utilisateur
    static async sendUserNotification(notificationData) {
        try {
            const { title, message, type, priority, relatedEntity, entityId, userId } = notificationData;

            const id = randomUUID();


            await pool.execute(
                'INSERT INTO notifications (id, title, message, type, priority, relatedEntity, entityId, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [id, title, message, type, priority, relatedEntity, entityId, userId]
            );

            console.log(`Notification envoyée à l'utilisateur ${userId}`);
            return id;
        } catch (error) {
            console.error('Erreur lors de l\'envoi de la notification:', error);
            throw error;
        }
    }

    // Envoyer une notification à un groupe
    static async sendGroupNotification(notificationData, userIds) {
        try {
            if (!Array.isArray(userIds) || userIds.length === 0) {
                console.warn('Aucun destinataire pour la notification');
                return;
            }

            const {
                title,
                message,
                type = 'INFO',
                priority = 'LOW',
                relatedEntity = null,
                entityId = null
            } = notificationData;

            const safe = (val) => (val === undefined || val === '') ? null : val;

            const query = `
                INSERT INTO notifications 
                (title, message, type, priority, is_read, relatedEntity, entityId, userId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;

            for (const rawId of userIds) {
                const userId = safe(rawId);
                if (!userId) {
                    console.warn('ID utilisateur invalide détecté:', rawId);
                    continue;
                }

                await pool.execute(query, [
                    safe(title),
                    safe(message),
                    safe(type),
                    safe(priority),
                    0,
                    safe(relatedEntity),
                    safe(entityId),
                    userId
                ]);
            }

            console.log(`✅ Notifications envoyées à ${userIds.length} utilisateur(s)`);
        } catch (error) {
            console.error('Erreur lors de l\'envoi des notifications groupées:', error);
            throw error;
        }
    }

    // Notification pour une nouvelle élection
    static async notifyNewElection(electionData, concernedStudents) {
        try {
            const { id, titre, description } = electionData;

            const notificationData = {
                title: 'Nouvelle Élection',
                message: `Une nouvelle élection "${titre}" a été créée. ${description || ''}`,
                type: 'ELECTION',
                priority: 'MEDIUM',
                relatedEntity: 'election',
                entityId: id
            };

            return await this.sendGroupNotification(notificationData, concernedStudents);
        } catch (error) {
            console.error('Erreur lors de la notification de nouvelle élection:', error);
            throw error;
        }
    }


    // Notification pour approbation de candidature
    static async notifyCandidatureApproval(candidateData) {
        try {
            const { userId, electionId, electionTitle } = candidateData;

            return await this.sendUserNotification({
                title: 'Candidature Approuvée',
                message: `Votre candidature pour l'élection "${electionTitle}" a été approuvée.`,
                type: 'CANDIDATURE',
                priority: 'HIGH',
                relatedEntity: 'election',
                entityId: electionId,
                userId: userId
            });
        } catch (error) {
            console.error('Erreur lors de la notification d\'approbation:', error);
            throw error;
        }
    }

    // Notification pour mise en attente de candidature
    static async notifyCandidaturePending(candidateData) {
        try {
            const { userId, electionId, electionTitle } = candidateData;

            return await this.sendUserNotification({
                title: 'Candidature en attente',
                message: `Votre candidature pour l'élection "${electionTitle}" est en cours d'examen.`,
                type: 'CANDIDATURE',
                priority: 'LOW',
                relatedEntity: 'election',
                entityId: electionId,
                userId: userId
            });
        } catch (error) {
            console.error('Erreur lors de la notification de mise en attente:', error);
            throw error;
        }
    }

    // Notification pour rejet de candidature
    static async notifyCandidatureRejection(candidateData) {
        try {
            const { userId, electionId, electionTitle } = candidateData;

            return await this.sendUserNotification({
                title: 'Candidature Rejetée',
                message: `Votre candidature pour l'élection "${electionTitle}" a été rejetée.`,
                type: 'CANDIDATURE',
                priority: 'HIGH',
                relatedEntity: 'election',
                entityId: electionId,
                userId: userId
            });
        } catch (error) {
            console.error('Erreur lors de la notification de rejet:', error);
            throw error;
        }
    }


    // Notification pour rappel de vote
    static async notifyVoteReminder(electionData, students) {
        try {
            const { id, titre, dateFin } = electionData;
            const endDate = new Date(dateFin).toLocaleDateString('fr-FR');

            const notificationData = {
                title: 'Rappel de Vote',
                message: `N'oubliez pas de voter pour l'élection "${titre}" avant le ${endDate}.`,
                type: 'REMINDER',
                priority: 'MEDIUM',
                relatedEntity: 'election',
                entityId: id
            };

            return await this.sendGroupNotification(notificationData, students);
        } catch (error) {
            console.error('Erreur lors de l\'envoi des rappels:', error);
            throw error;
        }
    }
}

export default NotificationService;