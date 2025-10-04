import request from 'supertest';
import { createTestServer } from '../test-utils/createTestServer.js';

const CREATE_TIMESHEET_MUTATION = `
  mutation CreateTimesheet($input: CreateTimesheetInput!) {
    createTimesheet(input: $input) {
      ok
      timesheet { id approvalStatus }
      error
      message
    }
  }
`;

const APPROVE_TIMESHEET_MUTATION = `
  mutation ApproveTimesheet($input: TimesheetActionInput!) {
    timesheetAction(input: $input) {
      ok
      timesheet { id approvalStatus note }
      error
      message
    }
  }
`;

describe('pm-service durability scenarios', () => {
  test('repeated timesheet approvals maintain bounded event log', async () => {
    const { app, eventLog } = createTestServer();

    const graphql = (body) =>
      request(app)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send(body);

    const iterations = 25;
    for (let index = 0; index < iterations; index += 1) {
      const createResponse = await graphql({
        query: CREATE_TIMESHEET_MUTATION,
        variables: {
          input: {
            userName: `Durability Tester ${index}`,
            projectCode: `POC-${String(index).padStart(2, '0')}`,
            hours: 6,
            autoSubmit: true,
          },
        },
      }).expect(200);

      expect(createResponse.body.errors).toBeUndefined();
      expect(createResponse.body.data.createTimesheet.ok).toBe(true);
      const timesheetId = createResponse.body.data.createTimesheet.timesheet.id;
      expect(timesheetId).toBeTruthy();

      const approveResponse = await graphql({
        query: APPROVE_TIMESHEET_MUTATION,
        variables: {
          input: {
            timesheetId,
            action: 'approve',
            comment: `approved via durability test ${index}`,
          },
        },
      }).expect(200);

      expect(approveResponse.body.errors).toBeUndefined();
      expect(approveResponse.body.data.timesheetAction.ok).toBe(true);
      expect(approveResponse.body.data.timesheetAction.timesheet.approvalStatus).toBe('approved');
    }

    const approvalEvents = eventLog.filter((entry) => entry.eventType === 'pm.timesheet.approved');
    expect(approvalEvents.length).toBeGreaterThanOrEqual(iterations);
    expect(eventLog.length).toBeLessThanOrEqual(100);
  });
});
