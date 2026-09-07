import type { Prisma } from "../../src/generated/prisma/client";
import { integer, pick, type Rng } from "./random";

export const FIRST_NAMES = [
	"María",
	"Carlos",
	"Lucía",
	"Diego",
	"Sofía",
	"Javier",
	"Valentina",
	"Andrés",
	"Camila",
	"Ricardo",
	"Paula",
	"Fernando",
	"Isabel",
	"Tomás",
	"Renata",
];

export const LAST_NAMES = [
	"García",
	"Hernández",
	"López",
	"Martínez",
	"Torres",
	"Ruiz",
	"Flores",
	"Vargas",
	"Castro",
	"Romero",
	"Navarro",
	"Molina",
];

export const COMPANY_NAMES = [
	"Cumbre Minera",
	"Delta Logística",
	"Grupo Solaris",
	"Textiles del Norte",
	"Bioandes",
	"Puerto Verde",
	"Aurora Capital",
	"Ferrocarriles del Sur",
];

export const DESTINATIONS = [
	"Cancún",
	"Madrid",
	"Tokio",
	"Buenos Aires",
	"Roma",
	"Cusco",
	"París",
	"Lisboa",
	"Estambul",
	"Ciudad de México",
	"Cartagena",
	"Nueva York",
];

export const AIRPORTS = [
	"MEX",
	"CUN",
	"MAD",
	"NRT",
	"EZE",
	"FCO",
	"CUZ",
	"CDG",
	"LIS",
	"IST",
	"JFK",
	"BOG",
];

export const AIRLINES = [
	"Aeroméxico",
	"Iberia",
	"LATAM",
	"Air France",
	"ANA",
	"Avianca",
	"TAP",
];

export const HOTELS = [
	"Gran Hotel Central",
	"Riviera Palace",
	"Bosque Andino Lodge",
	"Marina Bay Suites",
	"Casa Colonial",
	"Sky Garden Resort",
];

export const CRUISE_SHIPS = ["MSC Seaside", "Costa Firenze", "Norwegian Bliss"];

export const SUPPLIER_NAMES = [
	"Mundo Mayorista",
	"Andes DMC",
	"Hoteles Directos",
	"Vuelos Premium",
	"Cruceros del Pacífico",
	"Cobertura Total Seguros",
	"Traslados Ejecutivos",
	"Operadora Sol",
	"Autos Libres",
	"Servicios Varios",
	"Conexión Global",
	"Ruta Directa",
];

export const NOTE_BODIES = [
	"El cliente pide salida por la mañana y asientos juntos.",
	"Confirmado el presupuesto por teléfono. Envía la cotización hoy.",
	"Prefiere hotel con desayuno incluido y cerca del centro.",
	"Viaja con un menor. Necesita cuna en la habitación.",
	"Pago por transferencia. Enviará el comprobante mañana.",
	"Aniversario de bodas. Sugiere una cena especial.",
];

export const CALL_SUBJECTS = [
	"Llamada de seguimiento",
	"Revisión de opciones",
	"Confirmación de fechas",
	"Aclaración de política de equipaje",
];

export const EMAIL_SUBJECTS = [
	"Cotización enviada",
	"Recordatorio de anticipo",
	"Itinerario actualizado",
	"Documentos de viaje",
];

export const MEETING_SUBJECTS = [
	"Cita en oficina",
	"Videollamada de planeación",
	"Firma de contrato",
];

export const TASK_SUBJECTS = [
	"Cobrar el anticipo",
	"Enviar el paquete de bienvenida",
	"Confirmar la reserva con el mayorista",
	"Solicitar los pasaportes",
	"Revisar la póliza de seguro",
	"Reconfirmar los vuelos 72 horas antes",
];

export const LOYALTY_PROGRAMS = [
	"Club Premier",
	"Iberia Plus",
	"LATAM Pass",
	"Flying Blue",
	"Marriott Bonvoy",
	"Hilton Honors",
];

export function personName(rng: Rng): string {
	return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
}

export type ItineraryType =
	| "FLIGHT"
	| "HOTEL"
	| "TRANSFER"
	| "TOUR"
	| "CRUISE"
	| "INSURANCE"
	| "CAR_RENTAL"
	| "PACKAGE"
	| "OTHER";

export const ITINERARY_TYPES: ItineraryType[] = [
	"FLIGHT",
	"HOTEL",
	"TRANSFER",
	"TOUR",
	"CRUISE",
	"INSURANCE",
	"CAR_RENTAL",
	"PACKAGE",
	"OTHER",
];

export function itineraryDetails(
	rng: Rng,
	type: ItineraryType,
): Prisma.InputJsonValue {
	switch (type) {
		case "FLIGHT": {
			const from = pick(rng, AIRPORTS);
			let to = pick(rng, AIRPORTS);
			if (to === from)
				to = AIRPORTS[(AIRPORTS.indexOf(from) + 1) % AIRPORTS.length] as string;
			return {
				type,
				airline: pick(rng, AIRLINES),
				flightNumber: `${pick(rng, ["AM", "IB", "LA", "AF"])}${integer(rng, 100, 989)}`,
				cabin: pick(rng, ["ECONOMY", "PREMIUM", "BUSINESS", "FIRST"]),
				departureAirport: from,
				arrivalAirport: to,
				baggage: rng() < 0.5 ? "1 pieza de 23 kg" : null,
			};
		}
		case "HOTEL":
			return {
				type,
				hotelName: pick(rng, HOTELS),
				roomType: pick(rng, ["Estándar", "Superior", "Suite júnior"]),
				mealPlan: pick(rng, [
					"ROOM_ONLY",
					"BREAKFAST",
					"HALF",
					"FULL",
					"ALL_INCLUSIVE",
				]),
				nights: integer(rng, 2, 9),
			};
		case "TRANSFER":
			return {
				type,
				mode: pick(rng, ["PRIVATE", "SHARED", "SHUTTLE"]),
				vehicle: rng() < 0.6 ? pick(rng, ["Van", "Sedán", "SUV"]) : null,
				pickup: "Aeropuerto",
				dropoff: "Hotel",
			};
		case "TOUR":
			return {
				type,
				tourName: pick(rng, [
					"City tour histórico",
					"Ruta gastronómica",
					"Excursión de día completo",
				]),
				durationHours: rng() < 0.7 ? integer(rng, 2, 8) : null,
				guideLanguage:
					rng() < 0.7 ? pick(rng, ["Español", "Inglés", "Bilingüe"]) : null,
				isPrivate: rng() < 0.5,
			};
		case "CRUISE":
			return {
				type,
				shipName: pick(rng, CRUISE_SHIPS),
				cabinCategory: pick(rng, [
					"INTERIOR",
					"OCEAN_VIEW",
					"BALCONY",
					"SUITE",
				]),
				nights: integer(rng, 3, 12),
			};
		case "INSURANCE":
			return {
				type,
				planName: pick(rng, [
					"Cobertura Básica",
					"Cobertura Plus",
					"Cobertura Total",
				]),
				coverage: "Gastos médicos hasta 50,000 USD y cancelación",
				policyNumber: rng() < 0.7 ? `POL-${integer(rng, 10000, 99999)}` : null,
			};
		case "CAR_RENTAL":
			return {
				type,
				company: pick(rng, ["Autos Libres", "Hertz", "Europcar"]),
				carClass: pick(rng, ["Económico", "Intermedio", "SUV"]),
				pickupLocation: "Aeropuerto",
				dropoffLocation: "Aeropuerto",
				transmission: pick(rng, ["AUTOMATIC", "MANUAL"]),
			};
		case "PACKAGE":
			return {
				type,
				packageName: pick(rng, [
					"Escapada romántica",
					"Aventura familiar",
					"Semana cultural",
				]),
				inclusions: "Vuelos, hotel 4 estrellas, traslados y dos excursiones",
			};
		default:
			return {
				type: "OTHER",
				label: pick(rng, [
					"Propina guía",
					"Cargo por servicio",
					"Upgrade de asiento",
				]),
				notes: rng() < 0.5 ? "Cargo adicional confirmado con el cliente" : null,
			};
	}
}
