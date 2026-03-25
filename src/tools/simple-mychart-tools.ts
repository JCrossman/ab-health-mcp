/**
 * Simple MyChart passthrough tools — each calls one client method and returns JSON.
 * Created via factory to eliminate boilerplate.
 *
 * Where MHR and MyChart have overlapping tools (medications, immunizations, referrals),
 * descriptions disambiguate: MHR = provincial/community data, MyChart = AHS/hospital data.
 */

import { simpleMyChartTool } from './tool-factory.js';

export const mcGetAllergiesTool = simpleMyChartTool(
  'mc_get_allergies',
  'Get your allergy list from AHS Connect (MyChart) — includes allergen names, reactions, and severity as recorded by AHS providers.',
  c => c.getAllergies());

export const mcGetCareTeamTool = simpleMyChartTool(
  'mc_get_care_team',
  'Get your AHS care team providers (MyChart) — includes physician names, specialties, and contact information.',
  c => c.getCareTeam());

export const mcGetFamilyTreeTool = simpleMyChartTool(
  'mc_get_family_tree',
  'Get your family tree and pedigree from AHS Connect (MyChart) — includes family medical history relationships.',
  c => c.getFamilyTree());

export const mcGetHealthIssuesTool = simpleMyChartTool(
  'mc_get_health_issues',
  'Get your active diagnoses and health conditions from AHS Connect (MyChart) — includes condition names, dates, and status.',
  c => c.getHealthIssues());

export const mcGetHealthSummaryTool = simpleMyChartTool(
  'mc_get_health_summary',
  'Get a health summary overview from AHS Connect (MyChart) — high-level snapshot of your health status in the AHS system.',
  c => c.getHealthSummary());

export const mcGetImmunizationsTool = simpleMyChartTool(
  'mc_get_immunizations',
  'Get immunization records from AHS Connect (MyChart) — vaccines administered by AHS/hospital providers. For provincial immunization records (pharmacies, public health), use get_immunizations instead.',
  c => c.getImmunizations());

export const mcGetMedicalHistoryTool = simpleMyChartTool(
  'mc_get_medical_history',
  'Get your medical and family history from AHS Connect (MyChart) — includes past medical history, surgical history, and family history as recorded by AHS.',
  c => c.getMedicalHistory());

export const mcGetMedicationsTool = simpleMyChartTool(
  'mc_get_medications',
  'Get your current medications from AHS Connect (MyChart) — medications prescribed by AHS/hospital providers. For provincial pharmacy prescriptions, use get_medications instead.',
  c => c.getMedications());

export const mcGetUpcomingOrdersTool = simpleMyChartTool(
  'mc_get_upcoming_orders',
  'Get upcoming tests and procedures ordered in AHS Connect (MyChart) — includes scheduled lab work, imaging, and procedures.',
  c => c.getUpcomingOrders());

export const mcGetAppointmentRequestsTool = simpleMyChartTool(
  'mc_get_appointment_requests',
  'Get pending appointment requests from AHS Connect (MyChart) — includes requested appointments awaiting scheduling.',
  c => c.getAppointmentRequests());

export const mcGetProxyAccessListTool = simpleMyChartTool(
  'mc_list_proxy_access',
  'Check for shared health records and proxy access. Lists all patient records you can access in MyChart — includes your own records and any Friends & Family / guardian / shared records. Use this tool whenever the user asks about shared records, proxy access, family access, or viewing someone else\'s health data. Returns patient names and IDs. To view a shared patient\'s records: first call mc_switch_context with their proxy ID, then use mc_get_test_results (not get_lab_results) and other mc_* tools.',
  c => c.getProxyAccessList());
