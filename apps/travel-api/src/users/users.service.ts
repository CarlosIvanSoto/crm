import { Injectable } from "@nestjs/common";
import { toAgencyRole } from "@travel/auth";
import { type Db } from "@travel/db";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class UsersService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(agencyId: string) {
		const members = await this.db.member.findMany({
			where: { organizationId: agencyId },
			select: {
				role: true,
				user: { select: { id: true, name: true, email: true, image: true } },
			},
			orderBy: [{ user: { name: "asc" } }, { user: { email: "asc" } }],
		});

		return members.map((member) => ({
			id: member.user.id,
			name: member.user.name,
			email: member.user.email,
			image: member.user.image,
			role: toAgencyRole(member.role),
		}));
	}
}
