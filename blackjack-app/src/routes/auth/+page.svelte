<script lang="ts">
	import AuthForm from '$lib/components/AuthForm.svelte';
	import type { ActionData } from './$types';
	import { browser } from '$app/environment'; // C'est OK d'importer ça partout
	import { onMount } from 'svelte'; // C'est OK d'importer ça partout

	export let form: ActionData;

	// Ce bloc s'exécute UNIQUEMENT sur le client après que le composant soit monté
	onMount(() => {
		if (browser) {
			// `browser` est un booléen fourni par SvelteKit, toujours false côté serveur
			// Cette ligne s'exécutera donc uniquement si on est dans un navigateur
			document.title = 'Authentification';
		}
	});
</script>

<svelte:head>
	<!-- Utilisation recommandée pour le titre et les meta tags, gérée par SvelteKit -->
	<title>Authentification</title>
	<meta name="description" content="Page de connexion et d'inscription" />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12 dark:bg-gray-900">
	<AuthForm serverErrors={form} />
</div>