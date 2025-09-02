// check-env.js
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Variables d\'environnement:');
console.log('MYSQLHOST:', process.env.MYSQLHOST);
console.log('MYSQLUSER:', process.env.MYSQLUSER);
console.log('MYSQLDATABASE:', process.env.MYSQLDATABASE);
console.log('MYSQLPORT:', process.env.MYSQLPORT);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);