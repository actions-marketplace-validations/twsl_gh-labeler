import type Labels from "@/models/config/labels";
import type Comments from "@/models/config/comments";
import type PRs from "@/models/config/prs";
import type Issues from "@/models/config/issues";
import type Discussions from "@/models/config/discussions";

interface Actions extends Comments {
	labels?: Labels;
	issues?: Issues;
	prs?: PRs;
	discussions?: Discussions;
}

export default Actions;
