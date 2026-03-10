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

export const clearAllHandlerMocks = () => {
  (ContentLabelHandler as jest.MockedFunction<any>).mockClear();
  (IssueHandler as jest.MockedFunction<any>).mockClear();
  (PullRequestHandler as jest.MockedFunction<any>).mockClear();
  (DiscussionHandler as jest.MockedFunction<any>).mockClear();
  mockContentLabelHandlerInstance.getThreadType.mockClear();
  mockContentLabelHandlerInstance.performContentScanning.mockClear();
  mockContentLabelHandlerInstance.performActions.mockClear();
  mockIssueHandlerInstance.getThreadType.mockClear();
  mockIssueHandlerInstance.performActions.mockClear();
  mockPullRequestHandlerInstance.getThreadType.mockClear();
  mockPullRequestHandlerInstance.performActions.mockClear();
  mockDiscussionHandlerInstance.getThreadType.mockClear();
  mockDiscussionHandlerInstance.performActions.mockClear();
};
