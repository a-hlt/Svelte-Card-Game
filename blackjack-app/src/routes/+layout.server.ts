// src/routes/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, url, locals }) => {
	// 1. Vérifie si l'utilisateur a le cookie de session
	const userSessionCookie = cookies.get('session_user_email'); // Le cookie posé par /auth/+page.server.ts

	// 2. Détermine si l'utilisateur est connecté
	const isLoggedIn = !!userSessionCookie;

	// 3. Récupère le chemin demandé
	const currentPath = url.pathname;

	console.log(`[Layout Load] Path: ${currentPath}, IsLoggedIn: ${isLoggedIn}`);

	// 4. Logique de protection pour la page racine ('/')
	// Si l'utilisateur N'EST PAS connecté ET qu'il demande la page racine...
	if (!isLoggedIn && currentPath === '/') {
		console.log(`[Layout Load] Redirecting unauthenticated user from / to /auth`);
		// ...redirige-le vers la page de connexion.
		throw redirect(303, '/auth');
	}

	// Optionnel mais recommandé: si l'utilisateur est connecté et va sur /auth, redirige-le vers la racine
	if (isLoggedIn && currentPath === '/auth') {
		console.log(`[Layout Load] Redirecting logged-in user from /auth to /`);
		throw redirect(303, '/');
	}

	// 5. Si on arrive ici, l'accès est autorisé.
	// Retourne les données utilisateur (même si nulles) pour les rendre disponibles.
	let userData: { email: string } | null = null;
	if (isLoggedIn) {
		userData = { email: userSessionCookie };
	}

	// Rends les données disponibles dans locals (pour d'autres fonctions serveur)
	// et dans la prop `data` du layout/page.
	locals.user = userData;

	return {
		user: userData
	};
};
