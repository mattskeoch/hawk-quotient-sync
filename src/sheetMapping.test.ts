import { describe, expect, it } from "vitest";
import { buildSheetMutation, mapRawEventToSheetQuote } from "./sheetMapping";

const basePayload = {
	quote_number: 9779,
	title: "Mechanically Polished Concrete Quotation - Variation",
	from: "Nathan Lankshear",
	for: "Johnny Zito",
	first_sent: "2026-05-25T03:52:19+00:00",
	quote_status: "Accepted",
	total_excludes_tax: 1038.46,
	quote_for: {
		name_first: "Johnny",
		name_last: "Zito",
		email: "johnz20008@hotmail.com",
		company_name: "",
	},
};

describe("mapRawEventToSheetQuote", () => {
	it("maps accepted payloads to the existing sheet columns with Perth dates", () => {
		const quote = mapRawEventToSheetQuote({
			id: 1611,
			event_type: "quote_accepted",
			payload: {
				...basePayload,
				event_name: "quote_accepted",
				accepted: { when: "2026-05-25T03:56:05+00:00" },
			},
		});

		expect(quote).toEqual({
			rawEventId: 1611,
			eventKey: "supabase:1611",
			quoteNumber: "9779",
			dateQuoted: "25/05/2026",
			estimator: "Nathan Lankshear",
			customer: "Johnny Zito",
			flooringStream: "",
			description: "Mechanically Polished Concrete Quotation - Variation",
			stage: "Accepted",
			stageChange: "25/05/2026",
			value: 1038.46,
		});
	});

	it("leaves stage change blank for quote sent events", () => {
		const quote = mapRawEventToSheetQuote({
			id: 1639,
			event_type: "quote_sent",
			payload: {
				...basePayload,
				event_name: "quote_sent",
				quote_status: "Awaiting Acceptance",
			},
		});

		expect(quote?.stage).toBe("Awaiting Acceptance");
		expect(quote?.stageChange).toBe("");
	});

	it("uses declined.when for declined stage changes", () => {
		const quote = mapRawEventToSheetQuote({
			id: 1568,
			event_type: "quote_declined",
			payload: {
				...basePayload,
				event_name: "quote_declined",
				quote_status: "Declined",
				declined: { when: "2026-05-21T01:43:28+00:00" },
			},
		});

		expect(quote?.stage).toBe("Declined");
		expect(quote?.stageChange).toBe("21/05/2026");
	});
});

describe("buildSheetMutation", () => {
	it("updates only automated ranges for existing rows", () => {
		const quote = mapRawEventToSheetQuote({
			id: 1611,
			event_type: "quote_accepted",
			payload: {
				...basePayload,
				event_name: "quote_accepted",
				accepted: { when: "2026-05-25T03:56:05+00:00" },
			},
		});

		if (!quote) throw new Error("expected quote");
		const mutation = buildSheetMutation("⚡ Quotient Import", quote, 23);

		expect(mutation.kind).toBe("update");
		if (mutation.kind !== "update") throw new Error("expected update mutation");
		expect(mutation.ranges).toEqual([
			{
				range: "'⚡ Quotient Import'!A23:H23",
				values: [["9779", "25/05/2026", "Nathan Lankshear", "Johnny Zito", "", "Mechanically Polished Concrete Quotation - Variation", "Accepted", "25/05/2026"]],
			},
			{ range: "'⚡ Quotient Import'!J23:J23", values: [[1038.46]] },
		]);
	});

	it("appends A:L rows while keeping manual fields blank", () => {
		const quote = mapRawEventToSheetQuote({
			id: 1639,
			event_type: "quote_sent",
			payload: {
				...basePayload,
				event_name: "quote_sent",
				quote_status: "Awaiting Acceptance",
			},
		});

		if (!quote) throw new Error("expected quote");
		const mutation = buildSheetMutation("⚡ Quotient Import", quote);

		expect(mutation.kind).toBe("append");
		if (mutation.kind !== "append") throw new Error("expected append mutation");
		expect(mutation.range).toBe("'⚡ Quotient Import'!A:L");
		expect(mutation.values).toEqual([[
			"9779",
			"25/05/2026",
			"Nathan Lankshear",
			"Johnny Zito",
			"",
			"Mechanically Polished Concrete Quotation - Variation",
			"Awaiting Acceptance",
			"",
			"",
			1038.46,
			"",
			"",
		]]);
	});
});
