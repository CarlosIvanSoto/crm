export const SEED_PRNG_SEED = 20260905;

export const SEED_PASSWORD = "password123";

export const RATE_PROVIDER = "seed";

export const GAP_CURRENCY = "JPY";

export interface SeedUserSpec {
	key: string;
	name: string;
	email: string;
	role: "owner" | "admin" | "agent" | "accountant";
}

export interface SeedAgencySpec {
	slug: string;
	name: string;
	baseCurrency: string;
	quotePrefix: string;
	bookingPrefix: string;
	legalName: string;
	taxId: string;
	phone: string;
	email: string;
	logoUrl: string;
	defaultTerms: string;
	timezone: string;
	pendingInvite: string;
	users: SeedUserSpec[];
}

export const AGENCIES: SeedAgencySpec[] = [
	{
		slug: "andes-travel",
		name: "Andes Travel",
		baseCurrency: "USD",
		quotePrefix: "COT",
		bookingPrefix: "EXP",
		legalName: "Andes Travel S.A. de C.V.",
		taxId: "ATR260901AB1",
		phone: "+52 55 1234 5678",
		email: "hola@andestravel.example",
		logoUrl: "https://dummyimage.com/240x80/006b4f/ffffff&text=Andes+Travel",
		defaultTerms:
			"Prices hold for 7 days. A 30% deposit confirms the file. The balance is due 45 days before departure.",
		timezone: "America/Mexico_City",
		pendingInvite: "pending@andestravel.example",
		users: [
			{
				key: "owner",
				name: "Agency Owner",
				email: "owner@andes.example",
				role: "owner",
			},
			{
				key: "admin",
				name: "Diego Admin",
				email: "admin@andes.example",
				role: "admin",
			},
			{
				key: "acct",
				name: "Carla Contreras",
				email: "carla@andes.example",
				role: "accountant",
			},
			{
				key: "agent1",
				name: "Ana Rivas",
				email: "ana@andes.example",
				role: "agent",
			},
			{
				key: "agent2",
				name: "Bruno Salas",
				email: "bruno@andes.example",
				role: "agent",
			},
		],
	},
	{
		slug: "maya-tours",
		name: "Maya Tours",
		baseCurrency: "EUR",
		quotePrefix: "CTZ",
		bookingPrefix: "RES",
		legalName: "Maya Tours Operadora S.A.",
		taxId: "MTO260901CD2",
		phone: "+34 91 987 6543",
		email: "hola@mayatours.example",
		logoUrl: "https://dummyimage.com/240x80/006b4f/ffffff&text=Maya+Tours",
		defaultTerms:
			"Los precios son válidos por 7 días. El expediente se confirma con un anticipo del 30%.",
		timezone: "Europe/Madrid",
		pendingInvite: "pending@mayatours.example",
		users: [
			{
				key: "owner",
				name: "Agency Owner",
				email: "owner@maya.example",
				role: "owner",
			},
			{
				key: "admin",
				name: "Paola Núñez",
				email: "admin@maya.example",
				role: "admin",
			},
			{
				key: "acct",
				name: "Pilar Ortega",
				email: "pilar@maya.example",
				role: "accountant",
			},
			{
				key: "agent1",
				name: "Mateo Cruz",
				email: "mateo@maya.example",
				role: "agent",
			},
			{
				key: "agent2",
				name: "Lucía Fernández",
				email: "lucia@maya.example",
				role: "agent",
			},
		],
	},
];

export const SEED_ORG_SLUGS = AGENCIES.map((agency) => agency.slug);

export const SEED_USER_EMAILS = AGENCIES.flatMap((agency) => [
	...agency.users.map((user) => user.email),
	agency.pendingInvite,
]);
