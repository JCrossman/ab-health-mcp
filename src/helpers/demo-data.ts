/**
 * Demo mode mock data and clients.
 *
 * When DEMO_MODE=true, these mock clients replace the real MHR and MyChart
 * clients so Anthropic directory reviewers can explore all tools without
 * an Alberta health portal account.
 *
 * All data is clearly fictional — "Demo User" with sample records.
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
            values: { displayValue: '4.8', value: '4.8', unitText: 'mmol/L', rangeDisplayText: '< 5.2' },
          },
          {
            when: '2024-12-10T08:30:00', whenDate: '2024-12-10', displayDate: 'Dec 10, 2024',
            name: 'LDL Cholesterol', index: 1, eduContent: '', resultUniqueId: 'demo-r-005',
            clinicalCode: { text: 'LDL', code: [{ value: '2089-1', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '2.8', value: '2.8', unitText: 'mmol/L', rangeDisplayText: '< 3.4' },
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
  {
    labTestDate: { date: 5, month: 10, year: 2024, hour: 9, minute: 15, second: 0, hasTimePart: true },
    labResultDate: '2024-11-05T09:15:00',
    labResultDisplayDate: 'Nov 05, 2024',
    labResultDisplayDateText: 'November 5, 2024',
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
    prescribedDate: '2024-06-01',
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
    prescribedDate: '2024-03-15',
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
      values: [{ displayString: '80', name: 'Weight' }],
      note: DEMO_NOTE,
    },
  ],
  bmi: [
    {
      effectiveDate: { date: 10, month: 11, year: 2024 },
      values: [{ displayString: '26.1', name: 'BMI' }],
      note: DEMO_NOTE,
    },
  ],
};

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
  HealthIssues: [],
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
    Weight: '80 kg',
    BMI: '26.1',
    BloodPressure: '120/78 mmHg',
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
      Type: 'Follow-up',
      Status: 'Scheduled',
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
  ],
};

const demoMyChartMessages = {
  Conversations: [
    {
      ID: 'demo-msg-001',
      Subject: 'Lab Results Follow-up',
      SenderName: 'Dr. Sarah Mitchell',
      Date: '2024-12-11T14:30:00',
      IsRead: false,
      Snippet: 'Your recent lab results look good. No concerns at this time.',
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
    { Name: 'Metformin 500 mg tablet', Directions: 'Take 1 tablet by mouth twice daily', Status: 'Active', note: DEMO_NOTE },
    { Name: 'Lisinopril 10 mg tablet', Directions: 'Take 1 tablet by mouth once daily', Status: 'Active', note: DEMO_NOTE },
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
    getVitalSigns: async () => [],
    getBloodOxygen: async () => [],
    getBloodPressure: async () => [],
    getExercise: async () => [],
    getReferrals: async () => [],
    getProcedures: async () => [],
    getBloodGlucose: async () => [],
    getSleep: async () => [],
    getDietaryIntake: async () => [],
    getInsulin: async () => ({ injections: [], usage: [] }),
    getPeakFlow: async () => [],
    getWaistCircumference: async () => [],
    getSymptomJournal: async () => [],
    downloadAttachment: async () => ({
      buffer: Buffer.from(`${DEMO_NOTE} — no real attachment in demo mode.`),
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
    getVisitDetails: async () => ({ ...demoMyChartPastVisits.Visits[0], Details: 'Annual physical exam — all within normal limits.', note: DEMO_NOTE }),
    getHealthSummary: async () => demoMyChartHealthSummary,
    getAllergies: async () => demoMyChartAllergies,
    getHealthIssues: async () => demoMyChartHealthIssues,
    getCareTeam: async () => demoMyChartCareTeam,
    getConversationList: async () => demoMyChartMessages,
    getConversationDetails: async () => ({
      ID: 'demo-msg-001',
      Subject: 'Lab Results Follow-up',
      Messages: [{
        SenderName: 'Dr. Sarah Mitchell',
        Date: '2024-12-11T14:30:00',
        Body: 'Your recent lab results look good. Your CBC, lipid panel, and thyroid are all within normal ranges. No concerns at this time. Keep up the good work! We will check again at your next visit.',
      }],
      note: DEMO_NOTE,
    }),
    getMedicalHistory: async () => ({ History: [], note: DEMO_NOTE }),
    getDocuments: async () => ({ Documents: [], note: DEMO_NOTE }),
    getDocumentDetails: async () => ({ DocumentName: 'No documents in demo mode', note: DEMO_NOTE }),
    getUpcomingOrders: async () => ({ Orders: [], note: DEMO_NOTE }),
    getTestResultsList: async () => demoMyChartTestResults,
    getTestResultDetails: async () => ({
      OrderName: 'Complete Blood Count (CBC)',
      OrderDate: '2024-12-10',
      Status: 'Final',
      Components: [
        { Name: 'Hemoglobin', Value: '145', Units: 'g/L', Range: '135 - 175', Flag: 'Normal' },
        { Name: 'WBC', Value: '7.2', Units: '10^9/L', Range: '4.0 - 11.0', Flag: 'Normal' },
        { Name: 'Platelets', Value: '250', Units: '10^9/L', Range: '150 - 400', Flag: 'Normal' },
      ],
      note: DEMO_NOTE,
    }),
    getReportContent: async () => ({ ReportContent: 'No report content available in demo mode.', note: DEMO_NOTE }),
    getFamilyTree: async () => ({ FamilyMembers: [], note: DEMO_NOTE }),
    getPatientGoals: async () => ({ Goals: [], note: DEMO_NOTE }),
    getCareTeamGoals: async () => ({ Goals: [], note: DEMO_NOTE }),
    getReferralsList: async () => ({ Referrals: [], note: DEMO_NOTE }),
    getReferralDetails: async () => ({ note: DEMO_NOTE }),
    getMedications: async () => demoMyChartMedications,
    getImmunizations: async () => demoMyChartImmunizations,
    getHistoricalResults: async () => ({ Components: [], note: DEMO_NOTE }),
    getAppointmentRequests: async () => ({ Requests: [], note: DEMO_NOTE }),
    keepAlive: async () => {},
    downloadDocumentBinary: async () => ({
      buffer: Buffer.from(`${DEMO_NOTE} — no real document in demo mode.`),
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
