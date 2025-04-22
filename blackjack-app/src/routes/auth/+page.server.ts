// src/routes/auth/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import prisma from '$lib/server/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'; // Import jwt
import { JWT_SECRET } from '$env/static/private'; // Importe le secret depuis .env (sécurisé)

// Type pour le payload du JWT (ce qu'on met dedans)
interface JWTPayload {
	userId: number; // Stocker l'ID utilisateur est plus courant et sûr que l'email
	email: string; // Peut être utile, mais l'ID suffit souvent
	// Tu peux ajouter d'autres infos non sensibles si besoin (ex: role)
}

// Durée de validité du token (ex: 1 heure, 7 jours, etc.)
const JWT_EXPIRATION = '7d'; // 7 jours pour cet exemple

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString();
		const password = data.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { email, error: 'Email et mot de passe requis.' });
		}

		try {
			const user = await prisma.user.findUnique({ where: { email } });

			if (!user) {
				return fail(401, { email, error: 'Identifiants incorrects.' });
			}

			const passwordMatch = await bcrypt.compare(password, user.passwordHash);

			if (!passwordMatch) {
				return fail(401, { email, error: 'Identifiants incorrects.' });
			}

			// --- Création du Payload JWT ---
			const payload: JWTPayload = {
				userId: user.id,
				email: user.email
			};

			// --- Signature du Token ---
			const token = jwt.sign(payload, JWT_SECRET, {
				expiresIn: JWT_EXPIRATION // Définit la durée de validité
			});

			// --- Envoi du Token via Cookie HttpOnly ---
			cookies.set('authToken', token, {
				// Nomme le cookie 'authToken' (ou autre)
				path: '/',
				httpOnly: true, // Empêche l'accès via JS côté client (sécurité XSS)
				secure: process.env.NODE_ENV === 'production', // True si en HTTPS
				sameSite: 'lax', // Protection CSRF
				maxAge: 60 * 60 * 24 * 7 // Doit correspondre ou être > à l'expiration du JWT (ici 7 jours en secondes)
			});

			console.log(`[Login Success] JWT created for user ${user.email}`);
			throw redirect(303, '/'); // Redirige vers la page d'accueil
		} catch (error) {
			console.error('[Login Action Error]', error);
			return fail(500, { email, error: 'Erreur serveur lors de la connexion.' });
		}
	},

	register: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString();
		const password = data.get('password')?.toString();
		const confirmPassword = data.get('confirmPassword')?.toString();

		// ... (validations inchangées) ...
		if (!email || !password || !confirmPassword)
			return fail(400, { email, error: 'Tous les champs requis.' });
		if (password !== confirmPassword)
			return fail(400, { email, error: 'Mots de passe non identiques.' });
		if (password.length < 8) return fail(400, { email, error: 'Mot de passe trop court (8 min).' });

		try {
			const existingUser = await prisma.user.findUnique({ where: { email } });
			if (existingUser) {
				return fail(409, { email, error: 'Email déjà utilisé.' });
			}

			const passwordHash = await bcrypt.hash(password, 10);

			const newUser = await prisma.user.create({
				data: { email, passwordHash }
			});

			// --- Création du Payload JWT pour le nouvel utilisateur ---
			const payload: JWTPayload = {
				userId: newUser.id,
				email: newUser.email
			};

			// --- Signature du Token ---
			const token = jwt.sign(payload, JWT_SECRET, {
				expiresIn: JWT_EXPIRATION
			});

			// --- Envoi du Token via Cookie HttpOnly ---
			cookies.set('authToken', token, {
				path: '/',
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7 // 7 jours
			});

			console.log(`[Register Success] User ${newUser.email} created and JWT issued.`);
			throw redirect(303, '/'); // Redirige après inscription réussie
		} catch (error) {
			console.error('[Register Action Error]', error);
			return fail(500, { email, error: "Erreur serveur lors de l'inscription." });
		}
	},

	logout: async ({ cookies }) => {
		// Pour déconnecter, on supprime simplement le cookie contenant le JWT
		console.log('[Logout Action] Clearing authToken cookie');
		cookies.delete('authToken', { path: '/' }); // Assure-toi de supprimer le bon cookie
		throw redirect(303, '/auth');
	}
};
