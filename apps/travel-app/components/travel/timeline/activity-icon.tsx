import { Icon } from "@crm/ui/components/icon";
import type { ActivityType } from "@travel/db/enums";
import { activityIcon } from "@/components/travel/activity-presentation";

export function ActivityIcon({ type }: { type: ActivityType }) {
	return <Icon icon={activityIcon(type)} />;
}
