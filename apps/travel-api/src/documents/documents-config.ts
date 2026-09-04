const MINUTE_MS = 60_000;

export const DOCUMENTS = {
	upload: {
		maxBytes: 20 * 1024 * 1024,
		tokenTtlMs: 10 * MINUTE_MS,
		allowedContentTypes: [
			"application/pdf",
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/heic",
		],
	},
	download: { urlTtlMs: 5 * MINUTE_MS },
	list: { maxRows: 200 },
} as const;
