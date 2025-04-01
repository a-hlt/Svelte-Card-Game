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
    let gameStatus: 'loading' | 'initial' | 'playerTurn' | 'dealerTurn' | 'playerBust' | 'dealerBust' | 'playerWin' | 'dealerWin' | 'push' | 'error' = 'loading';
    let isDealerCardHidden = true;
    let errorMessage: string | null = null;

    const API_BASE_URL = 'https://deckofcardsapi.com/api/deck';


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

    // Draw Cards from API
    async function drawCards(count: number): Promise<Card[] | null> {
      if (!deckId) return null;
      try {
        const response = await fetch(`${API_BASE_URL}/${deckId}/draw/?count=${count}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json();
        if (!data.success) throw new Error('Failed to draw cards from API.');
        remainingCards = data.remaining;
        return data.cards as Card[];
      } catch (err: any) {
        console.error("Error drawing cards:", err);
        errorMessage = err.message || 'Failed to draw cards.';
        gameStatus = 'error';
        return null;
      }
    }

    // --- Game Logic Functions ---

    // Start New Game
    async function startGame() {
      gameStatus = 'loading';
      errorMessage = null;
      playerCards = [];
      dealerCards = [];
      playerScore = 0;
      dealerScore = 0;
      isDealerCardHidden = true;

      try {
        // 1. Get a new deck
        const shuffleResponse = await fetch(`${API_BASE_URL}/new/shuffle/?deck_count=1`);
        if (!shuffleResponse.ok) throw new Error(`API Error: ${shuffleResponse.statusText}`);
        const shuffleData = await shuffleResponse.json();
        if (!shuffleData.success) throw new Error('Failed to get new deck.');
        deckId = shuffleData.deck_id;
        remainingCards = shuffleData.remaining;

        const initialCards = await drawCards(4);
        if (!initialCards) return;

        playerCards = [initialCards[0], initialCards[2]];
        dealerCards = [initialCards[1], initialCards[3]];

        playerScore = calculateScore(playerCards);

        dealerScore = calculateScore(dealerCards);

        // 4. Check condition Blackjack
        if (playerScore === 21 && dealerScore === 21) {
           isDealerCardHidden = false;
           gameStatus = 'push';
        } else if (playerScore === 21) {
           isDealerCardHidden = false;
           gameStatus = 'playerWin';
        } else if (dealerScore === 21) {
           isDealerCardHidden = false;
           gameStatus = 'dealerWin';
        } else {
           gameStatus = 'playerTurn';
        }

      } catch (err: any) {
        console.error("Error starting game:", err);
        errorMessage = err.message || 'Failed to start game.';
        gameStatus = 'error';
        deckId = null;
      }
    }

    async function hit() {
      if (gameStatus !== 'playerTurn' || !deckId) return;
      gameStatus = 'loading';

      const newCards = await drawCards(1);
      if (!newCards) return;

      playerCards = [...playerCards, newCards[0]];
      playerScore = calculateScore(playerCards);

      if (playerScore > 21) {
        gameStatus = 'playerBust';
        isDealerCardHidden = false;
      } else if (playerScore === 21) {

        stand();
      }
      else {
         gameStatus = 'playerTurn';
      }
    }


    async function stand() {
      if (gameStatus !== 'playerTurn' || !deckId) return;

      gameStatus = 'loading';
      isDealerCardHidden = false;
      dealerScore = calculateScore(dealerCards);


      while (dealerScore < 17) {
          await new Promise(resolve => setTimeout(resolve, 500));

          const newCards = await drawCards(1);
          if (!newCards) return;

          dealerCards = [...dealerCards, newCards[0]];
          dealerScore = calculateScore(dealerCards);
      }

      determineWinner();
    }

    // Qui Gagne
    function determineWinner() {
      playerScore = calculateScore(playerCards);
      dealerScore = calculateScore(dealerCards);
      isDealerCardHidden = false;

      if (playerScore > 21) {
        gameStatus = 'playerBust'; // Already set, but double-check
      } else if (dealerScore > 21) {
        gameStatus = 'dealerBust'; // Player wins
      } else if (playerScore > dealerScore) {
        gameStatus = 'playerWin';
      } else if (dealerScore > playerScore) {
        gameStatus = 'dealerWin';
      } else {
        gameStatus = 'push';
      }
    }

    // --- Start Game ---
    onMount(() => {
      startGame();
    });

    // --- Reactive Declarations ---
    $: canHit = gameStatus === 'playerTurn';
    $: canStand = gameStatus === 'playerTurn';
    $: isGameOver = ['playerBust', 'dealerBust', 'playerWin', 'dealerWin', 'push'].includes(gameStatus);

    // --- Display Text ---
    $: statusMessage = (() => {
      switch (gameStatus) {
        case 'loading': return 'Loading...';
        case 'initial': return 'Click Deal to Start';
        case 'playerTurn': return 'Your Turn';
        case 'dealerTurn': return "Dealer's Turn...";
        case 'playerBust': return 'You Busted! Dealer Wins.';
        case 'dealerBust': return 'Dealer Busted! You Win!';
        case 'playerWin': return 'You Win!';
        case 'dealerWin': return 'Dealer Wins!';
        case 'push': return 'Push (Tie)!';
        case 'error': return `Error: ${errorMessage}`;
        default: return '';
      }
    })();

    const cardBackUrl = "https://deckofcardsapi.com/static/img/back.png";

  </script>

  <main class="container mx-auto p-4 bg-green-800 min-h-screen text-white font-sans">
    <h1 class="text-3xl font-bold text-center mb-6 text-yellow-300">Svelte Blackjack</h1>

    {#if gameStatus === 'error'}
      <div class="bg-red-500 text-white p-4 rounded text-center">
        <p>{statusMessage}</p>
        <button
          class="mt-2 px-4 py-2 bg-red-700 hover:bg-red-800 rounded"
          on:click={startGame}
        >
          Try Again
        </button>
      </div>
    {/if}

    {#if deckId && gameStatus !== 'error'}
      <!-- Dealer Hand -->
      <div class="mb-8">
        <h2 class="text-xl mb-2 text-yellow-200">Dealer Hand ({ isDealerCardHidden && dealerCards.length > 0 ? '?' : dealerScore })</h2>
        <div class="flex space-x-2 justify-center min-h-[140px] items-center">
          {#each dealerCards as card, i (card.code)}
            {#if i === 1 && isDealerCardHidden}
              <img src={cardBackUrl} alt="Card Back" class="w-20 md:w-24 rounded border border-gray-300 shadow-md"/>
            {:else}
              <img src={card.image} alt="{card.code}" class="w-20 md:w-24 rounded border border-gray-300 shadow-md"/>
            {/if}
          {:else}
             <div class="w-20 md:w-24 h-[112px] md:h-[134px] border border-dashed border-green-400 rounded flex items-center justify-center text-sm text-green-300">Dealer</div>
          {/each}
        </div>
      </div>

      <!-- Player Hand -->
      <div class="mb-8">
        <h2 class="text-xl mb-2 text-yellow-200">Your Hand ({playerScore})</h2>
         <div class="flex space-x-2 justify-center min-h-[140px] items-center">
            {#each playerCards as card (card.code)}
              <img src={card.image} alt="{card.code}" class="w-20 md:w-24 rounded border border-gray-300 shadow-md"/>
            {:else}
               <div class="w-20 md:w-24 h-[112px] md:h-[134px] border border-dashed border-green-400 rounded flex items-center justify-center text-sm text-green-300">Player</div>
            {/each}
        </div>
      </div>

      <!-- Game Button -->
      <div class="text-center mb-4">
        {#if statusMessage}
          <p class="text-lg font-semibold mb-4 p-2 bg-black bg-opacity-30 rounded">{statusMessage}</p>
        {/if}

       <div class="flex space-x-4 justify-center">
         <button
           class="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
           on:click={hit}
           disabled={!canHit || gameStatus === 'loading'}
         >
           Hit
         </button>
         <button
           class="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 rounded text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
           on:click={stand}
           disabled={!canStand || gameStatus === 'loading'}
         >
           Stand
         </button>
          {#if isGameOver || gameStatus === 'initial'}
            <button
              class="px-5 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-semibold"
              on:click={startGame}
              disabled={gameStatus === 'loading'}
            >
              Deal New Game
            </button>
          {/if}
       </div>
     </div>

       <!-- Deck Info -->
       <div class="text-center mt-6 text-sm text-gray-300">
         Cards Remaining: {remainingCards} | Deck ID: {deckId || 'N/A'}
       </div>

    {:else if gameStatus === 'loading'}
       <div class="text-center text-xl font-semibold">Loading Game...</div>
    {/if}

  </main>