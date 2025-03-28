import type Trigger from "@/models/config/trigger";
import type Assignees from "@/models/config/assignees";
import type Comments from "@/models/config/comments";
import type Milestones from "@/models/config/milestones";
import type Projects from "@/models/config/projects";

interface Issues extends Trigger, Comments {
	assignees?: Assignees;
	close?: boolean;
	close_reason?: "not-planned" | "duplicate";
	lock?: boolean;
	convert_to_discussion?: boolean;
	pin?: boolean;
	milestones?: Milestones;
	projects?: Projects;
}

export default Issues;
