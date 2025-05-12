<script lang="ts">
	import { enhance } from '$app/forms';
	import { navigating } from '$app/stores';

	// --- Props ---
	type ServerErrorType = { error?: string; email?: string } | null;
	let { serverErrors }: { serverErrors?: ServerErrorType } = $props();

	// --- State ---
	let isLogin = $state(true);
	let email = $state(serverErrors?.email ?? '');
	let password = $state('');
	let confirmPassword = $state('');
	let clientErrorMessage = $state<string | null>(null);

	// --- Loading State ---
	let isSubmitting = $derived(
		$navigating?.form?.method === 'POST' &&
			($navigating?.form?.action.pathname === '/auth?/login' ||
				$navigating?.form?.action.pathname === '/auth?/register')
	);

	// --- Derived State ---
	const formTitle = $derived(isLogin ? 'Connexion' : 'Inscription');
	const submitButtonText = $derived(isLogin ? 'Se connecter' : "S'inscrire");
	const toggleLinkText = $derived(
		isLogin ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'
	);
	const formAction = $derived(isLogin ? '?/login' : '?/register');

	// --- Client-Side Validation ---
	const isFormValid = $derived(() => {
		if (!email || !password) return false;
		if (!isLogin && !confirmPassword) return false;
		if (!isLogin && password !== confirmPassword) return false;
		return true;
	});

	function validateClientSide(): boolean {
		clientErrorMessage = null;
		if (!isLogin && password !== confirmPassword) {
			clientErrorMessage = 'Les mots de passe ne correspondent pas.';
			return false;
		}
		return true;
	}

	// --- Mode Toggle ---
	function toggleMode(): void {
		isLogin = !isLogin;
		password = '';
		confirmPassword = '';
		clientErrorMessage = null;
		// serverErrors est une prop, on ne la modifie pas ici
	}

	// --- Tailwind Class Definitions for Clarity ---

	// Container for the whole form card
	const cardContainerClasses =
		'mx-auto w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800';

	// Form title
	const titleClasses = 'mb-6 text-center text-2xl font-semibold text-gray-800 dark:text-white';

	// General spacing for form elements
	const formSpacingClasses = 'space-y-5';

	// Styling for the error message box
	const errorBoxClasses =
		'mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900 dark:text-red-200';
	const errorTextClasses = 'block sm:inline';

	// Common styles for form labels
	const labelClasses = 'mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300';

	// Base styles for input fields (shared by all inputs)
	const inputBaseClasses = 'block w-full rounded-md border px-3 py-2 shadow-sm sm:text-sm';
	// Border and background colors for inputs (normal state)
	const inputColorClasses = 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
	// Focus state styles for inputs
	const inputFocusClasses =
		'focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400';
	// Disabled state styles for inputs (using Tailwind's `disabled:` variant)
	const inputDisabledClasses =
		'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-70 disabled:dark:bg-gray-600';
	// Combined input classes
	const inputClasses = `${inputBaseClasses} ${inputColorClasses} ${inputFocusClasses} ${inputDisabledClasses}`;

	// Style for the password mismatch text
	const mismatchTextClasses = 'mt-1 text-xs text-red-600 dark:text-red-400';

	// Base styles for the primary submit button
	const buttonBaseClasses =
		'flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2';
	// Color and hover styles for the primary button
	const buttonPrimaryColorClasses =
		'border-transparent bg-indigo-600 text-white hover:bg-indigo-700';
	// Focus styles for the primary button
	const buttonPrimaryFocusClasses = 'focus:ring-indigo-500 dark:focus:ring-offset-gray-800';
	// Disabled state for buttons
	const buttonDisabledClasses = 'disabled:cursor-not-allowed disabled:opacity-50';
	// Combined primary button classes
	const buttonPrimaryClasses = `${buttonBaseClasses} ${buttonPrimaryColorClasses} ${buttonPrimaryFocusClasses} ${buttonDisabledClasses}`;

	// Spinner SVG inside the button
	const spinnerClasses = 'h-5 w-5 animate-spin'; // Added mr-2 if text follows

	// Styles for the secondary toggle button (looks like a link)
	const buttonLinkBaseClasses = 'text-sm hover:underline';
	const buttonLinkColorClasses =
		'text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300';
	// Disabled state for the link-like button
	const buttonLinkDisabledClasses =
		'disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline';
	// Combined link button classes
	const buttonLinkClasses = `${buttonLinkBaseClasses} ${buttonLinkColorClasses} ${buttonLinkDisabledClasses}`;

	// Container for the toggle button link
	const toggleLinkContainerClasses = 'mt-6 text-center';
</script>

<div class={cardContainerClasses}>
	<h2 class={titleClasses}>{formTitle}</h2>

	<form
		method="POST"
		action={formAction}
		use:enhance={() => {
			if (!validateClientSide()) {
				return ({ cancel }) => cancel();
			}
			return async ({ result, update }) => {
				if (result.type === 'fail') {
					password = ''; // Clear password on failed attempt
					confirmPassword = '';
				}
				await update(); // Update page data (including `form` prop)
			};
		}}
		class={formSpacingClasses}
	>
		<!-- Error Message Box -->
		{#if serverErrors?.error || clientErrorMessage}
			<div class={errorBoxClasses} role="alert">
				<span class={errorTextClasses}>{serverErrors?.error || clientErrorMessage}</span>
			</div>
		{/if}

		<!-- Email Field -->
		<div>
			<label for="email" class={labelClasses}>Email</label>
			<input
				type="email"
				id="email"
				name="email"
				bind:value={email}
				required
				disabled={isSubmitting}
				class={inputClasses}
				placeholder="vous@exemple.com"
			/>
		</div>

		<!-- Password Field -->
		<div>
			<label for="password" class={labelClasses}>Mot de passe</label>
			<input
				type="password"
				id="password"
				name="password"
				bind:value={password}
				required
				minlength={isLogin ? undefined : 8}
				disabled={isSubmitting}
				class={inputClasses}
				placeholder="••••••••"
			/>
		</div>

		<!-- Confirm Password Field (Register Only) -->
		{#if !isLogin}
			<div>
				<label for="confirmPassword" class={labelClasses}>Confirmer le mot de passe</label>
				<input
					type="password"
					id="confirmPassword"
					name="confirmPassword"
					bind:value={confirmPassword}
					required
					minlength="8"
					disabled={isSubmitting}
					class={inputClasses}
					placeholder="••••••••"
				/>
				{#if password && confirmPassword && password !== confirmPassword && !isSubmitting}
					<p class={mismatchTextClasses}>Les mots de passe ne correspondent pas.</p>
				{/if}
			</div>
		{/if}

		<!-- Submit Button -->
		<div>
			<button type="submit" disabled={isSubmitting || !isFormValid} class={buttonPrimaryClasses}>
				{#if isSubmitting}
					<svg
						class={`${spinnerClasses} mr-2`}
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span>En cours...</span>
				{:else}
					{submitButtonText}
				{/if}
			</button>
		</div>
	</form>

	<!-- Toggle Mode Link/Button -->
	<div class={toggleLinkContainerClasses}>
		<button type="button" onclick={toggleMode} disabled={isSubmitting} class={buttonLinkClasses}>
			{toggleLinkText}
		</button>
	</div>
</div>
