import type Trigger from "@/models/internal/config/trigger";
import type Reviewers from "@/models/internal/config/reviewers";
import type Assignees from "@/models/internal/config/assignees";
import type Comments from "@/models/internal/config/comments";

interface PRs extends Trigger, Comments {
	reviewers?: Reviewers;
	assignees?: Assignees;
	close?: boolean;
	lock?: boolean;
}

export default PRs;
