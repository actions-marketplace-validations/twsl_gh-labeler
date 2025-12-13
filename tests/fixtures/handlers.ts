import { jest } from "@jest/globals";

export const mockContentLabelHandlerInstance = {
	getThreadType: jest.fn(),
	performContentScanning: jest.fn(),
	performActions: jest.fn(),
};

export const mockIssueHandlerInstance = {
	getThreadType: jest.fn(),
	performActions: jest.fn(),
};

export const mockPullRequestHandlerInstance = {
	getThreadType: jest.fn(),
	performActions: jest.fn(),
};

export const mockDiscussionHandlerInstance = {
	getThreadType: jest.fn(),
	performActions: jest.fn(),
};

export const ContentLabelHandler = jest
	.fn()
	.mockImplementation(() => mockContentLabelHandlerInstance);
export const IssueHandler = jest
	.fn()
	.mockImplementation(() => mockIssueHandlerInstance);
export const PullRequestHandler = jest
	.fn()
	.mockImplementation(() => mockPullRequestHandlerInstance);
export const DiscussionHandler = jest
	.fn()
	.mockImplementation(() => mockDiscussionHandlerInstance);
