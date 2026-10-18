# Giscus frontend adaptation

Upstream: https://github.com/giscus/giscus
Revision: 3d6430237108ca4ee3eb6a1a20595201c09c72d5
License: MIT (full upstream notice in LICENSE).

`api.js.txt` adapts the request/GraphQL patterns in:
- services/giscus/token.ts
- services/giscus/discussions.ts
- services/giscus/createDiscussion.ts
- services/github/addDiscussionComment.ts
- services/github/addDiscussionReply.ts
- services/github/toggleReaction.ts

Changes: remove React/SWR/Next dependencies; plain browser API; use fixed blog
adapter endpoints for giscus reads, token exchange and discussion creation;
continue sending authenticated comment/reaction mutations directly to GitHub.
Edit/delete use GitHub's DiscussionComment mutations.

This directory retains MIT licensing independently of the Apache-2.0 blog.
The new blog timeline UI and Worker adapter are outside this directory.
No MPL/GPL/AGPL code or dependencies from the upstream application are bundled.
DOMPurify and Marked remain the blog's existing, separately licensed assets.
Do not remove the MIT copyright/license notice from distributed copies.
