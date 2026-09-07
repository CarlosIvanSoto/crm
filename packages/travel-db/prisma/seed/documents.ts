import { randomUUID } from "node:crypto";
import { db } from "../../src/client";
import type { AgencyBag } from "./context";
import { integer, pick, type Rng } from "./random";

const CONTENT_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
];

interface DocSpec {
	kind:
		| "VOUCHER"
		| "TICKET"
		| "INVOICE"
		| "PASSPORT"
		| "VISA"
		| "INSURANCE_POLICY"
		| "OTHER";
	anchor: "booking" | "traveler";
	filename: string;
}

const DOC_SPECS: DocSpec[] = [
	{ kind: "VOUCHER", anchor: "booking", filename: "voucher-hotel.pdf" },
	{ kind: "VOUCHER", anchor: "booking", filename: "voucher-traslado.pdf" },
	{ kind: "TICKET", anchor: "booking", filename: "boleto-aereo.pdf" },
	{ kind: "TICKET", anchor: "booking", filename: "boleto-regreso.pdf" },
	{ kind: "INVOICE", anchor: "booking", filename: "factura-agencia.pdf" },
	{
		kind: "INSURANCE_POLICY",
		anchor: "booking",
		filename: "poliza-seguro.pdf",
	},
	{ kind: "OTHER", anchor: "booking", filename: "itinerario-firmado.pdf" },
	{ kind: "PASSPORT", anchor: "traveler", filename: "pasaporte.jpg" },
	{ kind: "PASSPORT", anchor: "traveler", filename: "pasaporte-menor.jpg" },
	{ kind: "VISA", anchor: "traveler", filename: "visa-schengen.png" },
	{ kind: "OTHER", anchor: "traveler", filename: "carta-consentimiento.pdf" },
];

export async function seedDocuments(bag: AgencyBag, rng: Rng): Promise<void> {
	const bookings = bag.bookings.filter((entry) => entry.status !== "CANCELLED");
	const userIds = bag.users.map((user) => user.id);
	if (bookings.length === 0 || bag.travelers.length === 0) return;

	let bookingCursor = 0;
	let travelerCursor = 0;

	for (let pass = 0; pass < 2; pass += 1) {
		for (const spec of DOC_SPECS) {
			const anchorId =
				spec.anchor === "booking"
					? (bookings[bookingCursor++ % bookings.length]?.id as string)
					: (bag.travelers[travelerCursor++ % bag.travelers.length]
							?.id as string);
			const filename = pass === 0 ? spec.filename : `v2-${spec.filename}`;
			const pathname = `agencies/${bag.agencyId}/${anchorId}/${randomUUID()}-${filename}`;
			await db.document.create({
				data: {
					agencyId: bag.agencyId,
					kind: spec.kind,
					pathname,
					url: `https://seed.blob.vercel-storage.example/${pathname}`,
					filename,
					contentType: filename.endsWith(".pdf")
						? "application/pdf"
						: pick(rng, CONTENT_TYPES),
					sizeBytes: integer(rng, 40_000, 4_000_000),
					uploadedById: pick(rng, userIds),
					bookingId: spec.anchor === "booking" ? anchorId : null,
					travelerId: spec.anchor === "traveler" ? anchorId : null,
				},
			});
		}
	}
}
