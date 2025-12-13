import type Actions from "@/models/config/actions";

interface Regex {
	regex?: Record<string, Actions>;
	caseSensitive?: boolean;
}

export default Regex;
