import type Labels from "@/models/config/labels";
import type Action from "@/models/config/actions";

interface Trigger {
	regex?: Record<string, Action>;
	labels?: Labels;
}

export default Trigger;
