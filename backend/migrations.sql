CREATE OR REPLACE FUNCTION
    mark_club_stats_dirty()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO club_stats_dirty (club_name)
        SELECT OLD.club_name
        WHERE EXISTS (SELECT 1 FROM club WHERE name = OLD.club_name)
        ON CONFLICT DO NOTHING;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.activated IS DISTINCT FROM NEW.activated THEN
            INSERT INTO club_stats_dirty (club_name) VALUES (NEW.club_name)
            ON CONFLICT DO NOTHING;
        END IF;
        RETURN NEW;
    ELSE
        INSERT INTO club_stats_dirty (club_name) VALUES (NEW.club_name)
        ON CONFLICT DO NOTHING;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;
