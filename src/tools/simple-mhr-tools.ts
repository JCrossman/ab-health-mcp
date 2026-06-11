/**
 * Simple MHR passthrough tools — each calls one client method and returns JSON.
 * Created via factory to eliminate boilerplate.
 *
 * Self-report tools (insulin, peak flow, dietary intake, etc.) are gated by
 * the AB_HEALTH_ENABLE_SELF_REPORT env var. They duplicate MHR portal
 * features that almost no one uses, so we hide them by default to keep the
 * tool surface (and Claude's planning prompt) lean. Set
 * AB_HEALTH_ENABLE_SELF_REPORT=1 to enable.
 */

import { simpleMhrTool, mhrDateRangeTool } from './tool-factory.js';

export const SELF_REPORT_TOOLS_ENABLED = process.env.AB_HEALTH_ENABLE_SELF_REPORT === '1';

// No-param tools
export const getMedicationsTool = simpleMhrTool(
  'get_medications',
  'Medications from MHR — community pharmacy prescriptions and dispensing history. For hospital-prescribed meds, use mc_get_medications.',
  c => c.getMedications(),
  'medications',
  { hint: 'table', columns: ['Medication', 'Dose', 'Frequency', 'Prescriber', 'Source'] },
);

// Date-range tools (default: 'All')
export const getVitalsTool = mhrDateRangeTool(
  'get_vitals',
  'Vitals from clinical visits — pulse, BP, respiratory rate, temperature, SpO2 recorded by providers.',
  (c, p) => c.getVitalSigns(p),
  'vitals',
  'All',
  { hint: 'table', columns: ['Date', 'Reading', 'Value', 'Unit', 'Status'] },
);

export const getBloodOxygenTool = mhrDateRangeTool(
  'get_blood_oxygen',
  'Blood oxygen (SpO2) readings from MHR self-report.',
  (c, p) => c.getBloodOxygen(p),
  'readings',
  'All',
  { hint: 'trend_table', columns: ['Date', 'SpO2 %', 'Status'] },
);

export const getBloodPressureTool = mhrDateRangeTool(
  'get_blood_pressure',
  'Blood pressure readings from MHR.',
  (c, p) => c.getBloodPressure(p),
  'readings',
  'All',
  { hint: 'trend_table', columns: ['Date', 'Systolic', 'Diastolic', 'Pulse', 'Status'] },
);

export const getExerciseTool = mhrDateRangeTool(
  'get_exercise',
  'Exercise records from MHR — calories, distance, duration, activity type.',
  (c, p) => c.getExercise(p),
  'exercise',
  'All',
  { hint: 'table', columns: ['Date', 'Activity', 'Duration', 'Calories', 'Distance'] },
);

// Date-range tool with 'AllData' default
export const getReferralsTool = mhrDateRangeTool(
  'get_referrals',
  'Specialist referrals from MHR. For AHS-specific referral details, use mc_get_referrals.',
  (c, p) => c.getReferrals(p),
  'referrals',
  'AllData',
  { hint: 'table', columns: ['Date', 'Specialty', 'Provider', 'Status'] },
);

// --- New tools discovered from HAR analysis ---

export const getProceduresTool = mhrDateRangeTool(
  'get_procedures',
  'Procedure records from MHR — surgeries, biopsies, other clinical procedures.',
  (c, p) => c.getProcedures(p),
  'procedures',
  'All',
  { hint: 'table', columns: ['Date', 'Procedure', 'Provider', 'Facility'] },
);

export const getBloodGlucoseTool = mhrDateRangeTool(
  'get_blood_glucose',
  'Blood glucose monitoring records from MHR (diabetes management).',
  (c, p) => c.getBloodGlucose(p),
  'readings',
  'All',
  { hint: 'trend_table', columns: ['Date', 'Glucose', 'Unit', 'Status'] },
);

export const getSleepTool = mhrDateRangeTool(
  'get_sleep',
  'Sleep session records from MHR self-report.',
  (c, p) => c.getSleep(p),
  'sessions',
  'All',
  { hint: 'table', columns: ['Date', 'Duration', 'Quality'] },
);

export const getDietaryIntakeTool = mhrDateRangeTool(
  'get_dietary_intake',
  'Dietary intake records from MHR self-report (food/nutrition tracking).',
  (c, p) => c.getDietaryIntake(p),
  'intake',
  'All',
  { hint: 'table', columns: ['Date', 'Item', 'Calories', 'Details'] },
);

export const getInsulinTool = mhrDateRangeTool(
  'get_insulin',
  'Insulin injection records from MHR self-report.',
  (c, p) => c.getInsulin(p),
  'insulin',
  'All',
  { hint: 'table', columns: ['Date', 'Type', 'Dose', 'Unit'] },
);

export const getPeakFlowTool = mhrDateRangeTool(
  'get_peak_flow',
  'Peak flow (asthma) readings from MHR self-report.',
  (c, p) => c.getPeakFlow(p),
  'readings',
  'All',
  { hint: 'trend_table', columns: ['Date', 'Peak Flow', 'Unit', 'Status'] },
);

export const getWaistCircumferenceTool = mhrDateRangeTool(
  'get_waist_circumference',
  'Waist circumference measurements from MHR self-report.',
  (c, p) => c.getWaistCircumference(p),
  'measurements',
  'All',
  { hint: 'trend_table', columns: ['Date', 'Measurement', 'Unit'] },
);

export const getSymptomJournalTool = mhrDateRangeTool(
  'get_symptom_journal',
  'Symptom journal entries from MHR self-report.',
  (c, p) => c.getSymptomJournal(p),
  'entries',
  'AllData',
  { hint: 'table', columns: ['Date', 'Symptom', 'Severity', 'Notes'] },
);
