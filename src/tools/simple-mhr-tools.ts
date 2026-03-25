/**
 * Simple MHR passthrough tools — each calls one client method and returns JSON.
 * Created via factory to eliminate boilerplate.
 */

import { simpleMhrTool, mhrDateRangeTool } from './tool-factory.js';

// No-param tools
export const getMedicationsTool = simpleMhrTool(
  'get_medications',
  'Get medication records from your provincial My Health Records account — community pharmacy prescriptions and dispensing history. For AHS/hospital-prescribed medications, use mc_get_medications instead.',
  c => c.getMedications(),
  'medications',
);

// Date-range tools (default: 'All')
export const getVitalsTool = mhrDateRangeTool(
  'get_vitals',
  'Get vital signs from clinical visits — includes pulse, blood pressure, respiratory rate, temperature, and blood oxygen readings recorded by healthcare providers.',
  (c, p) => c.getVitalSigns(p),
  'vitals',
);

export const getBloodOxygenTool = mhrDateRangeTool(
  'get_blood_oxygen',
  'Get blood oxygen saturation (SpO2) readings from your My Health Records account.',
  (c, p) => c.getBloodOxygen(p),
  'readings',
);

export const getBloodPressureTool = mhrDateRangeTool(
  'get_blood_pressure',
  'Get blood pressure readings from your My Health Records account.',
  (c, p) => c.getBloodPressure(p),
  'readings',
);

export const getExerciseTool = mhrDateRangeTool(
  'get_exercise',
  'Get exercise and physical activity records from your My Health Records account — includes calories, distance, duration, and activity types.',
  (c, p) => c.getExercise(p),
  'exercise',
);

// Date-range tool with 'AllData' default
export const getReferralsTool = mhrDateRangeTool(
  'get_referrals',
  'Get specialist referral records from your provincial My Health Records account. For AHS-specific referral details, use mc_get_referrals instead.',
  (c, p) => c.getReferrals(p),
  'referrals',
  'AllData',
);

// --- New tools discovered from HAR analysis ---

export const getProceduresTool = mhrDateRangeTool(
  'get_procedures',
  'Get medical procedure records from your My Health Records account — includes surgeries, biopsies, and other clinical procedures.',
  (c, p) => c.getProcedures(p),
  'procedures',
);

export const getBloodGlucoseTool = mhrDateRangeTool(
  'get_blood_glucose',
  'Get blood glucose monitoring records from your My Health Records account — includes glucose readings for diabetes management.',
  (c, p) => c.getBloodGlucose(p),
  'readings',
);

export const getSleepTool = mhrDateRangeTool(
  'get_sleep',
  'Get sleep session records from your My Health Records account — includes sleep duration and quality data.',
  (c, p) => c.getSleep(p),
  'sessions',
);

export const getDietaryIntakeTool = mhrDateRangeTool(
  'get_dietary_intake',
  'Get dietary intake records from your My Health Records account — includes food and nutrition tracking data.',
  (c, p) => c.getDietaryIntake(p),
  'intake',
);

export const getInsulinTool = mhrDateRangeTool(
  'get_insulin',
  'Get insulin injection and usage records from your My Health Records account — includes injection logs and insulin regimen data.',
  (c, p) => c.getInsulin(p),
  'insulin',
);

export const getPeakFlowTool = mhrDateRangeTool(
  'get_peak_flow',
  'Get peak flow (asthma) records from your My Health Records account — includes peak expiratory flow readings for respiratory monitoring.',
  (c, p) => c.getPeakFlow(p),
  'readings',
);

export const getWaistCircumferenceTool = mhrDateRangeTool(
  'get_waist_circumference',
  'Get waist circumference measurements from your My Health Records account.',
  (c, p) => c.getWaistCircumference(p),
  'measurements',
);

export const getSymptomJournalTool = mhrDateRangeTool(
  'get_symptom_journal',
  'Get symptom journal entries from your My Health Records account — includes logged symptoms and health concerns.',
  (c, p) => c.getSymptomJournal(p),
  'entries',
  'AllData',
);
