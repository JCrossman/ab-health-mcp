/**
 * Demo mode mock data and clients.
 *
 * When DEMO_MODE=true, these mock clients replace the real MHR and MyChart
 * clients so Anthropic directory reviewers can explore all tools without
 * an Alberta health portal account.
 *
 * All data is clearly fictional — "Demo User" with sample records.
 *
 * Clinical narrative: 39-year-old male with Type 2 Diabetes, Hypertension,
 * Hyperlipidemia, and Vitamin D deficiency. Lab trends show worsening
 * glycemic control, elevated cardiovascular risk markers, declining kidney
 * function, and borderline liver enzymes — patterns AI can connect across
 * labs, medications, vitals, and conditions.
 */

import type { MHRClient } from '../api/mhr-client.js';
import type { MyChartClient } from '../api/mychart-client.js';
import type {
  UserProfile,
  SessionStatus,
  LabResult,
  ImmunizationRecord,
} from '../types.js';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const DEMO_NOTE = '[DEMO MODE — sample data, not a real patient]';

// ---------------------------------------------------------------------------
// MHR demo data
// ---------------------------------------------------------------------------

const demoUserProfile: UserProfile = {
  personId: 'demo-user-123',
  name: 'Demo User',
  selectedRecordId: 'rec-demo-001',
  defaultUserLanguage: 'en-CA',
  isEmergencyAccessMode: false,
  createdDateTimeUtc: '2023-01-15T00:00:00Z',
  authorizedRecords: [
    {
      id: 'rec-demo-001',
      isCustodian: true,
      displayName: 'Demo User',
      name: 'Demo User',
      relationshipType: 'Self',
      patientInfo: 'DOB: 1985-06-15',
    },
  ],
};

const demoSessionStatus: SessionStatus = {
  isSessionExpired: false,
  numberOfMilliSecondsLeftForSessionExpire: 600_000,
};

const demoLabResults: LabResult[] = [
  // --- Panel 1: Complete Blood Count (CBC) — all normal ---
  {
    labTestDate: { date: 10, month: 11, year: 2024, hour: 8, minute: 30, second: 0, hasTimePart: true },
    labResultDate: '2024-12-10T08:30:00',
    labResultDisplayDate: 'Dec 10, 2024',
    labResultDisplayDateText: 'December 10, 2024',
    laboratoryName: 'Alberta Precision Laboratories',
    orderedByName: 'Dr. Sarah Mitchell',
    orderByType: 'Family Medicine',
    source: 'APL',
    clientId: 1,
    thingId: 'demo-thing-001',
    versionStamp: 'v1',
    isReadOnly: true,
    isItemRestricted: false,
    customData: [],
    group: [
      {
        groupName: 'Complete Blood Count (CBC)',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false,
        hasGroupWithOutResult: false,
        labOrderStatus: 'Final',
        attachmentCount: 0,
        attachment: [],
        customData: [],
        results: [
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'Hemoglobin', index: 0, eduContent: '', resultUniqueId: 'demo-r-001',
            clinicalCode: { text: 'HGB', code: [{ value: '718-7', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '145', value: '145', unitText: 'g/L', rangeDisplayText: '135 - 175' },
          },
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'White Blood Cells', index: 1, eduContent: '', resultUniqueId: 'demo-r-002',
            clinicalCode: { text: 'WBC', code: [{ value: '6690-2', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '7.2', value: '7.2', unitText: '10^9/L', rangeDisplayText: '4.0 - 11.0' },
          },
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'Platelets', index: 2, eduContent: '', resultUniqueId: 'demo-r-003',
            clinicalCode: { text: 'PLT', code: [{ value: '777-3', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '250', value: '250', unitText: '10^9/L', rangeDisplayText: '150 - 400' },
          },
        ],
      },
    ],
  },
  // --- Panel 2: Lipid Panel — LDL and Total Cholesterol HIGH ---
  {
    labTestDate: { date: 10, month: 11, year: 2024, hour: 8, minute: 30, second: 0, hasTimePart: true },
    labResultDate: '2024-12-10T08:30:00',
    labResultDisplayDate: 'Dec 10, 2024',
    labResultDisplayDateText: 'December 10, 2024',
    laboratoryName: 'Alberta Precision Laboratories',
    orderedByName: 'Dr. Sarah Mitchell',
    orderByType: 'Family Medicine',
    source: 'APL',
    clientId: 2,
    thingId: 'demo-thing-002',
    versionStamp: 'v1',
    isReadOnly: true,
    isItemRestricted: false,
    customData: [],
    group: [
      {
        groupName: 'Lipid Panel',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false,
        hasGroupWithOutResult: false,
        labOrderStatus: 'Final',
        attachmentCount: 0,
        attachment: [],
        customData: [],
        results: [
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'Total Cholesterol', index: 0, eduContent: '', resultUniqueId: 'demo-r-004',
            clinicalCode: { text: 'CHOL', code: [{ value: '2093-3', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '6.2', value: '6.2', unitText: 'mmol/L', rangeDisplayText: '< 5.2' },
          },
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'LDL Cholesterol', index: 1, eduContent: '', resultUniqueId: 'demo-r-005',
            clinicalCode: { text: 'LDL', code: [{ value: '2089-1', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '4.2', value: '4.2', unitText: 'mmol/L', rangeDisplayText: '< 3.4' },
          },
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'HDL Cholesterol', index: 2, eduContent: '', resultUniqueId: 'demo-r-006',
            clinicalCode: { text: 'HDL', code: [{ value: '2085-9', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '1.4', value: '1.4', unitText: 'mmol/L', rangeDisplayText: '> 1.0' },
          },
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'Triglycerides', index: 3, eduContent: '', resultUniqueId: 'demo-r-007',
            clinicalCode: { text: 'TRIG', code: [{ value: '2571-8', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '1.3', value: '1.3', unitText: 'mmol/L', rangeDisplayText: '< 1.7' },
          },
        ],
      },
    ],
  },
  // --- Panel 3: Diabetes Monitoring — HbA1c and Fasting Glucose HIGH ---
  {
    labTestDate: { date: 10, month: 11, year: 2024, hour: 8, minute: 30, second: 0, hasTimePart: true },
    labResultDate: '2024-12-10T08:30:00',
    labResultDisplayDate: 'Dec 10, 2024',
    labResultDisplayDateText: 'December 10, 2024',
    laboratoryName: 'Alberta Precision Laboratories',
    orderedByName: 'Dr. Sarah Mitchell',
    orderByType: 'Family Medicine',
    source: 'APL',
    clientId: 3,
    thingId: 'demo-thing-003',
    versionStamp: 'v1',
    isReadOnly: true,
    isItemRestricted: false,
    customData: [],
    group: [
      {
        groupName: 'Diabetes Monitoring',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false,
        hasGroupWithOutResult: false,
        labOrderStatus: 'Final',
        attachmentCount: 0,
        attachment: [],
        customData: [],
        results: [
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'Hemoglobin A1c (HbA1c)', index: 0, eduContent: '', resultUniqueId: 'demo-r-009',
            clinicalCode: { text: 'HBA1C', code: [{ value: '4548-4', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '6.8', value: '6.8', unitText: '%', rangeDisplayText: '< 6.0' },
          },
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'Fasting Glucose', index: 1, eduContent: '', resultUniqueId: 'demo-r-010',
            clinicalCode: { text: 'GLU', code: [{ value: '1558-6', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '7.8', value: '7.8', unitText: 'mmol/L', rangeDisplayText: '3.6 - 6.0' },
          },
        ],
      },
    ],
  },
  // --- Panel 4: Kidney & Liver Function — eGFR LOW, ALT borderline HIGH ---
  {
    labTestDate: { date: 10, month: 11, year: 2024, hour: 8, minute: 30, second: 0, hasTimePart: true },
    labResultDate: '2024-12-10T08:30:00',
    labResultDisplayDate: 'Dec 10, 2024',
    labResultDisplayDateText: 'December 10, 2024',
    laboratoryName: 'Alberta Precision Laboratories',
    orderedByName: 'Dr. Sarah Mitchell',
    orderByType: 'Family Medicine',
    source: 'APL',
    clientId: 4,
    thingId: 'demo-thing-004',
    versionStamp: 'v1',
    isReadOnly: true,
    isItemRestricted: false,
    customData: [],
    group: [
      {
        groupName: 'Kidney & Liver Function',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false,
        hasGroupWithOutResult: false,
        labOrderStatus: 'Final',
        attachmentCount: 0,
        attachment: [],
        customData: [],
        results: [
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'eGFR (Estimated Glomerular Filtration Rate)', index: 0, eduContent: '', resultUniqueId: 'demo-r-011',
            clinicalCode: { text: 'EGFR', code: [{ value: '33914-3', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '72', value: '72', unitText: 'mL/min/1.73m\u00B2', rangeDisplayText: '> 90' },
          },
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'Creatinine', index: 1, eduContent: '', resultUniqueId: 'demo-r-012',
            clinicalCode: { text: 'CREAT', code: [{ value: '2160-0', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '110', value: '110', unitText: '\u00B5mol/L', rangeDisplayText: '59 - 104' },
          },
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'ALT (Alanine Aminotransferase)', index: 2, eduContent: '', resultUniqueId: 'demo-r-013',
            clinicalCode: { text: 'ALT', code: [{ value: '1742-6', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '52', value: '52', unitText: 'U/L', rangeDisplayText: '7 - 56' },
          },
        ],
      },
    ],
  },
  // --- Panel 5: Vitamin D — critically LOW (common in Alberta) ---
  {
    labTestDate: { date: 10, month: 11, year: 2024, hour: 8, minute: 30, second: 0, hasTimePart: true },
    labResultDate: '2024-12-10T08:30:00',
    labResultDisplayDate: 'Dec 10, 2024',
    labResultDisplayDateText: 'December 10, 2024',
    laboratoryName: 'Alberta Precision Laboratories',
    orderedByName: 'Dr. Sarah Mitchell',
    orderByType: 'Family Medicine',
    source: 'APL',
    clientId: 5,
    thingId: 'demo-thing-005',
    versionStamp: 'v1',
    isReadOnly: true,
    isItemRestricted: false,
    customData: [],
    group: [
      {
        groupName: 'Vitamin D',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false,
        hasGroupWithOutResult: false,
        labOrderStatus: 'Final',
        attachmentCount: 0,
        attachment: [],
        customData: [],
        results: [
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: '25-Hydroxyvitamin D', index: 0, eduContent: '', resultUniqueId: 'demo-r-014',
            clinicalCode: { text: 'VITD', code: [{ value: '1989-3', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '32', value: '32', unitText: 'nmol/L', rangeDisplayText: '75 - 250' },
          },
        ],
      },
    ],
  },
  // --- Panel 6: Thyroid Function — normal ---
  {
    labTestDate: { date: 5, month: 10, year: 2024, hour: 9, minute: 15, second: 0, hasTimePart: true },
    labResultDate: '2024-11-05T09:15:00',
    labResultDisplayDate: 'Nov 05, 2024',
    labResultDisplayDateText: 'November 5, 2024',
    laboratoryName: 'Alberta Precision Laboratories',
    orderedByName: 'Dr. Sarah Mitchell',
    orderByType: 'Family Medicine',
    source: 'APL',
    clientId: 6,
    thingId: 'demo-thing-006',
    versionStamp: 'v1',
    isReadOnly: true,
    isItemRestricted: false,
    customData: [],
    group: [
      {
        groupName: 'Thyroid Function',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false,
        hasGroupWithOutResult: false,
        labOrderStatus: 'Final',
        attachmentCount: 0,
        attachment: [],
        customData: [],
        results: [
          {
            when: '2024-11-05T09:15:00', whenDate: '2024-11-05', displayDate: 'Nov 05, 2024',
            name: 'TSH', index: 0, eduContent: '', resultUniqueId: 'demo-r-008',
            clinicalCode: { text: 'TSH', code: [{ value: '3016-3', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '2.1', value: '2.1', unitText: 'mIU/L', rangeDisplayText: '0.4 - 4.0' },
          },
        ],
      },
    ],
  },
];

const demoImmunizations: ImmunizationRecord[] = [
  {
    itemKey: { thingId: 'demo-imm-001', versionStamp: 'v1' },
    effectiveDate: { date: 15, month: 9, year: 2024, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'COVID-19 mRNA Vaccine (Pfizer-BioNTech)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'October 15, 2024' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Pfizer-BioNTech' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-LOT-001' },
      { kind: 5, name: 'Dose', data: null, displayString: '5th dose (Fall 2024 booster)' },
    ],
  },
  {
    itemKey: { thingId: 'demo-imm-002', versionStamp: 'v1' },
    effectiveDate: { date: 1, month: 10, year: 2024, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Influenza Vaccine (2024-2025)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'November 1, 2024' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Seqirus' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-LOT-002' },
    ],
  },
  {
    itemKey: { thingId: 'demo-imm-003', versionStamp: 'v1' },
    effectiveDate: { date: 20, month: 2, year: 2022, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Tdap (Tetanus, Diphtheria, Pertussis)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'March 20, 2022' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Sanofi Pasteur' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-LOT-003' },
    ],
  },
];

const demoMedications: unknown[] = [
  {
    name: 'Metformin',
    strength: '500 mg',
    form: 'Tablet',
    route: 'Oral',
    frequency: 'Twice daily',
    prescribedBy: 'Dr. Sarah Mitchell',
    prescribedDate: '2023-09-01',
    status: 'Active',
    note: DEMO_NOTE,
  },
  {
    name: 'Lisinopril',
    strength: '10 mg',
    form: 'Tablet',
    route: 'Oral',
    frequency: 'Once daily',
    prescribedBy: 'Dr. Sarah Mitchell',
    prescribedDate: '2022-11-15',
    status: 'Active',
    note: DEMO_NOTE,
  },
  {
    name: 'Atorvastatin',
    strength: '20 mg',
    form: 'Tablet',
    route: 'Oral',
    frequency: 'Once daily at bedtime',
    prescribedBy: 'Dr. Sarah Mitchell',
    prescribedDate: '2024-06-20',
    status: 'Active',
    note: DEMO_NOTE,
  },
  {
    name: 'Vitamin D3',
    strength: '2000 IU',
    form: 'Softgel',
    route: 'Oral',
    frequency: 'Once daily',
    prescribedBy: 'Dr. Sarah Mitchell',
    prescribedDate: '2024-12-11',
    status: 'Active',
    note: DEMO_NOTE,
  },
];

const demoDiagnosticImaging: unknown[] = [
  {
    labTestDate: { date: 20, month: 10, year: 2024, hour: 14, minute: 0, second: 0, hasTimePart: true },
    labResultDisplayDateText: 'November 20, 2024',
    laboratoryName: 'Foothills Medical Centre',
    orderedByName: 'Dr. Sarah Mitchell',
    source: 'AHS',
    thingId: 'demo-img-001',
    group: [
      {
        groupName: 'Chest X-Ray (PA and Lateral)',
        labOrderStatus: 'Final',
        results: [
          {
            name: 'Chest X-Ray',
            values: { displayValue: 'No acute cardiopulmonary abnormality. Heart size normal. Lungs clear.', unitText: '' },
            displayDate: 'Nov 20, 2024',
          },
        ],
        attachment: [],
      },
    ],
  },
];

const demoHeightWeight = {
  height: [
    {
      effectiveDate: { date: 10, month: 11, year: 2024 },
      values: [{ displayString: '175', name: 'Height' }],
      note: DEMO_NOTE,
    },
  ],
  weight: [
    {
      effectiveDate: { date: 10, month: 11, year: 2024 },
      values: [{ displayString: '88', name: 'Weight' }],
      note: DEMO_NOTE,
    },
  ],
  bmi: [
    {
      effectiveDate: { date: 10, month: 11, year: 2024 },
      values: [{ displayString: '28.7', name: 'BMI' }],
      note: DEMO_NOTE,
    },
  ],
};

// Blood pressure: mostly controlled with a couple elevated readings
const demoBloodPressure = [
  {
    effectiveDate: { date: 15, month: 5, year: 2024 },
    values: [
      { displayString: '126', name: 'Systolic' },
      { displayString: '80', name: 'Diastolic' },
      { displayString: '74', name: 'Pulse' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 20, month: 6, year: 2024 },
    values: [
      { displayString: '128', name: 'Systolic' },
      { displayString: '82', name: 'Diastolic' },
      { displayString: '72', name: 'Pulse' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 12, month: 7, year: 2024 },
    values: [
      { displayString: '145', name: 'Systolic' },
      { displayString: '92', name: 'Diastolic' },
      { displayString: '80', name: 'Pulse' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 5, month: 9, year: 2024 },
    values: [
      { displayString: '130', name: 'Systolic' },
      { displayString: '84', name: 'Diastolic' },
      { displayString: '76', name: 'Pulse' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 18, month: 10, year: 2024 },
    values: [
      { displayString: '138', name: 'Systolic' },
      { displayString: '88', name: 'Diastolic' },
      { displayString: '78', name: 'Pulse' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 10, month: 11, year: 2024 },
    values: [
      { displayString: '128', name: 'Systolic' },
      { displayString: '82', name: 'Diastolic' },
      { displayString: '72', name: 'Pulse' },
    ],
    note: DEMO_NOTE,
  },
];

// Blood glucose: fasting values with variability showing poor control
const demoBloodGlucose = [
  {
    effectiveDate: { date: 15, month: 5, year: 2024 },
    values: [
      { displayString: '6.2', name: 'Blood Glucose' },
      { displayString: 'Fasting', name: 'Measurement Context' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 20, month: 6, year: 2024 },
    values: [
      { displayString: '5.8', name: 'Blood Glucose' },
      { displayString: 'Fasting', name: 'Measurement Context' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 12, month: 7, year: 2024 },
    values: [
      { displayString: '8.1', name: 'Blood Glucose' },
      { displayString: 'Fasting', name: 'Measurement Context' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 5, month: 9, year: 2024 },
    values: [
      { displayString: '7.4', name: 'Blood Glucose' },
      { displayString: 'Fasting', name: 'Measurement Context' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 18, month: 10, year: 2024 },
    values: [
      { displayString: '6.0', name: 'Blood Glucose' },
      { displayString: 'Fasting', name: 'Measurement Context' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 10, month: 11, year: 2024 },
    values: [
      { displayString: '7.8', name: 'Blood Glucose' },
      { displayString: 'Fasting', name: 'Measurement Context' },
    ],
    note: DEMO_NOTE,
  },
];

// Vital signs from most recent visit
const demoVitalSigns = [
  {
    effectiveDate: { date: 10, month: 11, year: 2024 },
    values: [
      { displayString: '36.8', name: 'Temperature (\u00B0C)' },
      { displayString: '76', name: 'Heart Rate (bpm)' },
      { displayString: '16', name: 'Respiratory Rate (breaths/min)' },
      { displayString: '97', name: 'Oxygen Saturation (%)' },
    ],
    note: DEMO_NOTE,
  },
];

// MHR referrals
const demoReferrals = [
  {
    effectiveDate: { date: 11, month: 11, year: 2024 },
    values: [
      { displayString: 'Endocrinology', name: 'Specialty' },
      { displayString: 'Dr. Sarah Mitchell', name: 'Referring Provider' },
      { displayString: 'Diabetes management — worsening glycemic control', name: 'Reason' },
      { displayString: 'Pending', name: 'Status' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 11, month: 11, year: 2024 },
    values: [
      { displayString: 'Ophthalmology', name: 'Specialty' },
      { displayString: 'Dr. Sarah Mitchell', name: 'Referring Provider' },
      { displayString: 'Diabetic retinopathy screening — annual eye exam', name: 'Reason' },
      { displayString: 'Scheduled — March 2025', name: 'Status' },
    ],
    note: DEMO_NOTE,
  },
];

// ---------------------------------------------------------------------------
// MyChart demo data
// ---------------------------------------------------------------------------

const demoMyChartAllergies = {
  Allergies: [
    {
      AllergyName: 'Penicillin',
      AllergyType: 'Medication',
      Reactions: ['Rash', 'Hives'],
      Severity: 'Moderate',
      Status: 'Active',
      OnsetDate: '2010-01-01',
      note: DEMO_NOTE,
    },
  ],
};

const demoMyChartHealthIssues = {
  HealthIssues: [
    {
      Name: 'Type 2 Diabetes Mellitus',
      Code: 'E11.9',
      Status: 'Active',
      DateDiagnosed: '2023-09-01',
      DiagnosedBy: 'Dr. Sarah Mitchell',
      note: DEMO_NOTE,
    },
    {
      Name: 'Essential Hypertension',
      Code: 'I10',
      Status: 'Active',
      DateDiagnosed: '2022-11-15',
      DiagnosedBy: 'Dr. Sarah Mitchell',
      note: DEMO_NOTE,
    },
    {
      Name: 'Hyperlipidemia',
      Code: 'E78.5',
      Status: 'Active',
      DateDiagnosed: '2024-06-20',
      DiagnosedBy: 'Dr. Sarah Mitchell',
      note: DEMO_NOTE,
    },
    {
      Name: 'Vitamin D Deficiency',
      Code: 'E55.9',
      Status: 'Active',
      DateDiagnosed: '2024-12-10',
      DiagnosedBy: 'Dr. Sarah Mitchell',
      note: DEMO_NOTE,
    },
  ],
  note: DEMO_NOTE,
};

const demoMyChartHealthSummary = {
  Demographics: {
    Name: 'Demo User',
    DateOfBirth: '1985-06-15',
    Age: 39,
    Sex: 'Male',
  },
  Vitals: {
    Height: '175 cm',
    Weight: '88 kg',
    BMI: '28.7',
    BloodPressure: '128/82 mmHg',
    LastUpdated: '2024-12-10',
  },
  note: DEMO_NOTE,
};

const demoMyChartUpcomingVisits = {
  Visits: [
    {
      VisitID: 'demo-visit-001',
      Date: '2025-02-15T10:30:00',
      Department: 'Family Medicine',
      Provider: 'Dr. Sarah Mitchell',
      Location: 'South Health Campus',
      Type: 'Diabetes Follow-up',
      Status: 'Scheduled',
      Instructions: 'Fasting bloodwork required 1 week before visit. Bring glucose log.',
      note: DEMO_NOTE,
    },
  ],
};

const demoMyChartPastVisits = {
  Visits: [
    {
      VisitID: 'demo-visit-002',
      CSN: 'demo-csn-002',
      Date: '2024-12-10T09:00:00',
      Department: 'Family Medicine',
      Provider: 'Dr. Sarah Mitchell',
      Location: 'South Health Campus',
      Type: 'Annual Physical',
      Status: 'Completed',
      note: DEMO_NOTE,
    },
    {
      VisitID: 'demo-visit-003',
      CSN: 'demo-csn-003',
      Date: '2024-09-05T14:00:00',
      Department: 'Family Medicine',
      Provider: 'Dr. Sarah Mitchell',
      Location: 'South Health Campus',
      Type: 'Diabetes Check-in',
      Status: 'Completed',
      note: DEMO_NOTE,
    },
  ],
};

const demoMyChartMessages = {
  Conversations: [
    {
      ID: 'demo-msg-001',
      Subject: 'Lab Results & Medication Adjustment',
      SenderName: 'Dr. Sarah Mitchell',
      Date: '2024-12-11T14:30:00',
      IsRead: false,
      Snippet: 'Your HbA1c has increased slightly. Let\'s discuss adjusting your medication...',
      note: DEMO_NOTE,
    },
  ],
  TotalCount: 1,
};

const demoMyChartCareTeam = {
  CareTeamMembers: [
    {
      Name: 'Dr. Sarah Mitchell',
      Role: 'Primary Care Provider',
      Specialty: 'Family Medicine',
      Phone: '(403) 555-0100',
      Location: 'South Health Campus, Calgary, AB',
      note: DEMO_NOTE,
    },
    {
      Name: 'Dr. Raj Patel',
      Role: 'Specialist — Referral Pending',
      Specialty: 'Endocrinology',
      Phone: '(403) 555-0200',
      Location: 'Foothills Medical Centre, Calgary, AB',
      note: DEMO_NOTE,
    },
  ],
};

const demoMyChartImmunizations = {
  Immunizations: [
    { Name: 'COVID-19 mRNA Vaccine (Pfizer-BioNTech)', Date: 'October 15, 2024', Dose: '5th dose', note: DEMO_NOTE },
    { Name: 'Influenza Vaccine (2024-2025)', Date: 'November 1, 2024', note: DEMO_NOTE },
    { Name: 'Tdap (Tetanus, Diphtheria, Pertussis)', Date: 'March 20, 2022', note: DEMO_NOTE },
  ],
};

const demoMyChartMedications = {
  Medications: [
    { Name: 'Metformin 500 mg tablet', Directions: 'Take 1 tablet by mouth twice daily with meals', Status: 'Active', note: DEMO_NOTE },
    { Name: 'Lisinopril 10 mg tablet', Directions: 'Take 1 tablet by mouth once daily in the morning', Status: 'Active', note: DEMO_NOTE },
    { Name: 'Atorvastatin 20 mg tablet', Directions: 'Take 1 tablet by mouth once daily at bedtime', Status: 'Active', note: DEMO_NOTE },
    { Name: 'Vitamin D3 2000 IU softgel', Directions: 'Take 1 softgel by mouth once daily', Status: 'Active', note: DEMO_NOTE },
  ],
};

const demoMyChartTestResults = {
  ResultGroups: [
    {
      OrderKey: 'demo-order-001',
      OrderName: 'Complete Blood Count (CBC)',
      OrderDate: '2024-12-10',
      Status: 'Final',
      Provider: 'Dr. Sarah Mitchell',
      note: DEMO_NOTE,
    },
    {
      OrderKey: 'demo-order-002',
      OrderName: 'Lipid Panel',
      OrderDate: '2024-12-10',
      Status: 'Final',
      Provider: 'Dr. Sarah Mitchell',
      note: DEMO_NOTE,
    },
    {
      OrderKey: 'demo-order-003',
      OrderName: 'Diabetes Monitoring (HbA1c)',
      OrderDate: '2024-12-10',
      Status: 'Final',
      Provider: 'Dr. Sarah Mitchell',
      note: DEMO_NOTE,
    },
    {
      OrderKey: 'demo-order-004',
      OrderName: 'Kidney & Liver Function',
      OrderDate: '2024-12-10',
      Status: 'Final',
      Provider: 'Dr. Sarah Mitchell',
      note: DEMO_NOTE,
    },
    {
      OrderKey: 'demo-order-005',
      OrderName: 'Vitamin D',
      OrderDate: '2024-12-10',
      Status: 'Final',
      Provider: 'Dr. Sarah Mitchell',
      note: DEMO_NOTE,
    },
  ],
};

const demoMyChartProxyAccess = {
  ProxySubjects: [],
  CurrentContext: { Name: 'Demo User', IsSelf: true },
  note: DEMO_NOTE,
};

// ---------------------------------------------------------------------------
// Mock MHR Client
// ---------------------------------------------------------------------------

export function createDemoMHRClient(): MHRClient {
  return {
    getSessionStatus: async () => demoSessionStatus,
    getUser: async () => demoUserProfile,
    getLabResults: async () => demoLabResults,
    getImmunizations: async () => demoImmunizations,
    getMedications: async () => demoMedications,
    getDiagnosticImaging: async () => demoDiagnosticImaging,
    getHeightWeight: async () => demoHeightWeight,
    getVitalSigns: async () => demoVitalSigns,
    getBloodOxygen: async () => [],
    getBloodPressure: async () => demoBloodPressure,
    getExercise: async () => [],
    getReferrals: async () => demoReferrals,
    getProcedures: async () => [],
    getBloodGlucose: async () => demoBloodGlucose,
    getSleep: async () => [],
    getDietaryIntake: async () => [],
    getInsulin: async () => ({ injections: [], usage: [] }),
    getPeakFlow: async () => [],
    getWaistCircumference: async () => [],
    getSymptomJournal: async () => [],
    downloadAttachment: async () => ({
      buffer: Buffer.from(`${DEMO_NOTE} \u2014 no real attachment in demo mode.`),
      contentType: 'text/plain',
    }),
  } as unknown as MHRClient;
}

// ---------------------------------------------------------------------------
// Mock MyChart Client
// ---------------------------------------------------------------------------

export function createDemoMyChartClient(): MyChartClient {
  return {
    getUpcomingVisits: async () => demoMyChartUpcomingVisits,
    getPastVisits: async () => demoMyChartPastVisits,
    getVisitDetails: async () => ({
      ...demoMyChartPastVisits.Visits[0],
      Details: 'Annual physical exam. Bloodwork ordered: CBC, Lipid Panel, HbA1c, Kidney/Liver Function, Vitamin D, Thyroid. Blood pressure 128/82. Weight 88 kg (up 3 kg from last visit). Discussed worsening HbA1c trend, started Vitamin D supplementation, referral to Endocrinology placed.',
      note: DEMO_NOTE,
    }),
    getHealthSummary: async () => demoMyChartHealthSummary,
    getAllergies: async () => demoMyChartAllergies,
    getHealthIssues: async () => demoMyChartHealthIssues,
    getCareTeam: async () => demoMyChartCareTeam,
    getConversationList: async () => demoMyChartMessages,
    getConversationDetails: async () => ({
      ID: 'demo-msg-001',
      Subject: 'Lab Results & Medication Adjustment',
      Messages: [{
        SenderName: 'Dr. Sarah Mitchell',
        Date: '2024-12-11T14:30:00',
        Body: 'Hi Demo User,\n\nI\'ve reviewed your lab results from December 10th. A few things I want to discuss:\n\n1. Your HbA1c has increased from 6.5% in September to 6.8% now. This tells me your blood sugar control has been slipping. We should discuss whether to increase your Metformin dose or add a second diabetes medication at your February appointment.\n\n2. Your LDL cholesterol is 4.2 mmol/L, which is above target (< 3.4). The Atorvastatin we started in June may need a dose increase. We\'ll reassess at your next visit.\n\n3. Your Vitamin D is quite low at 32 nmol/L (normal is 75\u2013250). This is very common in Alberta, especially in winter. Please start taking Vitamin D3 2000 IU daily \u2014 I\'ve added this to your medications.\n\n4. Your kidney function (eGFR 72) is mildly decreased. This is important to monitor given that you\'re on Metformin. We\'ll recheck in 6 months.\n\n5. Your ALT (liver enzyme) at 52 is borderline. This can sometimes be related to statin use. We\'ll keep an eye on it.\n\nI\'ve also placed a referral to Dr. Patel in Endocrinology for your diabetes management, and you\'re due for your annual diabetic eye screening \u2014 I\'ve referred you to Ophthalmology as well.\n\nPlease continue logging your blood sugars and bring your log to your February 15th appointment.\n\nBest,\nDr. Mitchell',
      }],
      note: DEMO_NOTE,
    }),
    getMedicalHistory: async () => ({
      History: [
        {
          Condition: 'Appendectomy',
          Date: '2015-03-22',
          Type: 'Surgical',
          Details: 'Laparoscopic appendectomy — uncomplicated',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Family History: Coronary Artery Disease',
          Date: null,
          Type: 'Family',
          Details: 'Father — myocardial infarction at age 58',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Family History: Type 2 Diabetes',
          Date: null,
          Type: 'Family',
          Details: 'Mother — diagnosed at age 52',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getDocuments: async () => ({
      Documents: [
        {
          DocumentID: 'demo-doc-001',
          DocumentName: 'After Visit Summary — Annual Physical',
          Date: '2024-12-10',
          Provider: 'Dr. Sarah Mitchell',
          Department: 'Family Medicine',
          Type: 'After Visit Summary',
          note: DEMO_NOTE,
        },
        {
          DocumentID: 'demo-doc-002',
          DocumentName: 'Diabetes Management Plan',
          Date: '2024-09-05',
          Provider: 'Dr. Sarah Mitchell',
          Department: 'Family Medicine',
          Type: 'Care Plan',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getDocumentDetails: async () => ({
      DocumentName: 'After Visit Summary — Annual Physical',
      Date: '2024-12-10',
      Provider: 'Dr. Sarah Mitchell',
      Content: 'Annual physical exam completed. Active conditions: Type 2 Diabetes, Hypertension, Hyperlipidemia. New diagnosis: Vitamin D deficiency. Lab work ordered with multiple results requiring follow-up. Referrals placed to Endocrinology and Ophthalmology. Follow-up scheduled February 15, 2025.',
      note: DEMO_NOTE,
    }),
    getUpcomingOrders: async () => ({
      Orders: [
        {
          OrderName: 'HbA1c + Fasting Glucose',
          OrderDate: '2025-02-08',
          Status: 'Scheduled',
          Instructions: 'Fasting required — no food or drink (except water) for 8 hours before bloodwork',
          Provider: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
        {
          OrderName: 'Comprehensive Metabolic Panel (eGFR, ALT, Creatinine)',
          OrderDate: '2025-06-10',
          Status: 'Scheduled',
          Instructions: '6-month kidney/liver function recheck',
          Provider: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getTestResultsList: async () => demoMyChartTestResults,
    getTestResultDetails: async () => ({
      OrderName: 'Diabetes Monitoring',
      OrderDate: '2024-12-10',
      Status: 'Final',
      Components: [
        { Name: 'Hemoglobin A1c (HbA1c)', Value: '6.8', Units: '%', Range: '< 6.0', Flag: 'High' },
        { Name: 'Fasting Glucose', Value: '7.8', Units: 'mmol/L', Range: '3.6 - 6.0', Flag: 'High' },
      ],
      note: DEMO_NOTE,
    }),
    getReportContent: async () => ({ ReportContent: 'No report content available in demo mode.', note: DEMO_NOTE }),
    getFamilyTree: async () => ({
      FamilyMembers: [
        { Relationship: 'Father', Conditions: ['Coronary Artery Disease — MI at age 58'], Deceased: true, note: DEMO_NOTE },
        { Relationship: 'Mother', Conditions: ['Type 2 Diabetes — diagnosed age 52'], Deceased: false, note: DEMO_NOTE },
      ],
      note: DEMO_NOTE,
    }),
    getPatientGoals: async () => ({
      Goals: [
        {
          GoalName: 'HbA1c Target',
          Target: '< 7.0%',
          Current: '6.8%',
          Status: 'In Progress',
          StartDate: '2023-09-01',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Blood Pressure Target',
          Target: '< 130/80 mmHg',
          Current: '128/82 mmHg',
          Status: 'In Progress',
          StartDate: '2022-11-15',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Weight Loss',
          Target: 'Lose 5 kg (goal weight: 83 kg)',
          Current: '88 kg',
          Status: 'Not Started',
          StartDate: '2024-12-10',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getCareTeamGoals: async () => ({
      Goals: [
        {
          GoalName: 'Annual Diabetic Eye Exam',
          Description: 'Dilated eye exam by Ophthalmology to screen for diabetic retinopathy',
          DueDate: '2025-03-31',
          Status: 'Scheduled — referral sent',
          Owner: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Kidney Function Monitoring',
          Description: 'Recheck eGFR and creatinine every 6 months given Metformin use and declining kidney function',
          DueDate: '2025-06-10',
          Status: 'Scheduled',
          Owner: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Liver Enzyme Monitoring',
          Description: 'Recheck ALT in 6 months given borderline elevation on statin therapy',
          DueDate: '2025-06-10',
          Status: 'Scheduled',
          Owner: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getReferralsList: async () => ({
      Referrals: [
        {
          ReferralID: 'demo-ref-001',
          Specialty: 'Endocrinology',
          Provider: 'Dr. Raj Patel',
          ReferringProvider: 'Dr. Sarah Mitchell',
          Reason: 'Diabetes management — worsening glycemic control despite Metformin',
          Status: 'Pending',
          DateReferred: '2024-12-11',
          note: DEMO_NOTE,
        },
        {
          ReferralID: 'demo-ref-002',
          Specialty: 'Ophthalmology',
          Provider: 'TBD',
          ReferringProvider: 'Dr. Sarah Mitchell',
          Reason: 'Diabetic retinopathy screening — annual eye exam',
          Status: 'Scheduled — March 2025',
          DateReferred: '2024-12-11',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getReferralDetails: async () => ({
      ReferralID: 'demo-ref-001',
      Specialty: 'Endocrinology',
      Provider: 'Dr. Raj Patel',
      Reason: 'Diabetes management — worsening glycemic control despite Metformin 500 mg BID. HbA1c trending up: 6.2% (Jun) \u2192 6.5% (Sep) \u2192 6.8% (Dec). eGFR mildly decreased at 72.',
      Status: 'Pending',
      note: DEMO_NOTE,
    }),
    getMedications: async () => demoMyChartMedications,
    getImmunizations: async () => demoMyChartImmunizations,
    getHistoricalResults: async () => ({
      Components: [
        {
          Name: 'Hemoglobin A1c (HbA1c)',
          Units: '%',
          Range: '< 6.0',
          Results: [
            { Date: '2024-06-15', Value: '6.2', Flag: 'High' },
            { Date: '2024-09-05', Value: '6.5', Flag: 'High' },
            { Date: '2024-12-10', Value: '6.8', Flag: 'High' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'LDL Cholesterol',
          Units: 'mmol/L',
          Range: '< 3.4',
          Results: [
            { Date: '2024-06-15', Value: '3.6', Flag: 'High' },
            { Date: '2024-12-10', Value: '4.2', Flag: 'High' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'eGFR',
          Units: 'mL/min/1.73m\u00B2',
          Range: '> 90',
          Results: [
            { Date: '2024-06-15', Value: '82', Flag: 'Low' },
            { Date: '2024-12-10', Value: '72', Flag: 'Low' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'Fasting Glucose',
          Units: 'mmol/L',
          Range: '3.6 - 6.0',
          Results: [
            { Date: '2024-06-15', Value: '6.9', Flag: 'High' },
            { Date: '2024-09-05', Value: '7.2', Flag: 'High' },
            { Date: '2024-12-10', Value: '7.8', Flag: 'High' },
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
    getProxyAccessList: async () => demoMyChartProxyAccess,
    switchToProxy: async () => {},
    switchToSelf: async () => {},
  } as unknown as MyChartClient;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

let _runtimeDemoMode = false;

export function setDemoMode(enabled: boolean): void {
  _runtimeDemoMode = enabled;
}

export function isDemoMode(): boolean {
  if (_runtimeDemoMode) return true;
  const val = process.env.DEMO_MODE;
  return val === 'true' || val === 'True' || val === '1' || val === 'yes';
}
