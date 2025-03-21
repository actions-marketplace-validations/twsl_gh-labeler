interface ThreadData {
	number: number;
	user: { login: string };
	labels: { name: string }[];
	locked: boolean;
	active_lock_reason?: string | null;
	state: "open" | "closed";
	merged?: boolean;
}
export default ThreadData;
