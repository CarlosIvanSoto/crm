export const SEARCH_PARAM = {
	list: {
		q: "q",
		sort: "sort",
		dir: "dir",
		page: "page",
		fields: "fields",
		archived: "archived",
	},
	record: {
		stack: "record",
		tab: "tab",
		add: "add",
	},
	fieldsSheet: {
		entity: "manageFields",
		field: "manageField",
	},
	dialog: {
		create: "new",
	},
	overview: {
		scope: "scope",
	},
} as const;

export const RESERVED_SEARCH_PARAM_KEYS: ReadonlySet<string> = new Set(
	Object.values(SEARCH_PARAM).flatMap((group) => Object.values(group)),
);
