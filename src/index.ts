import { requireConfig, eventLimit, type AppEnv } from "./config";
import { D1SyncStore } from "./d1Store";
import { GoogleSheetsClient } from "./googleSheets";
import { SupabaseQuotientClient } from "./supabaseClient";
import { runSync, type SyncResult } from "./sync";

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return json({ ok: true });
		}

		if (request.method === "POST" && url.pathname === "/sync") {
			const auth = authorizeManualSync(request, env);
			if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

			try {
				const result = await syncSupabaseToSheet(env);
				return json({ ok: result.errors === 0, ...result }, { status: result.errors === 0 ? 200 : 207 });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return json({ ok: false, error: message }, { status: 500 });
			}
		}

		return json({ error: "Not found" }, { status: 404 });
	},

	async scheduled(_event, env, ctx) {
		ctx.waitUntil(syncSupabaseToSheet(env));
	},
} satisfies ExportedHandler<AppEnv>;

async function syncSupabaseToSheet(env: AppEnv): Promise<SyncResult> {
	const startedAt = new Date().toISOString();
	const config = requireConfig(env);
	const store = new D1SyncStore(config.DB);

	try {
		const supabase = new SupabaseQuotientClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
		const sheets = new GoogleSheetsClient(
			config.GOOGLE_SHEET_ID,
			config.GOOGLE_SHEET_TAB_NAME,
			config.GOOGLE_CLIENT_EMAIL,
			config.GOOGLE_PRIVATE_KEY,
		);
		const events = await supabase.listProcessedQuoteEvents(eventLimit(config));

		const result = await runSync({
			tabName: config.GOOGLE_SHEET_TAB_NAME,
			events,
			isProcessed: (eventKey) => store.isProcessed(eventKey),
			findRowByQuoteNumber: (quoteNumber) => sheets.findRowByQuoteNumber(quoteNumber),
			applyMutation: (mutation) => sheets.applyMutation(mutation),
			recordProcessed: (eventKey, rawEventId) => store.recordProcessed(eventKey, rawEventId),
			log: (event) => store.log(event),
		});

		await store.recordRun(result.errors === 0 ? "success" : "error", result, startedAt);
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const result = { fetched: 0, skipped: 0, applied: 0, ignored: 0, errors: 1 };
		await store.recordRun("error", result, startedAt, message);
		throw error;
	}
}

function authorizeManualSync(request: Request, env: AppEnv): { ok: true } | { ok: false; status: number; error: string } {
	if (!env.SYNC_SHARED_SECRET) return { ok: true };

	const authorization = request.headers.get("authorization");
	const token = authorization?.toLowerCase().startsWith("bearer ")
		? authorization.slice("bearer ".length).trim()
		: new URL(request.url).searchParams.get("token");

	if (token === env.SYNC_SHARED_SECRET) return { ok: true };
	return { ok: false, status: 401, error: "Invalid sync token." };
}

function json(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
	});
}
