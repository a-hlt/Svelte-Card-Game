<script lang="ts">
	import { onMount } from 'svelte';

	interface Card {
		code: string;
		image: string;
		value: string;
		suit: string;
	}

	let deckId: string | null = null;
	let playerCards: Card[] = [];
	let dealerCards: Card[] = [];
	let playerScore = 0;
	let dealerScore = 0;
	let remainingCards = 0;
	let gameStatus:
		| 'loading'
		| 'betting'
		| 'playerTurn'
		| 'dealerTurn'
		| 'playerBust'
		| 'dealerBust'
		| 'playerWin'
		| 'dealerWin'
		| 'push'
		| 'blackjack'
		| 'gameOver'
		| 'error' = 'loading';
	let isDealerCardHidden = true;
	let errorMessage: string | null = null;

	let playerBalance = 1000;
	let currentBet = 0;
	let betPlaced = false;
	const betOptions = [10, 25, 50, 100];

	const API_BASE_URL = 'https://deckofcardsapi.com/api/deck';
	const cardBackUrl = '/img/Larry.png';

	function calculateScore(hand: Card[]): number {
		let score = 0;
		let aceCount = 0;
		for (const card of hand) {
			if (['KING', 'QUEEN', 'JACK'].includes(card.value)) {
				score += 10;
			} else if (card.value === 'ACE') {
				aceCount += 1;
				score += 11;
			} else {
				const numValue = parseInt(card.value, 10);
				if (!isNaN(numValue)) {
					score += numValue;
				}
			}
		}
		while (score > 21 && aceCount > 0) {
			score -= 10;
			aceCount -= 1;
		}
		return score;
	}

	async function initializeDeck() {
		gameStatus = 'loading';
		errorMessage = null;
		deckId = null;
		playerCards = [];
		dealerCards = [];
		playerScore = 0;
		dealerScore = 0;
		isDealerCardHidden = true;
		betPlaced = false;
		currentBet = 0;

		try {
			const shuffleResponse = await fetch(`${API_BASE_URL}/new/shuffle/?deck_count=6`);
			if (!shuffleResponse.ok) {
				const errorText = await shuffleResponse.text();
				throw new Error(`API Error (${shuffleResponse.status}): ${errorText}`);
			}
			const shuffleData = await shuffleResponse.json();
			if (!shuffleData.success) throw new Error('Failed to get new deck from API.');

			deckId = shuffleData.deck_id;
			remainingCards = shuffleData.remaining;
			gameStatus = 'betting';
		} catch (err: any) {
			console.error('Error initializing deck:', err);
			errorMessage = err.message || 'Failed to get new deck. Check network or API status.';
			gameStatus = 'error';
			deckId = null;
		}
	}

	async function drawCards(count: number): Promise<Card[] | null> {
		if (!deckId) {
			errorMessage = 'Deck ID is missing. Cannot draw cards.';
			gameStatus = 'error';
			return null;
		}

		if (remainingCards < 15) {
			try {
				const reshuffleResponse = await fetch(`${API_BASE_URL}/${deckId}/shuffle/`);
				const reshuffleData = await reshuffleResponse.json();
				if (reshuffleData.success) {
					remainingCards = reshuffleData.remaining;
				} else {
					console.warn('Could not reshuffle deck via API.');
				}
			} catch (err) {
				console.warn('Error during reshuffle attempt:', err);
			}
		}

		try {
			const response = await fetch(`${API_BASE_URL}/${deckId}/draw/?count=${count}`);
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`API Error (${response.status}) drawing cards: ${errorText}`);
			}
			const data = await response.json();
			if (!data.success) {
				if (data.error?.includes('Not enough cards remaining')) {
					errorMessage = 'Not enough cards left in the deck. Please start a new session.';
					gameStatus = 'error';
					return null;
				}
				throw new Error(data.error || 'Failed to draw cards from API.');
			}
			remainingCards = data.remaining;
			return data.cards as Card[];
		} catch (err: any) {
			console.error('Error drawing cards:', err);
			errorMessage = err.message || 'Failed to draw cards.';
			gameStatus = 'error';
			return null;
		}
	}

	function selectBet(amount: number) {
		if (gameStatus !== 'betting') return;
		if (amount <= playerBalance) {
			currentBet = amount;
			errorMessage = null;
		} else {
			errorMessage = 'Bet amount exceeds your balance.';
			currentBet = 0;
			setTimeout(() => (errorMessage = null), 3000);
		}
	}

	async function placeBetAndDeal() {
		if (currentBet <= 0) {
			errorMessage = 'Please select a bet amount first.';
			setTimeout(() => (errorMessage = null), 3000);
			return;
		}
		if (currentBet > playerBalance) {
			errorMessage = 'Selected bet exceeds your balance.';
			setTimeout(() => (errorMessage = null), 3000);
			return;
		}
		if (gameStatus !== 'betting') return;

		errorMessage = null;
		betPlaced = true;
		gameStatus = 'loading';

		await dealInitialHand();
	}

	function updateBalance(outcome: 'win' | 'loss' | 'push' | 'blackjack') {
		if (outcome === 'win') {
			playerBalance += currentBet;
		} else if (outcome === 'loss') {
			playerBalance -= currentBet;
		} else if (outcome === 'blackjack') {
			playerBalance += Math.floor(currentBet * 1.5);
		}

		if (playerBalance <= 0) {
			setTimeout(() => {
				if (playerBalance <= 0) {
					gameStatus = 'gameOver';
				}
			}, 500);
		}
	}

	function resetHand() {
		playerCards = [];
		dealerCards = [];
		playerScore = 0;
		dealerScore = 0;
		isDealerCardHidden = true;
		errorMessage = null;
		betPlaced = false;
		currentBet = 0;

		if (playerBalance > 0) {
			gameStatus = 'betting';
		} else {
			gameStatus = 'gameOver';
		}
	}

	function startNewGameSession() {
		playerBalance = 1000;
		initializeDeck();
	}

	async function dealInitialHand() {
		playerCards = [];
		dealerCards = [];
		playerScore = 0;
		dealerScore = 0;
		isDealerCardHidden = true;

		if (!deckId) {
			errorMessage = 'Deck not initialized. Trying to re-initialize...';
			await initializeDeck();
			if (!deckId) {
				errorMessage = 'Failed to initialize deck. Cannot start game.';
				gameStatus = 'error';
				return;
			}
			gameStatus = 'betting';
			betPlaced = false;
			return;
		}

		try {
			const initialCards = await drawCards(4);
			if (!initialCards || initialCards.length < 4) {
				betPlaced = false;
				return;
			}

			playerCards = [initialCards[0], initialCards[2]];
			dealerCards = [initialCards[1], initialCards[3]];

			playerScore = calculateScore(playerCards);
			dealerScore = calculateScore(dealerCards);

			const playerHasBlackjack = playerScore === 21 && playerCards.length === 2;
			const dealerHasBlackjack = dealerScore === 21 && dealerCards.length === 2;

			if (playerHasBlackjack && dealerHasBlackjack) {
				isDealerCardHidden = false;
				gameStatus = 'push';
				updateBalance('push');
			} else if (playerHasBlackjack) {
				isDealerCardHidden = false;
				gameStatus = 'blackjack';
				updateBalance('blackjack');
			} else if (dealerHasBlackjack) {
				isDealerCardHidden = false;
				gameStatus = 'dealerWin';
				updateBalance('loss');
			} else {
				gameStatus = 'playerTurn';
			}
		} catch (err: any) {
			console.error('Error during initial deal:', err);
			errorMessage = err.message || 'Failed to deal cards.';
			gameStatus = 'error';
			betPlaced = false;
		}
	}

	async function hit() {
		if (gameStatus !== 'playerTurn' || !deckId) return;
		gameStatus = 'loading';

		const newCards = await drawCards(1);
		if (!newCards || newCards.length === 0) {
			if (gameStatus !== 'error') gameStatus = 'playerTurn'; // Revenir si erreur non critique
			return;
		}

		playerCards = [...playerCards, newCards[0]];
		playerScore = calculateScore(playerCards);
		// console.log(`Player draws ${newCards[0].code}. New score: ${playerScore}`); // Optionnel

		if (playerScore > 21) {
			// console.log('Player Busts!'); // Optionnel
			gameStatus = 'playerBust';
			isDealerCardHidden = false;
			updateBalance('loss');
		} else if (playerScore === 21) {
			gameStatus = 'dealerTurn'; // Indiquer l'intention
			isDealerCardHidden = false; // Révéler la carte comme si on faisait "stand"
			dealerScore = calculateScore(dealerCards); // Mettre à jour le score affiché du croupier

			setTimeout(async () => {
				await dealerPlay(); // Démarrer le jeu du croupier
			}, 800); // Délai en ms (ajustez si besoin)
		} else {
			gameStatus = 'playerTurn'; // Permettre un autre tour
		}
	}

	async function stand() {
		if (gameStatus !== 'playerTurn' || !deckId) return;

		gameStatus = 'loading';
		isDealerCardHidden = false;
		dealerScore = calculateScore(dealerCards);

		await new Promise((resolve) => setTimeout(resolve, 700));

		await dealerPlay();
	}

	async function dealerPlay() {
		gameStatus = 'dealerTurn';

		while (dealerScore < 17) {
			await new Promise((resolve) => setTimeout(resolve, 800));

			const newCards = await drawCards(1);
			if (!newCards || newCards.length === 0) {
				if (gameStatus !== 'error') gameStatus = 'dealerTurn';
				return;
			}

			dealerCards = [...dealerCards, newCards[0]];
			dealerScore = calculateScore(dealerCards);
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
		determineWinner();
	}

	function determineWinner() {
		isDealerCardHidden = false;

		if (gameStatus === 'playerBust') {
			return;
		}

		if (dealerScore > 21) {
			gameStatus = 'dealerBust';
			updateBalance('win');
		} else if (playerScore > dealerScore) {
			gameStatus = 'playerWin';
			updateBalance('win');
		} else if (dealerScore > playerScore) {
			gameStatus = 'dealerWin';
			updateBalance('loss');
		} else {
			gameStatus = 'push';
			updateBalance('push');
		}
	}

	onMount(() => {
		startNewGameSession();
	});

	$: canHit = gameStatus === 'playerTurn';
	$: canStand = gameStatus === 'playerTurn';

	$: isRoundOver = [
		'playerBust',
		'dealerBust',
		'playerWin',
		'dealerWin',
		'push',
		'blackjack'
	].includes(gameStatus);

	$: showBettingControls = gameStatus === 'betting' && !betPlaced;
	$: showActionButtons = gameStatus === 'playerTurn';
	$: showNextHandButton = isRoundOver && playerBalance > 0;
	$: showNewGameButton = gameStatus === 'gameOver' || (isRoundOver && playerBalance <= 0);
	$: showSessionRestartButton = gameStatus === 'error';

	$: statusMessage = (() => {
		if (gameStatus === 'error') {
			return `Erreur: ${errorMessage || 'Une erreur inconnue est survenue.'}`;
		}

		switch (gameStatus) {
			case 'loading':
				return 'Chargement...';
			case 'betting':
				return `Placez votre mise (Solde: ${playerBalance}$)`;
			case 'playerTurn':
				return `Votre tour (Score: ${playerScore})`;
			case 'dealerTurn':
				return `Tour du Croupier (Score: ${dealerScore})`;
			case 'playerBust':
				return `Dépassé (${playerScore})! Vous perdez ${currentBet}$.`;
			case 'dealerBust':
				return `Le Croupier dépasse (${dealerScore})! Vous gagnez ${currentBet}$!`;
			case 'playerWin':
				return `Vous gagnez ${currentBet}$! (${playerScore} vs ${dealerScore})`;
			case 'dealerWin':
				return `Le Croupier gagne (${dealerScore} vs ${playerScore}). Vous perdez ${currentBet}$.`;
			case 'push':
				return `Égalité (${playerScore})! Mise retournée.`;
			case 'blackjack':
				return `Blackjack! Vous gagnez ${Math.floor(currentBet * 1.5)}$!`;
			case 'gameOver':
				return `Partie Terminée! Vous n'avez plus d'argent.`;
			default:
				return 'Prêt à jouer...';
		}
	})();

	let displayErrorMessage: string | null = null;
	$: {
		if (errorMessage && gameStatus !== 'error') {
			displayErrorMessage = errorMessage;
		} else if (gameStatus !== 'error') {
			displayErrorMessage = null;
		}
	}
</script>

<main class="relative h-screen overflow-hidden bg-black font-sans text-gray-200">
	<div class="absolute inset-0 opacity-20 mix-blend-soft-light"></div>

	<div
		class="relative z-10 mx-auto h-full max-w-4xl rounded-lg border-2 border-yellow-700/60 bg-gradient-to-br from-emerald-800 via-green-900 to-emerald-950 shadow-2xl"
	>
		<h1
			class="mb-6 text-center text-4xl font-bold tracking-wider text-yellow-300 drop-shadow-md md:text-5xl lg:text-6xl"
		>
			Blackjack Royale
		</h1>

		{#if gameStatus === 'error'}
			<div
				class="mb-6 rounded-lg border border-red-600/80 bg-red-900/90 p-4 text-center text-white shadow-lg backdrop-blur-sm"
			>
				<p class="mb-3 text-lg font-semibold">{statusMessage}</p>
				{#if showSessionRestartButton}
					<button
						class="rounded-md border-b-4 border-yellow-700 bg-gradient-to-b from-yellow-400 to-yellow-600 px-6 py-2 font-bold text-black uppercase shadow-md transition duration-150 ease-in-out hover:from-yellow-300 hover:to-yellow-500 hover:shadow-lg active:translate-y-px active:scale-[0.98] active:border-b-2 active:brightness-95 disabled:border-gray-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-400 disabled:opacity-60 disabled:shadow-none"
						on:click={startNewGameSession}
					>
						Recommencer
					</button>
				{/if}
			</div>
		{/if}

		{#if gameStatus === 'gameOver'}
			<div
				class="mb-6 rounded-lg border border-yellow-600/50 bg-gray-900/90 p-6 text-center text-white shadow-lg backdrop-blur-sm"
			>
				<p class="mb-4 text-xl font-semibold">{statusMessage}</p>
				{#if showNewGameButton}
					<button
						class="rounded-md border-b-4 border-yellow-700 bg-gradient-to-b from-yellow-400 to-yellow-600 px-6 py-2 font-bold text-black uppercase shadow-md transition duration-150 ease-in-out hover:from-yellow-300 hover:to-yellow-500 hover:shadow-lg active:translate-y-px active:scale-[0.98] active:border-b-2 active:brightness-95 disabled:border-gray-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-400 disabled:opacity-60 disabled:shadow-none"
						on:click={startNewGameSession}
					>
						Nouvelle Session
					</button>
				{/if}
			</div>
		{/if}

		{#if deckId && gameStatus !== 'error' && gameStatus !== 'gameOver'}
			{#if betPlaced}
				<div class="mb-8 min-h-[180px]">
					<h2 class="mb-3 text-center text-xl font-semibold text-yellow-200/80 drop-shadow-sm">
						Main du Croupier
						{#if dealerCards.length > 0}
							{#if isDealerCardHidden}
								<span class="ml-2 text-gray-400">(?)</span>
							{:else if dealerScore > 21}
								<span class="ml-2 font-bold text-red-400">(Dépassé!)</span>
							{:else if dealerScore > 0}
								<span class="ml-2 text-yellow-100">({dealerScore})</span>
							{/if}
						{/if}
					</h2>

					<div class="flex h-36 items-center justify-center space-x-2 drop-shadow-lg">
						{#each dealerCards as card, i (card.code)}
							<img
								src={i === 1 && isDealerCardHidden ? cardBackUrl : card.image}
								alt={i === 1 && isDealerCardHidden ? 'Dos de carte' : card.code}
								class="animate-card-fade-in will-change-opacity h-32 rounded-lg border-2 border-black/20 object-contain shadow-lg will-change-transform md:h-36"
								loading="lazy"
							/>
						{/each}
					</div>
				</div>
			{/if}

			{#if betPlaced}
				<div class="mb-8 min-h-[180px]">
					<h2 class="mb-3 text-center text-xl font-semibold text-yellow-200 drop-shadow-sm">
						Votre Main
						{#if playerScore > 0}
							<span class="ml-2 text-yellow-100">({playerScore})</span>
						{/if}
						{#if gameStatus === 'playerBust'}
							<span class="ml-2 font-bold text-red-400">(Dépassé!)</span>
						{/if}
					</h2>
					<div class="flex h-36 items-center justify-center space-x-2 drop-shadow-lg">
						{#each playerCards as card (card.code)}
							<img
								src={card.image}
								alt={card.code}
								class="animate-card-fade-in will-change-opacity h-32 rounded-lg border-2 border-white/20 object-contain shadow-lg will-change-transform md:h-36"
								loading="lazy"
							/>
						{/each}
					</div>
				</div>
			{/if}

			<div class="mb-6 flex min-h-[4rem] items-center justify-center text-center">
				{#if statusMessage && gameStatus !== 'loading'}
					<p
						class="rounded-md border border-yellow-600/30 bg-black/70 px-4 py-2 text-lg font-semibold shadow-md backdrop-blur-sm"
					>
						{statusMessage}
					</p>
				{/if}
				{#if displayErrorMessage}
					<p
						class="ml-4 rounded-md border border-red-500/50 bg-red-900/80 px-3 py-1 text-sm text-red-100 shadow backdrop-blur-sm"
					>
						{displayErrorMessage}
					</p>
				{/if}
				{#if gameStatus === 'loading'}
					<div class="flex items-center space-x-2 text-lg font-semibold text-yellow-300">
						<svg
							class="h-5 w-5 animate-spin text-yellow-400"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<span>Chargement...</span>
					</div>
				{/if}
			</div>

			{#if showBettingControls}
				<div
					class="mb-6 rounded-lg border border-yellow-600/40 bg-black/70 p-4 shadow-inner backdrop-blur-sm"
				>
					<h3 class="mb-4 text-center text-xl font-semibold text-yellow-300 drop-shadow-sm">
						Placez Votre Mise
					</h3>
					<div class="mb-5 flex flex-wrap items-center justify-center gap-4">
						{#each betOptions as amount}
							{@const chipColors = {
								10: 'bg-red-600 border-red-800 hover:bg-red-500 text-white',
								25: 'bg-green-600 border-green-800 hover:bg-green-500 text-white',
								50: 'bg-blue-600 border-blue-800 hover:bg-blue-500 text-white',
								100: 'bg-gray-800 border-black hover:bg-gray-700 text-yellow-300'
							}}
							{@const isDisabled = amount > playerBalance || gameStatus !== 'betting'}
							<button
								class="flex h-16 w-16 items-center justify-center rounded-full border-4 font-bold shadow-md transition duration-150 ease-in-out active:scale-95 md:h-20 md:w-20 {chipColors[
									amount
								]}"
								class:ring-4={currentBet === amount}
								class:ring-yellow-400={currentBet === amount}
								class:ring-offset-2={currentBet === amount}
								class:ring-offset-black={currentBet === amount}
								class:opacity-40={isDisabled}
								class:cursor-not-allowed={isDisabled}
								class:hover:bg-none={isDisabled}
								on:click={() => selectBet(amount)}
								disabled={isDisabled}
								title={isDisabled && amount > playerBalance
									? 'Solde insuffisant'
									: `Miser ${amount}$`}
							>
								<span class="text-lg md:text-xl">{amount}$</span>
							</button>
						{/each}
					</div>
					<div class="text-center">
						<button
							class="rounded-md border-b-4 border-green-800 bg-gradient-to-b from-green-500 to-green-700 px-8 py-3 text-lg font-bold tracking-wider text-white uppercase shadow-lg transition duration-150 ease-in-out hover:from-green-400 hover:to-green-600 active:translate-y-px active:scale-[0.98] active:border-b-2 active:brightness-95 disabled:cursor-not-allowed disabled:border-gray-700 disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-60 disabled:shadow-none"
							on:click={placeBetAndDeal}
							disabled={currentBet <= 0 || gameStatus !== 'betting'}
						>
							Jouer
						</button>
					</div>
				</div>
			{/if}

			<div class="mb-6 flex min-h-[4rem] items-center justify-center space-x-4 text-center">
				{#if showActionButtons}
					<button
						class="rounded-lg border-b-4 border-blue-800 bg-gradient-to-b from-blue-500 to-blue-700 px-7 py-3 font-semibold tracking-wider text-white uppercase shadow-md transition duration-150 ease-in-out hover:from-blue-400 hover:to-blue-600 hover:shadow-lg active:translate-y-px active:scale-[0.98] active:border-b-2 active:brightness-95 disabled:cursor-not-allowed disabled:border-gray-700 disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-50 disabled:shadow-none"
						on:click={hit}
						disabled={!canHit || gameStatus === 'loading'}
					>
						Tirer
					</button>
					<button
						class="rounded-lg border-b-4 border-amber-700 bg-gradient-to-b from-amber-400 to-amber-600 px-7 py-3 font-semibold tracking-wider text-black uppercase shadow-md transition duration-150 ease-in-out hover:from-amber-300 hover:to-amber-500 hover:shadow-lg active:translate-y-px active:scale-[0.98] active:border-b-2 active:brightness-95 disabled:cursor-not-allowed disabled:border-gray-700 disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-50 disabled:shadow-none"
						on:click={stand}
						disabled={!canStand || gameStatus === 'loading'}
					>
						Rester
					</button>
				{/if}

				{#if showNextHandButton}
					<button
						class="rounded-md border-b-4 border-gray-900 bg-gradient-to-b from-gray-600 to-gray-800 px-7 py-3 font-semibold tracking-wider text-white uppercase shadow-md transition duration-150 ease-in-out hover:from-gray-500 hover:to-gray-700 hover:shadow-lg active:translate-y-px active:scale-[0.98] active:border-b-2 active:brightness-95 disabled:cursor-not-allowed disabled:border-gray-700 disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-50 disabled:shadow-none"
						on:click={resetHand}
						disabled={gameStatus === 'loading'}
					>
						Main Suivante
					</button>
				{/if}
				{#if showNewGameButton && gameStatus === 'gameOver'}
					<button
						class="rounded-md border-b-4 border-yellow-700 bg-gradient-to-b from-yellow-400 to-yellow-600 px-6 py-2 font-bold text-black uppercase shadow-md transition duration-150 ease-in-out hover:from-yellow-300 hover:to-yellow-500 hover:shadow-lg active:translate-y-px active:scale-[0.98] active:border-b-2 active:brightness-95 disabled:border-gray-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-400 disabled:opacity-60 disabled:shadow-none"
						on:click={startNewGameSession}
					>
						Nouvelle Session
					</button>
				{/if}
			</div>

			<div class="mt-6 rounded bg-black/70 p-2 text-center text-sm text-gray-300 backdrop-blur-sm">
				<span>Solde: <span class="font-semibold text-yellow-300">{playerBalance}$</span></span>
				<span class="mx-2">|</span>
				<span
					>Mise: <span class="font-semibold text-yellow-300"
						>{currentBet > 0 ? currentBet + '$' : 'N/A'}</span
					></span
				>
				<span class="mx-2">|</span>
				<span
					>Cartes: <span class="font-semibold text-yellow-300"
						>{remainingCards > 0 ? remainingCards : 'N/A'}</span
					></span
				>
			</div>
		{:else if gameStatus === 'loading' && !deckId}
			<div class="flex h-[calc(100vh-200px)] items-center justify-center">
				<div class="flex flex-col items-center space-y-4 text-xl font-semibold text-yellow-300">
					<svg
						class="h-10 w-10 animate-spin text-yellow-400"
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
					<span>Mélange des cartes...</span>
				</div>
			</div>
		{/if}
	</div>
</main>
