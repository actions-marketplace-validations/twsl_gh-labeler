import type { ThreadType } from "@/types/common";

interface GHActionConfig {
	"github-token": string;
	process?: Array<ThreadType>;
	"config-path": string;
}
export default GHActionConfig;
