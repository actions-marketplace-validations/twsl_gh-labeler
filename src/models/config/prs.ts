import type Trigger from "@/models/config/trigger";
import type Reviewers from "@/models/config/reviewers";
import type Assignees from "@/models/config/assignees";
import type Comments from "@/models/config/comments";

interface PRs extends Trigger, Comments {
	reviewers?: Reviewers;
	assignees?: Assignees;
	close?: boolean;
	lock?: boolean;
}

export default PRs;
