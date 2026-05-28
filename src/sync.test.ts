import { describe, expect, it } from "vitest";
import { runSync } from "./sync";
import type { SupabaseRawEvent } from "./sheetMapping";

describe("runSync", () => {
	it("skips processed raw events and records newly applied events", async () => {
		const events: SupabaseRawEvent[] = [
			{
				id: 10,
				event_type: "quote_sent",
				payload: {
					event_name: "quote_sent",
					quote_number: 9790,
					first_sent: "2026-05-28T00:45:09+00:00",
					from: "Nathan Lankshear",
					quote_for: { name_first: "Courtney", name_last: "Foulds" },
					title: "Commercial: Resinous Flooring Quotation - Workshop (Regional)",
					quote_status: "Awaiting Acceptance",
					total_excludes_tax: 131642.82,
				},
			},
			{
				id: 11,
				event_type: "quote_accepted",
				payload: {
					event_name: "quote_accepted",
					quote_number: 9790,
					first_sent: "2026-05-28T00:45:09+00:00",
					from: "Nathan Lankshear",
					quote_for: { name_first: "Courtney", name_last: "Foulds" },
					title: "Commercial: Resinous Flooring Quotation - Workshop (Regional)",
					quote_status: "Accepted",
					total_excludes_tax: 131642.82,
					accepted: { when: "2026-05-29T00:02:00+00:00" },
				},
			},
		];
		const processed = new Set(["supabase:10"]);
		const applied: unknown[] = [];
		const recorded: string[] = [];

		const result = await runSync({
			tabName: "⚡ Quotient Import",
			events,
			isProcessed: async (eventKey) => processed.has(eventKey),
			findRowByQuoteNumber: async () => 42,
			applyMutation: async (mutation) => {
				applied.push(mutation);
			},
			recordProcessed: async (eventKey) => {
				recorded.push(eventKey);
				processed.add(eventKey);
			},
			log: async () => undefined,
		});

		expect(result).toEqual({ fetched: 2, skipped: 1, applied: 1, ignored: 0, errors: 0 });
		expect(recorded).toEqual(["supabase:11"]);
		expect(applied).toHaveLength(1);
		expect(applied[0]).toMatchObject({
			kind: "update",
			ranges: [
				{ range: "'⚡ Quotient Import'!A42:H42" },
				{ range: "'⚡ Quotient Import'!J42:J42" },
			],
		});
	});

	it("stops after the first apply failure", async () => {
		const events: SupabaseRawEvent[] = [
			{
				id: 20,
				event_type: "quote_sent",
				payload: {
					event_name: "quote_sent",
					quote_number: 9793,
					first_sent: "2026-05-28T06:49:29+00:00",
					from: "Matt Skeoch",
					quote_for: { name_first: "test", name_last: "quote" },
					title: "Quotation - HAWK Concrete Floor Coatings",
					quote_status: "Awaiting Acceptance",
					total_excludes_tax: 0,
				},
			},
			{
				id: 21,
				event_type: "quote_sent",
				payload: {
					event_name: "quote_sent",
					quote_number: 9794,
					first_sent: "2026-05-28T07:00:00+00:00",
					quote_status: "Awaiting Acceptance",
				},
			},
		];
		const recorded: string[] = [];

		const result = await runSync({
			tabName: "⚡ Quotient Import",
			events,
			isProcessed: async () => false,
			findRowByQuoteNumber: async () => null,
			applyMutation: async () => {
				throw new Error("Google Sheets request failed: 403");
			},
			recordProcessed: async (eventKey) => {
				recorded.push(eventKey);
			},
			log: async () => undefined,
		});

		expect(result).toEqual({ fetched: 2, skipped: 0, applied: 0, ignored: 0, errors: 1 });
		expect(recorded).toEqual([]);
	});
});
