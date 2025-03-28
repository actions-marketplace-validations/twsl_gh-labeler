import type Trigger from "@/models/config/trigger";
import type Comments from "@/models/config/comments";

interface Discussions extends Trigger, Comments {
	category?: string;
	close?: boolean;
	close_reason?: "outdated" | "duplicate" | "resolved";
	create_issue?: boolean;
}

export default Discussions;
