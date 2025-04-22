<script lang="ts">
  import { onMount } from 'svelte';

  interface Card {
    code: string;
    image: string;
    value: string;
    suit: string;
  }

  // --- State Variables ---
  let deckId: string | null = null;
  let playerCards: Card[] = [];
  let dealerCards: Card[] = [];
  let playerScore = 0;
  let dealerScore = 0;
  let remainingCards = 0;
  let gameStatus: 'loading' | 'betting' | 'playerTurn' | 'dealerTurn' | 'playerBust' | 'dealerBust' | 'playerWin' | 'dealerWin' | 'push' | 'blackjack' | 'gameOver' | 'error' = 'loading';
  let isDealerCardHidden = true;
  let errorMessage: string | null = null;

  // Betting System State
  let playerBalance = 1000; // Starting balance
  let currentBet = 0;
  let betPlaced = false;
  const betOptions = [10, 25, 50, 100];

  const API_BASE_URL = 'https://deckofcardsapi.com/api/deck';
  // const cardBackUrl = "https://deckofcardsapi.com/static/img/back.png"; // Alternative back
  const cardBackUrl = "/img/Larry.png"; // Your custom back

  // --- Core Functions ---

  // Calculate Score
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
        score += parseInt(card.value, 10);
      }
    }
    while (score > 21 && aceCount > 0) {
      score -= 10;
      aceCount -= 1;
    }
    return score;
  }

  // Get New Deck (or reuse if exists and reshuffle?) - For now, always new
  async function initializeDeck() {
      gameStatus = 'loading';
      errorMessage = null;
      try {
          const shuffleResponse = await fetch(`${API_BASE_URL}/new/shuffle/?deck_count=1`);
          if (!shuffleResponse.ok) throw new Error(`API Error: ${shuffleResponse.statusText}`);
          const shuffleData = await shuffleResponse.json();
          if (!shuffleData.success) throw new Error('Failed to get new deck.');
          deckId = shuffleData.deck_id;
          remainingCards = shuffleData.remaining;
          gameStatus = 'betting'; // Move to betting phase
          resetHand(); // Ensure cards/scores are cleared
      } catch (err: any) {
          console.error("Error initializing deck:", err);
          errorMessage = err.message || 'Failed to get new deck.';
          gameStatus = 'error';
          deckId = null;
      }
  }

  // Draw Cards from API
  async function drawCards(count: number): Promise<Card[] | null> {
    if (!deckId) {
        errorMessage = 'Deck ID is missing.';
        gameStatus = 'error';
        return null;
    }
    // Optional: Reshuffle if few cards left
    if (remainingCards < 10) {
        try {
            await fetch(`${API_BASE_URL}/${deckId}/shuffle/`);
            // Maybe update remaining count here if API provides it
        } catch (err) {
            console.warn("Could not reshuffle deck:", err);
            // Continue anyway, maybe draw will fail
        }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/${deckId}/draw/?count=${count}`);
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      const data = await response.json();
      if (!data.success) {
          // Handle specific API error like "Not enough cards remaining"
          if (data.error?.includes("Not enough cards")) {
               throw new Error('Not enough cards remaining in the deck. Please start a new game.');
          }
          throw new Error('Failed to draw cards from API.');
      }
      remainingCards = data.remaining;
      return data.cards as Card[];
    } catch (err: any) {
      console.error("Error drawing cards:", err);
      errorMessage = err.message || 'Failed to draw cards.';
      gameStatus = 'error';
      return null;
    }
  }

  // --- Betting Functions ---

  function selectBet(amount: number) {
      if (gameStatus !== 'betting') return;
      if (amount <= playerBalance) {
          currentBet = amount;
      } else {
          // Optional: Add feedback if bet is too high
          console.warn("Selected bet exceeds balance.");
          currentBet = 0; // Reset if invalid selection
      }
  }

  async function placeBetAndDeal() {
      if (currentBet <= 0 || currentBet > playerBalance || gameStatus !== 'betting') {
          // Add user feedback here - e.g., set an error message
          errorMessage = "Please select a valid bet amount.";
           // Clear message after a few seconds
          setTimeout(() => errorMessage = null, 3000);
          return;
      }

      errorMessage = null; // Clear previous errors
      betPlaced = true;
      gameStatus = 'loading'; // Show loading while dealing

      // Deduct bet amount visually immediately (or wait until end?)
      // Let's wait until the end of the round to update balance for clarity

      await dealInitialHand();
  }

  function updateBalance(outcome: 'win' | 'loss' | 'push' | 'blackjack') {
      if (outcome === 'win') {
          playerBalance += currentBet;
      } else if (outcome === 'loss') {
          playerBalance -= currentBet;
      } else if (outcome === 'blackjack') {
          playerBalance += Math.floor(currentBet * 1.5); // Blackjack pays 3:2
      }
      // For 'push', balance remains unchanged

      // Check for game over (out of money)
      if (playerBalance <= 0) {
          gameStatus = 'gameOver';
      }
  }

  // --- Game Logic Functions ---

   function resetHand() {
      playerCards = [];
      dealerCards = [];
      playerScore = 0;
      dealerScore = 0;
      isDealerCardHidden = true;
      betPlaced = false;
      currentBet = 0;
      errorMessage = null;
      // Don't reset deckId here, only game state
      if (playerBalance > 0) {
           gameStatus = 'betting'; // Go back to betting if player has money
      } else {
          gameStatus = 'gameOver';
      }
   }

   function startNewGameSession() {
      playerBalance = 1000; // Reset balance
      initializeDeck(); // Get a new deck and go to betting
   }

  // Deal Initial Cards (called after bet is placed)
  async function dealInitialHand() {
      // Reset visual state for the hand
      playerCards = [];
      dealerCards = [];
      playerScore = 0;
      dealerScore = 0;
      isDealerCardHidden = true;

    try {
      // Ensure deck is ready
      if (!deckId) {
          await initializeDeck(); // Get deck if missing (shouldn't happen in normal flow)
          if (!deckId) return; // Stop if deck initialization failed
      }

      const initialCards = await drawCards(4);
      if (!initialCards) return; // Error handled in drawCards

      playerCards = [initialCards[0], initialCards[2]];
      dealerCards = [initialCards[1], initialCards[3]];

      playerScore = calculateScore(playerCards);
      // Calculate dealer's full score now, but only show hole card if needed
      dealerScore = calculateScore(dealerCards);

      // Check for immediate Blackjack
      const playerHasBlackjack = playerScore === 21 && playerCards.length === 2;
      const dealerHasBlackjack = dealerScore === 21 && dealerCards.length === 2;

      if (playerHasBlackjack && dealerHasBlackjack) {
         isDealerCardHidden = false;
         gameStatus = 'push';
         updateBalance('push');
      } else if (playerHasBlackjack) {
         isDealerCardHidden = false;
         gameStatus = 'blackjack'; // Special win state
         updateBalance('blackjack');
      } else if (dealerHasBlackjack) {
         // Dealer checks for Blackjack only if their upcard is Ace or 10-value
         const upCard = dealerCards[0];
         if (['ACE', 'KING', 'QUEEN', 'JACK', '10'].includes(upCard.value)) {
              isDealerCardHidden = false; // Reveal card if dealer has BJ
              gameStatus = 'dealerWin';
              updateBalance('loss');
         } else {
             // Dealer doesn't have BJ, continue player's turn
             gameStatus = 'playerTurn';
         }
      } else {
         // Normal turn start
         gameStatus = 'playerTurn';
      }

    } catch (err: any) {
      console.error("Error dealing initial hand:", err);
      errorMessage = err.message || 'Failed to deal cards.';
      gameStatus = 'error';
    }
  }

  // Player Hits
  async function hit() {
    if (gameStatus !== 'playerTurn' || !deckId) return;
    gameStatus = 'loading'; // Indicate loading while drawing

    const newCards = await drawCards(1);
    if (!newCards) return; // Error handled in drawCards

    playerCards = [...playerCards, newCards[0]];
    playerScore = calculateScore(playerCards);

    if (playerScore > 21) {
      gameStatus = 'playerBust';
      isDealerCardHidden = false;
      updateBalance('loss');
    } else {
       gameStatus = 'playerTurn'; // Allow another hit/stand
    }
  }

  // Player Stands
  async function stand() {
    if (gameStatus !== 'playerTurn' || !deckId) return;

    gameStatus = 'loading'; // Indicate loading for dealer's turn
    isDealerCardHidden = false;
    dealerScore = calculateScore(dealerCards); // Recalculate just in case

    // Start dealer's turn logic
    await dealerPlay();
  }

  // Dealer's Turn Logic
  async function dealerPlay() {
      gameStatus = 'dealerTurn';

      // Dealer hits on 16 or less, stands on 17 or more
      while (dealerScore < 17) {
          await new Promise(resolve => setTimeout(resolve, 600)); // Pause for effect

          const newCards = await drawCards(1);
          if (!newCards) return; // Error handled in drawCards

          dealerCards = [...dealerCards, newCards[0]];
          dealerScore = calculateScore(dealerCards);
      }

      // Short delay before determining winner
      await new Promise(resolve => setTimeout(resolve, 400));
      determineWinner();
  }

  // Determine Winner (after Dealer finishes or Player busts)
  function determineWinner() {
    // Scores are already calculated
    isDealerCardHidden = false; // Ensure revealed

    if (playerScore > 21) {
       // Already handled in hit(), but double check state
       gameStatus = 'playerBust';
       // Balance update already happened in hit()
    } else if (dealerScore > 21) {
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

  // --- Lifecycle ---
  onMount(() => {
    initializeDeck(); // Get the deck when component mounts
  });

  // --- Reactive Declarations ---
  $: canHit = gameStatus === 'playerTurn';
  $: canStand = gameStatus === 'playerTurn';
  $: isRoundOver = ['playerBust', 'dealerBust', 'playerWin', 'dealerWin', 'push', 'blackjack', 'gameOver'].includes(gameStatus);
  $: showBettingControls = gameStatus === 'betting' && !betPlaced;
  $: showActionButtons = betPlaced && (gameStatus === 'playerTurn' || gameStatus === 'loading'); // Show Hit/Stand only when bet is placed and it's player turn or loading between actions
  $: showNextHandButton = isRoundOver && playerBalance > 0;
  $: showNewGameButton = gameStatus === 'gameOver' || gameStatus === 'error'; // Show full reset button only if out of money or error

  // --- Display Text ---
  $: statusMessage = (() => {
      // Prioritize error message
      if (errorMessage && gameStatus !== 'error') {
           // Temporarily show non-fatal errors over status
           // return `Note: ${errorMessage}`; // Or integrate differently
      }
       if (gameStatus === 'error') return `Error: ${errorMessage}`;

    switch (gameStatus) {
      case 'loading': return 'Chargement...';
      case 'betting': return `Placez votre mise (Solde: ${playerBalance}$)`;
      case 'playerTurn': return 'Votre tour';
      case 'dealerTurn': return "Tour du Croupier...";
      case 'playerBust': return `Dépassé (${playerScore})! Vous perdez ${currentBet}$.`;
      case 'dealerBust': return `Le Croupier dépasse! Vous gagnez ${currentBet}$!`;
      case 'playerWin': return `Vous gagnez ${currentBet}$!`;
      case 'dealerWin': return `Le Croupier gagne. Vous perdez ${currentBet}$.`;
      case 'push': return 'Égalité (Push)! Mise retournée.';
      case 'blackjack': return `Blackjack! Vous gagnez ${Math.floor(currentBet * 1.5)}$!`;
      case 'gameOver': return `Partie Terminée! Vous n'avez plus d'argent.`;
      default: return ''; // Should not happen
    }
  })();

</script>

<!-- Main Container -->
<main class="min-h-screen bg-green-700 text-gray-200 font-sans p-4 md:p-8 relative overflow-hidden">
<!-- Optional: Subtle background pattern -->
<div class="absolute inset-0 bg-[url('/images/felt-texture.png')] opacity-30 mix-blend-overlay"></div>

<!-- Game Content Area -->
<div class="relative z-10 max-w-4xl mx-auto">

  <h1 class="text-3xl md:text-4xl font-bold text-center mb-6 text-yellow-400 tracking-wider">
      Blackjack
  </h1>

  <!-- Error Display -->
  {#if gameStatus === 'error'}
    <div class="bg-red-700 border border-red-900 text-white p-4 rounded-lg text-center shadow-lg mb-6">
      <p class="text-lg mb-3">{statusMessage}</p>
      <button
        class="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-md transition-colors duration-200"
        on:click={startNewGameSession}
      >
        Recommencer la Session
      </button>
    </div>
  {/if}

   <!-- Game Over Display -->
  {#if gameStatus === 'gameOver'}
    <div class="bg-gray-800 border border-gray-600 text-white p-6 rounded-lg text-center shadow-lg mb-6">
      <p class="text-xl mb-4">{statusMessage}</p>
      <button
        class="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-md transition-colors duration-200"
        on:click={startNewGameSession}
      >
        Nouvelle Session (1000$)
      </button>
    </div>
  {/if}

  <!-- Game Area (only if not error/game over) -->
  {#if deckId && gameStatus !== 'error' && gameStatus !== 'gameOver'}
    <!-- Dealer's Hand -->
    <div class="mb-8 min-h-[180px]">
      <h2 class="text-xl mb-3 text-yellow-300 font-semibold text-center opacity-80">
          Main du Croupier
          {#if !isDealerCardHidden && dealerScore > 0}
              ({dealerScore})
          {:else if dealerCards.length > 0 && !isDealerCardHidden && dealerScore === 0}
               (Bust!) <!-- Should be covered by status msg -->
          {:else if dealerCards.length > 0}
               (?)
          {/if}
      </h2>
      <div class="flex space-x-2 justify-center items-center h-36"> <!-- Fixed height container -->
        {#each dealerCards as card, i (card.code)}
          <img
            src={i === 1 && isDealerCardHidden ? cardBackUrl : card.image}
            alt={i === 1 && isDealerCardHidden ? "Dos de carte" : card.code}
            class="h-32 md:h-36 rounded-lg border border-gray-700 shadow-md object-contain"
            loading="lazy"
          />
        {:else}
          <!-- Placeholder before deal -->
           {#if gameStatus !== 'betting'}
           <div class="w-24 h-36 border-2 border-dashed border-green-600 rounded-lg flex items-center justify-center text-sm text-green-400 opacity-50">Croupier</div>
           {/if}
        {/each}
      </div>
    </div>

    <!-- Player's Hand -->
    <div class="mb-8 min-h-[180px]">
       <div class="flex space-x-2 justify-center items-center h-36"> <!-- Fixed height container -->
        {#each playerCards as card (card.code)}
          <img
            src={card.image}
            alt={card.code}
            class="h-32 md:h-36 rounded-lg border border-gray-600 shadow-md object-contain"
            loading="lazy"
          />
        {:else}
           <!-- Placeholder before deal -->
           {#if gameStatus !== 'betting'}
           <div class="w-24 h-36 border-2 border-dashed border-green-600 rounded-lg flex items-center justify-center text-sm text-green-400 opacity-50">Joueur</div>
           {/if}
        {/each}
      </div>
      <h2 class="text-xl mt-3 text-yellow-300 font-semibold text-center">
          Votre Main {#if playerScore > 0}({playerScore}){/if}
      </h2>
    </div>

    <!-- Status Message Area -->
    <div class="text-center mb-6 min-h-[3rem] flex items-center justify-center">
       {#if statusMessage}
          <p class="text-lg font-semibold p-3 bg-black bg-opacity-30 rounded-md shadow">
              {statusMessage}
              {#if errorMessage && gameStatus !== 'error'}
                  <span class="block text-sm text-red-400 mt-1">{errorMessage}</span>
              {/if}
          </p>
       {/if}
       {#if gameStatus === 'loading'}
           <div class="text-lg font-semibold text-yellow-300">Chargement...</div>
       {/if}
    </div>


    <!-- Betting Controls -->
     {#if showBettingControls}
         <div class="mb-6 p-4 bg-black bg-opacity-20 rounded-lg shadow-inner">
              <h3 class="text-center text-lg text-yellow-300 mb-3">Choisissez votre mise :</h3>
              <div class="flex justify-center space-x-3 mb-4">
                  {#each betOptions as amount}
                      <button
                          class="px-4 py-2 rounded-md font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          class:bg-yellow-500={currentBet === amount}
                          class:text-black={currentBet === amount}
                          class:bg-gray-700={currentBet !== amount}
                          class:hover:bg-gray-600={currentBet !== amount}
                          class:text-gray-200={currentBet !== amount}
                          on:click={() => selectBet(amount)}
                          disabled={amount > playerBalance || gameStatus !== 'betting'}
                      >
                          {amount}$
                      </button>
                  {/each}
              </div>
               <div class="text-center">
                   <button
                      class="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-md text-white font-bold text-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      on:click={placeBetAndDeal}
                      disabled={currentBet <= 0 || gameStatus !== 'betting'}
                  >
                      Placer la Mise et Jouer
                  </button>
               </div>
         </div>
     {/if}

    <!-- Action Buttons -->
    <div class="text-center mb-6 flex space-x-4 justify-center items-center min-h-[4rem]">
      {#if showActionButtons}
          <button
              class="px-7 py-3 bg-blue-600 hover:bg-blue-500 rounded-md text-white font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={hit}
              disabled={!canHit || gameStatus === 'loading'}
          >
              Tirer (Hit)
          </button>
          <button
              class="px-7 py-3 bg-yellow-600 hover:bg-yellow-500 rounded-md text-black font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={stand}
              disabled={!canStand || gameStatus === 'loading'}
          >
              Rester (Stand)
          </button>
      {/if}

      {#if showNextHandButton}
           <button
              class="px-7 py-3 bg-gray-600 hover:bg-gray-500 rounded-md text-white font-semibold transition-colors duration-200"
              on:click={resetHand}
              disabled={gameStatus === 'loading'}
          >
              Main Suivante
          </button>
      {/if}
       {#if showNewGameButton && gameStatus !== 'gameOver'} <!-- Avoid double button with game over -->
           <button
              class="px-7 py-3 bg-red-600 hover:bg-red-500 rounded-md text-white font-semibold transition-colors duration-200"
              on:click={startNewGameSession}
          >
              Recommencer la Session
          </button>
       {/if}
    </div>

         <!-- Deck Info (Optional) -->
         <div class="text-center mt-8 text-xs text-gray-400 opacity-70">
          Solde: {playerBalance}$ | Mise Actuelle: {currentBet > 0 ? currentBet + '$' : 'N/A'} | Cartes Restantes: {remainingCards}
          <!-- | ID Paquet: {deckId || 'N/A'} --> <!-- Can uncomment if needed for debug -->
       </div>

  {:else if gameStatus === 'loading' && !deckId}
      <!-- Initial Loading State -->
    <div class="text-center text-xl font-semibold text-yellow-300 mt-20">Chargement du jeu...</div>
  {/if}

</div>
</main>

<style>
  /* Optional: Add custom styles or overrides here */
  /* Example: Ensure card images don't distort */
  img {
      object-fit: contain; /* Or 'cover' depending on desired look */
  }

  /* Add a subtle animation for cards appearing */
  @keyframes cardFadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
  }

  .flex img {
    animation: cardFadeIn 0.3s ease-out forwards;
  }

  /* Add smooth transition for button background colors */
  button {
      transition: background-color 0.2s ease-in-out, opacity 0.2s ease-in-out;
  }
</style>