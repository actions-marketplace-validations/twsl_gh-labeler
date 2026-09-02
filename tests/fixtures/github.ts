import { jest } from "bun:test";
import type * as github from "@actions/github";

export const context = {
	payload: {},
	repo: {
		owner: "test-owner",
		repo: "test-repo",
	},
	issue: {
		owner: "test-owner",
		repo: "test-repo",
		number: 123,
	},
} as typeof github.context;

export const getOctokit = jest.fn();
