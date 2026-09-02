const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface AgencyInvitation {
	email: string;
	agencyName: string;
	inviterName: string;
	acceptUrl: string;
}

export interface InviteDelivery {
	delivered: boolean;
	url: string;
}

export async function sendAgencyInvitation(
	invite: AgencyInvitation,
): Promise<InviteDelivery> {
	const apiKey = process.env.TRAVEL_RESEND_API_KEY;
	const from = process.env.TRAVEL_INVITATION_FROM;

	if (!apiKey || !from) {
		return { delivered: false, url: invite.acceptUrl };
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
				to: invite.email,
				subject: `${invite.inviterName} te invitó a ${invite.agencyName}`,
				text: [
					`${invite.inviterName} te invitó a unirte a ${invite.agencyName}.`,
					"",
					"Acepta la invitación:",
					invite.acceptUrl,
					"",
				].join("\n"),
			}),
		});

		return { delivered: response.ok, url: invite.acceptUrl };
	} catch {
		return { delivered: false, url: invite.acceptUrl };
	}
}
