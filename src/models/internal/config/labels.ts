import type Actions from "@/models/internal/config/actions";

interface Labels {
  add?: Record<string, Actions> | string[];
  remove?: Record<string, Actions> | string[];
  // default actions per label, if a label is only defined as string during adding or removing
  // it will be used as default action
  default?: Record<string, Actions>;
}

export default Labels;
