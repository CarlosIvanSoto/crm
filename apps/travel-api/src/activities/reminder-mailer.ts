const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface ReminderEmailInput {
	to: string;
	subject: string;
	body: string;
}

export interface ReminderDelivery {
	configured: boolean;
	delivered: boolean;
}

export async function sendReminderEmail(
	input: ReminderEmailInput,
): Promise<ReminderDelivery> {
	const apiKey = process.env.TRAVEL_RESEND_API_KEY;
	const from = process.env.TRAVEL_REMINDER_FROM;

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
				subject: input.subject,
				text: input.body,
			}),
		});

		return { configured: true, delivered: response.ok };
	} catch {
		return { configured: true, delivered: false };
	}
}
