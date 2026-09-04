import Chat from "@carbon/icons-react/es/Chat";
import Email from "@carbon/icons-react/es/Email";
import Events from "@carbon/icons-react/es/Events";
import Notebook from "@carbon/icons-react/es/Notebook";
import Phone from "@carbon/icons-react/es/Phone";
import Task from "@carbon/icons-react/es/Task";
import type { CarbonIcon } from "@crm/ui/components/icon";
import type { ActivityType } from "@travel/db/enums";

type ActivityPresentation = Record<
	ActivityType,
	{ icon: CarbonIcon; label: string }
>;

const PRESENTATION: ActivityPresentation = {
	NOTE: { icon: Chat, label: "Note" },
	CALL: { icon: Phone, label: "Call" },
	EMAIL: { icon: Email, label: "Email" },
	MEETING: { icon: Events, label: "Meeting" },
	TASK: { icon: Task, label: "Task" },
	SYSTEM: { icon: Notebook, label: "System" },
};

export function activityLabel(type: ActivityType): string {
	return PRESENTATION[type].label;
}

export function activityIcon(type: ActivityType): CarbonIcon {
	return PRESENTATION[type].icon;
}
