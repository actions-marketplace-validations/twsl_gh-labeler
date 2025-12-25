import type Labels from "@/models/internal/config/labels";
import type Comments from "@/models/internal/config/comments";
import type PRs from "@/models/internal/config/prs";
import type Issues from "@/models/internal/config/issues";
import type Discussions from "@/models/internal/config/discussions";

interface Actions extends Comments {
	labels?: Labels;
	issues?: Issues;
	prs?: PRs;
	discussions?: Discussions;
}

export default Actions;
