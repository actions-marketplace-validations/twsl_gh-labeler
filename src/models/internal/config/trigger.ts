import type Labels from "@/models/internal/config/labels";
import type Action from "@/models/internal/config/actions";

interface Trigger {
  regex?: Record<string, Action>;
  labels?: Labels;
}

export default Trigger;
