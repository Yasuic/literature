# Literature game specification

Source: the [live game's How to play panel](https://yasuic.github.io/literature/), checked against [engine.js at revision 8074fb1](https://github.com/Yasuic/literature/blob/8074fb1af2a76841efcd0b315927eda5ff525630/engine.js) on 3 November 2026.

## Deck and teams

There are 54 cards, including two jokers. Each suit has a low book containing 2 to 7 and a high book containing 9 to ace. The four 8s and two jokers form the ninth book. Every book has six cards.

Seats alternate teams. Four players form teams of two, and each team receives 27 cards across one 13 card hand and one 14 card hand. Six players form teams of three, and each player receives nine cards. The starting player is random.

The first team to win five books wins. Players see only their own cards. Questions and responses are public. Teammates cannot communicate directly or ask each other for cards.

## Asking and bluffing

On a turn, ask one opponent for one card in an unclaimed book. With rule checks on, the asker must currently hold at least one card from that book. Losing the final card in a book removes permission to ask in it.

A successful ask transfers the card and keeps the turn with the asker. A failed ask gives the turn to the opponent who was asked. It does not automatically pass clockwise.

With bluffing on, the asker may request a card already in their own hand. This always fails and gives away the turn, but suggests to other players that the asker does not hold it. A failed target's denial is certain information. An asker's apparent denial is uncertain when bluffing is allowed.

## Calling and finishing

A player can call a book only on their own turn. The six cards must be held across that player's team; the caller does not need to hold all six personally. A correct call awards the team one book and keeps the caller's turn. The six cards leave play.

A wrong call awards the opponents one book. The turn goes to the first opponent clockwise who held a card in that book and still has cards after the book is removed. If none qualifies, the engine selects the next player with cards clockwise.

With six player naming on, the caller must also name the correct teammate holding each card. A wrong assignment loses the book even if all six cards are on the caller's team. Four player mode does not require assignments.

A player with no cards is skipped. If the caller runs out after a correct call, the turn passes clockwise to the next player with cards. If one team has no cards left, the other team receives all remaining books.

## Existing play aids

- Casual bots forget some information. Sharp bots track public evidence. Expert bots compare possible moves by playing out imagined deals consistent with the available information.
- Smart teammates consider who receives the turn after a miss. Mid teammates use the odds of obtaining a card.
- The coach compares moves with alternatives from simulated deals. Its percentages are estimates.
- Notes show deductions from public play and the viewer's hand. Voices use the original recorded audio.
- Settings and game progress are stored on the current device. The web version can export a deal and move history for a ChatGPT review.

## Implementation

The original engine and recorded assets are retained. The root web files are the source for both the hosted copy and ios-app/www/. Run node scripts/build-web.mjs before publishing or syncing Capacitor so both versions use the same game.
