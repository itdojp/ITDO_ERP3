export const PROJECTS_PAGE_QUERY = `#graphql
  query ProjectsPage(
    $status: String
    $keyword: String
    $manager: String
    $health: String
    $tag: String
    $tags: [String!]
    $first: Int
    $after: String
  ) {
    projects(
      status: $status
      keyword: $keyword
      manager: $manager
      health: $health
      tag: $tag
      tags: $tags
      first: $first
      after: $after
    ) {
      items {
        id
        code
        name
        clientName
        status
        startOn
        endOn
        manager
        health
        tags
      }
      meta {
        total
        fetchedAt
        fallback
        returned
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const CREATE_PROJECT_MUTATION = `#graphql
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      ok
      error
      message
      project {
        id
        code
        name
        clientName
        status
        startOn
        endOn
        manager
        health
        tags
      }
    }
  }
`;

export const PROJECT_TRANSITION_MUTATION = `#graphql
  mutation TransitionProject($input: ProjectTransitionInput!) {
    projectTransition(input: $input) {
      ok
      error
      message
      project {
        id
        code
        name
        clientName
        status
        startOn
        endOn
        manager
        health
        tags
      }
    }
  }
`;

export const PROJECT_INSIGHTS_QUERY = `#graphql
  query ProjectInsights($projectId: String!) {
    timeline: projectTimeline(projectId: $projectId) {
      projectId
      chatSummary
      chatSummaryLanguage
      metrics {
        plannedValue
        earnedValue
        actualCost
        costVariance
        scheduleVariance
        cpi
        spi
      }
      tasks {
        id
        name
        phase
        startDate
        endDate
        status
      }
      phases {
        id
        name
        sortOrder
      }
    }
    metrics: projectMetrics(projectId: $projectId) {
      projectId
      evm {
        plannedValue
        earnedValue
        actualCost
        costVariance
        scheduleVariance
        cpi
        spi
      }
      burndown {
        labels
        planned
        actual
      }
      risks {
        id
        probability
        impact
        status
      }
    }
  }
`;
