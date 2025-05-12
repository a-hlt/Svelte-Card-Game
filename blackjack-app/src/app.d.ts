// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { PrismaClient } from '@prisma/client';
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
		interface Locals {
			user: {
				id: number;
				email: string;
				// ajoutez ici les autres champs que vous avez mis dans le `select` de votre hook
			} | null;
		}
	}

	var __prisma: PrismaClient | undefined;
}

export {};
