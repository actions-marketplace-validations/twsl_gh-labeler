import type Assignees from "@/models/internal/config/assignees";
import type Comments from "@/models/internal/config/comments";
import type Labels from "@/models/internal/config/labels";
import type Reviewers from "@/models/internal/config/reviewers";
import type Trigger from "@/models/internal/config/trigger";

interface PRs extends Trigger, Comments {
	reviewers?: Reviewers;
	assignees?: Assignees;
	close?: boolean;
	reopen?: boolean;
	lock?: boolean;
	unlock?: boolean;
	lock_reason?: "resolved" | "off-topic" | "too heated" | "spam";
	draft?: boolean;
	request_changes?: boolean;
	approve?: boolean;
	labels?: Labels;
}

export default PRs;
