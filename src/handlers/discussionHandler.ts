import * as core from "@actions/core";
import type { DiscussionEvent } from "@octokit/webhooks-types";
import type Discussions from "@/models/internal/config/discussions";
import type { ThreadType } from "@/types/common";
import { AbstractHandler } from "./baseHandler";

export class DiscussionHandler extends AbstractHandler {
  getThreadType(): ThreadType {
    return "discussion";
  }

  async performActions(
    payload: any,
    threadData: DiscussionEvent["discussion"],
  ): Promise<void> {
    const actions = await this.getLabelActions(
      payload.label.name,
      payload.action,
      this.getThreadType(),
    );

    if (!actions) {
      core.debug("No actions found for discussion");
      return;
    }

    const discussionActions = actions as Discussions;

    // Handle comments (via GraphQL API)
    if (discussionActions.comments && discussionActions.comments.length > 0) {
      core.debug("Commenting on discussion");
      try {
        const mutation = `
					mutation($discussionId: ID!, $body: String!) {
						addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
							comment {
								id
							}
						}
					}
				`;

        for (const comment of discussionActions.comments) {
          const commentBody = comment.replace(
            /{issue-author}/g,
            threadData.user?.login || "unknown",
          );

          await this.client.graphql(mutation, {
            discussionId: threadData.node_id,
            body: commentBody,
          });
        }
      } catch (error) {
        this.failAction("Failed to comment on discussion", error);
      }
    }

    // Handle labels (via GraphQL API)
    if (discussionActions.labels?.add) {
      const labelsToAdd = Array.isArray(discussionActions.labels.add)
        ? discussionActions.labels.add
        : Object.keys(discussionActions.labels.add);

      if (labelsToAdd.length > 0) {
        core.debug(`Adding labels to discussion: ${labelsToAdd.join(", ")}`);
        try {
          // First get label IDs
          const labelQuery = `
						query($owner: String!, $name: String!, $labels: [String!]!) {
							repository(owner: $owner, name: $name) {
								labels(first: 100, query: $labels) {
									nodes {
										id
										name
									}
								}
							}
						}
					`;

          const labelData: any = await this.client.graphql(labelQuery, {
            owner: this.owner,
            name: this.repo,
            labels: labelsToAdd.join(" "),
          });

          const labelIds = labelData.repository.labels.nodes
            .filter((l: any) => labelsToAdd.includes(l.name))
            .map((l: any) => l.id);

          if (labelIds.length > 0) {
            const mutation = `
							mutation($discussionId: ID!, $labelIds: [ID!]!) {
								addLabelsToLabelable(input: {labelableId: $discussionId, labelIds: $labelIds}) {
									labelable {
										... on Discussion {
											id
										}
									}
								}
							}
						`;

            await this.client.graphql(mutation, {
              discussionId: threadData.node_id,
              labelIds,
            });
          }
        } catch (error) {
          this.failAction("Failed to add labels to discussion", error);
        }
      }
    }

    // Handle labels - remove
    if (discussionActions.labels?.remove) {
      const labelsToRemove = Array.isArray(discussionActions.labels.remove)
        ? discussionActions.labels.remove
        : Object.keys(discussionActions.labels.remove);

      if (labelsToRemove.length > 0) {
        core.debug(
          `Removing labels from discussion: ${labelsToRemove.join(", ")}`,
        );
        try {
          // First get label IDs
          const labelQuery = `
						query($owner: String!, $name: String!, $labels: [String!]!) {
							repository(owner: $owner, name: $name) {
								labels(first: 100, query: $labels) {
									nodes {
										id
										name
									}
								}
							}
						}
					`;

          const labelData: any = await this.client.graphql(labelQuery, {
            owner: this.owner,
            name: this.repo,
            labels: labelsToRemove.join(" "),
          });

          const labelIds = labelData.repository.labels.nodes
            .filter((l: any) => labelsToRemove.includes(l.name))
            .map((l: any) => l.id);

          if (labelIds.length > 0) {
            const mutation = `
							mutation($discussionId: ID!, $labelIds: [ID!]!) {
								removeLabelsFromLabelable(input: {labelableId: $discussionId, labelIds: $labelIds}) {
									labelable {
										... on Discussion {
											id
										}
									}
								}
							}
						`;

            await this.client.graphql(mutation, {
              discussionId: threadData.node_id,
              labelIds,
            });
          }
        } catch (error) {
          this.failAction("Failed to remove labels from discussion", error);
        }
      }
    }

    // Handle category change
    if (discussionActions.category) {
      core.debug(
        `Changing discussion category to: ${discussionActions.category}`,
      );
      try {
        // First get category ID
        const categoryQuery = `
					query($owner: String!, $name: String!) {
						repository(owner: $owner, name: $name) {
							discussionCategories(first: 100) {
								nodes {
									id
									name
								}
							}
						}
					}
				`;

        const categoryData: any = await this.client.graphql(categoryQuery, {
          owner: this.owner,
          name: this.repo,
        });

        const category =
          categoryData.repository.discussionCategories.nodes.find(
            (c: any) => c.name === discussionActions.category,
          );

        if (category) {
          const mutation = `
						mutation($discussionId: ID!, $categoryId: ID!) {
							updateDiscussion(input: {discussionId: $discussionId, categoryId: $categoryId}) {
								discussion {
									id
								}
							}
						}
					`;

          await this.client.graphql(mutation, {
            discussionId: threadData.node_id,
            categoryId: category.id,
          });
        } else {
          this.failAction(
            `Category "${discussionActions.category}" not found in repository`,
          );
        }
      } catch (error) {
        this.failAction("Failed to change discussion category", error);
      }
    }

    // Handle close
    if (discussionActions.close) {
      core.debug("Closing discussion");
      try {
        const mutation = `
					mutation($discussionId: ID!, $reason: DiscussionCloseReason) {
						closeDiscussion(input: {discussionId: $discussionId, reason: $reason}) {
							discussion {
								id
							}
						}
					}
				`;

        // Map close_reason to GraphQL enum values
        const reason =
          discussionActions.close_reason === "outdated"
            ? "OUTDATED"
            : discussionActions.close_reason === "duplicate"
              ? "DUPLICATE"
              : discussionActions.close_reason === "resolved"
                ? "RESOLVED"
                : null;

        await this.client.graphql(mutation, {
          discussionId: threadData.node_id,
          reason,
        });
      } catch (error) {
        this.failAction("Failed to close discussion", error);
      }
    }

    // Handle create_issue
    if (discussionActions.create_issue) {
      core.debug("Creating issue from discussion");
      try {
        await this.client.rest.issues.create({
          owner: this.owner,
          repo: this.repo,
          title: threadData.title,
          body: `Created from discussion: ${threadData.html_url || ""}\n\n${threadData.body || ""}`,
        });
      } catch (error) {
        this.failAction("Failed to create issue from discussion", error);
      }
    }
  }
}
