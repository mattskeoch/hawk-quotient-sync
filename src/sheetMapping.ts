type JsonObject = Record<string, unknown>;

export type SupabaseRawEvent = {
	id: number;
	event_type: string | null;
	payload: JsonObject;
};

export type SheetQuote = {
	rawEventId: number;
	eventKey: string;
	quoteNumber: string;
	dateQuoted: string;
	estimator: string;
	customer: string;
	flooringStream: "";
	description: string;
	stage: string;
	stageChange: string;
	value: number | "";
};

export type SheetMutation =
	| {
			kind: "append";
			range: string;
			values: SheetCell[][];
	  }
	| {
			kind: "update";
			ranges: Array<{ range: string; values: SheetCell[][] }>;
	  };

type SheetCell = string | number;

const SUPPORTED_EVENTS = new Set(["quote_sent", "quote_accepted", "quote_declined"]);

export function mapRawEventToSheetQuote(event: SupabaseRawEvent): SheetQuote | null {
	const eventName = firstString([event.payload.event_name, event.event_type]);
	if (!eventName || !SUPPORTED_EVENTS.has(eventName)) return null;

	const quoteNumber = firstString([event.payload.quote_number]);
	if (!quoteNumber) return null;

	const quoteFor = isObject(event.payload.quote_for) ? event.payload.quote_for : null;
	const customer = formatCustomerName(quoteFor) ?? firstString([event.payload.for]) ?? "";
	const value = firstNumber([event.payload.total_excludes_tax]) ?? "";

	return {
		rawEventId: event.id,
		eventKey: `supabase:${event.id}`,
		quoteNumber,
		dateQuoted: formatPerthDate(firstString([event.payload.first_sent])) ?? "",
		estimator: firstString([event.payload.from]) ?? "",
		customer,
		flooringStream: "",
		description: firstString([event.payload.title]) ?? "",
		stage: firstString([event.payload.quote_status]) ?? "",
		stageChange: stageChangeDate(eventName, event.payload),
		value,
	};
}

export function buildSheetMutation(tabName: string, quote: SheetQuote, rowNumber?: number): SheetMutation {
	if (!rowNumber) {
		return {
			kind: "append",
			range: `${quoteSheetName(tabName)}!A:L`,
			values: [[
				quote.quoteNumber,
				quote.dateQuoted,
				quote.estimator,
				quote.customer,
				quote.flooringStream,
				quote.description,
				quote.stage,
				quote.stageChange,
				"",
				quote.value,
				"",
				"",
			]],
		};
	}

	return {
		kind: "update",
		ranges: [
			{
				range: `${quoteSheetName(tabName)}!A${rowNumber}:H${rowNumber}`,
				values: [[
					quote.quoteNumber,
					quote.dateQuoted,
					quote.estimator,
					quote.customer,
					quote.flooringStream,
					quote.description,
					quote.stage,
					quote.stageChange,
				]],
			},
			{
				range: `${quoteSheetName(tabName)}!J${rowNumber}:J${rowNumber}`,
				values: [[quote.value]],
			},
		],
	};
}

function stageChangeDate(eventName: string, payload: JsonObject): string {
	if (eventName === "quote_accepted") {
		return formatNestedEventDate(payload, "accepted");
	}
	if (eventName === "quote_declined") {
		return formatNestedEventDate(payload, "declined");
	}
	return "";
}

function formatNestedEventDate(payload: JsonObject, key: string): string {
	const nested = isObject(payload[key]) ? payload[key] : null;
	return formatPerthDate(firstString([nested?.when])) ?? "";
}

function formatCustomerName(quoteFor: JsonObject | null): string | null {
	if (!quoteFor) return null;
	const name = [firstString([quoteFor.name_first]), firstString([quoteFor.name_last])]
		.filter(Boolean)
		.join(" ")
		.trim();
	if (name) return name;
	return firstString([quoteFor.company_name]);
}

function formatPerthDate(value: string | null): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;

	const parts = new Intl.DateTimeFormat("en-AU", {
		timeZone: "Australia/Perth",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).formatToParts(date);

	const day = parts.find((part) => part.type === "day")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const year = parts.find((part) => part.type === "year")?.value;
	return day && month && year ? `${day}/${month}/${year}` : null;
}

function quoteSheetName(tabName: string): string {
	return `'${tabName.replaceAll("'", "''")}'`;
}

function firstString(values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
		if (typeof value === "number" && Number.isFinite(value)) return String(value);
	}
	return null;
}

function firstNumber(values: unknown[]): number | null {
	for (const value of values) {
		const number = Number(value);
		if (Number.isFinite(number)) return number;
	}
	return null;
}

function isObject(value: unknown): value is JsonObject {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
