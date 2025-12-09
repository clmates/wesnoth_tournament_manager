-- Simulate FIDE ELO calculation for 5 test matches
-- After each match, update user ratings

-- Match 1: fide_test_user (unrated, 1400 implied) vs admin (2000)
-- Winner (fide_test_user): K=40, EA = 1/(1+10^((2000-1400)/400)) ≈ 0.094, Rating = 1400 + 40*(1-0.094) ≈ 1437
-- Loser (admin): K=16, EA = 1/(1+10^((1400-2000)/400)) ≈ 0.906, Rating = 2000 + 16*(0-0.906) ≈ 1985

UPDATE users SET elo_rating = 1437, is_rated = false, matches_played = 1 WHERE nickname = 'fide_test_user';
UPDATE users SET elo_rating = 1985, is_rated = true, matches_played = 1 WHERE nickname = 'admin';

-- Match 2: fide_test_user (1437, 1 match) vs admin (1985)
-- Winner: K=40, EA ≈ 0.087, Rating = 1437 + 40*(1-0.087) ≈ 1474
-- Loser: K=16, EA ≈ 0.913, Rating = 1985 + 16*(0-0.913) ≈ 1970

UPDATE users SET elo_rating = 1474, matches_played = 2 WHERE nickname = 'fide_test_user';
UPDATE users SET elo_rating = 1970, matches_played = 2 WHERE nickname = 'admin';

-- Match 3: fide_test_user (1474, 2 matches) vs admin (1970)
-- Winner: K=40, EA ≈ 0.081, Rating = 1474 + 40*(1-0.081) ≈ 1511
-- Loser: K=16, EA ≈ 0.919, Rating = 1970 + 16*(0-0.919) ≈ 1955

UPDATE users SET elo_rating = 1511, matches_played = 3 WHERE nickname = 'fide_test_user';
UPDATE users SET elo_rating = 1955, matches_played = 3 WHERE nickname = 'admin';

-- Match 4: fide_test_user (1511, 3 matches) vs admin (1955)
-- Winner: K=40, EA ≈ 0.078, Rating = 1511 + 40*(1-0.078) ≈ 1548
-- Loser: K=16, EA ≈ 0.922, Rating = 1955 + 16*(0-0.922) ≈ 1940

UPDATE users SET elo_rating = 1548, matches_played = 4 WHERE nickname = 'fide_test_user';
UPDATE users SET elo_rating = 1940, matches_played = 4 WHERE nickname = 'admin';

-- Match 5: fide_test_user (1548, 4 matches) vs admin (1940)
-- Winner: K=40, EA ≈ 0.073, Rating = 1548 + 40*(1-0.073) ≈ 1585
-- Loser: K=16, EA ≈ 0.927, Rating = 1940 + 16*(0-0.927) ≈ 1925
-- After 5 matches vs rated player, fide_test_user becomes rated!

UPDATE users SET elo_rating = 1585, is_rated = true, matches_played = 5 WHERE nickname = 'fide_test_user';
UPDATE users SET elo_rating = 1925, matches_played = 5 WHERE nickname = 'admin';

-- Verify final state
SELECT nickname, is_rated, matches_played, elo_rating FROM users WHERE nickname IN ('fide_test_user', 'admin');
