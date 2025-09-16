import pool from '../dbconfig.js';
import { randomUUID } from 'crypto';

class NotificationService {
    static validate(data) {
        const required = ['title', 'message', 'type', 'priority', 'userId'];
        for (const field of required) {
            if (!data[field] || typeof data[field] !== 'string') {
                throw new Error(`Champ requis ou invalide : ${field}`);
            }
        }
    }

    static async sendUserNotification(notificationData) {
        try {
            this.validate(notificationData);

            const {
                title, message, type, priority,
                relatedEntity = null, entityId = null, userId
            } = notificationData;

            const id = randomUUID();

            await pool.execute(
                `INSERT INTO notifications 
                 (id, title, message, type, priority, is_read, relatedEntity, entityId, userId, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NOW(), NOW())`,
                [id, title, message, type, priority, relatedEntity, entityId, userId]
            );

            console.log(`✅ Notification envoyée à l'utilisateur ${userId}`);
            return id;
        } catch (error) {
            console.error('❌ Erreur envoi notification utilisateur:', error);
            throw error;
        }
    }

    static async sendGroupNotification(notificationData, userIds) {
        try {
            if (!Array.isArray(userIds) || userIds.length === 0) {
                console.warn('⚠️ Aucun destinataire pour la notification');
                return;
            }

            this.validate(notificationData);

            const {
                title, message, type, priority,
                relatedEntity = null, entityId = null
            } = notificationData;

            const query = `
                INSERT INTO notifications 
                (id, title, message, type, priority, is_read, relatedEntity, entityId, userId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NOW(), NOW())
            `;

            for (const rawId of userIds) {
                const userId = rawId?.trim();
                if (!userId) continue;

                const id = randomUUID();

                try {
                    await pool.execute(query, [
                        id, title, message, type, priority,
                        relatedEntity, entityId, userId
                    ]);
                } catch (err) {
                    console.warn(`❌ Notification échouée pour ${userId}:`, err.message);
                }
            }

            console.log(`✅ Notifications envoyées à ${userIds.length} utilisateur(s)`);
        } catch (error) {
            console.error('❌ Erreur envoi notifications groupées:', error);
            throw error;
        }
    }

    static async notifyNewElection(electionData, concernedStudents) {
        const { id, titre, description } = electionData;
        return await this.sendGroupNotification({
            title: 'Nouvelle Élection',
            message: `Une nouvelle élection "${titre}" a été créée. ${description || ''}`,
            type: 'ELECTION',
            priority: 'MEDIUM',
            relatedEntity: 'election',
            entityId: id
        }, concernedStudents);
    }

    static async notifyCandidatureApproval({ userId, electionId, electionTitle }) {
        return await this.sendUserNotification({
            title: 'Candidature Approuvée',
            message: `Votre candidature pour l'élection "${electionTitle}" a été approuvée.`,
            type: 'CANDIDATURE',
            priority: 'HIGH',
            relatedEntity: 'election',
            entityId: electionId,
            userId
        });
    }

    static async notifyCandidaturePending({ userId, electionId, electionTitle }) {
        return await this.sendUserNotification({
            title: 'Candidature en attente',
            message: `Votre candidature pour l'élection "${electionTitle}" est en cours d'examen.`,
            type: 'CANDIDATURE',
            priority: 'LOW',
            relatedEntity: 'election',
            entityId: electionId,
            userId
        });
    }

    static async notifyCandidatureRejection({ userId, electionId, electionTitle }) {
        return await this.sendUserNotification({
            title: 'Candidature Rejetée',
            message: `Votre candidature pour l'élection "${electionTitle}" a été rejetée.`,
            type: 'CANDIDATURE',
            priority: 'HIGH',
            relatedEntity: 'election',
            entityId: electionId,
            userId
        });
    }

    static async notifyVoteReminder(electionData, students) {
        const { id, titre, dateFin } = electionData;
        const endDate = new Date(dateFin).toLocaleDateString('fr-FR');

        return await this.sendGroupNotification({
            title: 'Rappel de Vote',
            message: `N'oubliez pas de voter pour l'élection "${titre}" avant le ${endDate}.`,
            type: 'REMINDER',
            priority: 'MEDIUM',
            relatedEntity: 'election',
            entityId: id
        }, students);
    }
}

export default NotificationService;
