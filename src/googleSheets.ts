import { getGoogleAccessToken } from "./googleAuth";
import type { SheetMutation } from "./sheetMapping";

type SheetsValueResponse = {
	values?: string[][];
};

export class GoogleSheetsClient {
	private quoteRowIndex: Map<string, number> | null = null;

	constructor(
		private readonly sheetId: string,
		private readonly tabName: string,
		private readonly clientEmail: string,
		private readonly privateKey: string,
	) {}

	async findRowByQuoteNumber(quoteNumber: string): Promise<number | null> {
		if (!this.quoteRowIndex) {
			this.quoteRowIndex = await this.loadQuoteRowIndex();
		}
		return this.quoteRowIndex.get(quoteNumber) ?? null;
	}

	private async loadQuoteRowIndex(): Promise<Map<string, number>> {
		const data = await this.request<SheetsValueResponse>(
			`/values/${encodeURIComponent(this.range("A:A"))}?majorDimension=ROWS`,
			{ method: "GET" },
		);
		const rowIndex = new Map<string, number>();
		const rows = data.values ?? [];
		for (const [rowOffset, row] of rows.entries()) {
			const quoteNumber = String(row[0] ?? "").trim();
			if (quoteNumber) {
				rowIndex.set(quoteNumber, rowOffset + 1);
			}
		}
		return rowIndex;
	}

	async applyMutation(mutation: SheetMutation): Promise<void> {
		if (mutation.kind === "append") {
			await this.request(
				`/values/${encodeURIComponent(mutation.range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
				{
					method: "POST",
					body: JSON.stringify({ values: mutation.values }),
				},
			);
			return;
		}

		await this.request("/values:batchUpdate", {
			method: "POST",
			body: JSON.stringify({
				valueInputOption: "USER_ENTERED",
				data: mutation.ranges,
			}),
		});
	}

	private range(a1: string): string {
		return `'${this.tabName.replaceAll("'", "''")}'!${a1}`;
	}

	private async request<T = unknown>(path: string, init: RequestInit): Promise<T> {
		const token = await getGoogleAccessToken(this.clientEmail, this.privateKey);
		const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}${path}`, {
			...init,
			headers: {
				authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				...(init.headers ?? {}),
			},
		});
		if (!response.ok) {
			throw new Error(`Google Sheets request failed: ${response.status} ${await response.text()}`);
		}
		return (await response.json()) as T;
	}
}
