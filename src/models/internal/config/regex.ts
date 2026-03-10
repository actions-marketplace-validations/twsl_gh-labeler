import type Actions from "@/models/internal/config/actions";

interface Regex {
  regex?: Record<string, Actions>;
  caseSensitive?: boolean;
  scanTitle?: boolean;
  scanBody?: boolean;
}

export default Regex;
