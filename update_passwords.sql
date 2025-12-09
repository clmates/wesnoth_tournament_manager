UPDATE users SET password_hash = '$2b$10$/lU70NBq2.4.Tb.x1XnZJuEhbO4x651cCPgXb87AT1cFl//ckmaxm' WHERE nickname IN ('admin', 'fide_test_user', 'unrated_player');
SELECT nickname, password_hash FROM users WHERE nickname IN ('admin', 'fide_test_user', 'unrated_player');
