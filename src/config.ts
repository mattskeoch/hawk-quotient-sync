export type AppEnv = {
	DB: D1Database;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	GOOGLE_CLIENT_EMAIL: string;
	GOOGLE_PRIVATE_KEY: string;
	GOOGLE_SHEET_ID: string;
	GOOGLE_SHEET_TAB_NAME: string;
	SYNC_SHARED_SECRET?: string;
	SUPABASE_EVENT_LIMIT?: string;
	SUPABASE_MIN_RAW_EVENT_ID?: string;
};

export function requireConfig(env: AppEnv): Required<Omit<AppEnv, "SYNC_SHARED_SECRET" | "SUPABASE_EVENT_LIMIT">> & {
	SYNC_SHARED_SECRET?: string;
	SUPABASE_EVENT_LIMIT?: string;
	SUPABASE_MIN_RAW_EVENT_ID?: string;
} {
	const missing: string[] = [];
	for (const key of [
		"SUPABASE_URL",
		"SUPABASE_SERVICE_ROLE_KEY",
		"GOOGLE_CLIENT_EMAIL",
		"GOOGLE_PRIVATE_KEY",
		"GOOGLE_SHEET_ID",
		"GOOGLE_SHEET_TAB_NAME",
	] as const) {
		if (!env[key]) missing.push(key);
	}
	if (missing.length) {
		throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
	}
	return env as ReturnType<typeof requireConfig>;
}

export function eventLimit(env: AppEnv): number {
	const parsed = Number(env.SUPABASE_EVENT_LIMIT ?? 100);
	if (!Number.isInteger(parsed) || parsed < 1) return 100;
	return Math.min(parsed, 1000);
}

export function minRawEventId(env: AppEnv): number | null {
	const raw = env.SUPABASE_MIN_RAW_EVENT_ID;
	if (!raw) return null;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 1) return null;
	return parsed;
}
