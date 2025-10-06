export const TIMESHEETS_PAGE_QUERY = `#graphql
  query TimesheetsPage($status: String, $keyword: String, $userName: String, $projectCode: String) {
    timesheets(status: $status, keyword: $keyword, userName: $userName, projectCode: $projectCode) {
      id
      userName
      projectCode
      projectName
      taskName
      workDate
      hours
      approvalStatus
      note
      submittedAt
    }
  }
`;

export const CREATE_TIMESHEET_MUTATION = `#graphql
  mutation CreateTimesheet($input: CreateTimesheetInput!) {
    createTimesheet(input: $input) {
      ok
      error
      message
      timesheet {
        id
        userName
        projectCode
        projectName
        taskName
        workDate
        hours
        approvalStatus
        note
        submittedAt
      }
    }
  }
`;

export const TIMESHEET_ACTION_MUTATION = `#graphql
  mutation TimesheetAction($input: TimesheetActionInput!) {
    timesheetAction(input: $input) {
      ok
      error
      message
      timesheet {
        id
        userName
        projectCode
        projectName
        taskName
        workDate
        hours
        approvalStatus
        note
        submittedAt
      }
      eventId
      shard
    }
  }
`;
