# Tournament Rules and Flow

Tournaments are created by users from the user menu, by entering the "my tournaments" option, where they can create tournaments.
Tournaments have a flow of states:
- Preparation
- In Progress
- Completed
- Cancelled

When a tournament is created, it starts in the Preparation state. On the tournament creation page, the user enters the tournament name and description, which can indicate the type of tournament (league, elimination, swiss, etc.). The user can set the maximum number of participants, or leave it unset. There are also selectors to choose the following:
- Tournament type:
    - Elimination: Choose which rounds are Best of 3 and which are Best of 5. The round selector indicates general matches, and then options for round of 16, quarterfinals, semifinals, and final.
    - League: Choose if it is a single round (best of 3) or two rounds (1 match each).
    - Swiss: For each round, choose if it is 1 match, best of 3, or best of 5.
    - Mixed Swiss with Elimination: Combines the options of Swiss and Elimination.
- Tournament times: The organizer can set the time limit for each round and decide if the system advances the round automatically when the deadline is reached or not.
If the round advances after the deadline and there are unplayed matches, these are counted as losses for both players, again, without affecting global ELO or ranking, only the tournament info.

The tournament should appear in the list of available tournaments in the main menu's "tournaments" option. In that list, clicking on a tournament will take you to a page showing the tournament details and a button to register. The tournament page itself will show a list of registered players.
The registration process has two states: when a player requests to join, they are in the registration request state. The tournament creator must admit them, which can be done from that page or from the "my tournaments" page (the tournament detail form should be the same on both pages, but only the creator can see the admit button for applicants).
The creator can deny an applicant, in which case the applicant is removed from the tournament participant list.
The tournament appears in each user's "my tournaments" list from the moment of the request.
Once the creator is satisfied with the number of participants, they can set or change the tournament rules and description, and start the tournament. Once started, no more registrations can be requested.
After a tournament has started, a player can choose to leave, canceling their participation. This gives all their matches as lost (note: this does not affect their ELO nor is it counted as a win for their opponents in ELO, it only affects the tournament).
Once the tournament has started, participants can report matches for the tournament. This is done within "my tournaments" by selecting the tournament and using the "report match" option. The functionality is exactly the same as the main page's report match, but in this case, the report is associated with the tournament and counts for both global ELO/ranking and the tournament standings.
The creator cannot confirm the revocation of a match; this remains only an admin capability. If the admin confirms the revocation of a tournament match, it affects both global ELO/ranking and the tournament info.
The tournament page should show the standings and a list of tournament matches.
In the global match list and in "my matches" you should also see if a match is from a tournament, showing the tournament name.
The organizer can finish the tournament at any time with a "finish tournament" button.
The system will control pending matches in a tournament and will not allow a player to report a match to the tournament if they have already reported all their matches.
The organizer will have an option to start the next round of the tournament once the deadline for the round is reached, if manual round advancement is set for the tournament (not automatic).
Once all rounds are completed, the option to report matches will be closed and the winners and tournament ranking will be displayed.
The system will post automatic announcements for certain tournament actions:
- Tournament created: name, organizer
- Tournament started: name, organizer
- Tournament finished: name, organizer, winner name and stats, runner-up name and stats.
