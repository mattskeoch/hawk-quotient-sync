CREATE TABLE IF NOT EXISTS processed_events (
    event_key TEXT PRIMARY KEY NOT NULL,
    raw_event_id INTEGER NOT NULL,
    processed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS processed_events_raw_event_id_idx
    ON processed_events(raw_event_id);

CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    fetched INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    applied INTEGER NOT NULL DEFAULT 0,
    ignored INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL
);
