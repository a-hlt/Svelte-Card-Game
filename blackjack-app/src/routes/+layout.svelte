<script lang="ts">
	import '../app.css';

	// let { children } = $props();
	import type { LayoutData } from './$types';
	import { page } from '$app/stores'; // Pour vérifier la route ou accéder aux data si besoin

	// Reçoit les données (incluant `user`) retournées par `+layout.server.ts`
	export let data: LayoutData;

	// Accède aux données utilisateur
	$: user = data.user;
</script>

<!-- {@render children()} -->
<!-- Structure de base de la page -->
<div>
	<header class="border-b p-4">
		<nav class="container mx-auto flex justify-between">
			<a href="/" class="font-bold">Mon App</a>
			<div>
				{#if user}
					<span>{user.email}</span>
					<!-- Formulaire POST pour la déconnexion -->
					<form method="POST" action="/auth?/logout" style="display: inline; margin-left: 1rem;">
						<button type="submit" class="text-red-600 hover:underline">Déconnexion</button>
					</form>
				{:else if $page.route.id !== '/auth'}
					<!-- Affiche le lien de connexion seulement si on n'est pas déjà sur /auth -->
					<a href="/auth" class="text-blue-600 hover:underline">Connexion / Inscription</a>
				{/if}
			</div>
		</nav>
	</header>

	<main class="container mx-auto p-4">
		<!-- Le contenu de la page enfant (+page.svelte) sera injecté ici -->
		<slot />
	</main>
</div>
