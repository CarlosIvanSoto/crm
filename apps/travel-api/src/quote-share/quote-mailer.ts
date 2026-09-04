const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface QuoteLinkInput {
	to: string;
	customerName: string;
	url: string;
	message: string | null;
}

export interface QuoteLinkDelivery {
	configured: boolean;
	delivered: boolean;
}

export async function sendQuoteLink(
	input: QuoteLinkInput,
): Promise<QuoteLinkDelivery> {
	const apiKey = process.env.TRAVEL_RESEND_API_KEY;
	const from = process.env.TRAVEL_QUOTE_FROM;

	if (!apiKey || !from) {
		return { configured: false, delivered: false };
	}

	try {
		const response = await fetch(RESEND_ENDPOINT, {
			method: "POST",
			headers: {
				authorization: `Bearer ${apiKey}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				from,
				to: input.to,
				subject: "Your travel quote",
				text: [
					`Hello ${input.customerName},`,
					"",
					input.message ?? "Here is your travel quote.",
					"",
					input.url,
					"",
				].join("\n"),
			}),
		});

		return { configured: true, delivered: response.ok };
	} catch {
		return { configured: true, delivered: false };
	}
}
