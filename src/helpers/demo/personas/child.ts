/**
 * Demo persona — Liam User (the Demo User's son).
 *
 * 7-year-old male (DOB 2017-05-14, consistent with Sarah's delivery date).
 * Active issues: mild persistent asthma (since age 4, on fluticasone +
 * albuterol PRN), ADHD predominantly inattentive (dx Mar 2024, on
 * methylphenidate ER), peanut allergy with EpiPen (anaphylaxis-grade,
 * confirmed Ara h 2 IgE), seasonal allergic rhinitis (tree pollen + cat
 * dander), and a recent resolved strep throat episode (Oct 2024).
 *
 * Recent ED visit (Oct 14, 2024) for viral-triggered asthma exacerbation
 * \u2014 treated with nebs + PO dexamethasone, stepped up from fluticasone
 * 55 to 110. Outpatient pediatric follow-up Nov 4. Stimulant titration
 * (Concerta 9 -> 18 mg) Sep 2024 with pre-stimulant ECG baseline normal.
 *
 * Important drug-safety hooks:
 *  - Tolerates penicillin family (mother Sarah has documented PCN allergy
 *    \u2014 the chart explicitly avoids inheriting that allergy).
 *  - EpiPen Jr 0.15 mg dose appropriate at current weight (24 kg);
 *    auto-switch to adult 0.3 mg at 25 kg flagged in messages.
 *  - Stimulant monitoring (height/weight/sleep/appetite) per CADDRA guidelines.
 *
 * Custodial proxy: Demo User (parent) holds FULL proxy access \u2014 this
 * differs from adult spouse Sarah who has Limited access in the demo.
 */

import type { MHRClient } from '../../../api/mhr-client.js';
import type { MyChartClient } from '../../../api/mychart-client.js';
import type {
  UserProfile,
  SessionStatus,
  LabResult,
  ImmunizationRecord,
} from '../../../types.js';
import type { Persona } from './index.js';
import { DEMO_NOTE } from '../shared.js';

// ---------------------------------------------------------------------------
// MHR demo data
// ---------------------------------------------------------------------------

const childUserProfile: UserProfile = {
  personId: 'demo-child-001',
  name: 'Liam User',
  selectedRecordId: 'rec-demo-child',
  defaultUserLanguage: 'en-CA',
  isEmergencyAccessMode: false,
  createdDateTimeUtc: '2017-05-14T00:00:00Z',
  authorizedRecords: [
    {
      id: 'rec-demo-child',
      isCustodian: true,
      displayName: 'Liam User',
      name: 'Liam User',
      relationshipType: 'Self',
      patientInfo: 'DOB: 2017-05-14',
    },
  ],
};

const childSessionStatus: SessionStatus = {
  isSessionExpired: false,
  numberOfMilliSecondsLeftForSessionExpire: 600_000,
};

const childLabResults: LabResult[] = [];

// Sep 2024 — pre-stimulant baseline workup + annual labs
childLabResults.push({
  labTestDate: { date: 5, month: 8, year: 2024, hour: 10, minute: 0, second: 0, hasTimePart: true },
  labResultDate: '2024-09-05T10:00:00',
  labResultDisplayDate: 'Sep 5, 2024',
  labResultDisplayDateText: 'September 5, 2024',
  laboratoryName: 'Alberta Precision Laboratories',
  orderedByName: 'Dr. Kim Nguyen',
  orderByType: 'Pediatrics',
  source: 'APL', clientId: 301, thingId: 'demo-ch-thing-301', versionStamp: 'v1',
  isReadOnly: true, isItemRestricted: false, customData: [],
  group: [
    {
      groupName: 'Complete Blood Count',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-09-05T10:00:00', whenDate: '2024-09-05', displayDate: 'Sep 5, 2024',
          name: 'Hemoglobin', index: 0, eduContent: '', resultUniqueId: 'demo-ch-r-001',
          clinicalCode: { text: 'HGB', code: [{ value: '718-7', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '128', value: '128', unitText: 'g/L', rangeDisplayText: '115 - 145 (pediatric)' },
        },
        {
          when: '2024-09-05T10:00:00', whenDate: '2024-09-05', displayDate: 'Sep 5, 2024',
          name: 'Ferritin', index: 1, eduContent: '', resultUniqueId: 'demo-ch-r-002',
          clinicalCode: { text: 'FERR', code: [{ value: '2276-4', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '32', value: '32', unitText: 'ug/L', rangeDisplayText: '12 - 80 (pediatric)' },
        },
      ],
    },
    {
      groupName: 'Pre-Stimulant Baseline',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-09-05T10:00:00', whenDate: '2024-09-05', displayDate: 'Sep 5, 2024',
          name: 'TSH', index: 0, eduContent: '', resultUniqueId: 'demo-ch-r-003',
          clinicalCode: { text: 'TSH', code: [{ value: '3016-3', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '2.1', value: '2.1', unitText: 'mIU/L', rangeDisplayText: '0.50 - 4.30 (pediatric)' },
        },
      ],
    },
  ],
});

// Aug 2022 — allergy workup (peanut IgE + Ara h 2)
childLabResults.push({
  labTestDate: { date: 28, month: 7, year: 2022, hour: 11, minute: 0, second: 0, hasTimePart: true },
  labResultDate: '2022-08-28T11:00:00',
  labResultDisplayDate: 'Aug 28, 2022',
  labResultDisplayDateText: 'August 28, 2022',
  laboratoryName: 'Alberta Precision Laboratories',
  orderedByName: 'Dr. Pooja Sharma',
  orderByType: 'Allergy & Immunology',
  source: 'APL', clientId: 302, thingId: 'demo-ch-thing-302', versionStamp: 'v1',
  isReadOnly: true, isItemRestricted: false, customData: [],
  group: [
    {
      groupName: 'Component-Resolved Allergy Testing',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2022-08-28T11:00:00', whenDate: '2022-08-28', displayDate: 'Aug 28, 2022',
          name: 'Peanut-specific IgE', index: 0, eduContent: '', resultUniqueId: 'demo-ch-r-101',
          clinicalCode: { text: 'PNUTIGE', code: [{ value: '6206-7', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '18', value: '18', unitText: 'kUA/L', rangeDisplayText: '< 0.35' },
        },
        {
          when: '2022-08-28T11:00:00', whenDate: '2022-08-28', displayDate: 'Aug 28, 2022',
          name: 'Ara h 2-specific IgE (peanut component)', index: 1, eduContent: '', resultUniqueId: 'demo-ch-r-102',
          clinicalCode: { text: 'ARAH2', code: [{ value: '63452-7', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '12', value: '12', unitText: 'kUA/L', rangeDisplayText: '< 0.35 (\u22650.35 highly predictive of clinical reactivity)' },
        },
      ],
    },
  ],
});

const childImmunizations: ImmunizationRecord[] = [
  // ---- Routine childhood schedule (Alberta) ----
  {
    itemKey: { thingId: 'demo-ch-imm-001', versionStamp: 'v1' },
    effectiveDate: { date: 14, month: 6, year: 2017, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'DTaP-IPV-Hib + Rotavirus + PCV13 (2-month series)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'July 14, 2017' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Multiple' },
    ],
  },
  {
    itemKey: { thingId: 'demo-ch-imm-002', versionStamp: 'v1' },
    effectiveDate: { date: 14, month: 8, year: 2017, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'DTaP-IPV-Hib + Rotavirus + PCV13 (4-month series)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'September 14, 2017' },
    ],
  },
  {
    itemKey: { thingId: 'demo-ch-imm-003', versionStamp: 'v1' },
    effectiveDate: { date: 14, month: 10, year: 2017, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'DTaP-IPV-Hib + PCV13 (6-month series)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'November 14, 2017' },
    ],
  },
  {
    itemKey: { thingId: 'demo-ch-imm-004', versionStamp: 'v1' },
    effectiveDate: { date: 14, month: 4, year: 2018, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'MMR + Varicella + Men-C-C (12-month)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'May 14, 2018' },
    ],
  },
  {
    itemKey: { thingId: 'demo-ch-imm-005', versionStamp: 'v1' },
    effectiveDate: { date: 14, month: 10, year: 2018, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'DTaP-IPV-Hib + Hep B (18-month)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'November 14, 2018' },
    ],
  },
  {
    itemKey: { thingId: 'demo-ch-imm-006', versionStamp: 'v1' },
    effectiveDate: { date: 8, month: 8, year: 2022, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'dTap-IPV + MMR booster + Varicella booster (4-6 yr / Kindergarten)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'September 8, 2022' },
    ],
  },
  {
    itemKey: { thingId: 'demo-ch-imm-007', versionStamp: 'v1' },
    effectiveDate: { date: 4, month: 10, year: 2024, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Influenza vaccine (2024-2025, quadrivalent inactivated, pediatric formulation)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'November 4, 2024' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'GSK' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-CH-FLU-2024' },
    ],
  },
  {
    itemKey: { thingId: 'demo-ch-imm-008', versionStamp: 'v1' },
    effectiveDate: { date: 4, month: 10, year: 2024, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'COVID-19 mRNA Vaccine (pediatric XBB.1.5 booster)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'November 4, 2024' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Pfizer-BioNTech (pediatric formulation)' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-CH-COV-2024' },
    ],
  },
];

const childMedications: unknown[] = [
  { name: 'Fluticasone HFA (Flovent)', strength: '110 mcg/actuation', form: 'Metered-dose inhaler with spacer', route: 'Inhalation', frequency: '2 puffs twice daily',
    prescribedBy: 'Dr. Kim Nguyen', prescribedDate: '2024-10-14', status: 'Active (stepped up from 55 mcg after ED visit)', note: DEMO_NOTE },
  { name: 'Salbutamol (Ventolin / albuterol)', strength: '100 mcg/actuation', form: 'Metered-dose inhaler with spacer', route: 'Inhalation', frequency: '2 puffs every 4-6 hours as needed for wheeze; 2 puffs 15 min before exercise if symptomatic',
    prescribedBy: 'Dr. Kim Nguyen', prescribedDate: '2021-06-08', status: 'Active', note: DEMO_NOTE },
  { name: 'Methylphenidate ER (Concerta)', strength: '18 mg', form: 'Extended-release tablet', route: 'Oral', frequency: 'Once daily in the morning with breakfast',
    prescribedBy: 'Dr. Kim Nguyen', prescribedDate: '2024-09-05', status: 'Active (titrated from 9 mg)', note: DEMO_NOTE },
  { name: 'Cetirizine (Reactine)', strength: '5 mg', form: 'Chewable tablet', route: 'Oral', frequency: 'Once daily during pollen season (Mar-Jun, Sep)',
    prescribedBy: 'Dr. Pooja Sharma', prescribedDate: '2022-08-28', status: 'Active (seasonal)', note: DEMO_NOTE },
  { name: 'Epinephrine auto-injector (EpiPen Jr)', strength: '0.15 mg', form: 'Auto-injector (2 carried: 1 with patient/school, 1 at home)', route: 'Intramuscular', frequency: 'Emergency use only for suspected anaphylaxis from peanut exposure',
    prescribedBy: 'Dr. Pooja Sharma', prescribedDate: '2019-04-22', status: 'Active (switch to adult 0.3 mg at 25 kg)', note: DEMO_NOTE },
  { name: 'Amoxicillin', strength: '400 mg/5 mL suspension', form: 'Oral suspension', route: 'Oral', frequency: '5 mL three times daily \u00d7 10 days',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2024-10-27',
    status: 'Completed Nov 5, 2024 (strep throat \u2014 fully resolved; patient tolerated penicillin family despite maternal PCN allergy)',
    note: DEMO_NOTE },
  { name: 'Dexamethasone (PO)', strength: '6 mg', form: 'Tablet', route: 'Oral', frequency: '1 tablet daily \u00d7 2 doses (1 in ED, 1 home dose next day)',
    prescribedBy: 'Children\u2019s Hospital ED', prescribedDate: '2024-10-14', status: 'Completed Oct 15, 2024', note: DEMO_NOTE },
];

const childDiagnosticImaging: unknown[] = [
  {
    labTestDate: { date: 14, month: 9, year: 2024, hour: 22, minute: 30, second: 0, hasTimePart: true },
    labResultDisplayDateText: 'October 14, 2024',
    laboratoryName: 'Alberta Children\u2019s Hospital \u2014 ED Radiology',
    orderedByName: 'Dr. Jacqueline Roy (ED Pediatrics)',
    source: 'AHS',
    thingId: 'demo-ch-img-001',
    group: [
      {
        groupName: 'Chest X-ray (2-view)',
        labOrderStatus: 'Final',
        results: [
          {
            name: 'Chest X-ray Report',
            values: {
              displayValue: 'Lungs are clear. No focal consolidation, pneumothorax, or effusion. Cardiomediastinal silhouette normal. Bony thorax intact. Findings consistent with viral asthma exacerbation \u2014 no superimposed bacterial pneumonia.',
              unitText: '',
            },
            displayDate: 'Oct 14, 2024',
          },
        ],
        attachment: [],
      },
    ],
  },
  {
    labTestDate: { date: 30, month: 2, year: 2024, hour: 14, minute: 0, second: 0, hasTimePart: true },
    labResultDisplayDateText: 'March 30, 2024',
    laboratoryName: 'Pediatric Cardiology',
    orderedByName: 'Dr. Kim Nguyen',
    source: 'AHS',
    thingId: 'demo-ch-img-002',
    group: [
      {
        groupName: '12-Lead ECG (Pre-Stimulant Baseline)',
        labOrderStatus: 'Final',
        results: [
          {
            name: 'ECG Interpretation',
            values: {
              displayValue: 'Normal sinus rhythm, rate 92. Normal axis. No QT prolongation (QTc 405 ms). No conduction abnormalities. Cleared for stimulant therapy.',
              unitText: '',
            },
            displayDate: 'Mar 30, 2024',
          },
        ],
        attachment: [],
      },
    ],
  },
];

const childHeightWeight = {
  height: [
    {
      effectiveDate: { date: 5, month: 8, year: 2024 },
      values: [{ displayString: '122', name: 'Height (cm)' }, { displayString: '60th', name: 'Percentile' }],
      note: DEMO_NOTE,
    },
    {
      effectiveDate: { date: 4, month: 10, year: 2024 },
      values: [{ displayString: '122', name: 'Height (cm)' }],
      note: DEMO_NOTE,
    },
  ],
  weight: [
    {
      effectiveDate: { date: 5, month: 8, year: 2024 },
      values: [{ displayString: '24', name: 'Weight (kg)' }, { displayString: '55th', name: 'Percentile' }],
      note: DEMO_NOTE,
    },
    {
      effectiveDate: { date: 4, month: 10, year: 2024 },
      values: [{ displayString: '24', name: 'Weight (kg)' }],
      note: DEMO_NOTE,
    },
  ],
  bmi: [
    {
      effectiveDate: { date: 5, month: 8, year: 2024 },
      values: [{ displayString: '16.1', name: 'BMI' }, { displayString: '50th', name: 'BMI Percentile (normal)' }],
      note: DEMO_NOTE,
    },
  ],
};

const childBloodPressure = [
  {
    effectiveDate: { date: 5, month: 8, year: 2024, hour: 10, minute: 0, second: 0 },
    values: [
      { displayString: '98', name: 'Systolic (mmHg)' },
      { displayString: '62', name: 'Diastolic (mmHg)' },
      { displayString: '92', name: 'Pulse (bpm)' },
    ],
    note: DEMO_NOTE,
  },
];

const childVitalSigns = [
  {
    effectiveDate: { date: 14, month: 9, year: 2024, hour: 22, minute: 30, second: 0 },
    values: [
      { displayString: '128 (tachycardia, asthma exacerbation)', name: 'Heart rate (bpm)' },
      { displayString: '37.8 (low-grade fever)', name: 'Temperature (\u00b0C)' },
      { displayString: '32 (tachypnea, mild work of breathing)', name: 'Respiratory rate (breaths/min)' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 5, month: 8, year: 2024, hour: 10, minute: 0, second: 0 },
    values: [
      { displayString: '92', name: 'Heart rate (bpm)' },
      { displayString: '36.7', name: 'Temperature (\u00b0C)' },
      { displayString: '20', name: 'Respiratory rate (breaths/min)' },
    ],
    note: DEMO_NOTE,
  },
];

const childBloodOxygen = [
  {
    effectiveDate: { date: 14, month: 9, year: 2024, hour: 22, minute: 30, second: 0 },
    values: [{ displayString: '91 (on room air at triage; improved to 96 post-nebs)', name: 'SpO2 (%)' }],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 5, month: 8, year: 2024, hour: 10, minute: 0, second: 0 },
    values: [{ displayString: '99', name: 'SpO2 (%)' }],
    note: DEMO_NOTE,
  },
];

const childExercise = [
  {
    effectiveDate: { date: 10, month: 10, year: 2024, hour: 16, minute: 0, second: 0 },
    exerciseValues: [
      { name: 'Activity', displayString: 'Soccer practice' },
      { name: 'Duration', displayString: '60 min' },
      { name: 'Notes', displayString: 'Pre-treated with albuterol; tolerated well' },
    ],
    durationUnit: 'min',
    distanceUnit: 'km',
    calorieUnit: 'kcal',
    note: DEMO_NOTE,
  },
];

const childReferrals = [
  {
    referralDate: '2024-03-22',
    referringProvider: 'Dr. Kim Nguyen (Pediatrics)',
    referredTo: 'School IPP team \u2014 Westbrook Elementary',
    reason: 'ADHD predominantly inattentive \u2014 individualized program plan support',
    status: 'Active',
    note: DEMO_NOTE,
  },
  {
    referralDate: '2022-06-15',
    referringProvider: 'Dr. Kim Nguyen (Pediatrics)',
    referredTo: 'Dr. Pooja Sharma, Allergy & Immunology',
    reason: 'Suspected peanut allergy (mild swelling after first known exposure age 2); skin prick + IgE workup',
    status: 'Completed (Aug 28, 2022) \u2014 ongoing annual follow-up',
    note: DEMO_NOTE,
  },
];

const childProcedures = [
  {
    procedureDate: '2024-10-14',
    procedureName: 'Albuterol nebulizer treatments \u00d7 3 + PO dexamethasone',
    location: 'Alberta Children\u2019s Hospital ED',
    provider: 'Dr. Jacqueline Roy',
    note: DEMO_NOTE,
  },
];

const childSleep = [
  {
    effectiveDate: { date: 10, month: 10, year: 2024, hour: 21, minute: 0, second: 0 },
    values: [
      { displayString: '9h 30m', name: 'Total sleep' },
      { displayString: 'Falling asleep faster than before Concerta increase; no early waking', name: 'Notes' },
    ],
    note: DEMO_NOTE,
  },
];

const childDietaryIntake = [
  {
    effectiveDate: { date: 10, month: 10, year: 2024, hour: 12, minute: 0, second: 0 },
    values: [
      { displayString: 'Lunch eaten at school: cheese sandwich, apple, milk. Appetite slightly reduced since Concerta increase \u2014 parent monitoring.', name: 'Food log' },
    ],
    note: DEMO_NOTE,
  },
];

const childPeakFlow = [
  {
    effectiveDate: { date: 11, month: 9, year: 2024, hour: 19, minute: 0, second: 0 },
    values: [{ displayString: '180', name: 'Peak Flow (L/min) \u2014 green zone for height' }],
    note: DEMO_NOTE,
  },
];

const childWaistCircumference: unknown[] = [];

const childSymptomJournal = [
  {
    effectiveDate: { date: 16, month: 9, year: 2024, hour: 22, minute: 0, second: 0 },
    values: [
      { displayString: 'Coughing more at night since ED visit. Used albuterol twice today.', name: 'Parent note' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 14, month: 9, year: 2024, hour: 21, minute: 0, second: 0 },
    values: [
      { displayString: 'Cough started this morning after cold symptoms 2 days ago. Wheezy and short of breath by dinner. Albuterol not lasting. Bringing to ED.', name: 'Parent note' },
    ],
    note: DEMO_NOTE,
  },
];

// ============================================================================
// MyChart data
// ============================================================================

const childMyChartAllergies = {
  patientName: 'Liam User',
  allergies: [
    {
      name: 'Peanut',
      reaction: 'Anaphylaxis (lip and tongue swelling, urticaria, vomiting age 2). Confirmed by elevated Ara h 2-specific IgE.',
      severity: 'Severe (anaphylaxis)',
      noted: '2019-04-22',
      source: 'Diagnosed by Dr. Sharma after first known exposure',
      note: DEMO_NOTE,
    },
    {
      name: 'Tree pollen (alder, birch)',
      reaction: 'Sneezing, nasal congestion, watery eyes (seasonal Mar-Jun)',
      severity: 'Moderate',
      noted: '2022-08-28',
      source: 'Skin prick test positive',
      note: DEMO_NOTE,
    },
    {
      name: 'Cat dander',
      reaction: 'Sneezing, watery eyes on direct exposure',
      severity: 'Mild-Moderate',
      noted: '2022-08-28',
      source: 'Skin prick test positive (home is cat-free)',
      note: DEMO_NOTE,
    },
    {
      name: 'No known drug allergies (penicillin tolerated \u2014 do not inherit from mother)',
      reaction: '',
      severity: '',
      noted: '2024-10-27 (amoxicillin course tolerated for strep)',
      source: 'Confirmed by clinical exposure',
      note: DEMO_NOTE,
    },
  ],
};

const childMyChartHealthIssues = {
  patientName: 'Liam User',
  healthIssues: [
    { name: 'Asthma, mild persistent', icd10: 'J45.30', noted: '2021-06-08', status: 'Active', note: DEMO_NOTE },
    { name: 'Attention-deficit/hyperactivity disorder, predominantly inattentive type', icd10: 'F90.0', noted: '2024-03-22', status: 'Active', note: DEMO_NOTE },
    { name: 'Peanut allergy (anaphylaxis risk)', icd10: 'Z91.010', noted: '2019-04-22', status: 'Active', note: DEMO_NOTE },
    { name: 'Allergic rhinitis (seasonal, pollen + cat)', icd10: 'J30.1', noted: '2022-08-28', status: 'Active', note: DEMO_NOTE },
    { name: 'Streptococcal pharyngitis', icd10: 'J02.0', noted: '2024-10-27', status: 'Resolved (treated with amoxicillin)', note: DEMO_NOTE },
  ],
};

const childMyChartHealthSummary = {
  patientName: 'Liam User',
  summary: 'Patient: Liam User (DOB 2017-05-14, age 7). Active issues: mild persistent asthma (on fluticasone 110 BID + albuterol PRN, recently stepped up after Oct 14, 2024 ED visit), ADHD predominantly inattentive (on Concerta 18 mg AM, recently titrated from 9 mg), peanut allergy (anaphylaxis risk, EpiPen Jr carried), seasonal allergic rhinitis (tree pollen + cat). Recent strep throat fully resolved (amoxicillin Oct 27 \u2013 Nov 5, 2024) \u2014 tolerated penicillin family despite maternal PCN allergy. Growth on track: 122 cm / 24 kg / BMI 16.1 (50-60th %iles). Immunizations current per Alberta schedule plus 2024-2025 flu + COVID; HPV scheduled grade 5. Parent (Demo User) holds full custodial proxy.',
  note: DEMO_NOTE,
};

const childMyChartUpcomingVisits = [
  {
    appointmentId: 'demo-ch-appt-001',
    dateTime: '2025-02-04T15:30:00',
    provider: 'Dr. Kim Nguyen',
    specialty: 'Pediatrics',
    department: 'Sunridge Pediatric Clinic',
    visitType: 'Asthma + ADHD follow-up (3-month combined visit)',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-ch-appt-002',
    dateTime: '2025-04-22T10:00:00',
    provider: 'Dr. Pooja Sharma',
    specialty: 'Allergy & Immunology',
    department: 'Allergy Clinic',
    visitType: 'Annual allergy review (peanut + environmental); update school documentation',
    note: DEMO_NOTE,
  },
];

const childMyChartPastVisits = [
  {
    appointmentId: 'demo-ch-past-001',
    dateTime: '2024-11-04T16:00:00',
    provider: 'Dr. Kim Nguyen',
    specialty: 'Pediatrics',
    department: 'Sunridge Pediatric Clinic',
    visitType: 'Post-ED asthma follow-up + flu/COVID vaccines',
    summary: 'Three-week follow-up after Oct 14 ED visit for viral asthma exacerbation. Continuing fluticasone 110 BID (stepped up from 55). Reviewed spacer technique with parent and patient. Spirometry deferred (uncooperative at this age). Asthma Action Plan updated. Inactivated flu vaccine + pediatric COVID booster given same visit. Next combined asthma/ADHD review Feb 2025.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-ch-past-002',
    dateTime: '2024-10-27T11:00:00',
    provider: 'Dr. Sarah Mitchell',
    specialty: 'Family Medicine (walk-in)',
    department: 'Sunnyside Family Clinic',
    visitType: 'Sore throat \u2014 strep test positive',
    summary: 'Three-day history of fever and sore throat. Rapid strep test positive. Tonsillar exudate present. Started amoxicillin 400 mg/5 mL, 5 mL TID \u00d7 10 days. Confirmed no penicillin allergy (mother has documented PCN allergy but patient has tolerated PCN family previously). Return if no improvement in 48 hours or new rash.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-ch-past-003',
    dateTime: '2024-10-14T22:30:00',
    provider: 'Dr. Jacqueline Roy',
    specialty: 'Emergency Medicine (Pediatrics)',
    department: 'Alberta Children\u2019s Hospital ED',
    visitType: 'Asthma exacerbation (viral trigger)',
    summary: 'Presented with 2-day cough/cold symptoms progressing to wheeze and shortness of breath. SpO2 91% on arrival, RR 32, mild retractions. Treated with albuterol nebs \u00d7 3 (improved to SpO2 96%) plus PO dexamethasone 6 mg. CXR clear (no pneumonia). Discharged home on dexamethasone 6 mg \u00d7 1 more dose tomorrow. Stepped up fluticasone from 55 to 110 mcg BID. Pediatric follow-up in 3 weeks. Parent counselled on AAP yellow/red zone triggers.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-ch-past-004',
    dateTime: '2024-09-05T10:00:00',
    provider: 'Dr. Kim Nguyen',
    specialty: 'Pediatrics',
    department: 'Sunridge Pediatric Clinic',
    visitType: 'Annual well-child + back-to-school + ADHD titration',
    summary: 'Annual well-child visit. Growth on track (122 cm / 60th %ile, 24 kg / 55th %ile, BMI 16.1 normal). Vision screen 20/20 both eyes. Hearing screen pass. Discussed ADHD med titration based on parent + teacher Vanderbilt forms \u2014 increasing Concerta from 9 to 18 mg. CBC + ferritin + TSH ordered as baseline. Pre-stimulant ECG from March still valid. Asthma stable on fluticasone 55 BID at this visit.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-ch-past-005',
    dateTime: '2024-03-22T14:00:00',
    provider: 'Dr. Kim Nguyen',
    specialty: 'Pediatrics',
    department: 'Sunridge Pediatric Clinic',
    visitType: 'ADHD assessment (initial)',
    summary: 'Parent + Grade 1 teacher Vanderbilt scales completed and reviewed. Meets criteria for ADHD, predominantly inattentive type. Pre-stimulant baseline: blood pressure, height, weight documented. Family history of cardiac sudden death negative \u2014 ECG ordered as standard pre-stimulant clearance. Will start methylphenidate ER 9 mg with weekly check-in calls. School IPP referral placed.',
    note: DEMO_NOTE,
  },
];

const childMyChartMessages = [
  {
    messageId: 'demo-ch-msg-001',
    from: 'Demo User (parent)',
    to: 'Dr. Kim Nguyen, Pediatrics',
    subject: 'Liam still coughing at night after ED visit',
    sentDate: '2024-10-17T20:00:00',
    body: 'Hi Dr. Nguyen \u2014 Liam was discharged from ED 3 days ago after the asthma flare. He\u2019s still coughing at night and using the rescue inhaler twice a day. Should we be using albuterol more often, or come in? \u2014 Demo',
    status: 'Read',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-ch-msg-002',
    from: 'Dr. Kim Nguyen, Pediatrics',
    to: 'Demo User (parent)',
    subject: 'RE: Liam still coughing at night after ED visit',
    sentDate: '2024-10-18T08:30:00',
    body: 'Hi Demo \u2014 night cough is common for several days after a viral asthma flare. Continue albuterol q4h while symptomatic and complete the dex dose tomorrow. If by Saturday his cough is not better or he is working harder to breathe (sucking in between his ribs, nostrils flaring, can\u2019t talk in full sentences), bring him in or back to the ED. Otherwise see you at the Nov 4 follow-up. \u2014 Dr. Nguyen',
    status: 'Read',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-ch-msg-003',
    from: 'Demo User (parent)',
    to: 'Dr. Pooja Sharma, Allergy',
    subject: 'Updated EpiPen Rx for school form',
    sentDate: '2024-09-12T13:30:00',
    body: 'Hi Dr. Sharma \u2014 Liam\u2019s school is asking for updated allergy paperwork. Can you confirm the EpiPen dosing for our records? He\u2019s now 24 kg. \u2014 Demo',
    status: 'Read',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-ch-msg-004',
    from: 'Dr. Pooja Sharma, Allergy',
    to: 'Demo User (parent)',
    subject: 'RE: Updated EpiPen Rx for school form',
    sentDate: '2024-09-13T10:00:00',
    body: 'Stay on EpiPen Jr 0.15 mg until he reaches 25 kg, then switch to the adult EpiPen 0.3 mg. I\u2019ve updated the school anaphylaxis action plan and faxed it to Westbrook Elementary today. Keep two carriers \u2014 one with him/school nurse, one at home. \u2014 Dr. Sharma',
    status: 'Read',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-ch-msg-005',
    from: 'Demo User (parent)',
    to: 'Dr. Kim Nguyen, Pediatrics',
    subject: 'Concerta 9 mg \u2014 afternoons still tough',
    sentDate: '2024-03-25T19:30:00',
    body: 'Hi Dr. Nguyen \u2014 Concerta 9 mg has helped with focus in the morning but teacher says afternoons are still hard. Should we bump up the dose? \u2014 Demo',
    status: 'Read',
    note: DEMO_NOTE,
  },
];

const childMyChartCareTeam = {
  patientName: 'Liam User',
  careTeam: [
    { name: 'Dr. Kim Nguyen', role: 'Pediatrician (primary)', phone: '(403) 555-0144', clinic: 'Sunridge Pediatric Clinic', note: DEMO_NOTE },
    { name: 'Dr. Pooja Sharma', role: 'Allergist & Immunologist', phone: '(403) 555-0256', clinic: 'Allergy Clinic', note: DEMO_NOTE },
    { name: 'Dr. Sarah Mitchell', role: 'Family Physician (shared family practice)', phone: '(403) 555-0101', clinic: 'Sunnyside Family Clinic', note: DEMO_NOTE },
    { name: 'Maria Cortez, RN', role: 'School Nurse', phone: '(403) 555-0367', clinic: 'Westbrook Elementary', note: DEMO_NOTE },
  ],
};

const childMyChartImmunizations = childImmunizations.map((imm, i) => ({
  immunizationId: 'demo-ch-mc-imm-' + (i + 1),
  name: imm.values?.[0]?.displayString,
  dateAdministered: imm.values?.[1]?.displayString,
  manufacturer: imm.values?.[2]?.displayString,
  note: DEMO_NOTE,
}));

const childMyChartMedications = childMedications.map((m, i) => ({
  medicationId: 'demo-ch-mc-med-' + (i + 1),
  ...(m as Record<string, unknown>),
  note: DEMO_NOTE,
}));

const childMyChartTestResults = [
  {
    resultId: 'demo-ch-tr-001',
    name: 'Chest X-ray (ED, asthma exacerbation)',
    collectedDate: '2024-10-14',
    value: 'Clear lungs, no pneumonia, no pneumothorax \u2014 viral asthma exacerbation only',
    orderedBy: 'Dr. Jacqueline Roy (ED)',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-ch-tr-002',
    name: 'Pre-stimulant ECG',
    collectedDate: '2024-03-30',
    value: 'Normal sinus rhythm, QTc 405 ms \u2014 cleared for stimulant therapy',
    orderedBy: 'Dr. Kim Nguyen',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-ch-tr-003',
    name: 'Baseline labs (pre-stimulant + annual)',
    collectedDate: '2024-09-05',
    value: 'CBC normal, Ferritin 32, TSH 2.1 \u2014 all within pediatric reference ranges',
    orderedBy: 'Dr. Kim Nguyen',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-ch-tr-004',
    name: 'Peanut + Ara h 2 specific IgE',
    collectedDate: '2022-08-28',
    value: 'Peanut IgE 18 kUA/L (high), Ara h 2 IgE 12 kUA/L (highly predictive of clinical reactivity) \u2014 confirms true peanut allergy',
    orderedBy: 'Dr. Pooja Sharma',
    note: DEMO_NOTE,
  },
];

// ---------------------------------------------------------------------------
// Mock MHR Client (Liam's data)
// ---------------------------------------------------------------------------

function createChildMHRClient(): MHRClient {
  return {
    getSessionStatus: async () => childSessionStatus,
    getUser: async () => childUserProfile,
    getLabResults: async () => childLabResults,
    getImmunizations: async () => childImmunizations,
    getMedications: async () => childMedications,
    getDiagnosticImaging: async () => childDiagnosticImaging,
    getHeightWeight: async () => childHeightWeight,
    getVitalSigns: async () => childVitalSigns,
    getBloodOxygen: async () => childBloodOxygen,
    getBloodPressure: async () => childBloodPressure,
    getExercise: async () => childExercise,
    getReferrals: async () => childReferrals,
    getProcedures: async () => childProcedures,
    getBloodGlucose: async () => [],
    getSleep: async () => childSleep,
    getDietaryIntake: async () => childDietaryIntake,
    getInsulin: async () => ({ injections: [], usage: [] }),
    getPeakFlow: async () => childPeakFlow,
    getWaistCircumference: async () => childWaistCircumference,
    getSymptomJournal: async () => childSymptomJournal,
    downloadAttachment: async () => ({
      buffer: Buffer.from(`${DEMO_NOTE} \u2014 no real attachment in demo mode.`),
      contentType: 'text/plain',
    }),
  } as unknown as MHRClient;
}

// ---------------------------------------------------------------------------
// Mock MyChart Client (Liam's data)
// ---------------------------------------------------------------------------

function createChildMyChartClient(): MyChartClient {
  return {
    getUpcomingVisits: async () => childMyChartUpcomingVisits,
    getPastVisits: async () => childMyChartPastVisits,
    getVisitDetails: async () => ({
      ...childMyChartPastVisits[0],
      Details: childMyChartPastVisits[0]?.summary,
      note: DEMO_NOTE,
    }),
    getHealthSummary: async () => childMyChartHealthSummary,
    getAllergies: async () => childMyChartAllergies,
    getHealthIssues: async () => childMyChartHealthIssues,
    getCareTeam: async () => childMyChartCareTeam,
    getConversationList: async () => childMyChartMessages,
    getConversationDetails: async () => ({
      ID: 'demo-ch-msg-001',
      Subject: 'Liam still coughing at night after ED visit',
      Messages: childMyChartMessages.slice(0, 2).map((m) => ({
        SenderName: m.from,
        Date: m.sentDate,
        Body: m.body,
      })),
      note: DEMO_NOTE,
    }),
    getMedicalHistory: async () => ({
      History: [
        {
          Condition: 'Birth history \u2014 full-term vaginal delivery',
          Date: '2017-05-14',
          Type: 'Birth',
          Details: 'Born at Foothills Medical Centre, mother Sarah User. Uncomplicated. APGAR 9/9. Birth weight 3.4 kg. No NICU stay.',
          note: DEMO_NOTE,
        },
        {
          Condition: 'First peanut exposure reaction (age 2)',
          Date: '2019-04-22',
          Type: 'Allergic',
          Details: 'Lip and tongue swelling with urticaria after small bite of peanut butter cookie. Treated in ED. Subsequent IgE workup (2022) confirmed true peanut allergy via Ara h 2 specific IgE.',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Family History: Type 2 Diabetes + Hypertension + Hyperlipidemia',
          Date: null,
          Type: 'Family (paternal)',
          Details: 'Father (Demo User) \u2014 T2D, HTN, hyperlipidemia. Paternal grandmother (Margaret) \u2014 T2D, AFib, HFpEF, mild dementia, CKD3a',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Family History: Hashimoto thyroiditis + GAD + migraine',
          Date: null,
          Type: 'Family (maternal)',
          Details: 'Mother (Sarah User) \u2014 Hashimoto hypothyroidism, GAD, migraine with aura, history of PPD. Maternal grandmother \u2014 breast cancer (age 58).',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getDocuments: async () => ({
      Documents: [
        {
          DocumentID: 'demo-ch-doc-001',
          DocumentName: 'Asthma Action Plan (AAP) \u2014 Updated',
          Date: '2024-11-04',
          Provider: 'Dr. Kim Nguyen',
          Department: 'Pediatrics',
          Type: 'Care Plan',
          note: DEMO_NOTE,
        },
        {
          DocumentID: 'demo-ch-doc-002',
          DocumentName: 'Anaphylaxis Action Plan (school)',
          Date: '2024-09-13',
          Provider: 'Dr. Pooja Sharma',
          Department: 'Allergy',
          Type: 'School Form',
          note: DEMO_NOTE,
        },
        {
          DocumentID: 'demo-ch-doc-003',
          DocumentName: 'ED Discharge Summary \u2014 Asthma exacerbation',
          Date: '2024-10-14',
          Provider: 'Dr. Jacqueline Roy',
          Department: 'Alberta Children\u2019s Hospital ED',
          Type: 'Discharge Summary',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getDocumentDetails: async () => ({
      DocumentName: 'Asthma Action Plan (AAP) \u2014 Updated',
      Date: '2024-11-04',
      Provider: 'Dr. Kim Nguyen',
      Content: 'GREEN ZONE (no symptoms, peak flow \u226580% personal best): Fluticasone 110 mcg, 2 puffs BID with spacer. No rescue needed. YELLOW ZONE (cough, wheeze, peak flow 50-80%, mild shortness of breath): Continue fluticasone, add albuterol 100 mcg, 2 puffs every 4 hours via spacer. Call office if no improvement in 24 hours. RED ZONE (severe shortness of breath, blue lips, peak flow <50%, cannot speak in full sentences): Albuterol 2 puffs every 20 minutes \u00d7 3 doses while calling 911. If recent peanut exposure suspected, use EpiPen Jr 0.15 mg IM in mid-outer thigh THEN call 911.',
      note: DEMO_NOTE,
    }),
    getUpcomingOrders: async () => ({
      Orders: [
        {
          OrderName: 'Vision + hearing screen (annual school)',
          OrderDate: '2025-09-01',
          Status: 'Scheduled',
          Instructions: 'Done at well-child visit \u2014 no preparation needed',
          Provider: 'Dr. Kim Nguyen',
          note: DEMO_NOTE,
        },
        {
          OrderName: 'HPV vaccine (grade 5 school program)',
          OrderDate: '2027-09-01',
          Status: 'Pending (eligibility starts grade 5)',
          Instructions: 'Will be offered via Alberta school immunization program when in grade 5',
          Provider: 'AHS School Immunization Program',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getTestResultsList: async () => childMyChartTestResults,
    getTestResultDetails: async () => ({
      OrderName: 'Pre-stimulant baseline + annual labs',
      OrderDate: '2024-09-05',
      Status: 'Final',
      Components: [
        { Name: 'Hemoglobin', Value: '128', Units: 'g/L', Range: '115 - 145 (pediatric)', Flag: '' },
        { Name: 'Ferritin', Value: '32', Units: 'ug/L', Range: '12 - 80 (pediatric)', Flag: '' },
        { Name: 'TSH', Value: '2.1', Units: 'mIU/L', Range: '0.50 - 4.30 (pediatric)', Flag: '' },
      ],
      note: DEMO_NOTE,
    }),
    getReportContent: async () => ({ ReportContent: 'No report content available in demo mode.', note: DEMO_NOTE }),
    getFamilyTree: async () => ({
      FamilyMembers: [
        { Relationship: 'Father (Demo User)', Conditions: ['Type 2 Diabetes', 'Hypertension', 'Hyperlipidemia'], Deceased: false, note: DEMO_NOTE },
        { Relationship: 'Mother (Sarah User)', Conditions: ['Hashimoto hypothyroidism', 'GAD', 'Migraine with aura', 'History of PPD'], Deceased: false, note: DEMO_NOTE },
        { Relationship: 'Paternal grandmother (Margaret User)', Conditions: ['T2D', 'AFib', 'HFpEF', 'Mild dementia', 'CKD3a'], Deceased: false, note: DEMO_NOTE },
        { Relationship: 'Maternal grandmother', Conditions: ['Breast cancer (diagnosed age 58, in remission)'], Deceased: false, note: DEMO_NOTE },
        { Relationship: 'Maternal grandfather', Conditions: ['Hypertension', 'T2D'], Deceased: false, note: DEMO_NOTE },
      ],
      note: DEMO_NOTE,
    }),
    getPatientGoals: async () => ({
      Goals: [
        {
          GoalName: 'Asthma control \u2014 stay in green zone',
          Target: 'Zero rescue inhaler use most days; no ED visits',
          Current: 'Stepped up to fluticasone 110 BID after Oct 2024 exacerbation',
          Status: 'In Progress',
          StartDate: '2024-10-14',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'School performance with ADHD meds',
          Target: 'Sustained focus in afternoon classes per teacher feedback',
          Current: 'Concerta 18 mg with school IPP support \u2014 improving',
          Status: 'In Progress',
          StartDate: '2024-09-05',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Peanut avoidance + emergency preparedness',
          Target: 'Zero accidental exposures; EpiPen always within 5 minutes',
          Current: 'EpiPen Jr carried at school and home; school nurse trained',
          Status: 'On track',
          StartDate: '2019-04-22',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getCareTeamGoals: async () => ({
      Goals: [
        {
          GoalName: 'Stimulant monitoring (CADDRA)',
          Description: 'Track height, weight, blood pressure, sleep, and appetite every 3 months on methylphenidate',
          DueDate: '2025-02-04',
          Status: 'Scheduled',
          Owner: 'Dr. Kim Nguyen',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Asthma step-down trial',
          Description: 'After 3 months of stable control on fluticasone 110, consider step-down to 55 mcg if no exacerbations',
          DueDate: '2025-02-04',
          Status: 'Pending stability',
          Owner: 'Dr. Kim Nguyen',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Annual allergy review',
          Description: 'Update EpiPen dose for weight; reconsider oral immunotherapy candidacy at age 8',
          DueDate: '2025-04-22',
          Status: 'Scheduled',
          Owner: 'Dr. Pooja Sharma',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getReferralsList: async () => ({
      Referrals: childReferrals.map((r, i) => ({
        ReferralID: 'demo-ch-mc-ref-' + (i + 1),
        Specialty: r.referredTo,
        ReferringProvider: r.referringProvider,
        Reason: r.reason,
        Status: r.status,
        DateReferred: r.referralDate,
        note: DEMO_NOTE,
      })),
      note: DEMO_NOTE,
    }),
    getReferralDetails: async () => ({
      ReferralID: 'demo-ch-mc-ref-1',
      Specialty: 'School IPP team',
      Provider: 'Westbrook Elementary',
      Reason: 'ADHD predominantly inattentive \u2014 individualized program plan support',
      Status: 'Active',
      note: DEMO_NOTE,
    }),
    getMedications: async () => childMyChartMedications,
    getImmunizations: async () => childMyChartImmunizations,
    getHistoricalResults: async () => ({
      Components: [
        {
          Name: 'Peanut-specific IgE',
          Units: 'kUA/L',
          Range: '< 0.35',
          Results: [
            { Date: '2022-08-28', Value: '18', Flag: 'High (clinically reactive)' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'Ara h 2 specific IgE',
          Units: 'kUA/L',
          Range: '< 0.35',
          Results: [
            { Date: '2022-08-28', Value: '12', Flag: 'High (highly predictive of anaphylaxis)' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'Height (cm)',
          Units: 'cm',
          Range: '50th-75th %ile for age',
          Results: [
            { Date: '2023-09-10', Value: '116' },
            { Date: '2024-09-05', Value: '122' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'Weight (kg)',
          Units: 'kg',
          Range: '50th %ile for age',
          Results: [
            { Date: '2023-09-10', Value: '22' },
            { Date: '2024-09-05', Value: '24' },
          ],
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getAppointmentRequests: async () => ({ Requests: [], note: DEMO_NOTE }),
    keepAlive: async () => {},
    downloadDocumentBinary: async () => ({
      buffer: Buffer.from(`${DEMO_NOTE} \u2014 no real document in demo mode.`),
      contentType: 'text/plain',
    }),
    getProxyAccessList: async () => ({ ProxyList: [], note: DEMO_NOTE }),
    switchToProxy: async () => {},
    switchToSelf: async () => {},
  } as unknown as MyChartClient;
}

// ---------------------------------------------------------------------------
// Persona export
// ---------------------------------------------------------------------------

export const childPersona: Persona = {
  id: 'child',
  recordId: 'rec-demo-child',
  proxyEid: 'child',
  displayName: 'Liam User',
  relationshipType: 'Child',
  isCustodian: true,
  isSelf: false,
  dob: '2017-05-14',
  age: 7,
  patientInfo: 'DOB: 2017-05-14',
  accessLevel: 'Full',
  description: '7-year-old male \u2014 mild persistent asthma (recent ED), ADHD predominantly inattentive on Concerta, peanut allergy with EpiPen, seasonal allergic rhinitis. Recent strep throat resolved. Normal growth. Immunizations current.',
  mhrClient: createChildMHRClient(),
  myChartClient: createChildMyChartClient(),
};
