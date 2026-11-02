# Goals and Vision

> **The strategic direction of DevHub.**
> This document describes what the project is trying to prove, who it serves,
> what success looks like, what failure looks like, and what is deliberately
> out of scope. It is the reference for product decisions when the codebase
> alone does not answer "should we build this?"

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. The Problem](#2-the-problem)
- [3. Core Hypothesis](#3-core-hypothesis)
- [4. Vision](#4-vision)
- [5. Mission](#5-mission)
- [6. Target Audience](#6-target-audience)
- [7. What We Are Optimising For](#7-what-we-are-optimising-for)
- [8. Product Values](#8-product-values)
- [9. Anti-Goals](#9-anti-goals)
- [10. Why Now](#10-why-now)
- [11. Success Metrics](#11-success-metrics)
- [12. Risks and Mitigations](#12-risks-and-mitigations)
- [13. Roadmap and Exit Criteria](#13-roadmap-and-exit-criteria)
- [14. What Failure Looks Like](#14-what-failure-looks-like)
- [15. Philosophy](#15-philosophy)

---

## 1. Executive Summary

DevHub is an open-source platform for discovering and reviewing software
projects. It exists to test a specific hypothesis: **that a curated
discovery layer with mandatory feedback produces better project
recommendations than raw popularity metrics.**

GitHub's star count is the de facto signal for open-source quality. It is a
poor one. It measures historical attention, not current usefulness. It is
influenced by marketing, timing, and network effects. It does not tell a
developer whether a project is actively maintained, well-documented, or fit
for their purpose.

DevHub is an attempt to add a second signal: structured community review.
Users rate projects, express satisfaction, and leave written feedback. The
discovery algorithm weights these signals more heavily than stars, and it
applies time decay so that new projects are not permanently disadvantaged by
older projects' accumulated engagement.

This is not a proven concept. The project is at version 1.0 (feature-complete
MVP) and has not yet demonstrated that the hypothesis holds at scale. The
purpose of this document is to define what "demonstrating it" would mean,
what would falsify it, and what resources would be required to find out.

---

## 2. The Problem

### 2.1 Stars measure attention, not utility

A star is a one-click signal with no commitment attached. It can mean "this
looks interesting", "I plan to use this someday", "a colleague asked me to
star it", or "the README went viral on Hacker News." It cannot distinguish
between a project that a thousand people glanced at and a project that three
people rely on daily.

The consequences are concrete:

- An abandoned project with a strong historical launch can outrank a
  maintained alternative indefinitely.
- A project with excellent code and clear documentation but no launch
  strategy will remain invisible.
- Developers searching for a library to solve a specific problem must
  manually inspect dozens of projects to determine which are actually usable.

### 2.2 Feedback is scattered across the wrong channels

Users who want to share their experience with a project have no dedicated
place to do so. They can:

- Open a GitHub issue, which is designed for bug reports, not for general
  feedback.
- Post on social media, where feedback is disconnected from the project.
- Write a blog post, which is invisible to anyone browsing the project.

The result is that the feedback that would most help a future user — the
feedback about actual experience using the tool — is either never written or
written somewhere the next user will not find it.

### 2.3 Project information is fragmented

A typical open-source project has its code on GitHub, its demo on Vercel or
Netlify, its screenshots in the README, its release downloads in GitHub
Releases, and its documentation on a separate docs site. There is no single
view that shows all of this together. A developer who wants to evaluate a
project must visit four different pages, and each one may be stale.

### 2.4 Discovery is dominated by recency and social proof

GitHub Trending, Hacker News, and Product Hunt all reward recency. A project
that launched three years ago and is still actively maintained has no
advantage over a project that launched last week and was abandoned. This
creates a bias toward new projects regardless of quality, and a bias toward
projects with a marketing team regardless of usefulness.

---

## 3. Core Hypothesis

DevHub is built on the following hypothesis:

> **A discovery platform that (a) requires authenticated identity to leave
> feedback, (b) restricts one review per user per project, (c) weights
> verified reviews more heavily than passive signals, and (d) applies time
> decay to ranking will produce recommendations that users trust more than
> raw star counts.**

### 3.1 What would confirm the hypothesis

- Users rate recommendations from DevHub's explore feed as more useful than
  recommendations from GitHub Trending, given the same problem to solve.
- Projects with strong review signals but modest star counts receive
  meaningful traffic and adoption that they would not have received on GitHub
  alone.
- Users who leave reviews report that their feedback was heard and acted upon
  by project owners.
- Review quality correlates with project success (projects rated highly are
  more likely to be adopted and maintained).

### 3.2 What would falsify the hypothesis

- Review signals do not correlate with actual project usage. Users rate
  projects highly based on README quality, not on actual experience.
- Star counts remain the dominant factor in user decision-making even when
  review data is available.
- Review systems are captured by the same gaming dynamics they were meant to
  counteract: bot accounts, coordinated reviews, or review bombing.
- Maintained, useful projects continue to go undiscovered because they lack
  the social capital required to attract reviews.

If any of these hold, the design hypothesis is wrong and the architecture
should be revisited rather than extended.

---

## 4. Vision

**A world where the developer who needs a tool, the developer who built it,
and the developer who has used it can find each other without relying on
virality, marketing, or a single platform's ranking algorithm.**

In this world:

- A project's reputation reflects its actual usefulness to its users, not the
  size of its launch.
- Feedback about a project is easy to give and easy to find.
- A developer evaluating an unfamiliar project can see, in one place, whether
  others like them found it useful, what its maintainers claim it does, and
  what its users say it actually does.
- Discovery is not a popularity contest. It is a curated recommendation.

The vision is not "replace GitHub." It is "add the layer that GitHub does not
provide." A developer might use GitHub to find a repository, then visit DevHub
to decide whether to use it.

---

## 5. Mission

The mission breaks the vision into a sequence of achievable objectives.

### 5.1 Immediate (achieved at v1.0)

Build a platform where:

- Users can publish a project with the media and documentation required to
  evaluate it.
- Users can leave structured feedback (rating, satisfaction, written review)
  that other users can read and act on.
- Discovery is driven by an algorithm that weights verified engagement more
  heavily than passive signals.
- The platform is secure enough that a real user can trust it with their
  account and their content.

### 5.2 Near-term (v1.1, v1.2)

Build the mechanisms required for the platform to grow beyond the initial
curated set of users:

- Notifications so that users return to the platform when something they care
  about changes.
- Follow relationships so that a user's reputation accumulates across the
  projects they interact with.
- Search advanced enough to find a specific project by describing what it
  does.
- Stability and operational maturity such that the platform does not fail
  under load.

### 5.3 Long-term (v2.0+)

Build the mechanisms required for the platform to be self-sustaining:

- A public API so that other tools can integrate DevHub data.
- Two-factor authentication and other security hardening such that
  enterprise-adjacent users can trust it.
- Mobile access so that discovery is not limited to desktop users.
- A contributor ecosystem such that the platform is not dependent on a single
  maintainer.

---

## 6. Target Audience

DevHub is built for three distinct audiences. Each has a different need and a
different reason to use the platform.

### 6.1 Primary: The evaluating developer

**Context:** A developer is about to start work on a new feature or project.
They want to know whether a solution already exists, and if so, whether it is
good.

**Behaviour:**

- Searches for a description of the problem they are solving, not for a
  specific project name.
- Compares two or three candidate projects.
- Reads the README of each, then reads reviews if any exist.
- Makes a decision within minutes.

**Needs from DevHub:**

- Fast, relevant search.
- Trustworthy ratings that reflect actual usage, not marketing.
- Enough written feedback to distinguish between "works well" and "abandoned."
- A direct link to the project so they can evaluate the code.

**What would make them return:**

- Discovering a project that solved their problem that they would not have
  found on GitHub.
- Trusting a recommendation enough to use it without further investigation.

### 6.2 Secondary: The project creator

**Context:** A developer has built a project and wants feedback and adoption.

**Behaviour:**

- Publishes the project with a description, screenshots, and a demo.
- Checks the project page periodically to see new reviews and statistics.
- Responds to comments, addresses feedback, and updates the project.

**Needs from DevHub:**

- A way to present the project professionally.
- Genuine feedback from users, not just upvotes.
- Visibility to the right audience (developers who would use it), not to a
  general audience.
- Analytics that show whether the project is being discovered and adopted.

**What would make them stay:**

- Receiving reviews from users they did not know, with specific feedback.
- Seeing the project acquire users through the platform.
- Being able to respond to feedback without leaving the platform.

### 6.3 Tertiary: The explorer

**Context:** A developer wants to see what is happening in the ecosystem,
without a specific problem to solve.

**Behaviour:**

- Browses the explore feed without a specific search.
- Follows links to interesting projects.
- Occasionally leaves reviews on projects they have used.

**Needs from DevHub:**

- A curated feed that surfaces interesting work, not the noisiest.
- Enough variety that browsing is interesting.
- A sense that the platform is alive and updated.

**What would make them return:**

- Seeing new projects they want to investigate.
- Feeling that the platform's recommendations have value.

### 6.4 Non-audience

DevHub is **not** built for:

- Users who want to host code. They should use GitHub, GitLab, or a self-hosted
  alternative.
- Users who want to sell products or services. The platform does not support
  commerce and will not.
- Recruiters or hiring managers. The platform does not expose hiring signals
  and will not build them.
- Bots or automated tools. The platform is designed for human users; automation
  is not a use case.
- Users under 13. The platform does not have the safety features required for
  minors.

---

## 7. What We Are Optimising For

A product optimises for what it measures. The following table distinguishes
the metrics that matter from the metrics that are convenient to measure but
misleading.

### 7.1 Signal metrics (optimise for these)

| Metric                                  | Why it matters                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Reviews per project**                 | A project with ten real reviews is more useful to a future user than a project with a thousand stars and no reviews. |
| **Reviews per active user**             | Measures whether the platform encourages contribution, not just consumption.                                         |
| **Median time-to-review**               | A user who leaves a review within one hour of using the platform is more likely to become a repeat contributor.      |
| **User return rate (7-day)**            | Measures whether the platform provides ongoing value.                                                                |
| **Project page → GitHub click-through** | Measures whether the platform is helping users discover projects worth examining.                                    |
| **Review-to-adoption correlation**      | Measures whether the platform's recommendations actually reflect quality.                                            |

### 7.2 Health metrics (monitor but do not optimise for)

| Metric                   | Why it should not be optimised directly                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Monthly active users** | A useful metric, but optimising for it leads to growth-hacking tactics that attract the wrong users. |
| **Total projects**       | A user can create a hundred projects; the metric is meaningless without an activity threshold.       |
| **Total reviews**        | A user can leave a one-word review; the metric is meaningless without a length threshold.            |
| **Page views**           | Bots, search engines, and the platform's own users inflate this metric.                              |
| **Session duration**     | A user who finds what they need in two minutes is better served than one who wanders for twenty.     |

### 7.3 Vanity metrics (do not report unless explicitly requested)

| Metric                       | Why it is misleading                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| **Registered users**         | Many users register and never return. Measure active users instead.                    |
| **Total downloads**          | Counts include repeated downloads by the same user and bot traffic.                    |
| **Stars synced from GitHub** | This is GitHub's metric, not DevHub's. It is displayed as context, not as achievement. |
| **Lines of code**            | A quality signal for neither the platform nor the projects it catalogs.                |

---

## 8. Product Values

The following values guide decisions when the code and the roadmap do not
provide an answer.

### 8.1 Quality over popularity

**What it means operationally:**

- The discovery algorithm weights forks (2.5×) more heavily than stars (1.0×).
  Forks indicate intent to use; stars indicate interest.
- Verified reviews (4.0× per review) outweigh passive engagement.
- Time decay is applied so that older projects do not accumulate permanent
  ranking advantages.
- One review per user per project is enforced by a unique index, preventing
  review bombing.
- Featured projects are manually curated; the curation criteria are not
  disclosed to prevent gaming.

**What it does not mean:**

- It does not mean "ignore stars." Stars are a signal, weighted appropriately.
- It does not mean "small projects are always better." Popularity is often
  earned legitimately; the platform simply tries to also surface quality that
  has not yet been discovered.

### 8.2 Honest feedback

The review system is designed to make honest feedback the path of least
resistance:

- Rating and satisfaction are recorded separately. A project can be loved
  (high satisfaction) but flawed (low rating), or vice versa.
- Written reviews are optional but encouraged. A user with a strong opinion is
  not forced to write an essay, but is not prevented from writing one.
- Project owners cannot review their own projects. This is enforced, not
  merely discouraged.
- Reviews are attributed to a real user account with a real email address,
  verified through OTP. Anonymous reviewing is not possible.
- Reviews can be edited. A user who changes their mind is not stuck with a
  review they no longer believe.

**What it does not mean:**

- It does not mean "reviews are always accurate." Users can be wrong, and
  consensus can be wrong.
- It does not mean "no negative reviews." A one-star review with a good reason
  is more valuable than a five-star review with no explanation.

### 8.3 Reversibility

Every significant action can be undone or has an audit trail:

- **Email change** is two-step, with rollback. A user who enters a wrong email
  does not lose access to their account.
- **Password change** revokes other sessions but preserves the current one. A
  user is not logged out of the device where they made the change.
- **Role changes** record who made the change, when, and why. Administrative
  actions can be audited.
- **Comments with replies** are soft-deleted. The reply hierarchy is preserved
  even when the root is deleted.
- **Project deletion** requires confirmation and removes all associated data.
  There is no soft-delete path, because projects do not have the same
  hierarchy constraints as comments.

**What it does not mean:**

- It does not mean "nothing can be permanent." Bans, project deletion, and
  account deletion are permanent by design.
- It does not mean "every action is reversible." The goal is to make the
  common mistakes reversible, not to make the system unstateable.

### 8.4 Community governance

The platform does not operate on top-down curation:

- Users can create tags without administrator approval. This follows the
  GitHub model; the assumption is that a bad tag will simply not be used.
- Users can propose new categories. Categories require administrator approval
  because they represent a structural change to the taxonomy, not a single
  value.
- Tags with no usage are not automatically deleted but are not promoted in
  autocomplete. The system does not punish early experimentation.
- User-created content (projects, reviews, comments) is attributed to the
  user. The platform does not claim ownership of user content.

**What it does not mean:**

- It does not mean "no moderation." Spam, harassment, and abuse are removed.
- It does not mean "the community decides everything." The maintainers retain
  authority over platform policy, infrastructure, and code.

---

## 9. Anti-Goals

The following are explicitly **not** goals for DevHub. They are listed here so
that future proposals can be evaluated against them.

### 9.1 Not a code hosting platform

DevHub does not host repositories. It links to GitHub. There are no plans to
add Git hosting, issue tracking for project code, or pull requests.

**Reasoning:** GitHub, GitLab, Codeberg, and SourceHut are excellent at this.
Building a competing host would require infrastructure, governance, and
maintenance that would distract from the discovery mission.

### 9.2 Not a social network

DevHub does not have a feed, direct messages, or follower counts as primary
features. When follow is added (v1.1), it will be a subscription mechanism for
discovering new content, not a social graph.

**Reasoning:** Social networks optimise for engagement, which often means
outrage and conflict. DevHub optimises for usefulness, which means quiet,
high-quality content.

### 9.3 Not a marketplace

DevHub does not have payments, subscriptions, or paid listings. Projects are
discovered on merit, not on budget.

**Reasoning:** A marketplace introduces conflicts of interest. Users would no
longer be able to trust that a project is recommended because it is good.

### 9.4 Not a job board

DevHub does not expose hiring signals or facilitate recruitment. Profiles do
not display "open to work" status.

**Reasoning:** Recruitment platforms have different incentives from discovery
platforms. Mixing them would compromise the platform's neutrality.

### 9.5 Not a blog platform

DevHub does not host long-form articles, tutorials, or opinion pieces. The
project description field is for describing a project, not for writing an
essay.

**Reasoning:** Blogs require editorial processes, comment moderation, and
content discovery systems that DevHub is not building.

### 9.6 Not a general-purpose review site

DevHub reviews projects. It does not review books, products, services, or
anything else. When the platform's review system is generalised, it should be
generalised to more categories of software, not to other domains.

**Reasoning:** Generalising too broadly dilutes the platform's value. A user
who wants software reviews goes to a software review platform. A user who
wants book reviews goes to a book review platform.

### 9.7 Not a replacement for GitHub

DevHub depends on GitHub. It is not an alternative. If GitHub disappeared
tomorrow, DevHub would need to pivot to a different repository host, not
replace it.

**Reasoning:** The platform is a curation layer. It is not a foundation.

---

## 10. Why Now

The timing argument for building DevHub rests on several observations about
the current state of open-source discovery.

### 10.1 The volume of open source has grown faster than discovery tools

The number of public repositories on GitHub has grown from approximately 100
million in 2020 to over 400 million in 2025. Most are abandoned. A
developer searching for a solution to a specific problem faces hundreds of
candidates, many of them abandoned.

Star counts, the only widely-available ranking signal, do not distinguish
between a project that is popular and a project that is good. The gap between
"available" and "useful" has widened, not narrowed.

### 10.2 GitHub has not solved the quality signal problem

GitHub has added features that improve discovery: Topics, Collections,
Sponsors, and the newer repository search. None of these address the core
problem. Stars are still the dominant visible metric. There is no structured
review system. There is no reliable way to see whether a project is actually
maintained and useful, as opposed to historically popular.

This is not a criticism of GitHub. It reflects a prioritisation: GitHub
optimises for hosting, not for curation. That prioritisation leaves room for a
complementary platform.

### 10.3 Product Hunt's model has not transferred to software

Product Hunt is the best-known discovery platform for software, but its model
is built for launches, not for ongoing quality. A project that was featured
on Product Hunt three years ago has no advantage on the platform today, even
if it has since become the leading option in its category.

The "developer product discovery" space is fragmented. There are aggregators,
newsletters, and curators, but no unified platform with a structured review
system. DevHub is an attempt to fill that gap.

### 10.4 The technical stack has matured

The tools required to build a secure, server-rendered, modern application have
become accessible:

- **Node.js and TypeScript** are mature and well-supported.
- **MongoDB** provides a flexible document model that fits the data shape.
- **Zod** and similar libraries provide runtime validation that was previously
  tedious to implement.
- **EJS** provides server-side rendering with minimal overhead.
- **Tailwind-level design systems** can be built in plain CSS with custom
  properties.

A developer can now build a platform that would have required a team five
years ago. The barrier to entry is low enough that an individual can plausibly
attempt it.

### 10.5 Developer scepticism about stars is rising

There is a growing body of commentary — on Hacker News, on blogs, in
conferences — arguing that GitHub stars are a poor signal. This is not yet a
consensus, but it is no longer a contrarian opinion. The audience for a
better signal exists.

### 10.6 What would make the timing wrong

The timing argument fails if any of the following become true:

- GitHub introduces a first-class review system that addresses the quality
  signal problem.
- A competitor launches with significantly more resources and captures the
  audience first.
- Developer scepticism about stars proves to be a small, vocal minority rather
  than a broad sentiment.
- The cost of maintaining a discovery platform becomes prohibitive relative to
  its value.

The roadmap should be revisited if any of these occur.

---

## 11. Success Metrics

Metrics are expressed as targets at four tiers of success. The purpose of
tiering is to acknowledge that the project has not yet demonstrated product-
market fit. What counts as "success" depends on what the platform is trying to
accomplish at each stage.

### 11.1 Tier definitions

| Tier         | Meaning                                                    |
| ------------ | ---------------------------------------------------------- |
| **Survival** | The project exists and is used by some people.             |
| **Traction** | The project is worth continuing to invest in.              |
| **Growth**   | The project has the potential to be sustainable.           |
| **Scale**    | The project has the potential to be a significant product. |

### 11.2 Tier 1: Survival

The minimum bar for the project to be considered alive.

| Metric                                                                     | Target | Measurement         |
| -------------------------------------------------------------------------- | ------ | ------------------- |
| Monthly active users (users who perform at least one authenticated action) | ≥ 50   | Log analysis        |
| Published projects                                                         | ≥ 100  | Database query      |
| Reviews submitted                                                          | ≥ 200  | Database query      |
| Uptime                                                                     | ≥ 99%  | External monitoring |

**Interpretation:** If the project does not meet Tier 1, it is not being used
and should be either improved or discontinued.

### 11.3 Tier 2: Traction

The bar for the project to be worth continued investment.

| Metric                               | Target  | Measurement     |
| ------------------------------------ | ------- | --------------- |
| Monthly active users                 | ≥ 500   | Log analysis    |
| Published projects                   | ≥ 500   | Database query  |
| Reviews submitted                    | ≥ 2,000 | Database query  |
| Median reviews per published project | ≥ 3     | Aggregation     |
| User return rate (7-day)             | ≥ 30%   | Cohort analysis |
| Review-to-GitHub click-through rate  | ≥ 20%   | Event tracking  |

**Interpretation:** Tier 2 indicates that the platform is providing value to
its users. The review-to-click-through metric is particularly important: it
indicates that users are acting on the recommendations the platform provides.

### 11.4 Tier 3: Growth

The bar for the project to be considered sustainable.

| Metric                                                            | Target        | Measurement            |
| ----------------------------------------------------------------- | ------------- | ---------------------- |
| Monthly active users                                              | ≥ 5,000       | Log analysis           |
| Published projects                                                | ≥ 3,000       | Database query         |
| Reviews submitted                                                 | ≥ 15,000      | Database query         |
| Median reviews per published project                              | ≥ 5           | Aggregation            |
| User return rate (7-day)                                          | ≥ 40%         | Cohort analysis        |
| User return rate (30-day)                                         | ≥ 20%         | Cohort analysis        |
| Weekly active contributors (users who create, review, or comment) | ≥ 200         | Aggregation            |
| Server cost per active user                                       | ≤ $0.10/month | Infrastructure billing |

**Interpretation:** Tier 3 indicates that the platform has enough activity to
sustain itself. The contributor metric is the most important: a platform where
users consume but do not contribute is not a review platform.

### 11.5 Tier 4: Scale

The bar for the project to be a significant product.

| Metric                               | Target    | Measurement     |
| ------------------------------------ | --------- | --------------- |
| Monthly active users                 | ≥ 50,000  | Log analysis    |
| Published projects                   | ≥ 20,000  | Database query  |
| Reviews submitted                    | ≥ 100,000 | Database query  |
| Median reviews per published project | ≥ 5       | Aggregation     |
| User return rate (30-day)            | ≥ 30%     | Cohort analysis |
| Weekly active contributors           | ≥ 2,000   | Aggregation     |

**Interpretation:** Tier 4 is aspirational. It would require the project to be
a full-time commitment and possibly require funding.

### 11.6 Quality metrics

These metrics are monitored across all tiers.

| Metric                                     | Target                            | Measurement     |
| ------------------------------------------ | --------------------------------- | --------------- |
| API error rate (5xx)                       | ≤ 0.5%                            | Log analysis    |
| P95 response time                          | ≤ 500 ms                          | APM             |
| Median time-to-first-review for a new user | ≤ 7 days                          | Cohort analysis |
| Spam content ratio (rejected / submitted)  | ≤ 5%                              | Log analysis    |
| Account ban rate                           | ≤ 1% of active accounts per month | Database query  |

**Interpretation:** These metrics indicate whether the platform is functioning
correctly and whether the quality signals are actually trustworthy.

### 11.7 What success does not look like

A high number of a metric does not imply success if the metric is being gamed:

- Monthly active users growing because of bot traffic is not success.
- Reviews growing because of short, meaningless contributions is not success.
- Projects growing because of duplicate submissions is not success.

The quality metrics in Section 11.6 are designed to catch these cases.

---

## 12. Risks and Mitigations

The following risks are real. Each is described with its likelihood, its
impact, and the concrete steps taken or planned to reduce it.

### 12.1 Risk: Cold start

**Likelihood:** High.

**Impact:** Critical. A review platform with no reviews is worthless. A
discovery platform with no projects to discover has nothing to offer.

**Description:** New users arrive, see an empty platform, and leave. Without
users there are no reviews; without reviews there is nothing for new users to
read.

**Mitigation (implemented):**

- The platform seeds the taxonomy with ten categories and dozens of tags, so
  that the first user has something to organise their project with.
- The home feed includes a "latest" section that does not require prior
  engagement, so that new projects appear immediately on the landing page.
- The first registered user receives the developer role, allowing the
  maintainer to curate the early content.

**Mitigation (planned):**

- **Curated onboarding.** Invite a small number of project owners to publish
  their projects before opening registration.
- **Import from GitHub.** Allow a user to create a project by pasting a
  repository URL, reducing friction for the first contribution.
- **Featured curation.** Manually select a small number of high-quality
  projects for the home page, so that new users see the platform's best work
  immediately, not its emptiest.

### 12.2 Risk: Spam and abuse

**Likelihood:** High.

**Impact:** High. A review platform where reviews cannot be trusted is worse
than no review platform, because users will act on false signals.

**Description:** The platform attracts low-quality content: fake reviews from
accounts created to boost a project, spam links disguised as project
descriptions, and abusive comments.

**Mitigation (implemented):**

- Email verification is mandatory before project creation.
- One review per user per project, enforced by a unique index.
- Rate limiting on all create, update, and delete endpoints.
- Spam detection with rejection thresholds and warning thresholds.
- Project owners cannot review their own projects.
- Reviews are attributed to real accounts; anonymous review is not possible.

**Mitigation (planned):**

- **CAPTCHA on registration** if spam becomes a real problem.
- **Review useful-vote system with limits** (one vote per user per review,
  enforced at the database level).
- **Trust weighting.** A review from a user with a history of useful
  contributions carries more weight than a review from a newly-created
  account.
- **Account age gating.** New accounts cannot review or comment for a
  period (typically 24 hours) after registration.

### 12.3 Risk: Competition from GitHub

**Likelihood:** Medium.

**Impact:** High. If GitHub introduces a first-class review system, DevHub's
core differentiator disappears.

**Description:** GitHub has the resources, the audience, and the integration
advantage. A feature announcement could displace DevHub overnight.

**Mitigation (structural):**

- **Focus on the review model, not on the code.** DevHub reviews projects,
  not commits. GitHub's incentive is to review code, not projects.
- **Focus on the discovery experience.** GitHub's search is built for finding
  a specific repository. DevHub's search is built for finding a solution to a
  problem.
- **Build a community, not a feature.** If DevHub's value is primarily in its
  community and its content, a GitHub feature announcement does not displace
  it. If DevHub's value is in its algorithm, it does.
- **Remain integrated with GitHub, not opposed to it.** The platform is a
  complement. A GitHub feature that improves discovery is not a threat if
  DevHub continues to serve a different purpose.

**What would make this risk fatal:** GitHub adding structured reviews,
aggregate ratings, and a curated discovery feed. This is not currently on
GitHub's public roadmap, but it is not impossible.

### 12.4 Risk: Maintainer burnout

**Likelihood:** High.

**Impact:** Critical. A solo-maintained project that stops being maintained
is an abandoned platform. Abandoned platforms accumulate security debt, which
is worse than a clean shutdown.

**Description:** A project of this complexity requires ongoing work:
security updates, dependency updates, bug fixes, moderation, and community
support. If the maintainer stops, the platform degrades.

**Mitigation (implemented):**

- Extensive documentation (this document, `README.md`,
  `PROJECT_GUIDE.md`, `AI_GUIDE.md`, `SECURITY.md`, `CONTRIBUTING.md`) so
  that a future maintainer can understand the system.
- BSD 3-Clause license that permits forking and continuation.
- Self-hosted architecture that does not depend on proprietary services.
- Minimal external dependencies.

**Mitigation (planned):**

- **Recruit co-maintainers.** The path to sustainability is not through a
  single maintainer doing more, but through additional maintainers sharing the
  work.
- **Establish a governance model.** Clear decision-making processes for
  feature proposals and disputes.
- **Build a moderation team.** Community moderation reduces the maintainer's
  workload for content decisions.
- **Automate routine work.** Dependency updates, security scanning, and log
  rotation should be automated so that they do not compete with feature work.

### 12.5 Risk: Review system capture

**Likelihood:** Medium.

**Impact:** High. If the review system can be gamed, the platform's value is
destroyed.

**Description:** A review system is a new attack surface. The same dynamics
that plague star counts — bot accounts, coordinated campaigns, and reciprocal
reviewing — can affect reviews if the platform does not defend against them.

**Mitigation (implemented):**

- Email verification before review.
- One review per user per project.
- Project owners cannot review their own projects.
- Rate limiting on review submission.
- Spam detection on review content.

**Mitigation (planned):**

- **Detection of review rings.** Identifying clusters of accounts that
  consistently review the same projects.
- **Detection of reciprocal reviewing.** Identifying users who consistently
  review each other's projects with high ratings.
- **Weighted reviews.** Reviews from accounts with a history of other
  contributions carry more weight than reviews from accounts that only
  review.
- **Public review histories.** Allowing users to see a reviewer's other
  reviews, so that patterns of bias or abuse are visible.

### 12.6 Risk: Regulatory and legal

**Likelihood:** Low.

**Impact:** Medium. GDPR, data retention, and content moderation rules vary by
jurisdiction. A platform that hosts user content has obligations.

**Description:** A user in the EU has GDPR rights. A user in Germany has
stronger data retention obligations. A user in the US has Section 230
protections that may not apply in other jurisdictions.

**Mitigation (implemented):**

- Privacy Policy and Terms of Service.
- Account deletion that removes personal data.
- Data export capability (via the API for now; UI pending).
- Audit trail for administrative actions.
- Email verification before any content creation.

**Mitigation (planned):**

- **Formal DMCA process.** A designated agent for copyright complaints.
- **Data processing agreements** for any third-party service that handles
  user data.
- **Regional availability policy** if specific jurisdictions require
  infrastructure changes the project cannot support.

---

## 13. Roadmap and Exit Criteria

Each phase has a set of exit criteria. The next phase does not begin until the
current phase's criteria are met, or the criteria are explicitly waived with a
recorded rationale.

### 13.1 Phase 1: MVP (v1.0) — Complete

**Focus:** Build a working, secure, feature-complete platform that
demonstrates the core concept.

**Delivered:**

- Authentication with mandatory email verification
- Project CRUD with media and GitHub sync
- Reviews with ratings and satisfaction
- Threaded comments with soft deletion
- Tag and category management
- Explore with Hot Score
- Role-based dashboard
- Support ticket system
- Public profiles and directories
- Security hardening across the platform

**Exit criteria:**

- [x] All core features implemented and working
- [x] Security review completed (see `SECURITY.md`)
- [x] All endpoints rate-limited
- [x] TypeScript strict mode with no errors
- [x] Deployment tested on a staging environment
- [x] Documentation complete (`README.md`, `PROJECT_GUIDE.md`,
      `AI_GUIDE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`)

**Time elapsed:** Approximately the development period to reach v1.0.

### 13.2 Phase 2: Growth (v1.1)

**Focus:** Enable the community to grow beyond the initial curated set of
users.

**Planned features:**

- Follow and unfollow users
- Notification system (in-app inbox and email digest)
- Activity feed on profiles
- Login history in the security page
- CAPTCHA on registration (if spam is observed)
- Refined rate limiting across authentication endpoints
- CSP reporting endpoint

**Exit criteria:**

- [ ] Tier 1 metrics met (50 MAU, 100 projects, 200 reviews)
- [ ] User return rate ≥ 20% (7-day)
- [ ] Zero critical vulnerabilities open in `npm audit`
- [ ] Median time-to-first-review for a new user ≤ 14 days

**Estimated duration:** Three months.

### 13.3 Phase 3: Scale (v1.2)

**Focus:** Make the platform capable of handling significant traffic without
architectural change.

**Planned features:**

- Full-text search (MongoDB text index or Elasticsearch)
- Live comment updates over Server-Sent Events
- Complete admin panel UI
- Audit log in the database
- User preferences (locale, notification channels)
- Redis-backed caching and rate limiting
- Background job queue for long-running operations

**Exit criteria:**

- [ ] Tier 2 metrics met (500 MAU, 500 projects, 2,000 reviews)
- [ ] User return rate ≥ 30% (7-day)
- [ ] Median reviews per published project ≥ 3
- [ ] P95 response time ≤ 500 ms under load
- [ ] Uptime ≥ 99.5% over a rolling 30-day window
- [ ] Documented incident response procedure

**Estimated duration:** Six months after v1.1.

### 13.4 Phase 4: Ecosystem (v2.0)

**Focus:** Make the platform a foundation that other tools can build on.

**Planned features:**

- Public, versioned REST API with token authentication
- Two-factor authentication via TOTP
- GraphQL endpoint
- Webhooks for project events
- GitHub Action integration
- Mobile application
- Plugin system for custom content formats

**Exit criteria:**

- [ ] Tier 3 metrics met (5,000 MAU, 3,000 projects, 15,000 reviews)
- [ ] Weekly active contributors ≥ 200
- [ ] At least one third-party integration consuming the public API
- [ ] Sustainability plan documented (funding, co-maintainers, or other)
- [ ] Governance model established

**Estimated duration:** Twelve months after v1.2.

---

## 14. What Failure Looks Like

The project fails if any of the following becomes true. Naming these in
advance allows the maintainer to recognise failure rather than assume that
"more time" is the only missing ingredient.

### 14.1 Nobody uses it

**Indicators:**

- Tier 1 metrics are not met within twelve months of v1.0.
- Monthly active users remain below 50 after a sustained push to acquire them.
- The platform has fewer than 100 published projects after a year.

**Interpretation:** The hypothesis might be correct, but the platform is not
the way to test it. Options:

- Pivot to a different implementation (newsletter, curation account, etc.).
- Conclude that the hypothesis is wrong and document the learning.
- Accept the project as a portfolio piece and stop active development.

### 14.2 People use it but nobody contributes

**Indicators:**

- Monthly active users are respectable (≥ 500).
- Reviews per active user are negligible (< 0.1).
- The median project has fewer than one review.

**Interpretation:** The hypothesis is falsified. A review platform where
nobody reviews is not a review platform. Users are consuming but not
contributing, which suggests that the review workflow requires more
motivation than the platform provides.

**Response:**

- Revisit the review workflow. Is leaving a review too high-friction?
- Consider incentives: reputation systems, badges, or visible contribution
  history.
- Consider whether the platform's audience expects to contribute or only to
  consume.

### 14.3 Reviews exist but do not correlate with quality

**Indicators:**

- Reviews are submitted, but projects with high ratings are not adopted at a
  higher rate than projects with low ratings (measured by GitHub click-through).
- Users report that reviews are not helpful.
- Reviews correlate with README quality, not with actual project quality.

**Interpretation:** The hypothesis is falsified, but differently from 14.2.
Users are contributing, but their contributions are not measuring what the
platform claims to measure. The review system is measuring presentation, not
substance.

**Response:**

- Require proof of use for a review (for example, "I have used this project"
  checkbox with a minimum account age).
- Change the rating scale to capture specific dimensions (maintenance,
  documentation, code quality) rather than a single number.
- Consider abandoning the review model and pivoting to curation.

### 14.4 Spam overwhelms quality

**Indicators:**

- Spam rejection rate (rejected / submitted) exceeds 20%.
- Reports of fake reviews increase.
- Users report that they no longer trust the ratings.

**Interpretation:** The platform's moderation model is insufficient. Users
will leave, and the platform will die.

**Response:**

- Increase moderation (manual review, trust scores, mandatory waiting periods).
- Restrict account creation.
- Reconsider whether the platform can operate at the current scale without
  manual moderation.

### 14.5 The platform degrades

**Indicators:**

- Uptime falls below 99%.
- Security vulnerabilities accumulate without patching.
- The maintainer disappears.

**Interpretation:** The project has succeeded in attracting users but failed to
sustain the infrastructure required to serve them.

**Response:**

- Document the shutdown procedure.
- Notify users in advance.
- Publish the codebase and data so that others can continue the work if they
  wish.
- Accept that the project is complete at its current scale, even if that scale
  is small.

### 14.6 GitHub obsoletes it

**Indicators:**

- GitHub introduces a structured review system with aggregate ratings,
  satisfaction, and written reviews.
- GitHub's discovery feed begins ranking by quality signals, not just stars.
- Users migrate away from DevHub because GitHub's version is sufficient.

**Interpretation:** The hypothesis may be correct, but the platform is not the
right place to test it.

**Response:**

- Acknowledge that the platform has served its purpose by demonstrating the
  hypothesis.
- Consider whether there is a remaining niche (for example, cross-platform
  reviews, or reviews of projects not on GitHub).
- Consider pivoting to a complementary service.
- Accept that the platform was an important contribution to the ecosystem even
  if it is no longer needed.

---

## 15. Philosophy

DevHub's philosophy can be summarised in a single sentence:

> **Good projects deserve to be seen, and good feedback deserves to be found.**

This is not a claim of certainty. It is a bet. The bet is that the
combination of:

- **Structured review** (rating, satisfaction, and written feedback, not just
  likes)
- **Verified identity** (no anonymous reviewing, email verification required)
- **Time-aware ranking** (new projects are not permanently disadvantaged)
- **Community governance** (users can create tags, propose categories, and
  moderate through review)

produces a discovery platform that is genuinely better than the alternative.

The bet might be wrong. If it is wrong, the right response is not to
double down, but to understand why and to adjust. The project's success is not
measured by its growth; it is measured by whether it produces a signal that
users trust.

A platform that is trusted by a hundred developers is more successful than a
platform that is used by a hundred thousand and trusted by none. The former
contributes to the ecosystem. The latter extracts attention from it.

The goal is the former.

---

**Last reviewed:** 2026
**Maintainer:** [@Sobhan-SRZA](https://github.com/Sobhan-SRZA)
**License:** BSD-3-Clause