/**
 * MCP Server factory.
 *
 * Creates a fully configured McpServer with all data + session tools registered.
 * Used by both stdio (index.ts) and HTTP (http-index.ts) entry points.
 *
 * Tool count varies: 41 by default; 48 when AB_HEALTH_ENABLE_SELF_REPORT=1
 * exposes the 7 self-report MHR tools (insulin, peak flow, dietary intake,
 * etc.). These duplicate MHR portal features that almost no one uses, so
 * they are hidden by default to keep Claude's tool-planning prompt lean.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VERSION } from '../version.js';
import { withPerfTiming } from '../utils/perf.js';

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
  SELF_REPORT_TOOLS_ENABLED,
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

// Find-a-Provider tools (public Alberta provider directory — no auth)
import { findProviderTool } from '../tools/find-provider.js';
import { searchProviderByNameTool } from '../tools/search-provider-by-name.js';
import { findProviderByLanguageTool } from '../tools/find-provider-by-language.js';
import { getProviderDetailsTool } from '../tools/get-provider-details.js';

/**
 * Create a fully configured MCP server with all 44 tools registered.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'ab-health-mcp',
      version: VERSION,
    },
    {
      instructions: [
        'You are helping a user access and understand their Alberta health records.',
        '',
        'Disclaimer (always honor):',
        '• Not a medical professional. Don\'t diagnose or recommend treatments without strong caveats.',
        '• Remind users to consult their provider for medical decisions.',
        '• Provide factual context (reference ranges); only their doctor can fully interpret results.',
        '',
        'Formatting:',
        '• Use markdown tables for any list of 3+ items. Lead with a 1-2 sentence summary.',
        '• Status: 🟢 normal, 🟡 borderline, 🔴 high/low; ↑↓→ for trends.',
        '• Each tool response includes a short formatting hint — follow it.',
        '',
        'Tool usage:',
        '• For broad health questions, prefer get_health_overview over chaining single tools.',
        '• Default to Last6Months or LastYear for dated data unless the user asks for full history.',
        '• Only set demo=true when the user explicitly says "demo", "demo mode", or "sample data".',
        '• On auth_required or session_expired, offer connect_account.',
        '• Don\'t repeat back more health information than the question needs.',
      ].join('\n'),
    },
  );

  // --- Session management tools ---
  server.tool(
    connectAccountTool.name,
    connectAccountTool.description,
    { 
      force: z.boolean().optional().describe('Force re-auth even if a valid session exists.'),
      demo: z.boolean().optional().describe('Sample data mode — only when user explicitly asks for "demo" or "sample data".'),
      accept_privacy: z.boolean().optional().describe('Acknowledge privacy notice; required on first use after it is shown.'),
    },
    { title: 'Connect Account',readOnlyHint: false, destructiveHint: false },
    withPerfTiming(connectAccountTool.name, connectAccountTool.handler),
  );

  server.tool(checkConnectionTool.name, checkConnectionTool.description, {}, { title: 'Check Connection',readOnlyHint: true, destructiveHint: false }, withPerfTiming(checkConnectionTool.name, checkConnectionTool.handler));
  server.tool(disconnectAccountTool.name, disconnectAccountTool.description, {}, { title: 'Disconnect Account',readOnlyHint: false, destructiveHint: false }, withPerfTiming(disconnectAccountTool.name, disconnectAccountTool.handler));
  server.tool(getHealthOverviewTool.name, getHealthOverviewTool.description, {}, { title: 'Health Overview',readOnlyHint: true, destructiveHint: false }, withPerfTiming(getHealthOverviewTool.name, getHealthOverviewTool.handler));

  // Shared pagination params (reused across many tools)
  const maxResultsParam = z.number().min(1).max(500).optional().describe('Results per page (default varies, max 500).');
  const offsetParam = z.number().min(0).optional().describe('Skip N results for pagination. Use nextOffset from the previous response.');
  const startDateParam = z.string().optional().describe('Custom start date (YYYY-MM-DD).');
  const endDateParam = z.string().optional().describe('Custom end date (YYYY-MM-DD).');
  const dateRangeStdParam = z.enum(['All', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear']).optional().describe('Predefined date range. Defaults to All.');

  // --- MHR tools with parameters ---
  server.tool(
    getLabResultsTool.name,
    getLabResultsTool.description,
    {
      date_range: dateRangeStdParam,
      start_date: startDateParam,
      end_date: endDateParam,
      test_name: z.string().optional().describe('Filter by test name (case-insensitive substring).'),
      max_results: maxResultsParam,
      offset: offsetParam,
    },
    { title: 'Lab Results',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(getLabResultsTool.name, getLabResultsTool.handler),
  );

  server.tool(getUserProfileTool.name, getUserProfileTool.description, {}, { title: 'User Profile',readOnlyHint: true, destructiveHint: false }, withPerfTiming(getUserProfileTool.name, getUserProfileTool.handler));

  server.tool(
    getImmunizationsTool.name,
    getImmunizationsTool.description,
    {
      date_range: dateRangeStdParam,
      start_date: startDateParam,
      end_date: endDateParam,
      max_results: maxResultsParam,
      offset: offsetParam,
    },
    { title: 'Immunizations',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(getImmunizationsTool.name, getImmunizationsTool.handler),
  );

  server.tool(getMedicationsTool.name, getMedicationsTool.description, { max_results: maxResultsParam, offset: offsetParam }, { title: 'Medications',readOnlyHint: true, destructiveHint: false }, withPerfTiming(getMedicationsTool.name, getMedicationsTool.handler));

  server.tool(
    getReferralsTool.name,
    getReferralsTool.description,
    {
      date_range: z.enum(['AllData', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear']).optional().describe('Date range. Defaults to AllData.'),
      max_results: maxResultsParam,
      offset: offsetParam,
    },
    { title: 'Referrals',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(getReferralsTool.name, getReferralsTool.handler),
  );

  const dateRangePaginationParams = { date_range: dateRangeStdParam, max_results: maxResultsParam, offset: offsetParam };

  // Read-only annotation for all data retrieval tools
  const readOnly = { readOnlyHint: true as const, destructiveHint: false as const };

  server.tool(getVitalsTool.name, getVitalsTool.description, dateRangePaginationParams, { title: 'Vitals',...readOnly}, withPerfTiming(getVitalsTool.name, getVitalsTool.handler));
  server.tool(getBloodPressureTool.name, getBloodPressureTool.description, dateRangePaginationParams, { title: 'Blood Pressure',...readOnly}, withPerfTiming(getBloodPressureTool.name, getBloodPressureTool.handler));
  server.tool(getHeightWeightTool.name, getHeightWeightTool.description, dateRangePaginationParams, { title: 'Height & Weight',...readOnly}, withPerfTiming(getHeightWeightTool.name, getHeightWeightTool.handler));
  server.tool(getExerciseTool.name, getExerciseTool.description, dateRangePaginationParams, { title: 'Exercise',...readOnly}, withPerfTiming(getExerciseTool.name, getExerciseTool.handler));
  server.tool(getDiagnosticImagingTool.name, getDiagnosticImagingTool.description, dateRangePaginationParams, { title: 'Diagnostic Imaging',...readOnly}, withPerfTiming(getDiagnosticImagingTool.name, getDiagnosticImagingTool.handler));
  server.tool(getProceduresTool.name, getProceduresTool.description, dateRangePaginationParams, { title: 'Procedures',...readOnly}, withPerfTiming(getProceduresTool.name, getProceduresTool.handler));
  server.tool(getBloodGlucoseTool.name, getBloodGlucoseTool.description, dateRangePaginationParams, { title: 'Blood Glucose',...readOnly}, withPerfTiming(getBloodGlucoseTool.name, getBloodGlucoseTool.handler));

  // Self-report MHR tools — hidden unless AB_HEALTH_ENABLE_SELF_REPORT=1 is set.
  // These duplicate MHR portal features that almost no one uses; hiding them
  // keeps Claude's tool-planning prompt lean. Set the env var to re-enable.
  if (SELF_REPORT_TOOLS_ENABLED) {
    server.tool(getBloodOxygenTool.name, getBloodOxygenTool.description, dateRangePaginationParams, { title: 'Blood Oxygen',...readOnly}, withPerfTiming(getBloodOxygenTool.name, getBloodOxygenTool.handler));
    server.tool(getSleepTool.name, getSleepTool.description, dateRangePaginationParams, { title: 'Sleep',...readOnly}, withPerfTiming(getSleepTool.name, getSleepTool.handler));
    server.tool(getDietaryIntakeTool.name, getDietaryIntakeTool.description, dateRangePaginationParams, { title: 'Dietary Intake',...readOnly}, withPerfTiming(getDietaryIntakeTool.name, getDietaryIntakeTool.handler));
    server.tool(getInsulinTool.name, getInsulinTool.description, dateRangePaginationParams, { title: 'Insulin',...readOnly}, withPerfTiming(getInsulinTool.name, getInsulinTool.handler));
    server.tool(getPeakFlowTool.name, getPeakFlowTool.description, dateRangePaginationParams, { title: 'Peak Flow',...readOnly}, withPerfTiming(getPeakFlowTool.name, getPeakFlowTool.handler));
    server.tool(getWaistCircumferenceTool.name, getWaistCircumferenceTool.description, dateRangePaginationParams, { title: 'Waist Circumference',...readOnly}, withPerfTiming(getWaistCircumferenceTool.name, getWaistCircumferenceTool.handler));
    server.tool(getSymptomJournalTool.name, getSymptomJournalTool.description, {
      date_range: z.enum(['AllData', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear']).optional().describe('Date range filter. Defaults to AllData.'),
      max_results: maxResultsParam,
      offset: offsetParam,
    }, { title: 'Symptom Journal',...readOnly}, withPerfTiming(getSymptomJournalTool.name, getSymptomJournalTool.handler));
  }

  server.tool(
    downloadAttachmentTool.name,
    downloadAttachmentTool.description,
    {
      thing_id: z.string().describe('thingId from the attachment metadata (get_lab_results / get_diagnostic_imaging).'),
      filename: z.string().describe('Attachment filename from the metadata.'),
    },
    { title: 'Download Attachment',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(downloadAttachmentTool.name, downloadAttachmentTool.handler),
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
    withPerfTiming(mcGetVisitsTool.name, mcGetVisitsTool.handler),
  );

  server.tool(mcGetHealthSummaryTool.name, mcGetHealthSummaryTool.description, {}, { title: 'Health Summary (MyChart)',...readOnly}, withPerfTiming(mcGetHealthSummaryTool.name, mcGetHealthSummaryTool.handler));
  server.tool(mcGetAllergiesTool.name, mcGetAllergiesTool.description, {}, { title: 'Allergies (MyChart)',...readOnly}, withPerfTiming(mcGetAllergiesTool.name, mcGetAllergiesTool.handler));
  server.tool(mcGetHealthIssuesTool.name, mcGetHealthIssuesTool.description, {}, { title: 'Health Issues (MyChart)',...readOnly}, withPerfTiming(mcGetHealthIssuesTool.name, mcGetHealthIssuesTool.handler));
  server.tool(mcGetCareTeamTool.name, mcGetCareTeamTool.description, {}, { title: 'Care Team (MyChart)',...readOnly}, withPerfTiming(mcGetCareTeamTool.name, mcGetCareTeamTool.handler));

  server.tool(
    mcGetMessagesTool.name,
    mcGetMessagesTool.description,
    {
      folder: z.enum(['inbox', 'sent', 'all']).optional().describe('Message folder to retrieve. Defaults to inbox.'),
      message_id: z.string().optional().describe('Conversation ID to get full details.'),
      page: z.number().optional().describe('Page number for pagination (default: 1). Use to load older messages.'),
    },
    { title: 'Messages (MyChart)',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(mcGetMessagesTool.name, mcGetMessagesTool.handler),
  );

  server.tool(mcGetMedicalHistoryTool.name, mcGetMedicalHistoryTool.description, {}, { title: 'Medical History (MyChart)',...readOnly}, withPerfTiming(mcGetMedicalHistoryTool.name, mcGetMedicalHistoryTool.handler));

  server.tool(
    mcGetDocumentsTool.name,
    mcGetDocumentsTool.description,
    {
      document_id: z.string().optional().describe('Document ID (dcsId) to get details for a specific document.'),
      file_extension: z.string().optional().describe('File extension of the document (e.g., PDF, JPG, HTML). Defaults to PDF.'),
    },
    { title: 'Documents (MyChart)',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(mcGetDocumentsTool.name, mcGetDocumentsTool.handler),
  );

  server.tool(mcGetUpcomingOrdersTool.name, mcGetUpcomingOrdersTool.description, {}, { title: 'Upcoming Orders (MyChart)',...readOnly}, withPerfTiming(mcGetUpcomingOrdersTool.name, mcGetUpcomingOrdersTool.handler));

  server.tool(
    mcGetTestResultsTool.name,
    mcGetTestResultsTool.description,
    {
      search_string: z.string().optional().describe('Search string to filter test results.'),
      order_id: z.string().optional().describe('Order key to get details for a specific test result.'),
      report_id: z.string().optional().describe('Report ID to fetch full report content (procedure narratives, findings). Found in the test result details response.'),
    },
    { title: 'Test Results (MyChart)',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(mcGetTestResultsTool.name, mcGetTestResultsTool.handler),
  );

  server.tool(mcGetFamilyTreeTool.name, mcGetFamilyTreeTool.description, {}, { title: 'Family History (MyChart)',...readOnly}, withPerfTiming(mcGetFamilyTreeTool.name, mcGetFamilyTreeTool.handler));
  server.tool(mcGetGoalsTool.name, mcGetGoalsTool.description, {}, { title: 'Health Goals (MyChart)',...readOnly}, withPerfTiming(mcGetGoalsTool.name, mcGetGoalsTool.handler));

  server.tool(
    mcGetReferralsTool.name,
    mcGetReferralsTool.description,
    { referral_id: z.string().optional().describe('Referral ID to get details for a specific referral.') },
    { title: 'Referrals (MyChart)',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(mcGetReferralsTool.name, mcGetReferralsTool.handler),
  );

  server.tool(mcGetMedicationsTool.name, mcGetMedicationsTool.description, {}, { title: 'Medications (MyChart)',...readOnly}, withPerfTiming(mcGetMedicationsTool.name, mcGetMedicationsTool.handler));
  server.tool(mcGetImmunizationsTool.name, mcGetImmunizationsTool.description, {}, { title: 'Immunizations (MyChart)',...readOnly}, withPerfTiming(mcGetImmunizationsTool.name, mcGetImmunizationsTool.handler));
  server.tool(mcGetAppointmentRequestsTool.name, mcGetAppointmentRequestsTool.description, {}, { title: 'Appointment Requests (MyChart)',...readOnly}, withPerfTiming(mcGetAppointmentRequestsTool.name, mcGetAppointmentRequestsTool.handler));
  server.tool(mcGetProxyAccessListTool.name, mcGetProxyAccessListTool.description, {}, { title: 'Proxy Access List (MyChart)',...readOnly}, withPerfTiming(mcGetProxyAccessListTool.name, mcGetProxyAccessListTool.handler));

  server.tool(
    mcSwitchContextTool.name,
    mcSwitchContextTool.description,
    { proxy_id: z.string().describe('Patient proxy ID from mc_list_proxy_access, or "self" to switch back to your own records.') },
    { title: 'Switch Patient Context',readOnlyHint: false, destructiveHint: false },
    withPerfTiming(mcSwitchContextTool.name, mcSwitchContextTool.handler),
  );

  server.tool(
    mcGetHistoricalResultsTool.name,
    mcGetHistoricalResultsTool.description,
    {
      order_id: z.string().describe('Order key from mc_get_test_results details.'),
      component_ids: z.array(z.string()).describe('Array of component IDs from the test result details to get historical trends for.'),
    },
    { title: 'Historical Results (MyChart)',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(mcGetHistoricalResultsTool.name, mcGetHistoricalResultsTool.handler),
  );

  server.tool(
    mcDownloadDocumentTool.name,
    mcDownloadDocumentTool.description,
    {
      dcs_id: z.string().describe('Document content service ID (dcsId) from test result scans or document listings.'),
      file_extension: z.string().describe('File extension (e.g., JPG, PNG, PDF) from the scan/document metadata.'),
    },
    { title: 'Download Document (MyChart)',readOnlyHint: true, destructiveHint: false },
    withPerfTiming(mcDownloadDocumentTool.name, mcDownloadDocumentTool.handler),
  );

  // --- Find-a-Provider tools (public Alberta provider directory) ---
  // No authentication required. Provider data is public, no PHI involved.
  // These tools always hit the live API, even in demo mode.
  server.tool(
    findProviderTool.name,
    findProviderTool.description,
    {
      postal_code: z.string().optional().describe('Canadian postal code (e.g. "T6G 1L7"). Resolved to lat/lng server-side.'),
      address: z.string().optional().describe('Free-form address or place name (e.g. "downtown Calgary"). Resolved to lat/lng server-side. Postal code is preferred for accuracy.'),
      latitude: z.number().optional().describe('Latitude in decimal degrees. Use with longitude to skip geocoding.'),
      longitude: z.number().optional().describe('Longitude in decimal degrees. Use with latitude to skip geocoding.'),
      radius_km: z.number().min(1).max(70).optional().describe('Search radius in kilometres (1–70). Default 10.'),
      accepting_new_patients: z.boolean().optional().describe('Filter to clinics accepting new patients. Default true.'),
      gender_preference: z.enum(['male', 'female']).optional().describe('Filter to clinics with at least one provider of this gender.'),
      language: z.string().optional().describe('Language the provider speaks, e.g. "Mandarin", "Punjabi", "Arabic", "Spanish".'),
      pcn: z.string().optional().describe('Primary Care Network name, e.g. "Edmonton West", "Calgary Foothills".'),
      services: z.array(z.string()).optional().describe('Services to filter by, e.g. ["Walk-in Services", "Virtual Appointments", "Online Booking", "Wheelchair Access", "Open After Hours"].'),
      walk_in_only: z.boolean().optional().describe('Limit to dedicated walk-in clinics. Default false.'),
    },
    { title: 'Find Provider', readOnlyHint: true, destructiveHint: false },
    withPerfTiming(findProviderTool.name, findProviderTool.handler),
  );

  server.tool(
    searchProviderByNameTool.name,
    searchProviderByNameTool.description,
    {
      name: z.string().describe('Full or partial name of the physician or nurse practitioner. Minimum 2 characters.'),
      include_nurse_practitioners: z.boolean().optional().describe('Include nurse practitioners alongside doctors. Default true.'),
      doctors_only: z.boolean().optional().describe('Restrict results to doctors (excludes nurse practitioners).'),
      nurse_practitioners_only: z.boolean().optional().describe('Restrict results to nurse practitioners (excludes doctors).'),
    },
    { title: 'Search Provider by Name', readOnlyHint: true, destructiveHint: false },
    withPerfTiming(searchProviderByNameTool.name, searchProviderByNameTool.handler),
  );

  server.tool(
    findProviderByLanguageTool.name,
    findProviderByLanguageTool.description,
    {
      language: z.string().describe('Language the provider speaks, e.g. "Mandarin", "Punjabi", "Arabic", "Spanish", "French".'),
      postal_code: z.string().optional().describe('Canadian postal code (e.g. "T6G 1L7"). Resolved to lat/lng server-side.'),
      address: z.string().optional().describe('Free-form address (e.g. "downtown Calgary"). Postal code preferred.'),
      latitude: z.number().optional().describe('Latitude in decimal degrees.'),
      longitude: z.number().optional().describe('Longitude in decimal degrees.'),
      radius_km: z.number().min(1).max(70).optional().describe('Search radius in km (1–70). Default 10.'),
      accepting_new_patients: z.boolean().optional().describe('Filter to clinics accepting new patients. Default true.'),
    },
    { title: 'Find Provider by Language', readOnlyHint: true, destructiveHint: false },
    withPerfTiming(findProviderByLanguageTool.name, findProviderByLanguageTool.handler),
  );

  server.tool(
    getProviderDetailsTool.name,
    getProviderDetailsTool.description,
    {
      id: z.number().describe('Numeric ID of the clinic, physician, or nurse practitioner from a previous search result.'),
      type: z.enum(['clinic', 'physician', 'nurse_practitioner']).describe('Whether the ID refers to a clinic, physician, or nurse practitioner.'),
    },
    { title: 'Provider Details', readOnlyHint: true, destructiveHint: false },
    withPerfTiming(getProviderDetailsTool.name, getProviderDetailsTool.handler),
  );

  return server;
}
