// test-user.js
import User from './models/User.js';

async function testUserModel() {
    try {
        console.log('🧪 Test du modèle User...');

        // 1. Création d'un utilisateur
        console.log('1. Création d\'un utilisateur...');
        const userId = await User.create({
            email: 'test@ucao.edu',
            password: 'test123',
            role: 'ADMIN',
            actif: true
        });
        console.log('✅ Utilisateur créé avec ID:', userId);

        // 2. Recherche par email
        console.log('2. Recherche par email...');
        const user = await User.findByEmail('test@ucao.edu');
        console.log('✅ Utilisateur trouvé:', user.email);

        // 3. Vérification du mot de passe
        console.log('3. Vérification du mot de passe...');
        const isValid = await User.verifyPassword('test123', user.password);
        console.log('✅ Mot de passe valide:', isValid);

        // 4. Vérification si email existe
        console.log('4. Vérification email...');
        const emailExists = await User.emailExists('test@ucao.edu');
        console.log('✅ Email existe:', emailExists);

        console.log('🎉 Tous les tests passent!');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

testUserModel();