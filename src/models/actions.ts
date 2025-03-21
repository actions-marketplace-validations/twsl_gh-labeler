interface Actions {
	comment?: string[];
	label?: string[];
	unlabel?: string[];
	reviewers?: string[];
	["number-of-reviewers"]?: number;
	["lock-reason"]?: string;
	reopen?: boolean;
	close?: boolean;
	lock?: boolean;
	unlock?: boolean;
}

export default Actions;
