import type Assignees from "@/models/internal/config/assignees";
import type Comments from "@/models/internal/config/comments";
import type Labels from "@/models/internal/config/labels";
import type Milestones from "@/models/internal/config/milestones";
import type Projects from "@/models/internal/config/projects";
import type Reviewers from "@/models/internal/config/reviewers";
import type Trigger from "@/models/internal/config/trigger";

interface Issues extends Trigger, Comments {
	assignees?: Assignees;
	reviewers?: Reviewers;
	close?: boolean;
	close_reason?: "not-planned" | "duplicate";
	reopen?: boolean;
	lock?: boolean;
	unlock?: boolean;
	lock_reason?: "resolved" | "off-topic" | "too heated" | "spam";
	convert_to_discussion?: boolean;
	pin?: boolean;
	unpin?: boolean;
	milestones?: Milestones;
	projects?: Projects;
	labels?: Labels;
}

export default Issues;
