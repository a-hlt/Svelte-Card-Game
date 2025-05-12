// src/routes/auth/+page.server.ts
import { fail, redirect } from '@sveltejs/kit'; // On n'importe plus Redirect
import type { Actions } from './$types';
import prisma from '$lib/server/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '$env/static/private';

// Type pour le payload du JWT (ce qu'on met dedans)
interface JWTPayload {
	userId: number; // Stocker l'ID utilisateur est plus courant et sûr que l'email
	email: string; // Peut être utile, mais l'ID suffit souvent
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

			const payload: JWTPayload = {
				userId: user.id,
				email: user.email
			};

			const token = jwt.sign(payload, JWT_SECRET, {
				expiresIn: JWT_EXPIRATION
			});

			cookies.set('authToken', token, {
				path: '/',
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7 // 7 jours
			});

			console.log(`[Login Success] JWT created for user ${user.email}`);
			throw redirect(303, '/'); // Redirige vers la page d'accueil
		} catch (error: any) {
			// Vérifier si l'objet ressemble à une redirection SvelteKit
			if (
				typeof error === 'object' &&
				error !== null &&
				'status' in error &&
				'location' in error &&
				typeof error.status === 'number' &&
				typeof error.location === 'string'
			) {
				// C'est probablement une redirection, la relancer
				throw error;
			}

			// Sinon, c'est une vraie erreur serveur
			console.error('[Login Action Error - Unexpected]', error);
			return fail(500, { email: email, error: 'Erreur serveur lors de la connexion.' });
		}
	},

	register: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString();
		const password = data.get('password')?.toString();
		const confirmPassword = data.get('confirmPassword')?.toString();

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

			const payload: JWTPayload = {
				userId: newUser.id,
				email: newUser.email
			};

			const token = jwt.sign(payload, JWT_SECRET, {
				expiresIn: JWT_EXPIRATION
			});

			cookies.set('authToken', token, {
				path: '/',
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7 // 7 jours
			});

			console.log(`[Register Success] User ${newUser.email} created and JWT issued.`);
			throw redirect(303, '/');
		} catch (error: any) {
			// Vérifier si l'objet ressemble à une redirection SvelteKit
			if (
				typeof error === 'object' &&
				error !== null &&
				'status' in error &&
				'location' in error &&
				typeof error.status === 'number' &&
				typeof error.location === 'string'
			) {
				// C'est probablement une redirection, la relancer
				throw error;
			}
			console.error('[Register Action Error - Unexpected]', error);
			return fail(500, { email, error: "Erreur serveur lors de l'inscription." });
		}
	},

	logout: async ({ cookies }) => {
		console.log('[Logout Action] Clearing authToken cookie');
		cookies.delete('authToken', { path: '/' });
		throw redirect(303, '/auth'); // Cette redirection sera gérée par SvelteKit directement
	}
};
