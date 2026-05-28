import type { SupabaseRawEvent } from "./sheetMapping";

const EVENT_TYPES = ["quote_sent", "quote_accepted", "quote_declined"];

export class SupabaseQuotientClient {
	constructor(
		private readonly url: string,
		private readonly serviceRoleKey: string,
	) {}

	async listProcessedQuoteEvents(limit: number, minRawEventId: number | null): Promise<SupabaseRawEvent[]> {
		const endpoint = new URL("/rest/v1/quotient_events_raw", this.url);
		endpoint.searchParams.set("select", "id,event_type,payload");
		endpoint.searchParams.set("status", "eq.processed");
		endpoint.searchParams.set("event_type", `in.(${EVENT_TYPES.join(",")})`);
		if (minRawEventId !== null) {
			endpoint.searchParams.set("id", `gte.${minRawEventId}`);
		}
		endpoint.searchParams.set("order", "id.desc");
		endpoint.searchParams.set("limit", String(limit));

		const response = await fetch(endpoint, {
			headers: {
				apikey: this.serviceRoleKey,
				authorization: `Bearer ${this.serviceRoleKey}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
		}

		return ((await response.json()) as SupabaseRawEvent[]).reverse();
	}
}
