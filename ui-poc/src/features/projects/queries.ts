export const PROJECTS_PAGE_QUERY = `#graphql
  query ProjectsPage($status: String, $keyword: String, $manager: String, $health: String, $tag: String, $tags: [String!]) {
    projects(status: $status, keyword: $keyword, manager: $manager, health: $health, tag: $tag, tags: $tags) {
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
