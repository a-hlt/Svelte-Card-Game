// src/routes/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Les routes publiques restent les mêmes
const PUBLIC_ROUTES: string[] = ['/auth'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// 1. Récupérer l'utilisateur depuis `locals` (rempli par le hook)
	const user = locals.user; // Contient les infos utilisateur (si connecté et vérifié) ou null

	// 2. Déterminer si l'utilisateur est connecté
	const isLoggedIn = !!user;

	// 3. Obtenir le chemin actuel
	const currentPath = url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.includes(currentPath);

	console.log(
		`[Layout Load] Path: ${currentPath}, IsLoggedIn: ${isLoggedIn} (User: ${user?.email ?? 'None'}), IsPublic: ${isPublicRoute}`
	);

	// 4. Logique de redirection (inchangée, mais basée sur `isLoggedIn` venant de `locals`)
	if (!isLoggedIn && !isPublicRoute) {
		console.log(`[Layout Load] Redirecting unauthenticated user from ${currentPath} to /auth`);
		throw redirect(303, '/auth');
	}

	// Optionnel: Redirection si connecté et sur une page publique comme /auth
	if (isLoggedIn && isPublicRoute) {
		console.log(`[Layout Load] Redirecting logged-in user from public route ${currentPath} to /`);
		throw redirect(303, '/');
	}

	// 5. Retourner les données utilisateur pour le layout Svelte et les pages
	//    Même si le hook a mis les données dans `locals`, il faut les retourner ici
	//    pour qu'elles soient accessibles via `data` dans +layout.svelte et $page.data
	return {
		user: user // Passe l'utilisateur (ou null) au composant layout
	};
};
