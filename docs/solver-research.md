# Mathematical play

The current Expert bot is a search approximation, not a verified equilibrium strategy. engine.js samples deals consistent with the acting player's information and plays candidate actions out with heuristic bots. Its results depend on that model of future play.

## What optimal means here

One possible target is the team strategy with the highest worst case chance of winning. Each teammate's action must depend only on their own hand and public play. A solver must not combine teammates' hidden cards into one fully informed player.

Another target is the strategy that wins most often against a particular opponent and teammate model. That can exploit their mistakes but can itself be exploited by a different opponent. The current bot is closer to this second target.

Team games have established equilibrium methods. Which method applies depends on whether teammates may agree on a shared strategy or random plan before a deal. That is different from communicating hidden cards during play.

## Rules to specify before claiming a full solution

- Use team match wins as the payoff, rather than the number of cards collected or margin in books.
- Fix player count, bluffing, rule checks and six player naming. They define different games.
- Define permitted pregame coordination between teammates.
- Define the outcome of endless repetition. Current legal asks can repeat forever, so a finite deck alone does not give a finite game tree. An analysis harness can use an explicit action limit and draw payoff, but this must be reported as an analysis assumption. The live rules have not been changed.

## Practical development order

1. Verify the rules and public evidence using tests. This repository now has 13 tests, including complete seeded bot games.
2. Build exact solutions for small positions. Publicly known endgames can use perfect information methods. Hidden information endgames need a policy that makes the same decision in states the player cannot distinguish.
3. Build a reduced training game with an explicit ending rule, then compare equilibrium learning with its exact solution. Ordinary independent CFR at each teammate is not enough to claim the two player convergence guarantee.
4. Expand with team game methods, sampling and self play. Evaluate against held out opponents, including policies trained to exploit the candidate.
5. Display estimates, assumptions and uncertainty in the coach. Use a GTO claim only when there is an appropriate exploitability bound for the stated game.

No new equilibrium solver or optimality guarantee has been added to this release.

## Sources

- [Regret Minimization in Games with Incomplete Information, Zinkevich et al., 2007](https://proceedings.neurips.cc/paper/2007/hash/08d98638c6fcd194a4b1e6992063e944-Abstract.html)
- [Team Belief DAG, Zhang, Farina and Sandholm, ICML 2023](https://proceedings.mlr.press/v202/zhang23j.html)
- [Subgame Solving in Adversarial Team Games, Zhang et al., NeurIPS 2022](https://proceedings.neurips.cc/paper_files/paper/2022/hash/aa5f5e6eb6f613ec412f1d948dfa21a5-Abstract-Conference.html)
- [Solving Heads-Up Limit Texas Hold'em, Tammelin et al., IJCAI 2015](https://ijcai.org/proceedings/2015/97)
