const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

type TokenResponse = {
	access_token: string;
	expires_in: number;
	token_type: string;
};

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	if (cachedToken && cachedToken.expiresAt - 60 > now) {
		return cachedToken.accessToken;
	}

	const assertion = await createJwtAssertion(clientEmail, privateKey, now);
	const body = new URLSearchParams({
		grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
		assertion,
	});

	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});

	if (!response.ok) {
		throw new Error(`Google token request failed: ${response.status} ${await response.text()}`);
	}

	const token = (await response.json()) as TokenResponse;
	cachedToken = {
		accessToken: token.access_token,
		expiresAt: now + token.expires_in,
	};
	return cachedToken.accessToken;
}

async function createJwtAssertion(clientEmail: string, privateKey: string, now: number): Promise<string> {
	const header = { alg: "RS256", typ: "JWT" };
	const claimSet = {
		iss: clientEmail,
		scope: SCOPE,
		aud: TOKEN_URL,
		exp: now + 3600,
		iat: now,
	};

	const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claimSet)}`;
	const key = await crypto.subtle.importKey(
		"pkcs8",
		pemToArrayBuffer(privateKey),
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
	return `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;
}

function base64UrlJson(value: unknown): string {
	return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function pemToArrayBuffer(privateKey: string): ArrayBuffer {
	const normalized = privateKey.replaceAll("\\n", "\n");
	const base64 = normalized
		.replace("-----BEGIN PRIVATE KEY-----", "")
		.replace("-----END PRIVATE KEY-----", "")
		.replace(/\s/g, "");
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}
