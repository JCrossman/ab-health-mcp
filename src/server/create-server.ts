/**
 * MCP Server factory.
 *
 * Creates a fully configured McpServer with all 44 tools registered.
 * Used by both stdio (index.ts) and HTTP (http-index.ts) entry points.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// MHR tools (complex — individual files)
import { connectAccountTool } from '../tools/connect-account.js';
import { checkConnectionTool } from '../tools/check-connection.js';
import { disconnectAccountTool } from '../tools/disconnect-account.js';
import { getLabResultsTool } from '../tools/get-lab-results.js';
import { getImmunizationsTool } from '../tools/get-immunizations.js';
import { getHeightWeightTool } from '../tools/get-height-weight.js';
import { getDiagnosticImagingTool } from '../tools/get-diagnostic-imaging.js';
import { downloadAttachmentTool } from '../tools/download-attachment.js';
import { getUserProfileTool } from '../tools/get-user-profile.js';
import { getHealthOverviewTool } from '../tools/get-health-overview.js';

// MHR tools (simple — factory-generated)
import {
  getMedicationsTool,
  getReferralsTool,
  getVitalsTool,
  getBloodOxygenTool,
  getBloodPressureTool,
  getExerciseTool,
  getProceduresTool,
  getBloodGlucoseTool,
  getSleepTool,
  getDietaryIntakeTool,
  getInsulinTool,
  getPeakFlowTool,
  getWaistCircumferenceTool,
  getSymptomJournalTool,
} from '../tools/simple-mhr-tools.js';

// MyChart tools (complex — individual files)
import { mcGetVisitsTool } from '../tools/mc-get-visits.js';
import { mcGetMessagesTool } from '../tools/mc-get-messages.js';
import { mcGetDocumentsTool } from '../tools/mc-get-documents.js';
import { mcGetTestResultsTool } from '../tools/mc-get-test-results.js';
import { mcGetGoalsTool } from '../tools/mc-get-goals.js';
import { mcGetReferralsTool } from '../tools/mc-get-referrals.js';
import { mcDownloadDocumentTool } from '../tools/mc-download-document.js';
import { mcGetHistoricalResultsTool } from '../tools/mc-get-historical-results.js';
import { mcSwitchContextTool } from '../tools/mc-switch-context.js';

// MyChart tools (simple — factory-generated)
import {
  mcGetAllergiesTool,
  mcGetCareTeamTool,
  mcGetFamilyTreeTool,
  mcGetHealthIssuesTool,
  mcGetHealthSummaryTool,
  mcGetImmunizationsTool,
  mcGetMedicalHistoryTool,
  mcGetMedicationsTool,
  mcGetUpcomingOrdersTool,
  mcGetAppointmentRequestsTool,
  mcGetProxyAccessListTool,
} from '../tools/simple-mychart-tools.js';

/**
 * Create a fully configured MCP server with all 44 tools registered.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'ab-health-mcp',
      version: '1.1.4',
    },
    {
      instructions: [
        'You are helping a user access and understand their Alberta health records.',
        '',
        'Demo mode:',
        '• If the user mentions "demo", "demo mode", "sample data", or "try it out", call connect_account with demo=true.',
        '• Demo mode uses realistic sample data and does NOT open a browser or require an Alberta account.',
        '',
        'Tool usage:',
        '• ALWAYS call the appropriate tool when a user asks about their health data. Never guess or assume a service is unavailable — let the tool handle errors.',
        '• If a tool returns an "auth_required" or "session_expired" error, immediately tell the user they need to sign in and offer to call connect_account.',
        '• If a tool returns an "api_error", relay the error message to the user.',
        '• Use check_connection first if you are unsure whether the user is signed in.',
        '',
        'IMPORTANT — Medical disclaimer:',
        '• You are NOT a doctor, nurse, or medical professional.',
        '• NEVER diagnose conditions, recommend treatments, or interpret results as normal/abnormal without strong caveats.',
        '• ALWAYS remind the user to consult their healthcare provider for medical decisions, especially when discussing lab results, medications, or symptoms.',
        '• When presenting health data, provide factual context (e.g., reference ranges) but make clear that only their doctor can interpret results in the context of their full medical history.',
        '• If the user asks "is this normal?" or similar, explain the reference range but say something like: "Your doctor can best interpret this in the context of your overall health."',
        '• If the user describes an emergency or urgent symptoms, tell them to call 911 or go to their nearest emergency department immediately.',
        '',
        'Legal notice:',
        '• This tool is provided "as is" without warranty of any kind.',
        '• It is an information retrieval tool, not a medical device or health service.',
        '• The creators are not liable for any decisions made based on data or interpretations provided through this tool.',
        '• Users accept full responsibility for how they use the information retrieved.',
        '',
        'Data handling:',
        '• Health data is fetched from Alberta\'s My Health Records and AHS MyChart portals.',
        '• Do not store, cache, or repeat back more personal health information than needed to answer the question.',
        '• Present data clearly using markdown formatting.',
      ].join('\n'),
    },
  );

  // --- Session management tools ---
  server.tool(
    connectAccountTool.name,
    connectAccountTool.description,
    { 
      force: z.boolean().optional().describe('Force re-authentication even if a valid session exists.'),
      demo: z.boolean().optional().describe('MUST be set to true when the user mentions "demo", "demo mode", "sample data", or "try it out". Connects with sample data — no browser, no Alberta account needed.'),
    },
    { title: 'Connect Account',readOnlyHint: false, destructiveHint: false },
    connectAccountTool.handler,
  );

  server.tool(checkConnectionTool.name, checkConnectionTool.description, {}, { title: 'Check Connection',readOnlyHint: true, destructiveHint: false }, checkConnectionTool.handler);
  server.tool(disconnectAccountTool.name, disconnectAccountTool.description, {}, { title: 'Disconnect Account',readOnlyHint: false, destructiveHint: false }, disconnectAccountTool.handler);
  server.tool(getHealthOverviewTool.name, getHealthOverviewTool.description, {}, { title: 'Health Overview',readOnlyHint: true, destructiveHint: false }, getHealthOverviewTool.handler);

  // Shared pagination params (reused across many tools)
  const maxResultsParam = z.number().min(1).max(500).optional().describe('Results per page (default varies by tool, max 500). Increase to see more at once.');
  const offsetParam = z.number().min(0).optional().describe('Number of results to skip for pagination (default 0). Use nextOffset from the response to get the next page.');

  // --- MHR tools with parameters ---
  server.tool(
    getLabResultsTool.name,
    getLabResultsTool.description,
    {
      date_range: z.enum(['All', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear']).optional().describe('Predefined date range filter. Defaults to All.'),
      start_date: z.string().optional().describe('Custom start date in YYYY-MM-DD format.'),
      end_date: z.string().optional().describe('Custom end date in YYYY-MM-DD format.'),
      test_name: z.string().optional().describe('Filter results by test name (case-insensitive substring match).'),
      max_results: maxResultsParam,
      offset: offsetParam,
    },
    { title: 'Lab Results',readOnlyHint: true, destructiveHint: false },
    getLabResultsTool.handler,
  );

  server.tool(getUserProfileTool.name, getUserProfileTool.description, {}, { title: 'User Profile',readOnlyHint: true, destructiveHint: false }, getUserProfileTool.handler);

  server.tool(
    getImmunizationsTool.name,
    getImmunizationsTool.description,
    {
      date_range: z.enum(['All', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear']).optional().describe('Predefined date range filter. Defaults to All.'),
      start_date: z.string().optional().describe('Custom start date in YYYY-MM-DD format.'),
      end_date: z.string().optional().describe('Custom end date in YYYY-MM-DD format.'),
      max_results: maxResultsParam,
      offset: offsetParam,
    },
    { title: 'Immunizations',readOnlyHint: true, destructiveHint: false },
    getImmunizationsTool.handler,
  );

  server.tool(getMedicationsTool.name, getMedicationsTool.description, { max_results: maxResultsParam, offset: offsetParam }, { title: 'Medications',readOnlyHint: true, destructiveHint: false }, getMedicationsTool.handler);

  server.tool(
    getReferralsTool.name,
    getReferralsTool.description,
    {
      date_range: z.enum(['AllData', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear']).optional().describe('Predefined date range filter. Defaults to AllData.'),
      max_results: maxResultsParam,
      offset: offsetParam,
    },
    { title: 'Referrals',readOnlyHint: true, destructiveHint: false },
    getReferralsTool.handler,
  );

  const dateRangeParam = z.enum(['All', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear']).optional().describe('Date range filter. Defaults to All.');
  const dateRangePaginationParams = { date_range: dateRangeParam, max_results: maxResultsParam, offset: offsetParam };

  // Read-only annotation for all data retrieval tools
  const readOnly = { readOnlyHint: true as const, destructiveHint: false as const };

  server.tool(getVitalsTool.name, getVitalsTool.description, dateRangePaginationParams, { title: 'Vitals',...readOnly}, getVitalsTool.handler);
  server.tool(getBloodOxygenTool.name, getBloodOxygenTool.description, dateRangePaginationParams, { title: 'Blood Oxygen',...readOnly}, getBloodOxygenTool.handler);
  server.tool(getBloodPressureTool.name, getBloodPressureTool.description, dateRangePaginationParams, { title: 'Blood Pressure',...readOnly}, getBloodPressureTool.handler);
  server.tool(getHeightWeightTool.name, getHeightWeightTool.description, dateRangePaginationParams, { title: 'Height & Weight',...readOnly}, getHeightWeightTool.handler);
  server.tool(getExerciseTool.name, getExerciseTool.description, dateRangePaginationParams, { title: 'Exercise',...readOnly}, getExerciseTool.handler);
  server.tool(getDiagnosticImagingTool.name, getDiagnosticImagingTool.description, dateRangePaginationParams, { title: 'Diagnostic Imaging',...readOnly}, getDiagnosticImagingTool.handler);
  server.tool(getProceduresTool.name, getProceduresTool.description, dateRangePaginationParams, { title: 'Procedures',...readOnly}, getProceduresTool.handler);
  server.tool(getBloodGlucoseTool.name, getBloodGlucoseTool.description, dateRangePaginationParams, { title: 'Blood Glucose',...readOnly}, getBloodGlucoseTool.handler);
  server.tool(getSleepTool.name, getSleepTool.description, dateRangePaginationParams, { title: 'Sleep',...readOnly}, getSleepTool.handler);
  server.tool(getDietaryIntakeTool.name, getDietaryIntakeTool.description, dateRangePaginationParams, { title: 'Dietary Intake',...readOnly}, getDietaryIntakeTool.handler);
  server.tool(getInsulinTool.name, getInsulinTool.description, dateRangePaginationParams, { title: 'Insulin',...readOnly}, getInsulinTool.handler);
  server.tool(getPeakFlowTool.name, getPeakFlowTool.description, dateRangePaginationParams, { title: 'Peak Flow',...readOnly}, getPeakFlowTool.handler);
  server.tool(getWaistCircumferenceTool.name, getWaistCircumferenceTool.description, dateRangePaginationParams, { title: 'Waist Circumference',...readOnly}, getWaistCircumferenceTool.handler);
  server.tool(getSymptomJournalTool.name, getSymptomJournalTool.description, {
    date_range: z.enum(['AllData', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear']).optional().describe('Date range filter. Defaults to AllData.'),
    max_results: maxResultsParam,
    offset: offsetParam,
  }, { title: 'Symptom Journal',...readOnly}, getSymptomJournalTool.handler);

  server.tool(
    downloadAttachmentTool.name,
    downloadAttachmentTool.description,
    {
      thing_id: z.string().describe('The thingId from the attachment metadata returned by get_lab_results or get_diagnostic_imaging.'),
      filename: z.string().describe('The attachment filename from the metadata.'),
    },
    { title: 'Download Attachment',readOnlyHint: true, destructiveHint: false },
    downloadAttachmentTool.handler,
  );

  // --- MyChart (AHS Connect) tools ---

  server.tool(
    mcGetVisitsTool.name,
    mcGetVisitsTool.description,
    {
      time_frame: z.enum(['upcoming', 'past', 'all']).optional().describe('Filter by upcoming, past, or all visits. Defaults to all.'),
      visit_id: z.string().optional().describe('CSN identifier for a specific visit to get details.'),
    },
    { title: 'Visits (MyChart)',readOnlyHint: true, destructiveHint: false },
    mcGetVisitsTool.handler,
  );

  server.tool(mcGetHealthSummaryTool.name, mcGetHealthSummaryTool.description, {}, { title: 'Health Summary (MyChart)',...readOnly}, mcGetHealthSummaryTool.handler);
  server.tool(mcGetAllergiesTool.name, mcGetAllergiesTool.description, {}, { title: 'Allergies (MyChart)',...readOnly}, mcGetAllergiesTool.handler);
  server.tool(mcGetHealthIssuesTool.name, mcGetHealthIssuesTool.description, {}, { title: 'Health Issues (MyChart)',...readOnly}, mcGetHealthIssuesTool.handler);
  server.tool(mcGetCareTeamTool.name, mcGetCareTeamTool.description, {}, { title: 'Care Team (MyChart)',...readOnly}, mcGetCareTeamTool.handler);

  server.tool(
    mcGetMessagesTool.name,
    mcGetMessagesTool.description,
    {
      folder: z.enum(['inbox', 'sent', 'all']).optional().describe('Message folder to retrieve. Defaults to inbox.'),
      message_id: z.string().optional().describe('Conversation ID to get full details.'),
      page: z.number().optional().describe('Page number for pagination (default: 1). Use to load older messages.'),
    },
    { title: 'Messages (MyChart)',readOnlyHint: true, destructiveHint: false },
    mcGetMessagesTool.handler,
  );

  server.tool(mcGetMedicalHistoryTool.name, mcGetMedicalHistoryTool.description, {}, { title: 'Medical History (MyChart)',...readOnly}, mcGetMedicalHistoryTool.handler);

  server.tool(
    mcGetDocumentsTool.name,
    mcGetDocumentsTool.description,
    {
      document_id: z.string().optional().describe('Document ID (dcsId) to get details for a specific document.'),
      file_extension: z.string().optional().describe('File extension of the document (e.g., PDF, JPG, HTML). Defaults to PDF.'),
    },
    { title: 'Documents (MyChart)',readOnlyHint: true, destructiveHint: false },
    mcGetDocumentsTool.handler,
  );

  server.tool(mcGetUpcomingOrdersTool.name, mcGetUpcomingOrdersTool.description, {}, { title: 'Upcoming Orders (MyChart)',...readOnly}, mcGetUpcomingOrdersTool.handler);

  server.tool(
    mcGetTestResultsTool.name,
    mcGetTestResultsTool.description,
    {
      search_string: z.string().optional().describe('Search string to filter test results.'),
      order_id: z.string().optional().describe('Order key to get details for a specific test result.'),
      report_id: z.string().optional().describe('Report ID to fetch full report content (procedure narratives, findings). Found in the test result details response.'),
    },
    { title: 'Test Results (MyChart)',readOnlyHint: true, destructiveHint: false },
    mcGetTestResultsTool.handler,
  );

  server.tool(mcGetFamilyTreeTool.name, mcGetFamilyTreeTool.description, {}, { title: 'Family History (MyChart)',...readOnly}, mcGetFamilyTreeTool.handler);
  server.tool(mcGetGoalsTool.name, mcGetGoalsTool.description, {}, { title: 'Health Goals (MyChart)',...readOnly}, mcGetGoalsTool.handler);

  server.tool(
    mcGetReferralsTool.name,
    mcGetReferralsTool.description,
    { referral_id: z.string().optional().describe('Referral ID to get details for a specific referral.') },
    { title: 'Referrals (MyChart)',readOnlyHint: true, destructiveHint: false },
    mcGetReferralsTool.handler,
  );

  server.tool(mcGetMedicationsTool.name, mcGetMedicationsTool.description, {}, { title: 'Medications (MyChart)',...readOnly}, mcGetMedicationsTool.handler);
  server.tool(mcGetImmunizationsTool.name, mcGetImmunizationsTool.description, {}, { title: 'Immunizations (MyChart)',...readOnly}, mcGetImmunizationsTool.handler);
  server.tool(mcGetAppointmentRequestsTool.name, mcGetAppointmentRequestsTool.description, {}, { title: 'Appointment Requests (MyChart)',...readOnly}, mcGetAppointmentRequestsTool.handler);
  server.tool(mcGetProxyAccessListTool.name, mcGetProxyAccessListTool.description, {}, { title: 'Proxy Access List (MyChart)',...readOnly}, mcGetProxyAccessListTool.handler);

  server.tool(
    mcSwitchContextTool.name,
    mcSwitchContextTool.description,
    { proxy_id: z.string().describe('Patient proxy ID from mc_list_proxy_access, or "self" to switch back to your own records.') },
    { title: 'Switch Patient Context',readOnlyHint: false, destructiveHint: false },
    mcSwitchContextTool.handler,
  );

  server.tool(
    mcGetHistoricalResultsTool.name,
    mcGetHistoricalResultsTool.description,
    {
      order_id: z.string().describe('Order key from mc_get_test_results details.'),
      component_ids: z.array(z.string()).describe('Array of component IDs from the test result details to get historical trends for.'),
    },
    { title: 'Historical Results (MyChart)',readOnlyHint: true, destructiveHint: false },
    mcGetHistoricalResultsTool.handler,
  );

  server.tool(
    mcDownloadDocumentTool.name,
    mcDownloadDocumentTool.description,
    {
      dcs_id: z.string().describe('Document content service ID (dcsId) from test result scans or document listings.'),
      file_extension: z.string().describe('File extension (e.g., JPG, PNG, PDF) from the scan/document metadata.'),
    },
    { title: 'Download Document (MyChart)',readOnlyHint: true, destructiveHint: false },
    mcDownloadDocumentTool.handler,
  );

  return server;
}
