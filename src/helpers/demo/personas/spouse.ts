/**
 * Demo persona — Sarah User (the Demo User's spouse).
 *
 * 41-year-old female with: Hashimoto's hypothyroidism (since 2014),
 * generalized anxiety disorder on long-term sertraline (since 2016),
 * migraine with aura on topiramate prophylaxis (since 2019), and recently
 * diagnosed perimenopause (Mar 2024) with low ferritin from heavy
 * perimenopausal bleeding (Mirena IUD placed Oct 2024 to manage).
 *
 * Past resolved postpartum depression (2017) is recorded as history -- a
 * relapse-watch flag given current perimenopause + caregiver stress from
 * helping with her mother-in-law (Margaret) -- creating a coherent
 * sandwich-generation narrative across all three personas.
 *
 * Preventive care is up-to-date: mammogram BI-RADS 1 (Aug 2024), Pap +
 * HPV co-test negative (Aug 2024, next in 5 years), HPV vaccine series
 * completed 2009 (age 26 catch-up).
 *
 * Drug-drug-condition reasoning hooks: topiramate lowers OCP efficacy
 * (hence IUD), sertraline+topiramate well-tolerated, sumatriptan PRN
 * appropriate with topiramate, magnesium adjunct for migraine + sleep.
 *
 * Shares Dr. Sarah Mitchell as family physician with Demo User.
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

const spouseUserProfile: UserProfile = {
  personId: 'demo-spouse-001',
  name: 'Sarah User',
  selectedRecordId: 'rec-demo-spouse',
  defaultUserLanguage: 'en-CA',
  isEmergencyAccessMode: false,
  createdDateTimeUtc: '2017-08-22T00:00:00Z',
  authorizedRecords: [
    {
      id: 'rec-demo-spouse',
      isCustodian: false,
      displayName: 'Sarah User',
      name: 'Sarah User',
      relationshipType: 'Self',
      patientInfo: 'DOB: 1983-09-04',
    },
  ],
};

const spouseSessionStatus: SessionStatus = {
  isSessionExpired: false,
  numberOfMilliSecondsLeftForSessionExpire: 600_000,
};

const spouseLabResults: LabResult[] = [];

// Sep 2024 — perimenopause workup + annual labs
spouseLabResults.push({
  labTestDate: { date: 16, month: 8, year: 2024, hour: 8, minute: 30, second: 0, hasTimePart: true },
  labResultDate: '2024-09-16T08:30:00',
  labResultDisplayDate: 'Sep 16, 2024',
  labResultDisplayDateText: 'September 16, 2024',
  laboratoryName: 'Alberta Precision Laboratories',
  orderedByName: 'Dr. Sarah Mitchell',
  orderByType: 'Family Medicine',
  source: 'APL', clientId: 201, thingId: 'demo-sp-thing-201', versionStamp: 'v1',
  isReadOnly: true, isItemRestricted: false, customData: [],
  group: [
    {
      groupName: 'Thyroid Function',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-09-16T08:30:00', whenDate: '2024-09-16', displayDate: 'Sep 16, 2024',
          name: 'TSH', index: 0, eduContent: '', resultUniqueId: 'demo-sp-r-001',
          clinicalCode: { text: 'TSH', code: [{ value: '3016-3', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '2.4', value: '2.4', unitText: 'mIU/L', rangeDisplayText: '0.30 - 4.00' },
        },
        {
          when: '2024-09-16T08:30:00', whenDate: '2024-09-16', displayDate: 'Sep 16, 2024',
          name: 'Free T4', index: 1, eduContent: '', resultUniqueId: 'demo-sp-r-002',
          clinicalCode: { text: 'FT4', code: [{ value: '3024-7', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '15', value: '15', unitText: 'pmol/L', rangeDisplayText: '10 - 23' },
        },
      ],
    },
    {
      groupName: 'Perimenopause Hormone Panel',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-09-16T08:30:00', whenDate: '2024-09-16', displayDate: 'Sep 16, 2024',
          name: 'FSH', index: 0, eduContent: '', resultUniqueId: 'demo-sp-r-003',
          clinicalCode: { text: 'FSH', code: [{ value: '15067-2', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '28', value: '28', unitText: 'IU/L', rangeDisplayText: 'Follicular 3-10 / Postmenopausal >25' },
        },
        {
          when: '2024-09-16T08:30:00', whenDate: '2024-09-16', displayDate: 'Sep 16, 2024',
          name: 'AMH (Anti-Mullerian Hormone)', index: 1, eduContent: '', resultUniqueId: 'demo-sp-r-004',
          clinicalCode: { text: 'AMH', code: [{ value: '38476-0', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '0.4', value: '0.4', unitText: 'ng/mL', rangeDisplayText: '> 1.0 (premenopausal)' },
        },
        {
          when: '2024-09-16T08:30:00', whenDate: '2024-09-16', displayDate: 'Sep 16, 2024',
          name: 'Estradiol', index: 2, eduContent: '', resultUniqueId: 'demo-sp-r-005',
          clinicalCode: { text: 'E2', code: [{ value: '14715-7', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '142', value: '142', unitText: 'pmol/L', rangeDisplayText: 'Variable (cycle-dependent)' },
        },
      ],
    },
    {
      groupName: 'Iron Studies / CBC',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-09-16T08:30:00', whenDate: '2024-09-16', displayDate: 'Sep 16, 2024',
          name: 'Hemoglobin', index: 0, eduContent: '', resultUniqueId: 'demo-sp-r-006',
          clinicalCode: { text: 'HGB', code: [{ value: '718-7', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '118', value: '118', unitText: 'g/L', rangeDisplayText: '120 - 160' },
        },
        {
          when: '2024-09-16T08:30:00', whenDate: '2024-09-16', displayDate: 'Sep 16, 2024',
          name: 'Ferritin', index: 1, eduContent: '', resultUniqueId: 'demo-sp-r-007',
          clinicalCode: { text: 'FERR', code: [{ value: '2276-4', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '22', value: '22', unitText: 'ug/L', rangeDisplayText: '30 - 200' },
        },
      ],
    },
    {
      groupName: 'Annual Screening',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-09-16T08:30:00', whenDate: '2024-09-16', displayDate: 'Sep 16, 2024',
          name: 'HbA1c', index: 0, eduContent: '', resultUniqueId: 'demo-sp-r-008',
          clinicalCode: { text: 'HBA1C', code: [{ value: '4548-4', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '5.2', value: '5.2', unitText: '%', rangeDisplayText: '< 6.0' },
        },
        {
          when: '2024-09-16T08:30:00', whenDate: '2024-09-16', displayDate: 'Sep 16, 2024',
          name: 'LDL Cholesterol', index: 1, eduContent: '', resultUniqueId: 'demo-sp-r-009',
          clinicalCode: { text: 'LDL', code: [{ value: '13457-7', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '2.4', value: '2.4', unitText: 'mmol/L', rangeDisplayText: '< 3.4' },
        },
      ],
    },
  ],
});

// Sep 2023 — baseline before perimenopause workup
spouseLabResults.push({
  labTestDate: { date: 5, month: 8, year: 2023, hour: 9, minute: 0, second: 0, hasTimePart: true },
  labResultDate: '2023-09-05T09:00:00',
  labResultDisplayDate: 'Sep 5, 2023',
  labResultDisplayDateText: 'September 5, 2023',
  laboratoryName: 'Alberta Precision Laboratories',
  orderedByName: 'Dr. Sarah Mitchell',
  orderByType: 'Family Medicine',
  source: 'APL', clientId: 202, thingId: 'demo-sp-thing-202', versionStamp: 'v1',
  isReadOnly: true, isItemRestricted: false, customData: [],
  group: [
    {
      groupName: 'Annual Labs',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2023-09-05T09:00:00', whenDate: '2023-09-05', displayDate: 'Sep 5, 2023',
          name: 'TSH', index: 0, eduContent: '', resultUniqueId: 'demo-sp-r-101',
          clinicalCode: { text: 'TSH', code: [{ value: '3016-3', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '2.8', value: '2.8', unitText: 'mIU/L', rangeDisplayText: '0.30 - 4.00' },
        },
        {
          when: '2023-09-05T09:00:00', whenDate: '2023-09-05', displayDate: 'Sep 5, 2023',
          name: 'FSH', index: 1, eduContent: '', resultUniqueId: 'demo-sp-r-102',
          clinicalCode: { text: 'FSH', code: [{ value: '15067-2', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '12', value: '12', unitText: 'IU/L', rangeDisplayText: 'Follicular 3-10' },
        },
        {
          when: '2023-09-05T09:00:00', whenDate: '2023-09-05', displayDate: 'Sep 5, 2023',
          name: 'Hemoglobin', index: 2, eduContent: '', resultUniqueId: 'demo-sp-r-103',
          clinicalCode: { text: 'HGB', code: [{ value: '718-7', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '128', value: '128', unitText: 'g/L', rangeDisplayText: '120 - 160' },
        },
        {
          when: '2023-09-05T09:00:00', whenDate: '2023-09-05', displayDate: 'Sep 5, 2023',
          name: 'Ferritin', index: 3, eduContent: '', resultUniqueId: 'demo-sp-r-104',
          clinicalCode: { text: 'FERR', code: [{ value: '2276-4', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '38', value: '38', unitText: 'ug/L', rangeDisplayText: '30 - 200' },
        },
      ],
    },
  ],
});

// Sep 2022 — earlier baseline showing TSH uptrend pre-titration
spouseLabResults.push({
  labTestDate: { date: 12, month: 8, year: 2022, hour: 9, minute: 0, second: 0, hasTimePart: true },
  labResultDate: '2022-09-12T09:00:00',
  labResultDisplayDate: 'Sep 12, 2022',
  labResultDisplayDateText: 'September 12, 2022',
  laboratoryName: 'Alberta Precision Laboratories',
  orderedByName: 'Dr. Sarah Mitchell',
  orderByType: 'Family Medicine',
  source: 'APL', clientId: 203, thingId: 'demo-sp-thing-203', versionStamp: 'v1',
  isReadOnly: true, isItemRestricted: false, customData: [],
  group: [
    {
      groupName: 'Annual Labs',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2022-09-12T09:00:00', whenDate: '2022-09-12', displayDate: 'Sep 12, 2022',
          name: 'TSH', index: 0, eduContent: '', resultUniqueId: 'demo-sp-r-201',
          clinicalCode: { text: 'TSH', code: [{ value: '3016-3', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '3.2', value: '3.2', unitText: 'mIU/L', rangeDisplayText: '0.30 - 4.00' },
        },
        {
          when: '2022-09-12T09:00:00', whenDate: '2022-09-12', displayDate: 'Sep 12, 2022',
          name: 'Ferritin', index: 1, eduContent: '', resultUniqueId: 'demo-sp-r-202',
          clinicalCode: { text: 'FERR', code: [{ value: '2276-4', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '45', value: '45', unitText: 'ug/L', rangeDisplayText: '30 - 200' },
        },
      ],
    },
  ],
});

const spouseImmunizations: ImmunizationRecord[] = [
  {
    itemKey: { thingId: 'demo-sp-imm-001', versionStamp: 'v1' },
    effectiveDate: { date: 12, month: 9, year: 2024, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Influenza Vaccine (2024-2025, quadrivalent)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'October 12, 2024' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'GSK (Flulaval Tetra)' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-SP-FLU-2024' },
    ],
  },
  {
    itemKey: { thingId: 'demo-sp-imm-002', versionStamp: 'v1' },
    effectiveDate: { date: 19, month: 9, year: 2024, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'COVID-19 mRNA Vaccine (XBB.1.5 booster)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'October 19, 2024' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Moderna' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-SP-COV-2024' },
    ],
  },
  {
    itemKey: { thingId: 'demo-sp-imm-003', versionStamp: 'v1' },
    effectiveDate: { date: 14, month: 5, year: 2018, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Tdap (Tetanus, Diphtheria, Pertussis)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'June 14, 2018' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Sanofi Pasteur' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-SP-TDAP' },
    ],
  },
  {
    itemKey: { thingId: 'demo-sp-imm-004', versionStamp: 'v1' },
    effectiveDate: { date: 3, month: 2, year: 2009, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'HPV (Gardasil 9) \u2014 series complete (catch-up, age 26)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'March 3, 2009 (last dose of 3-dose series)' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Merck' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-SP-HPV-3' },
    ],
  },
  {
    itemKey: { thingId: 'demo-sp-imm-005', versionStamp: 'v1' },
    effectiveDate: { date: 8, month: 5, year: 1990, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'MMR (Measles, Mumps, Rubella) \u2014 childhood series' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'June 8, 1990' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Merck' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-SP-MMR' },
    ],
  },
];

const spouseMedications: unknown[] = [
  { name: 'Levothyroxine', strength: '88 mcg', form: 'Tablet', route: 'Oral', frequency: 'Once daily, fasting (30 min before breakfast)',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2014-08-18', status: 'Active', note: DEMO_NOTE },
  { name: 'Sertraline (Zoloft)', strength: '100 mg', form: 'Tablet', route: 'Oral', frequency: 'Once daily',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2016-03-12', status: 'Active', note: DEMO_NOTE },
  { name: 'Topiramate (Topamax)', strength: '50 mg', form: 'Tablet', route: 'Oral', frequency: 'Twice daily (migraine prophylaxis)',
    prescribedBy: 'Dr. Marcus Thompson', prescribedDate: '2019-11-04', status: 'Active', note: DEMO_NOTE },
  { name: 'Sumatriptan (Imitrex)', strength: '100 mg', form: 'Tablet', route: 'Oral', frequency: 'As needed for acute migraine (max 2 doses/24h, max 10/month)',
    prescribedBy: 'Dr. Marcus Thompson', prescribedDate: '2019-11-04', status: 'Active', note: DEMO_NOTE },
  { name: 'Levonorgestrel IUD (Mirena)', strength: '52 mg / 5-year', form: 'Intrauterine device', route: 'Intrauterine', frequency: 'Continuous (placed 2024-10-08, replace by Oct 2029)',
    prescribedBy: 'Dr. Priya Reddy', prescribedDate: '2024-10-08', status: 'Active', note: DEMO_NOTE },
  { name: 'Vitamin D3', strength: '2000 IU', form: 'Softgel', route: 'Oral', frequency: 'Once daily',
    prescribedBy: 'OTC (recommended by Dr. Mitchell)', prescribedDate: '2020-11-04', status: 'Active', note: DEMO_NOTE },
  { name: 'Ferrous fumarate', strength: '300 mg', form: 'Tablet', route: 'Oral', frequency: 'Once daily with vitamin C',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2024-09-18', status: 'Active', note: DEMO_NOTE },
  { name: 'Magnesium glycinate', strength: '400 mg', form: 'Capsule', route: 'Oral', frequency: 'Once daily at bedtime (migraine + sleep adjunct)',
    prescribedBy: 'OTC (recommended by Dr. Thompson)', prescribedDate: '2022-06-15', status: 'Active', note: DEMO_NOTE },
  { name: 'Sertraline (Zoloft)', strength: '50 mg', form: 'Tablet', route: 'Oral', frequency: 'Once daily',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2017-02-08',
    status: 'Discontinued 2018-04-20 \u2014 postpartum depression resolved with combined SSRI + therapy; restarted at higher dose 2016 for generalized anxiety (separate course)',
    note: DEMO_NOTE },
];

const spouseDiagnosticImaging: unknown[] = [
  {
    labTestDate: { date: 22, month: 7, year: 2024, hour: 10, minute: 0, second: 0, hasTimePart: true },
    labResultDisplayDateText: 'August 22, 2024',
    laboratoryName: 'Foothills Breast Health Centre',
    orderedByName: 'Dr. Sarah Mitchell',
    source: 'AHS',
    thingId: 'demo-sp-img-001',
    group: [
      {
        groupName: 'Screening Mammography',
        labOrderStatus: 'Final',
        results: [
          {
            name: 'Mammogram (bilateral, screening)',
            values: {
              displayValue: 'BI-RADS Category 1 \u2014 Negative. No suspicious masses, calcifications, or architectural distortion. Recommend routine annual screening given family history (mother with breast cancer at age 58).',
              unitText: '',
            },
            displayDate: 'Aug 22, 2024',
          },
        ],
        attachment: [],
      },
    ],
  },
  {
    labTestDate: { date: 14, month: 4, year: 2019, hour: 14, minute: 0, second: 0, hasTimePart: true },
    labResultDisplayDateText: 'May 14, 2019',
    laboratoryName: 'Foothills Medical Centre \u2014 Radiology',
    orderedByName: 'Dr. Marcus Thompson',
    source: 'AHS',
    thingId: 'demo-sp-img-002',
    group: [
      {
        groupName: 'MRI Brain (with and without contrast)',
        labOrderStatus: 'Final',
        results: [
          {
            name: 'MRI Brain Report',
            values: {
              displayValue: 'Normal study. No acute or chronic ischemic changes. No mass, hemorrhage, or abnormal enhancement. No white matter hyperintensities. Performed for migraine with aura workup \u2014 reassuring.',
              unitText: '',
            },
            displayDate: 'May 14, 2019',
          },
        ],
        attachment: [],
      },
    ],
  },
];

const spouseHeightWeight = {
  height: [
    {
      effectiveDate: { date: 15, month: 8, year: 2024 },
      values: [{ displayString: '168', name: 'Height (cm)' }],
      note: DEMO_NOTE,
    },
  ],
  weight: [
    {
      effectiveDate: { date: 15, month: 8, year: 2024 },
      values: [{ displayString: '66', name: 'Weight (kg)' }],
      note: DEMO_NOTE,
    },
  ],
  bmi: [
    {
      effectiveDate: { date: 15, month: 8, year: 2024 },
      values: [{ displayString: '23.4', name: 'BMI' }],
      note: DEMO_NOTE,
    },
  ],
};

const spouseBloodPressure = [
  {
    effectiveDate: { date: 15, month: 8, year: 2024, hour: 8, minute: 45, second: 0 },
    values: [
      { displayString: '118', name: 'Systolic (mmHg)' },
      { displayString: '74', name: 'Diastolic (mmHg)' },
      { displayString: '70', name: 'Pulse (bpm)' },
    ],
    note: DEMO_NOTE,
  },
];

const spouseVitalSigns = [
  {
    effectiveDate: { date: 15, month: 8, year: 2024, hour: 8, minute: 45, second: 0 },
    values: [
      { displayString: '70', name: 'Heart rate (bpm)' },
      { displayString: '36.7', name: 'Temperature (\u00b0C)' },
      { displayString: '14', name: 'Respiratory rate (breaths/min)' },
    ],
    note: DEMO_NOTE,
  },
];

const spouseBloodOxygen = [
  {
    effectiveDate: { date: 15, month: 8, year: 2024, hour: 8, minute: 45, second: 0 },
    values: [{ displayString: '99', name: 'SpO2 (%)' }],
    note: DEMO_NOTE,
  },
];

const spouseExercise = [
  {
    effectiveDate: { date: 5, month: 10, year: 2024, hour: 7, minute: 0, second: 0 },
    exerciseValues: [
      { name: 'Activity', displayString: 'Running (parkrun)' },
      { name: 'Duration', displayString: '32 min' },
      { name: 'Distance', displayString: '5.0 km' },
    ],
    durationUnit: 'min',
    distanceUnit: 'km',
    calorieUnit: 'kcal',
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 1, month: 10, year: 2024, hour: 18, minute: 0, second: 0 },
    exerciseValues: [
      { name: 'Activity', displayString: 'Yoga' },
      { name: 'Duration', displayString: '60 min' },
    ],
    durationUnit: 'min',
    distanceUnit: 'km',
    calorieUnit: 'kcal',
    note: DEMO_NOTE,
  },
];

const spouseReferrals = [
  {
    referralDate: '2024-09-16',
    referringProvider: 'Dr. Sarah Mitchell (Family Medicine)',
    referredTo: 'Dr. Priya Reddy, Gynecology',
    reason: 'Heavy menstrual bleeding in perimenopause \u2014 IUD insertion consult',
    status: 'Completed (IUD inserted Oct 8, 2024)',
    note: DEMO_NOTE,
  },
  {
    referralDate: '2019-08-22',
    referringProvider: 'Dr. Sarah Mitchell (Family Medicine)',
    referredTo: 'Dr. Marcus Thompson, Neurology',
    reason: 'New migraine with aura \u2014 frequency increasing, neurology workup',
    status: 'Active (annual follow-up)',
    note: DEMO_NOTE,
  },
];

const spouseProcedures = [
  {
    procedureDate: '2024-10-08',
    procedureName: 'Levonorgestrel IUD (Mirena) insertion',
    location: 'Foothills Women\u2019s Health Centre',
    provider: 'Dr. Priya Reddy',
    note: DEMO_NOTE,
  },
  {
    procedureDate: '2017-05-14',
    procedureName: 'Vaginal delivery (full-term, uncomplicated)',
    location: 'Foothills Medical Centre',
    provider: 'Dr. Priya Reddy',
    note: DEMO_NOTE,
  },
];

const spouseSleep = [
  {
    effectiveDate: { date: 4, month: 10, year: 2024, hour: 23, minute: 0, second: 0 },
    values: [
      { displayString: '6h 12m', name: 'Total sleep' },
      { displayString: '3 (frequent night-time waking)', name: 'Awakenings' },
      { displayString: 'Hot flash at 3am', name: 'Notes' },
    ],
    note: DEMO_NOTE,
  },
];

const spouseDietaryIntake: unknown[] = [];
const spousePeakFlow: unknown[] = [];
const spouseWaistCircumference = [
  {
    effectiveDate: { date: 15, month: 8, year: 2024 },
    values: [{ displayString: '76', name: 'Waist (cm)' }],
    note: DEMO_NOTE,
  },
];

const spouseSymptomJournal = [
  {
    effectiveDate: { date: 18, month: 8, year: 2024, hour: 14, minute: 0, second: 0 },
    values: [
      { displayString: 'Migraine with aura started \u2014 visual zig-zag for 20 min then headache. Took sumatriptan. Resolved in 90 min.', name: 'Symptom note' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 2, month: 9, year: 2024, hour: 3, minute: 0, second: 0 },
    values: [
      { displayString: 'Woke up drenched at 3am \u2014 hot flash. Third time this week.', name: 'Symptom note' },
    ],
    note: DEMO_NOTE,
  },
];

// ============================================================================
// MyChart data
// ============================================================================

const spouseMyChartAllergies = {
  patientName: 'Sarah User',
  allergies: [
    {
      name: 'Penicillin (and beta-lactam family \u2014 amoxicillin)',
      reaction: 'Rash (whole-body morbilliform, age 8)',
      severity: 'Moderate',
      noted: '1991',
      source: 'Patient reported (childhood)',
      note: DEMO_NOTE,
    },
    {
      name: 'No known food or environmental allergies',
      reaction: '',
      severity: '',
      noted: '',
      source: '',
      note: DEMO_NOTE,
    },
  ],
};

const spouseMyChartHealthIssues = {
  patientName: 'Sarah User',
  healthIssues: [
    { name: 'Hashimoto thyroiditis with hypothyroidism', icd10: 'E06.3', noted: '2014-08-18', status: 'Active', note: DEMO_NOTE },
    { name: 'Generalized anxiety disorder', icd10: 'F41.1', noted: '2016-03-12', status: 'Active', note: DEMO_NOTE },
    { name: 'Migraine with aura', icd10: 'G43.109', noted: '2019-08-22', status: 'Active', note: DEMO_NOTE },
    { name: 'Perimenopause / menopausal transition', icd10: 'N95.1', noted: '2024-03-18', status: 'Active', note: DEMO_NOTE },
    { name: 'Iron deficiency anemia (mild)', icd10: 'D50.9', noted: '2024-09-18', status: 'Active', note: DEMO_NOTE },
    { name: 'Vitamin D deficiency (recurrent)', icd10: 'E55.9', noted: '2020-11-04', status: 'Active', note: DEMO_NOTE },
    { name: 'History of postpartum depression (resolved)', icd10: 'Z86.59', noted: '2017-09-15', status: 'Resolved \u2014 history only', note: DEMO_NOTE },
  ],
};

const spouseMyChartHealthSummary = {
  patientName: 'Sarah User',
  summary: 'Patient: Sarah User (DOB 1983-09-04, age 41). Active issues: Hashimoto hypothyroidism (stable on levothyroxine), generalized anxiety disorder (stable on sertraline 6 yrs), migraine with aura (improved on topiramate), perimenopause with heavy menstrual bleeding (Mirena IUD placed Oct 2024), mild iron deficiency anemia, recurrent vitamin D deficiency. History of postpartum depression (2017, resolved). Preventive care up to date: mammogram BI-RADS 1 (Aug 2024), Pap + HPV negative (Aug 2024), HPV vaccine series complete. Family history significant for maternal breast cancer (age 58, in remission). Shares family physician (Dr. Sarah Mitchell) with spouse. Currently providing care support for her mother-in-law (Margaret User) \u2014 caregiver-burnout flag noted Aug 2024.',
  note: DEMO_NOTE,
};

const spouseMyChartUpcomingVisits = [
  {
    appointmentId: 'demo-sp-appt-001',
    dateTime: '2025-01-10T14:00:00',
    provider: 'Dr. Priya Reddy',
    specialty: 'Gynecology',
    department: 'Foothills Women\u2019s Health Centre',
    visitType: 'IUD 3-month follow-up',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-sp-appt-002',
    dateTime: '2025-03-15T11:00:00',
    provider: 'Dr. Marcus Thompson',
    specialty: 'Neurology',
    department: 'Neurology Clinic',
    visitType: 'Migraine follow-up (6 month)',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-sp-appt-003',
    dateTime: '2025-02-04T10:30:00',
    provider: 'Dr. Hannah Lee, R.Psych',
    specialty: 'Psychology',
    department: 'Insight Counselling',
    visitType: 'Therapy session (caregiver stress block, session 5 of 6)',
    note: DEMO_NOTE,
  },
];

const spouseMyChartPastVisits = [
  {
    appointmentId: 'demo-sp-past-001',
    dateTime: '2024-10-08T09:00:00',
    provider: 'Dr. Priya Reddy',
    specialty: 'Gynecology',
    department: 'Foothills Women\u2019s Health Centre',
    visitType: 'Mirena IUD insertion',
    summary: 'Counselled on IUD risks/benefits. Insertion uncomplicated. Sound to 7 cm. Will follow up in 3 months. Expect irregular bleeding for first 3-6 months. Topiramate-OCP interaction discussed \u2014 IUD preferred non-hormonal-systemic option.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-sp-past-002',
    dateTime: '2024-09-15T08:30:00',
    provider: 'Dr. Sarah Mitchell',
    specialty: 'Family Medicine',
    department: 'Sunnyside Family Clinic',
    visitType: 'Annual physical',
    summary: 'Discussed perimenopausal symptoms (hot flashes, irregular cycles, sleep disruption, mood). TSH stable. Sertraline maintained. Topiramate effective. Mammogram + Pap due \u2014 booked Aug 22. Hormone panel + iron studies ordered. Gynecology referral for HMB management (IUD vs OCP \u2014 IUD preferred given topiramate). Patient reports increased caregiver stress helping with mother-in-law. Reassessed safety-of-self questions \u2014 no concerns. Continue Dr. Lee therapy.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-sp-past-003',
    dateTime: '2024-08-22T11:30:00',
    provider: 'Dr. Sarah Mitchell',
    specialty: 'Family Medicine / Cancer Screening',
    department: 'Foothills Breast Health Centre',
    visitType: 'Mammography + Pap/HPV co-test',
    summary: 'Bilateral screening mammogram \u2014 BI-RADS 1 (negative). Cervical screening with Pap + HPV co-test \u2014 negative. Next mammogram in 1 year (annual given family history). Next cervical screening in 5 years.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-sp-past-004',
    dateTime: '2024-06-11T14:00:00',
    provider: 'Dr. Marcus Thompson',
    specialty: 'Neurology',
    department: 'Neurology Clinic',
    visitType: 'Migraine follow-up',
    summary: 'Migraine frequency reduced from 6/month to 2/month on topiramate 50 mg BID. Continue current dose. Discussed perimenopausal estrogen fluctuations as a potential modifier of migraine pattern. Continue magnesium adjunct. Sumatriptan use 4-6 doses/month \u2014 well under monthly limit. Return in 6 months.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-sp-past-005',
    dateTime: '2024-04-04T15:00:00',
    provider: 'Dr. Hannah Lee, R.Psych',
    specialty: 'Psychology',
    department: 'Insight Counselling',
    visitType: 'Therapy session (parenting stress + caregiver burden, session 2 of 6)',
    summary: 'Continued discussion of work-life-care balance. Helping spouse manage mother-in-law\u2019s medical appointments while also parenting young child. CBT-based coping strategies reviewed. No acute concerns. Sertraline well-tolerated. Will reassess at session 6.',
    note: DEMO_NOTE,
  },
];

const spouseMyChartMessages = [
  {
    messageId: 'demo-sp-msg-001',
    from: 'Sarah User',
    to: 'Dr. Priya Reddy, Gynecology',
    subject: 'IUD \u2014 bleeding 2 days after insertion',
    sentDate: '2024-10-10T19:15:00',
    body: 'Hi Dr. Reddy \u2014 the IUD insertion went fine on Tuesday but I started bleeding heavily again the next day. Is this normal? When should it start to settle? Thanks, Sarah',
    status: 'Read',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-sp-msg-002',
    from: 'Dr. Priya Reddy, Gynecology',
    to: 'Sarah User',
    subject: 'RE: IUD \u2014 bleeding 2 days after insertion',
    sentDate: '2024-10-11T09:00:00',
    body: 'Hi Sarah \u2014 yes, this is expected. Irregular bleeding (sometimes heavy at first) is normal for the first 3-6 months as the lining adjusts. Most people notice their periods get much lighter or stop entirely after that. Please call the clinic or come in if you\u2019re soaking through a pad or tampon every hour for more than 2 hours, develop a fever, or have severe abdominal pain. Otherwise, we\u2019ll reassess at your January follow-up. \u2014 Dr. Reddy',
    status: 'Read',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-sp-msg-003',
    from: 'Sarah User',
    to: 'Dr. Marcus Thompson, Neurology',
    subject: 'Migraines around my period \u2014 worse since perimenopause',
    sentDate: '2024-09-20T20:45:00',
    body: 'Hi Dr. Thompson \u2014 I\u2019ve had 2 migraines this month, both with aura, both right around the start of my period. Is the perimenopause making this worse? Should I do anything different? \u2014 Sarah',
    status: 'Read by provider',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-sp-msg-004',
    from: 'Sarah User',
    to: 'Dr. Sarah Mitchell, Family Medicine',
    subject: 'Feeling overwhelmed \u2014 caregiver stress',
    sentDate: '2024-08-28T22:30:00',
    body: 'Hi Dr. Mitchell \u2014 Demo\u2019s mom (Margaret) had a fall and we\u2019re trying to help more with her appointments and medications. I\u2019m feeling overwhelmed and not sleeping well. Should I increase the sertraline? I don\u2019t want this to slip into a depression again. \u2014 Sarah',
    status: 'Read',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-sp-msg-005',
    from: 'Dr. Sarah Mitchell, Family Medicine',
    to: 'Sarah User',
    subject: 'RE: Feeling overwhelmed \u2014 caregiver stress',
    sentDate: '2024-08-29T08:30:00',
    body: 'Hi Sarah \u2014 thank you for reaching out. Please don\u2019t change the sertraline without us talking first. Let\u2019s book a visit this week and reconnect you with Dr. Lee for a few sessions. Caregiver burnout is real and very common when caring for a parent with cognitive changes \u2014 you\u2019re not alone. We\u2019ll make a plan. \u2014 Dr. M',
    status: 'Read',
    note: DEMO_NOTE,
  },
];

const spouseMyChartCareTeam = {
  patientName: 'Sarah User',
  careTeam: [
    { name: 'Dr. Sarah Mitchell', role: 'Family Physician (Primary Care \u2014 shared with spouse)', phone: '(403) 555-0101', clinic: 'Sunnyside Family Clinic', note: DEMO_NOTE },
    { name: 'Dr. Priya Reddy', role: 'Gynecologist', phone: '(403) 555-0712', clinic: 'Foothills Women\u2019s Health Centre', note: DEMO_NOTE },
    { name: 'Dr. Marcus Thompson', role: 'Neurologist (Migraine)', phone: '(403) 555-0823', clinic: 'Neurology Clinic', note: DEMO_NOTE },
    { name: 'Dr. Hannah Lee, R.Psych', role: 'Psychologist', phone: '(403) 555-0934', clinic: 'Insight Counselling', note: DEMO_NOTE },
  ],
};

const spouseMyChartImmunizations = spouseImmunizations.map((imm, i) => ({
  immunizationId: 'demo-sp-mc-imm-' + (i + 1),
  name: imm.values?.[0]?.displayString,
  dateAdministered: imm.values?.[1]?.displayString,
  manufacturer: imm.values?.[2]?.displayString,
  note: DEMO_NOTE,
}));

const spouseMyChartMedications = spouseMedications.map((m, i) => ({
  medicationId: 'demo-sp-mc-med-' + (i + 1),
  ...(m as Record<string, unknown>),
  note: DEMO_NOTE,
}));

const spouseMyChartTestResults = [
  {
    resultId: 'demo-sp-tr-001',
    name: 'TSH (Thyroid)',
    collectedDate: '2024-09-16',
    value: '2.4 mIU/L (target on levothyroxine)',
    orderedBy: 'Dr. Sarah Mitchell',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-sp-tr-002',
    name: 'FSH (perimenopause)',
    collectedDate: '2024-09-16',
    value: '28 IU/L (perimenopausal pattern)',
    orderedBy: 'Dr. Sarah Mitchell',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-sp-tr-003',
    name: 'Ferritin / Hemoglobin',
    collectedDate: '2024-09-16',
    value: 'Ferritin 22 (low), Hb 118 (mildly low) \u2014 iron deficiency anemia',
    orderedBy: 'Dr. Sarah Mitchell',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-sp-tr-004',
    name: 'Mammogram (bilateral screening)',
    collectedDate: '2024-08-22',
    value: 'BI-RADS 1 \u2014 negative',
    orderedBy: 'Dr. Sarah Mitchell',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-sp-tr-005',
    name: 'Pap + HPV co-test',
    collectedDate: '2024-08-22',
    value: 'Negative for intraepithelial lesion or malignancy; HPV negative \u2014 next screening in 5 years',
    orderedBy: 'Dr. Sarah Mitchell',
    note: DEMO_NOTE,
  },
];

// ---------------------------------------------------------------------------
// Mock MHR Client (Sarah's data)
// ---------------------------------------------------------------------------

function createSpouseMHRClient(): MHRClient {
  return {
    getSessionStatus: async () => spouseSessionStatus,
    getUser: async () => spouseUserProfile,
    getLabResults: async () => spouseLabResults,
    getImmunizations: async () => spouseImmunizations,
    getMedications: async () => spouseMedications,
    getDiagnosticImaging: async () => spouseDiagnosticImaging,
    getHeightWeight: async () => spouseHeightWeight,
    getVitalSigns: async () => spouseVitalSigns,
    getBloodOxygen: async () => spouseBloodOxygen,
    getBloodPressure: async () => spouseBloodPressure,
    getExercise: async () => spouseExercise,
    getReferrals: async () => spouseReferrals,
    getProcedures: async () => spouseProcedures,
    // Not diabetic.
    getBloodGlucose: async () => [],
    getSleep: async () => spouseSleep,
    getDietaryIntake: async () => spouseDietaryIntake,
    getInsulin: async () => ({ injections: [], usage: [] }),
    getPeakFlow: async () => spousePeakFlow,
    getWaistCircumference: async () => spouseWaistCircumference,
    getSymptomJournal: async () => spouseSymptomJournal,
    downloadAttachment: async () => ({
      buffer: Buffer.from(`${DEMO_NOTE} \u2014 no real attachment in demo mode.`),
      contentType: 'text/plain',
    }),
  } as unknown as MHRClient;
}

// ---------------------------------------------------------------------------
// Mock MyChart Client (Sarah's data)
// ---------------------------------------------------------------------------

function createSpouseMyChartClient(): MyChartClient {
  return {
    getUpcomingVisits: async () => spouseMyChartUpcomingVisits,
    getPastVisits: async () => spouseMyChartPastVisits,
    getVisitDetails: async () => ({
      ...spouseMyChartPastVisits[0],
      Details: spouseMyChartPastVisits[0]?.summary,
      note: DEMO_NOTE,
    }),
    getHealthSummary: async () => spouseMyChartHealthSummary,
    getAllergies: async () => spouseMyChartAllergies,
    getHealthIssues: async () => spouseMyChartHealthIssues,
    getCareTeam: async () => spouseMyChartCareTeam,
    getConversationList: async () => spouseMyChartMessages,
    getConversationDetails: async () => ({
      ID: 'demo-sp-msg-001',
      Subject: 'IUD \u2014 bleeding 2 days after insertion',
      Messages: spouseMyChartMessages.slice(0, 2).map((m) => ({
        SenderName: m.from,
        Date: m.sentDate,
        Body: m.body,
      })),
      note: DEMO_NOTE,
    }),
    getMedicalHistory: async () => ({
      History: [
        {
          Condition: 'Vaginal delivery (full-term, uncomplicated)',
          Date: '2017-05-14',
          Type: 'Obstetric',
          Details: 'Healthy child (Liam User). No instrumentation. Postpartum course complicated by depression \u2014 resolved with SSRI + therapy.',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Postpartum depression (resolved)',
          Date: '2017-09-15',
          Type: 'Mental Health \u2014 historical',
          Details: 'Treated 2017-2018 with sertraline 50 mg + therapy. Full remission. Restarted SSRI 2016 \u2014 wait, restarted at 100 mg in 2016 for separate GAD course.',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Family History: Breast cancer',
          Date: null,
          Type: 'Family',
          Details: 'Mother \u2014 diagnosed age 58 (in remission post-treatment) \u2014 drives annual mammography screening',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Family History: Hypertension + Type 2 Diabetes',
          Date: null,
          Type: 'Family',
          Details: 'Father \u2014 alive age 70, both conditions',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getDocuments: async () => ({
      Documents: [
        {
          DocumentID: 'demo-sp-doc-001',
          DocumentName: 'After Visit Summary \u2014 IUD insertion',
          Date: '2024-10-08',
          Provider: 'Dr. Priya Reddy',
          Department: 'Gynecology',
          Type: 'After Visit Summary',
          note: DEMO_NOTE,
        },
        {
          DocumentID: 'demo-sp-doc-002',
          DocumentName: 'Mammography Report',
          Date: '2024-08-22',
          Provider: 'Dr. Sarah Mitchell',
          Department: 'Breast Health Centre',
          Type: 'Imaging Report',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getDocumentDetails: async () => ({
      DocumentName: 'After Visit Summary \u2014 IUD insertion',
      Date: '2024-10-08',
      Provider: 'Dr. Priya Reddy',
      Content: 'Mirena IUD insertion for heavy menstrual bleeding in perimenopause. Uncomplicated procedure. Sound 7 cm. Expect 3-6 months of irregular bleeding. Topiramate-OCP interaction discussed \u2014 IUD preferred over OCP. Follow-up in 3 months.',
      note: DEMO_NOTE,
    }),
    getUpcomingOrders: async () => ({
      Orders: [
        {
          OrderName: 'TSH + Free T4 (annual thyroid monitoring)',
          OrderDate: '2025-09-15',
          Status: 'Scheduled',
          Instructions: 'Fasting not required. Annual Hashimoto monitoring.',
          Provider: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
        {
          OrderName: 'Ferritin + CBC recheck',
          OrderDate: '2025-03-16',
          Status: 'Scheduled',
          Instructions: '6-month iron repletion recheck on ferrous fumarate',
          Provider: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getTestResultsList: async () => spouseMyChartTestResults,
    getTestResultDetails: async () => ({
      OrderName: 'Perimenopause Workup',
      OrderDate: '2024-09-16',
      Status: 'Final',
      Components: [
        { Name: 'TSH', Value: '2.4', Units: 'mIU/L', Range: '0.30 - 4.00', Flag: '' },
        { Name: 'FSH', Value: '28', Units: 'IU/L', Range: 'Follicular 3-10', Flag: 'High (perimenopausal)' },
        { Name: 'AMH', Value: '0.4', Units: 'ng/mL', Range: '> 1.0', Flag: 'Low (perimenopausal)' },
        { Name: 'Estradiol', Value: '142', Units: 'pmol/L', Range: 'Variable', Flag: '' },
        { Name: 'Ferritin', Value: '22', Units: 'ug/L', Range: '30 - 200', Flag: 'Low' },
        { Name: 'Hemoglobin', Value: '118', Units: 'g/L', Range: '120 - 160', Flag: 'Low' },
      ],
      note: DEMO_NOTE,
    }),
    getReportContent: async () => ({ ReportContent: 'No report content available in demo mode.', note: DEMO_NOTE }),
    getFamilyTree: async () => ({
      FamilyMembers: [
        { Relationship: 'Mother', Conditions: ['Breast cancer \u2014 diagnosed age 58, in remission post-treatment'], Deceased: false, note: DEMO_NOTE },
        { Relationship: 'Father', Conditions: ['Hypertension', 'Type 2 Diabetes'], Deceased: false, note: DEMO_NOTE },
        { Relationship: 'Brother', Conditions: ['No significant medical history'], Deceased: false, note: DEMO_NOTE },
        { Relationship: 'Spouse (Demo User)', Conditions: ['Type 2 Diabetes, Hypertension, Hyperlipidemia'], Deceased: false, note: DEMO_NOTE },
        { Relationship: 'Mother-in-law (Margaret User)', Conditions: ['T2D, AFib, HFpEF, mild dementia, CKD3a'], Deceased: false, note: DEMO_NOTE },
      ],
      note: DEMO_NOTE,
    }),
    getPatientGoals: async () => ({
      Goals: [
        {
          GoalName: 'Manage perimenopause non-hormonally first',
          Target: 'Use IUD + lifestyle before considering MHT',
          Current: 'Mirena IUD placed Oct 2024',
          Status: 'In Progress',
          StartDate: '2024-09-15',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Maintain mental health stability',
          Target: 'No relapse of depression; continue therapy + sertraline as needed',
          Current: 'Stable on sertraline 100 mg; 6-session therapy block ongoing',
          Status: 'On track',
          StartDate: '2016-03-12',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getCareTeamGoals: async () => ({
      Goals: [
        {
          GoalName: 'Annual TSH monitoring (Hashimoto\u2019s)',
          Description: 'Check TSH and Free T4 annually; titrate levothyroxine as needed',
          DueDate: '2025-09-15',
          Status: 'Scheduled',
          Owner: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Migraine prophylaxis effectiveness review',
          Description: 'Reassess topiramate dose and sumatriptan use; adjust if frequency increases',
          DueDate: '2025-03-15',
          Status: 'Scheduled',
          Owner: 'Dr. Marcus Thompson',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Depression relapse surveillance (perimenopause)',
          Description: 'Patient has history of PPD and current caregiver burden; screen at every visit',
          DueDate: 'Ongoing',
          Status: 'In Progress',
          Owner: 'Dr. Sarah Mitchell + Dr. Hannah Lee',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Annual mammography (family history)',
          Description: 'Mother had breast cancer at age 58 \u2014 annual screening recommended',
          DueDate: '2025-08-22',
          Status: 'Scheduled',
          Owner: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getReferralsList: async () => ({
      Referrals: spouseReferrals.map((r, i) => ({
        ReferralID: 'demo-sp-mc-ref-' + (i + 1),
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
      ReferralID: 'demo-sp-mc-ref-1',
      Specialty: 'Gynecology',
      Provider: 'Dr. Priya Reddy',
      Reason: 'Heavy menstrual bleeding in perimenopause \u2014 IUD insertion consult',
      Status: 'Completed (IUD inserted Oct 8, 2024)',
      note: DEMO_NOTE,
    }),
    getMedications: async () => spouseMyChartMedications,
    getImmunizations: async () => spouseMyChartImmunizations,
    getHistoricalResults: async () => ({
      Components: [
        {
          Name: 'TSH',
          Units: 'mIU/L',
          Range: '0.30 - 4.00',
          Results: [
            { Date: '2022-09-12', Value: '3.2' },
            { Date: '2023-09-05', Value: '2.8' },
            { Date: '2024-09-16', Value: '2.4' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'FSH',
          Units: 'IU/L',
          Range: 'Follicular 3-10',
          Results: [
            { Date: '2023-09-05', Value: '12' },
            { Date: '2024-09-16', Value: '28', Flag: 'Perimenopausal' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'Ferritin',
          Units: 'ug/L',
          Range: '30 - 200',
          Results: [
            { Date: '2022-09-12', Value: '45' },
            { Date: '2023-09-05', Value: '38' },
            { Date: '2024-09-16', Value: '22', Flag: 'Low' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'Hemoglobin',
          Units: 'g/L',
          Range: '120 - 160',
          Results: [
            { Date: '2023-09-05', Value: '128' },
            { Date: '2024-09-16', Value: '118', Flag: 'Low' },
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

export const spousePersona: Persona = {
  id: 'spouse',
  recordId: 'rec-demo-spouse',
  proxyEid: 'spouse',
  displayName: 'Sarah User',
  relationshipType: 'Spouse',
  isCustodian: false,
  isSelf: false,
  dob: '1983-09-04',
  age: 41,
  patientInfo: 'DOB: 1983-09-04',
  accessLevel: 'Limited',
  description: '41-year-old female \u2014 Hashimoto hypothyroidism, generalized anxiety disorder on long-term SSRI, migraine with aura on topiramate prophylaxis, perimenopause with recent Mirena IUD, mild iron deficiency anemia. History of postpartum depression (resolved). Up-to-date preventive care.',
  mhrClient: createSpouseMHRClient(),
  myChartClient: createSpouseMyChartClient(),
};
