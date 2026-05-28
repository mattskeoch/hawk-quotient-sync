import type { SyncLogEvent, SyncResult } from "./sync";

export class D1SyncStore {
	constructor(private readonly db: D1Database) {}

	async isProcessed(eventKey: string): Promise<boolean> {
		const row = await this.db
			.prepare("SELECT event_key FROM processed_events WHERE event_key = ? LIMIT 1")
			.bind(eventKey)
			.first();
		return Boolean(row);
	}

	async recordProcessed(eventKey: string, rawEventId: number): Promise<void> {
		await this.db
			.prepare("INSERT OR IGNORE INTO processed_events (event_key, raw_event_id, processed_at) VALUES (?, ?, ?)")
			.bind(eventKey, rawEventId, new Date().toISOString())
			.run();
	}

	async recordRun(status: "success" | "error", result: SyncResult, startedAt: string, message?: string): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO sync_runs
					(status, fetched, skipped, applied, ignored, errors, message, started_at, finished_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				status,
				result.fetched,
				result.skipped,
				result.applied,
				result.ignored,
				result.errors,
				message ?? null,
				startedAt,
				new Date().toISOString(),
			)
			.run();
	}

	async log(event: SyncLogEvent): Promise<void> {
		const payload = JSON.stringify(event);
		if (event.level === "error") {
			console.error(payload);
			return;
		}
		console.log(payload);
	}
}
