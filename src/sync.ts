import { buildSheetMutation, mapRawEventToSheetQuote, type SheetMutation, type SupabaseRawEvent } from "./sheetMapping";

export type SyncResult = {
	fetched: number;
	skipped: number;
	applied: number;
	ignored: number;
	errors: number;
};

export type SyncLogEvent = {
	level: "info" | "error";
	message: string;
	quoteNumber?: string;
	rawEventId?: number;
	error?: string;
};

export type SyncDependencies = {
	tabName: string;
	events: SupabaseRawEvent[];
	isProcessed(eventKey: string): Promise<boolean>;
	findRowByQuoteNumber(quoteNumber: string): Promise<number | null>;
	applyMutation(mutation: SheetMutation): Promise<void>;
	recordProcessed(eventKey: string, rawEventId: number): Promise<void>;
	log(event: SyncLogEvent): Promise<void>;
};

export async function runSync(deps: SyncDependencies): Promise<SyncResult> {
	const result: SyncResult = {
		fetched: deps.events.length,
		skipped: 0,
		applied: 0,
		ignored: 0,
		errors: 0,
	};

	for (const event of deps.events) {
		const quote = mapRawEventToSheetQuote(event);
		if (!quote) {
			result.ignored += 1;
			continue;
		}

		if (await deps.isProcessed(quote.eventKey)) {
			result.skipped += 1;
			continue;
		}

		try {
			const rowNumber = await deps.findRowByQuoteNumber(quote.quoteNumber);
			await deps.applyMutation(buildSheetMutation(deps.tabName, quote, rowNumber ?? undefined));
			await deps.recordProcessed(quote.eventKey, quote.rawEventId);
			result.applied += 1;
			await deps.log({
				level: "info",
				message: rowNumber ? "row_updated" : "row_appended",
				quoteNumber: quote.quoteNumber,
				rawEventId: quote.rawEventId,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			result.errors += 1;
			await deps.log({
				level: "error",
				message: "event_failed",
				quoteNumber: quote.quoteNumber,
				rawEventId: quote.rawEventId,
				error: errorMessage,
			});
		}
	}

	return result;
}
