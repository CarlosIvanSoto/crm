import { BadRequestException } from "@nestjs/common";
import type { Db } from "@travel/db";
import { z } from "zod";

export const MAX_BULK_IDS = 100;

export const bulkIdsInput = z.object({
	ids: z
		.array(z.string())
		.min(1, "Nothing was selected.")
		.max(MAX_BULK_IDS, "Too many records at once — select a page at a time."),
});

export type BulkResult = {
	requested: number;
	succeeded: number;
	skipped: number;
	failed: number;
	message: string | null;
};

export async function requireAgencyMember(
	db: Db,
	agencyId: string,
	userId: string | null,
): Promise<void> {
	if (!userId) return;

	const member = await db.member.findUnique({
		where: { organizationId_userId: { organizationId: agencyId, userId } },
		select: { userId: true },
	});

	if (!member) {
		throw new BadRequestException("That owner is not a member of this agency.");
	}
}

export async function runBulk(
	ids: string[],
	act: (id: string) => Promise<unknown>,
): Promise<BulkResult> {
	const unique = [...new Set(ids)];
	let succeeded = 0;
	let skipped = 0;
	let message: string | null = null;

	for (const id of unique) {
		try {
			const outcome = await act(id);
			if (outcome === null) {
				skipped += 1;
			} else {
				succeeded += 1;
			}
		} catch (error) {
			message ??=
				error instanceof Error ? error.message : "Something went wrong.";
		}
	}

	return {
		requested: unique.length,
		succeeded,
		skipped,
		failed: unique.length - succeeded - skipped,
		message,
	};
}
