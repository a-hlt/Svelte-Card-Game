// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '$env/static/private';
import prisma from '$lib/server/prisma'; // Pour récupérer les infos utilisateur fraîches

// Type pour le payload DÉCODÉ du JWT
interface DecodedJWTPayload {
	userId: number;
	email: string;
	iat: number; // Issued at (timestamp)
	exp: number; // Expires at (timestamp)
}

export const handle: Handle = async ({ event, resolve }) => {
	// 1. Lire le cookie contenant le token JWT
	const authToken = event.cookies.get('authToken');

	// Réinitialiser locals.user au cas où
	event.locals.user = null;

	if (authToken) {
		// 2. Si le token existe, le vérifier
		try {
			const decoded = jwt.verify(authToken, JWT_SECRET) as DecodedJWTPayload; // Vérifie signature et expiration

			// 3. Vérification réussie : récupérer les infos utilisateur À JOUR depuis la BDD
			//    C'est important car l'utilisateur pourrait avoir été supprimé ou ses droits changés
			//    depuis la création du token. Ne te fie pas uniquement au contenu du token.
			const userFromDb = await prisma.user.findUnique({
				where: { id: decoded.userId },
				// Sélectionne uniquement les champs nécessaires (pas le hash du mdp!)
				select: { id: true, email: true /*, autres champs utiles comme name, role, etc. */ }
			});

			if (userFromDb) {
				// 4. Stocker les informations utilisateur vérifiées dans `event.locals`
				//    `event.locals` est disponible dans les fonctions `load` et `actions` serveur.
				event.locals.user = userFromDb;
				console.log(`[Hook] User authenticated: ${userFromDb.email}`);
			} else {
				// Utilisateur non trouvé dans la BDD (peut-être supprimé ?)
				console.warn(`[Hook] User ID ${decoded.userId} from valid JWT not found in DB.`);
				// Optionnel: invalider le cookie ici si l'utilisateur n'existe plus
				event.cookies.delete('authToken', { path: '/' });
			}
		} catch (error: any) {
			// 5. Gestion des erreurs de vérification (token invalide, expiré, etc.)
			console.error('[Hook] JWT Verification Error:', error.message);
			// Le token est invalide ou expiré, on le supprime pour éviter des erreurs répétées
			event.cookies.delete('authToken', { path: '/' });
			event.locals.user = null; // Assurer que l'utilisateur n'est pas considéré comme connecté
		}
	} else {
		console.log('[Hook] No authToken cookie found.');
	}

	// 6. Continuer le traitement de la requête
	//    SvelteKit exécutera ensuite la fonction `load` appropriée (ex: +layout.server.ts)
	//    puis le rendu de la page.
	const response = await resolve(event);
	return response;
};
