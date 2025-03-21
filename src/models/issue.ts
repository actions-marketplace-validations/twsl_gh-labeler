interface Issue {
	owner: string;
	repo: string;
	issue_number: number;
	lock_reason?: string;
	headers?: Record<string, string>;
}

export default Issue;
