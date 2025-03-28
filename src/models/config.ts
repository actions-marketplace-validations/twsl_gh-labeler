interface Config {
	"github-token": string;
	process?: Array<"issues" | "pr" | "discussions">;
	"config-path": string;
}
export default Config;
