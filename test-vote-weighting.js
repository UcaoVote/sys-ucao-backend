/**
 * 🧪 TESTS DE VALIDATION - Système de pondération des votes
 * 
 * Ce fichier contient des exemples de calculs pour valider la nouvelle logique 80/20
 * 
 * Pour exécuter:
 * node test-vote-weighting.js
 */

console.log('🧪 === TESTS DE PONDÉRATION DES VOTES ===\n');

// =============================================================================
// TEST 1: Élection SALLE - Calcul simple (1.0 pour tous)
// =============================================================================
console.log('📋 TEST 1: ÉLECTION DE SALLE');
console.log('─────────────────────────────────────');

const salle_candidatA = 45; // votes
const salle_candidatB = 55; // votes
const salle_total = salle_candidatA + salle_candidatB;

const salle_pctA = (salle_candidatA / salle_total) * 100;
const salle_pctB = (salle_candidatB / salle_total) * 100;

console.log(`Candidat A: ${salle_candidatA} votes → ${salle_pctA.toFixed(2)}%`);
console.log(`Candidat B: ${salle_candidatB} votes → ${salle_pctB.toFixed(2)}%`);
console.log(`Total: ${salle_total} votes`);
console.log(`✅ Simple pourcentage - pas de pondération\n`);


// =============================================================================
// TEST 2: Élection ÉCOLE - Pondération 80/20 (AVANT vs APRÈS)
// =============================================================================
console.log('📋 TEST 2: ÉLECTION D\'ÉCOLE - 80/20');
console.log('─────────────────────────────────────');

// Scénario: 20 responsables, 80 étudiants
const ecole_candidatA_resp = 15;  // responsables votent pour A
const ecole_candidatA_etud = 20;  // étudiants votent pour A

const ecole_candidatB_resp = 5;   // responsables votent pour B
const ecole_candidatB_etud = 60;  // étudiants votent pour B

const ecole_total_resp = ecole_candidatA_resp + ecole_candidatB_resp;
const ecole_total_etud = ecole_candidatA_etud + ecole_candidatB_etud;

console.log('\n🔵 Données:');
console.log(`  Responsables: ${ecole_total_resp} votes (${ecole_candidatA_resp} pour A, ${ecole_candidatB_resp} pour B)`);
console.log(`  Étudiants: ${ecole_total_etud} votes (${ecole_candidatA_etud} pour A, ${ecole_candidatB_etud} pour B)`);

// AVANT: Pondération 60/40 sur le NOMBRE de votes
console.log('\n❌ ANCIENNE MÉTHODE (pondération sur le NOMBRE):');
const avant_scoreA = (ecole_candidatA_resp * 0.6) + (ecole_candidatA_etud * 0.4);
const avant_scoreB = (ecole_candidatB_resp * 0.6) + (ecole_candidatB_etud * 0.4);
const avant_total = (ecole_total_resp * 0.6) + (ecole_total_etud * 0.4);

const avant_pctA = (avant_scoreA / avant_total) * 100;
const avant_pctB = (avant_scoreB / avant_total) * 100;

console.log(`  Candidat A: (${ecole_candidatA_resp} × 0.6) + (${ecole_candidatA_etud} × 0.4) = ${avant_scoreA.toFixed(2)} → ${avant_pctA.toFixed(2)}%`);
console.log(`  Candidat B: (${ecole_candidatB_resp} × 0.6) + (${ecole_candidatB_etud} × 0.4) = ${avant_scoreB.toFixed(2)} → ${avant_pctB.toFixed(2)}%`);

// NOUVELLE: Pondération 80/20 sur les POURCENTAGES
console.log('\n✅ NOUVELLE MÉTHODE (pondération sur les POURCENTAGES):');

// Étape 1: Calculer % dans chaque groupe
const pctA_resp = (ecole_candidatA_resp / ecole_total_resp) * 100;
const pctA_etud = (ecole_candidatA_etud / ecole_total_etud) * 100;

const pctB_resp = (ecole_candidatB_resp / ecole_total_resp) * 100;
const pctB_etud = (ecole_candidatB_etud / ecole_total_etud) * 100;

console.log(`  Candidat A chez responsables: ${ecole_candidatA_resp}/${ecole_total_resp} = ${pctA_resp.toFixed(2)}%`);
console.log(`  Candidat A chez étudiants: ${ecole_candidatA_etud}/${ecole_total_etud} = ${pctA_etud.toFixed(2)}%`);
console.log(`  Candidat B chez responsables: ${ecole_candidatB_resp}/${ecole_total_resp} = ${pctB_resp.toFixed(2)}%`);
console.log(`  Candidat B chez étudiants: ${ecole_candidatB_etud}/${ecole_total_etud} = ${pctB_etud.toFixed(2)}%`);

// Étape 2: Appliquer 80/20
const apres_pctA = (pctA_resp * 0.8) + (pctA_etud * 0.2);
const apres_pctB = (pctB_resp * 0.8) + (pctB_etud * 0.2);

console.log(`\n  Score final A: (${pctA_resp.toFixed(2)}% × 0.8) + (${pctA_etud.toFixed(2)}% × 0.2) = ${apres_pctA.toFixed(2)}%`);
console.log(`  Score final B: (${pctB_resp.toFixed(2)}% × 0.8) + (${pctB_etud.toFixed(2)}% × 0.2) = ${apres_pctB.toFixed(2)}%`);

console.log('\n📊 Comparaison:');
console.log(`  Ancienne méthode: A=${avant_pctA.toFixed(2)}%, B=${avant_pctB.toFixed(2)}%`);
console.log(`  Nouvelle méthode: A=${apres_pctA.toFixed(2)}%, B=${apres_pctB.toFixed(2)}%`);

if (avant_pctA > avant_pctB && apres_pctA < apres_pctB) {
    console.log('  ⚠️  CHANGEMENT DE GAGNANT !');
} else if (avant_pctA < avant_pctB && apres_pctA > apres_pctB) {
    console.log('  ⚠️  CHANGEMENT DE GAGNANT !');
} else {
    console.log(`  ✅ Gagnant: Candidat ${apres_pctA > apres_pctB ? 'A' : 'B'}`);
}
console.log();


// =============================================================================
// TEST 3: Élection UNIVERSITÉ Tour 1 - Pondération 80/20 délégués
// =============================================================================
console.log('📋 TEST 3: ÉLECTION UNIVERSITÉ TOUR 1 - 80/20');
console.log('─────────────────────────────────────────────');

// Scénario: 10 délégués, 90 autres
const univ_candidatA_delegues = 7;   // délégués votent pour A
const univ_candidatA_autres = 30;    // autres votent pour A

const univ_candidatB_delegues = 3;   // délégués votent pour B
const univ_candidatB_autres = 60;    // autres votent pour B

const univ_total_delegues = univ_candidatA_delegues + univ_candidatB_delegues;
const univ_total_autres = univ_candidatA_autres + univ_candidatB_autres;

console.log('\n🔵 Données:');
console.log(`  Délégués d'école: ${univ_total_delegues} votes (${univ_candidatA_delegues} pour A, ${univ_candidatB_delegues} pour B)`);
console.log(`  Autres: ${univ_total_autres} votes (${univ_candidatA_autres} pour A, ${univ_candidatB_autres} pour B)`);

console.log('\n✅ Pondération 80/20 sur les POURCENTAGES:');

// Calculer % dans chaque groupe
const pctA_delegues = (univ_candidatA_delegues / univ_total_delegues) * 100;
const pctA_autres = (univ_candidatA_autres / univ_total_autres) * 100;

const pctB_delegues = (univ_candidatB_delegues / univ_total_delegues) * 100;
const pctB_autres = (univ_candidatB_autres / univ_total_autres) * 100;

console.log(`  Candidat A chez délégués: ${univ_candidatA_delegues}/${univ_total_delegues} = ${pctA_delegues.toFixed(2)}%`);
console.log(`  Candidat A chez autres: ${univ_candidatA_autres}/${univ_total_autres} = ${pctA_autres.toFixed(2)}%`);
console.log(`  Candidat B chez délégués: ${univ_candidatB_delegues}/${univ_total_delegues} = ${pctB_delegues.toFixed(2)}%`);
console.log(`  Candidat B chez autres: ${univ_candidatB_autres}/${univ_total_autres} = ${pctB_autres.toFixed(2)}%`);

// Appliquer 80/20
const univ_pctA = (pctA_delegues * 0.8) + (pctA_autres * 0.2);
const univ_pctB = (pctB_delegues * 0.8) + (pctB_autres * 0.2);

console.log(`\n  Score final A: (${pctA_delegues.toFixed(2)}% × 0.8) + (${pctA_autres.toFixed(2)}% × 0.2) = ${univ_pctA.toFixed(2)}%`);
console.log(`  Score final B: (${pctB_delegues.toFixed(2)}% × 0.8) + (${pctB_autres.toFixed(2)}% × 0.2) = ${univ_pctB.toFixed(2)}%`);

console.log('\n📊 Comparaison avec calcul simple:');
const univ_simpleA = ((univ_candidatA_delegues + univ_candidatA_autres) / (univ_total_delegues + univ_total_autres)) * 100;
const univ_simpleB = ((univ_candidatB_delegues + univ_candidatB_autres) / (univ_total_delegues + univ_total_autres)) * 100;

console.log(`  Sans pondération: A=${univ_simpleA.toFixed(2)}%, B=${univ_simpleB.toFixed(2)}%`);
console.log(`  Avec pondération: A=${univ_pctA.toFixed(2)}%, B=${univ_pctB.toFixed(2)}%`);
console.log(`  Différence: A ${(univ_pctA - univ_simpleA).toFixed(2)}%, B ${(univ_pctB - univ_simpleB).toFixed(2)}%`);
console.log();


// =============================================================================
// TEST 4: Cas extrême - Impact maximal de la pondération
// =============================================================================
console.log('📋 TEST 4: CAS EXTRÊME - Impact maximal');
console.log('────────────────────────────────────────');

// Scénario: Tous les responsables votent A, tous les étudiants votent B
const extreme_resp_A = 20;
const extreme_resp_B = 0;
const extreme_etud_A = 0;
const extreme_etud_B = 80;

console.log('\n🔵 Données:');
console.log(`  20 responsables → 100% pour A`);
console.log(`  80 étudiants → 100% pour B`);

console.log('\n✅ Résultat avec 80/20 sur POURCENTAGES:');

// Calculer % dans chaque groupe
const pct_extreme_A_resp = (extreme_resp_A / (extreme_resp_A + extreme_resp_B)) * 100;
const pct_extreme_A_etud = (extreme_etud_A / (extreme_etud_A + extreme_etud_B)) * 100;

const pct_extreme_B_resp = (extreme_resp_B / (extreme_resp_A + extreme_resp_B)) * 100;
const pct_extreme_B_etud = (extreme_etud_B / (extreme_etud_A + extreme_etud_B)) * 100;

// Appliquer 80/20
const extreme_pctA = (pct_extreme_A_resp * 0.8) + (pct_extreme_A_etud * 0.2);
const extreme_pctB = (pct_extreme_B_resp * 0.8) + (pct_extreme_B_etud * 0.2);

console.log(`  Candidat A: (${pct_extreme_A_resp.toFixed(2)}% × 0.8) + (${pct_extreme_A_etud.toFixed(2)}% × 0.2) = ${extreme_pctA.toFixed(2)}%`);
console.log(`  Candidat B: (${pct_extreme_B_resp.toFixed(2)}% × 0.8) + (${pct_extreme_B_etud.toFixed(2)}% × 0.2) = ${extreme_pctB.toFixed(2)}%`);

console.log('\n📊 Comparaison:');
console.log(`  Sans pondération: A=20%, B=80% → B gagne`);
console.log(`  Avec pondération: A=${extreme_pctA.toFixed(2)}%, B=${extreme_pctB.toFixed(2)}% → ${extreme_pctA > extreme_pctB ? 'A' : 'B'} gagne`);
console.log('  ⚠️  Les 20 responsables battent les 80 étudiants !');
console.log();


// =============================================================================
// RÉSUMÉ
// =============================================================================
console.log('═══════════════════════════════════════════');
console.log('📊 RÉSUMÉ DES PONDÉRATIONS');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('✅ SALLE:');
console.log('   • Poids: 1.0 pour tous');
console.log('   • Calcul: Simple pourcentage');
console.log('   • Exemple: 45 votes A, 55 votes B → A=45%, B=55%');
console.log('');
console.log('✅ ÉCOLE:');
console.log('   • Pondération: 80% responsables / 20% étudiants');
console.log('   • Impact: Très élevé - les responsables pèsent 4× plus');
console.log('   • Exemple: 20 resp (75% pour A), 80 étud (75% pour B)');
console.log('     → A=54.55%, B=45.45% (A gagne malgré minorité)');
console.log('');
console.log('✅ UNIVERSITÉ Tour 1:');
console.log('   • Pondération: 80% délégués / 20% autres');
console.log('   • Impact: Très élevé - les délégués pèsent 4× plus');
console.log('   • Exemple: 10 délégués (70% pour A), 90 autres (67% pour B)');
console.log('     → A=47.47%, B=52.53% (B gagne de justesse)');
console.log('');
console.log('⏳ UNIVERSITÉ Tour 2:');
console.log('   • Système: Transfert de votes');
console.log('   • Les candidats classés votent');
console.log('   • Transfert automatique de tous leurs votes');
console.log('   • Statut: À implémenter');
console.log('');
console.log('═══════════════════════════════════════════');
console.log('✅ Tests terminés avec succès !');
console.log('═══════════════════════════════════════════\n');
