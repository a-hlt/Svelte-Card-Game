// src/routes/auth/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// --- Stockage en mémoire (NON SÉCURISÉ, TEMPORAIRE) ---
// Simule une base de données utilisateurs. Sera vidé à chaque redémarrage du serveur !
const usersStore = new Map<string, { email: string; password: string }>();

// Optionnel : pré-remplir un utilisateur pour tester le login rapidement
// usersStore.set('test@test.com', { email: 'test@test.com', password: 'password123' });
// console.log('Initial usersStore:', usersStore);

export const load: PageServerLoad = async ({ locals }) => {
	// Si l'utilisateur est déjà connecté (via un cookie par exemple),
	// on peut le rediriger vers une autre page.
	// Pour l'instant, on ne gère pas la session ici, mais c'est là que ça pourrait se faire.
	// if (locals.user) {
	//     throw redirect(303, '/dashboard');
	// }
	return {}; // Pas besoin de charger de données spécifiques pour le formulaire
};

export const actions: Actions = {
	// --- Action pour le Login ---
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString();
		const password = data.get('password')?.toString();

		// Validation simple
		if (!email || !password) {
			return fail(400, { email, error: 'Veuillez fournir un email et un mot de passe.' });
		}

		console.log('[Login Attempt]', { email });

		const existingUser = usersStore.get(email);

		if (!existingUser || existingUser.password !== password) {
			console.log('[Login Failed] Invalid credentials for:', email);
			// Important : ne pas donner d'indice si c'est l'email ou le mdp qui est faux
			return fail(401, { email, error: 'Email ou mot de passe incorrect.' });
		}

		// --- Succès du Login ---
		console.log('[Login Success]', { email });
		// Simuler une session en mettant un cookie (très basique)
		// Dans une vraie app, ce serait un token JWT ou un ID de session sécurisé
		cookies.set('session_user_email', email, {
			path: '/',
			httpOnly: true, // Important pour la sécurité (non accessible par JS client)
			secure: process.env.NODE_ENV === 'production', // Utiliser https en production
			sameSite: 'lax', // Protection CSRF
			maxAge: 60 * 60 * 24 * 7 // 1 semaine
		});

		// Rediriger vers une page après le login (ex: tableau de bord)
		// Remplacer '/dashboard' par la page de destination souhaitée
		throw redirect(303, '/'); // Redirige vers la page d'accueil pour l'exemple
	},

	// --- Action pour l'Inscription (Register) ---
	register: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString();
		const password = data.get('password')?.toString();
		const confirmPassword = data.get('confirmPassword')?.toString();

		// Validations
		if (!email || !password || !confirmPassword) {
			return fail(400, { email, error: 'Tous les champs sont requis.' });
		}
		if (password !== confirmPassword) {
			return fail(400, { email, error: 'Les mots de passe ne correspondent pas.' });
		}
		// Ajoute ici d'autres validations (longueur mdp, format email...) si nécessaire

		console.log('[Register Attempt]', { email });

		if (usersStore.has(email)) {
			console.log('[Register Failed] Email already exists:', email);
			return fail(409, { email, error: 'Cet email est déjà utilisé.' }); // 409 Conflict
		}

		// --- Succès de l'inscription ---
		// !! Stockage en clair - NE PAS FAIRE EN PRODUCTION !!
		usersStore.set(email, { email, password });
		console.log('[Register Success] User added:', { email });
		console.log('Current usersStore:', usersStore);

		// Optionnel : Connecter l'utilisateur directement après l'inscription
		cookies.set('session_user_email', email, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 1 semaine
		});

		// Rediriger vers une page après l'inscription
		throw redirect(303, '/'); // Redirige vers la page d'accueil pour l'exemple
	},

	// --- Action pour la Déconnexion (Logout) ---
	// Tu auras besoin d'un bouton quelque part dans ton app qui poste vers "?/logout"
	logout: async ({ cookies }) => {
		console.log('[Logout Action] Clearing session cookie');
		cookies.delete('session_user_email', { path: '/' });
		throw redirect(303, '/auth'); // Redirige vers la page de login
	}
};
