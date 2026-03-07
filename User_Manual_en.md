Ranked wesnoth and tournament manager

1. it is a ranked system for 1 vs 1 games, with true FIDE Elo implementation so this means a fair and proven ranking system

2. Players can self register, admin had to unlock new registered players. Registration requires an email, a nickname matching wesnoth nickname and a password, once registered and unlocked by the admin, the users login with the nickname

3. Reporting Matches:

3.1. Winner player can report matches and in the report form you have to specify opponent, map and factions, you can add comments and rate your opponent and can upload the replay. The good news is if you first upload the replay, then the system automatically fill the form as it parses the replay and extract the relevant data

3.2. Loser player can either confirm or dispute the game. also can rate opponent, enter coments and also upload replay if still not uploaded.

3.3. If loser disputes game, an admin has to resolve, either confirm the dispute = cancel game report, or discard de dispute = accept game report.

3.4. If the admin cancels the dispute, the system will reclaulate in cascade all elo of the matches reported after this match for all the players

4. Tournaments

4.1. Users can host their own tournanaments or join tournaments hosted by other payers

4.2. To setup a tournament you have to go to your user menu and there on My Tournaments you can create a tournament

4.3. Set the title, description (for the rules you want to set) and choose a tournament type (Elimination, League, Swiss, Mixed Swiss + Elimination) we will get later on this. You can specify the maximum number of players and the duration of each round, also set automatic advance of the round or manual advance by the tournament owner. Then you can create the tournament

4.4.Tournament Phases

4.4.1. Tournament is created and rules specified, then the Open Registration phase start

4.4.2. Open Registration phase. Users can request to join and tournament owner can accept or reject. The owner can close registration at any time and then move to preparation phase.

4.4.3. Preparation phase. Tournament owner can adapt start date, round duration, number of games for each type of round, and also some setings specific for each type of tournament, round auto advance and press Start.

4.4.4. Execution Phase. The system generates the rounds and the pairings for the matches, you can see the rounds, the pairings and the ranking of the tournament, from this point, the players have to play their games and report matches.

4.4.5. Reporting Tournament Matches. The matches reported for a tournament should be reported from the option Report Match inside the tournament page, in that way, the match count for both, the global elo ranking and for the tournament. The report match fucntionality is the same and with the same options for winner and loser.

4.4.5.1. Match disputes should be resolved by an admin, Tournament owners cant dirime match disputes as affects global Elo and ranking

4.4.6. Advancing rounds in the tournament. The system can auto advance the round when all the players hacve reported their matches if the auto advance option was set. If not set, the tournament owner can advance the round when it is complete. The system knows the users that will make to the next round and generate the round and the proper matches. When all rounds ends, the system determines the tournament winner and the runner up

4.4.7. If a player resigns and abandon the tournament, the tournament owner have the option to resolve pending matches and give the win to the opponnent so the tournament can continue.

5. Tournament type specific settings

5.1. Elimination. The tournament owner can diferentiate how many matches are played in the general rounds and in the final (best to 1, best of 3, best of 5)

5.2. League. The tournament owner can choose the number of waves, 1 or 2 and the number of matches per round (best to 1, best of 3, best of 5)

5.3. Swiss. The tournament owner can choose the number of rounds and the number of matches per round (best to 1, best of 3, best of 5).

5.4. Mixed mode Swiss + Elimination. The tournament owner can choose the number of swiss rounds and also the number of final rounds (quarters, semis, final), this determines the number of players that pass from the swiss mode to the elimination mode. and finally can chose the number of matches in the swiss phase and in each of the leves of the elimination phase from (best to 1, best of 3, best of 5)

Discord Integration
There is a new Discord server Wesnoth Tournament Manager. Discord server link : https://discord.gg/XUTpvBQNP6


When the users register the see a invitation link to join the server. 

There are a channel dedicated to new users "new-players" , here new users are announced and also there is a message where the user is notified for the account unlock

There is a Forum type channel "tournaments" that is mainly managed from the application, details below:

When a new tournament is created, the system creates a new thread in the forum called after the tournament and post messages on some tournament events.

Tournament creation with name, description and rules
Players request to join
Playerr accepted or rejected
Tournament Start
Rounds starts
Pairings
Tournament end, champion and runnner up
