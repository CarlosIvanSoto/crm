import { Injectable } from "@nestjs/common";
import { agencyDb, type Db } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class AgentConversationService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(agencyId: string, quoteId: string) {
		const rows = await agencyDb(this.db, agencyId).agentConversation.findMany({
			where: { quoteId },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				quoteId: true,
				userId: true,
				sessionId: true,
				lastMessageAt: true,
				createdAt: true,
			},
		});

		return rows.map(present);
	}

	async latest(agencyId: string, quoteId: string) {
		const row = await agencyDb(this.db, agencyId).agentConversation.findFirst({
			where: { quoteId },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				quoteId: true,
				userId: true,
				sessionId: true,
				lastMessageAt: true,
				createdAt: true,
			},
		});

		return row ? present(row) : null;
	}
}

function present(row: {
	id: string;
	quoteId: string;
	userId: string | null;
	sessionId: string | null;
	lastMessageAt: Date | null;
	createdAt: Date;
}) {
	return {
		id: row.id,
		quoteId: row.quoteId,
		userId: row.userId,
		sessionId: row.sessionId,
		lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
	};
}
