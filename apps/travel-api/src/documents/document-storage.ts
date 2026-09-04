import { Logger } from "@nestjs/common";
import { DOCUMENTS } from "./documents-config";

const logger = new Logger("DocumentStorage");

function token(): string | undefined {
	return process.env.TRAVEL_BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

export function storageEnabled(): boolean {
	return Boolean(token());
}

export interface UploadTokenRequest {
	pathname: string;
	contentType: string;
}

export async function createUploadToken(
	request: UploadTokenRequest,
): Promise<string> {
	const { generateClientTokenFromReadWriteToken } = await import(
		"@vercel/blob/client"
	);

	return generateClientTokenFromReadWriteToken({
		token: token(),
		pathname: request.pathname,
		allowedContentTypes: [request.contentType],
		maximumSizeInBytes: DOCUMENTS.upload.maxBytes,
		validUntil: Date.now() + DOCUMENTS.upload.tokenTtlMs,
		addRandomSuffix: false,
	});
}

export interface SignedDownload {
	url: string;
	expiresAt: string;
}

export async function signedDownloadUrl(
	pathname: string,
): Promise<SignedDownload> {
	const { issueSignedToken, presignUrl } = await import("@vercel/blob");

	const validUntil = Date.now() + DOCUMENTS.download.urlTtlMs;
	const issued = await issueSignedToken({
		token: token(),
		pathname,
		operations: ["get"],
		validUntil,
	});

	const { presignedUrl } = await presignUrl(issued, {
		operation: "get",
		pathname,
		access: "private",
	});

	return { url: presignedUrl, expiresAt: new Date(validUntil).toISOString() };
}

export async function removeObject(pathname: string): Promise<void> {
	try {
		const { del } = await import("@vercel/blob");
		await del(pathname, { token: token() });
	} catch (error) {
		logger.error(
			{ message: "Could not delete a document from storage", pathname },
			error instanceof Error ? error.stack : String(error),
		);
	}
}
