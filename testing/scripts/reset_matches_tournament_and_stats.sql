delete from tournament_matches;
delete from tournament_participants;
delete from tournament_round_matches;
delete from tournament_rounds;
delete from tournaments;
delete from matches;

update users set elo_rating=1600, level='Novato', is_rated=false, matches_played=0, total_wins=0, total_losses=0, trend='-';



select * from users