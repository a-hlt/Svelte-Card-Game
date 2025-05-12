// src/lib/server/prisma.ts
import { PrismaClient } from '@prisma/client';
import { dev } from '$app/environment';

const prisma =
	global.__prisma ||
	new PrismaClient({
		// log: dev ? ['query', 'info', 'warn', 'error'] : ['error'], //  Pour logger les requêtes en dev
	});

if (dev) {
	global.__prisma = prisma;
}

export default prisma;
