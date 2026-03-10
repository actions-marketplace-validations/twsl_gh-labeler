import type Trigger from "@/models/internal/config/trigger";
import type Assignees from "@/models/internal/config/assignees";
import type Comments from "@/models/internal/config/comments";
import type Milestones from "@/models/internal/config/milestones";
import type Projects from "@/models/internal/config/projects";

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
