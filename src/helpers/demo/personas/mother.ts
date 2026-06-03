/**
 * Demo persona — Margaret User (the Demo User's mother).
 *
 * Clinical narrative: 72-year-old female with multimorbidity typical of the
 * "sandwich generation" caregiving scenario — Type 2 Diabetes (since 2002),
 * Atrial Fibrillation (since 2018, on apixaban), HFpEF, mild Alzheimer-type
 * dementia (since 2022), CKD stage 3a, hypothyroidism, hyperlipidemia,
 * osteoporosis, osteoarthritis of both knees, and hypertension.
 *
 * Lab trends show worsening HbA1c (7.4 -> 7.9 over 18 months), declining
 * eGFR (56 -> 48), mild iron-deficiency anemia (likely metformin-related
 * B12/iron malabsorption), and borderline-high potassium (losartan +
 * spironolactone). Twelve active medications create classic polypharmacy
 * concerns: donepezil + metoprolol bradycardia risk, glipizide hypoglycemia
 * with CKD, apixaban dosing rationale, NSAID avoidance with CKD.
 *
 * Recent ED visit (Nov 2024) for AFib with rapid ventricular response
 * (treated with IV diltiazem). Memory clinic shows MoCA decline 26 -> 24
 * -> 22 over 18 months. Recent fall (Oct 2024) prompted OT home-safety
 * assessment. Caregiver artifacts include proxy access, blister-pack
 * dispensing, a missed appointment in Aug 2024, and an advance care
 * planning discussion (Nov 2024).
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

const motherUserProfile: UserProfile = {
  personId: 'demo-mother-001',
  name: 'Margaret User',
  selectedRecordId: 'rec-demo-mother',
  defaultUserLanguage: 'en-CA',
  isEmergencyAccessMode: false,
  createdDateTimeUtc: '2018-04-10T00:00:00Z',
  authorizedRecords: [
    {
      id: 'rec-demo-mother',
      isCustodian: false,
      displayName: 'Margaret User',
      name: 'Margaret User',
      relationshipType: 'Mother',
      patientInfo: 'DOB: 1952-03-22',
    },
  ],
};

const motherSessionStatus: SessionStatus = {
  isSessionExpired: false,
  numberOfMilliSecondsLeftForSessionExpire: 600_000,
};

// Lab results across 4 timepoints showing chronic disease progression:
//  - HbA1c trend 7.4 -> 7.6 -> 7.8 -> 7.9 (worsening glycemic control)
//  - eGFR trend  56  -> 52  -> 50  -> 48  (CKD stage 3a progression)
//  - Mild anemia (Hb 108) with low MCV + ferritin (Dec 2024) suggesting
//    iron deficiency, likely contributed to by long-term metformin use.
const motherLabResults: LabResult[] = [
  // --- Dec 2024: Diabetes Monitoring + CMP + CBC (most recent) ---
  {
    labTestDate: { date: 8, month: 11, year: 2024, hour: 9, minute: 0, second: 0, hasTimePart: true },
    labResultDate: '2024-12-08T09:00:00',
    labResultDisplayDate: 'Dec 8, 2024',
    labResultDisplayDateText: 'December 8, 2024',
    laboratoryName: 'Alberta Precision Laboratories',
    orderedByName: 'Dr. Sarah Mitchell',
    orderByType: 'Family Medicine',
    source: 'APL',
    clientId: 101,
    thingId: 'demo-mom-thing-101',
    versionStamp: 'v1',
    isReadOnly: true,
    isItemRestricted: false,
    customData: [],
    group: [
      {
        groupName: 'Diabetes Monitoring',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false, hasGroupWithOutResult: false,
        labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
        results: [
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Hemoglobin A1c (HbA1c)', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-101',
            clinicalCode: { text: 'HBA1C', code: [{ value: '4548-4', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '7.9', value: '7.9', unitText: '%', rangeDisplayText: '< 7.0' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Fasting Glucose', index: 1, eduContent: '', resultUniqueId: 'demo-mom-r-102',
            clinicalCode: { text: 'GLUF', code: [{ value: '1558-6', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '8.6', value: '8.6', unitText: 'mmol/L', rangeDisplayText: '3.6 - 6.0' },
          },
        ],
      },
      {
        groupName: 'Comprehensive Metabolic Panel',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false, hasGroupWithOutResult: false,
        labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
        results: [
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Creatinine', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-103',
            clinicalCode: { text: 'CREA', code: [{ value: '2160-0', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '105', value: '105', unitText: 'umol/L', rangeDisplayText: '45 - 84' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'eGFR', index: 1, eduContent: '', resultUniqueId: 'demo-mom-r-104',
            clinicalCode: { text: 'EGFR', code: [{ value: '62238-1', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '48', value: '48', unitText: 'mL/min/1.73m2', rangeDisplayText: '> 60' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Potassium', index: 2, eduContent: '', resultUniqueId: 'demo-mom-r-105',
            clinicalCode: { text: 'K', code: [{ value: '2823-3', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '5.0', value: '5.0', unitText: 'mmol/L', rangeDisplayText: '3.5 - 5.0' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Sodium', index: 3, eduContent: '', resultUniqueId: 'demo-mom-r-106',
            clinicalCode: { text: 'NA', code: [{ value: '2951-2', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '138', value: '138', unitText: 'mmol/L', rangeDisplayText: '135 - 145' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Calcium', index: 4, eduContent: '', resultUniqueId: 'demo-mom-r-107',
            clinicalCode: { text: 'CA', code: [{ value: '17861-6', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '2.32', value: '2.32', unitText: 'mmol/L', rangeDisplayText: '2.15 - 2.55' },
          },
        ],
      },
      {
        groupName: 'Complete Blood Count (CBC)',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false, hasGroupWithOutResult: false,
        labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
        results: [
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Hemoglobin', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-108',
            clinicalCode: { text: 'HGB', code: [{ value: '718-7', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '108', value: '108', unitText: 'g/L', rangeDisplayText: '120 - 160' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'MCV (Mean Corpuscular Volume)', index: 1, eduContent: '', resultUniqueId: 'demo-mom-r-109',
            clinicalCode: { text: 'MCV', code: [{ value: '787-2', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '76', value: '76', unitText: 'fL', rangeDisplayText: '80 - 100' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'White Blood Cells', index: 2, eduContent: '', resultUniqueId: 'demo-mom-r-110',
            clinicalCode: { text: 'WBC', code: [{ value: '6690-2', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '6.4', value: '6.4', unitText: '10^9/L', rangeDisplayText: '4.0 - 11.0' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Platelets', index: 3, eduContent: '', resultUniqueId: 'demo-mom-r-111',
            clinicalCode: { text: 'PLT', code: [{ value: '777-3', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '232', value: '232', unitText: '10^9/L', rangeDisplayText: '150 - 400' },
          },
        ],
      },
      {
        groupName: 'Iron Studies + B12',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false, hasGroupWithOutResult: false,
        labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
        results: [
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Ferritin', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-112',
            clinicalCode: { text: 'FERR', code: [{ value: '2276-4', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '18', value: '18', unitText: 'ug/L', rangeDisplayText: '30 - 200' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Vitamin B12', index: 1, eduContent: '', resultUniqueId: 'demo-mom-r-113',
            clinicalCode: { text: 'B12', code: [{ value: '2132-9', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '155', value: '155', unitText: 'pmol/L', rangeDisplayText: '150 - 700' },
          },
        ],
      },
      {
        groupName: 'Lipid Panel',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false, hasGroupWithOutResult: false,
        labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
        results: [
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'Total Cholesterol', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-114',
            clinicalCode: { text: 'CHOL', code: [{ value: '2093-3', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '5.4', value: '5.4', unitText: 'mmol/L', rangeDisplayText: '< 5.2' },
          },
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'LDL Cholesterol', index: 1, eduContent: '', resultUniqueId: 'demo-mom-r-115',
            clinicalCode: { text: 'LDL', code: [{ value: '2089-1', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '3.4', value: '3.4', unitText: 'mmol/L', rangeDisplayText: '< 2.6' },
          },
        ],
      },
      {
        groupName: 'Thyroid',
        laboratoryName: 'Alberta Precision Laboratories',
        isOtherSection: false, hasGroupWithOutResult: false,
        labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
        results: [
          {
            when: '2024-12-08T09:00:00', whenDate: '2024-12-08', displayDate: 'Dec 8, 2024',
            name: 'TSH', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-116',
            clinicalCode: { text: 'TSH', code: [{ value: '3016-3', family: 'LOINC', type: 'test' }] },
            customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
            values: { displayValue: '2.8', value: '2.8', unitText: 'mIU/L', rangeDisplayText: '0.4 - 4.0' },
          },
        ],
      },
    ],
  },
];

// --- Jun 2024 timepoint: HbA1c 7.8, eGFR 50 ---
motherLabResults.push({
  labTestDate: { date: 12, month: 5, year: 2024, hour: 9, minute: 0, second: 0, hasTimePart: true },
  labResultDate: '2024-06-12T09:00:00',
  labResultDisplayDate: 'Jun 12, 2024',
  labResultDisplayDateText: 'June 12, 2024',
  laboratoryName: 'Alberta Precision Laboratories',
  orderedByName: 'Dr. Sarah Mitchell',
  orderByType: 'Family Medicine',
  source: 'APL', clientId: 102, thingId: 'demo-mom-thing-102', versionStamp: 'v1',
  isReadOnly: true, isItemRestricted: false, customData: [],
  group: [
    {
      groupName: 'Diabetes Monitoring',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-06-12T09:00:00', whenDate: '2024-06-12', displayDate: 'Jun 12, 2024',
          name: 'Hemoglobin A1c (HbA1c)', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-201',
          clinicalCode: { text: 'HBA1C', code: [{ value: '4548-4', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '7.8', value: '7.8', unitText: '%', rangeDisplayText: '< 7.0' },
        },
        {
          when: '2024-06-12T09:00:00', whenDate: '2024-06-12', displayDate: 'Jun 12, 2024',
          name: 'Fasting Glucose', index: 1, eduContent: '', resultUniqueId: 'demo-mom-r-202',
          clinicalCode: { text: 'GLUF', code: [{ value: '1558-6', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '8.2', value: '8.2', unitText: 'mmol/L', rangeDisplayText: '3.6 - 6.0' },
        },
      ],
    },
    {
      groupName: 'Comprehensive Metabolic Panel',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-06-12T09:00:00', whenDate: '2024-06-12', displayDate: 'Jun 12, 2024',
          name: 'Creatinine', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-203',
          clinicalCode: { text: 'CREA', code: [{ value: '2160-0', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '100', value: '100', unitText: 'umol/L', rangeDisplayText: '45 - 84' },
        },
        {
          when: '2024-06-12T09:00:00', whenDate: '2024-06-12', displayDate: 'Jun 12, 2024',
          name: 'eGFR', index: 1, eduContent: '', resultUniqueId: 'demo-mom-r-204',
          clinicalCode: { text: 'EGFR', code: [{ value: '62238-1', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '50', value: '50', unitText: 'mL/min/1.73m2', rangeDisplayText: '> 60' },
        },
        {
          when: '2024-06-12T09:00:00', whenDate: '2024-06-12', displayDate: 'Jun 12, 2024',
          name: 'Potassium', index: 2, eduContent: '', resultUniqueId: 'demo-mom-r-205',
          clinicalCode: { text: 'K', code: [{ value: '2823-3', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '4.8', value: '4.8', unitText: 'mmol/L', rangeDisplayText: '3.5 - 5.0' },
        },
      ],
    },
    {
      groupName: 'Complete Blood Count (CBC)',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-06-12T09:00:00', whenDate: '2024-06-12', displayDate: 'Jun 12, 2024',
          name: 'Hemoglobin', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-206',
          clinicalCode: { text: 'HGB', code: [{ value: '718-7', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '114', value: '114', unitText: 'g/L', rangeDisplayText: '120 - 160' },
        },
      ],
    },
  ],
});

// --- Dec 2023 timepoint: HbA1c 7.6, eGFR 52 ---
motherLabResults.push({
  labTestDate: { date: 4, month: 11, year: 2023, hour: 9, minute: 15, second: 0, hasTimePart: true },
  labResultDate: '2023-12-04T09:15:00',
  labResultDisplayDate: 'Dec 4, 2023',
  labResultDisplayDateText: 'December 4, 2023',
  laboratoryName: 'Alberta Precision Laboratories',
  orderedByName: 'Dr. Sarah Mitchell',
  orderByType: 'Family Medicine',
  source: 'APL', clientId: 103, thingId: 'demo-mom-thing-103', versionStamp: 'v1',
  isReadOnly: true, isItemRestricted: false, customData: [],
  group: [
    {
      groupName: 'Diabetes Monitoring',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2023-12-04T09:15:00', whenDate: '2023-12-04', displayDate: 'Dec 4, 2023',
          name: 'Hemoglobin A1c (HbA1c)', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-301',
          clinicalCode: { text: 'HBA1C', code: [{ value: '4548-4', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '7.6', value: '7.6', unitText: '%', rangeDisplayText: '< 7.0' },
        },
      ],
    },
    {
      groupName: 'Comprehensive Metabolic Panel',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2023-12-04T09:15:00', whenDate: '2023-12-04', displayDate: 'Dec 4, 2023',
          name: 'Creatinine', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-302',
          clinicalCode: { text: 'CREA', code: [{ value: '2160-0', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '95', value: '95', unitText: 'umol/L', rangeDisplayText: '45 - 84' },
        },
        {
          when: '2023-12-04T09:15:00', whenDate: '2023-12-04', displayDate: 'Dec 4, 2023',
          name: 'eGFR', index: 1, eduContent: '', resultUniqueId: 'demo-mom-r-303',
          clinicalCode: { text: 'EGFR', code: [{ value: '62238-1', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '52', value: '52', unitText: 'mL/min/1.73m2', rangeDisplayText: '> 60' },
        },
        {
          when: '2023-12-04T09:15:00', whenDate: '2023-12-04', displayDate: 'Dec 4, 2023',
          name: 'Potassium', index: 2, eduContent: '', resultUniqueId: 'demo-mom-r-304',
          clinicalCode: { text: 'K', code: [{ value: '2823-3', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '4.6', value: '4.6', unitText: 'mmol/L', rangeDisplayText: '3.5 - 5.0' },
        },
      ],
    },
  ],
});

// --- Jun 2023 timepoint: baseline HbA1c 7.4, eGFR 56 ---
motherLabResults.push({
  labTestDate: { date: 6, month: 5, year: 2023, hour: 9, minute: 0, second: 0, hasTimePart: true },
  labResultDate: '2023-06-06T09:00:00',
  labResultDisplayDate: 'Jun 6, 2023',
  labResultDisplayDateText: 'June 6, 2023',
  laboratoryName: 'Alberta Precision Laboratories',
  orderedByName: 'Dr. Sarah Mitchell',
  orderByType: 'Family Medicine',
  source: 'APL', clientId: 104, thingId: 'demo-mom-thing-104', versionStamp: 'v1',
  isReadOnly: true, isItemRestricted: false, customData: [],
  group: [
    {
      groupName: 'Diabetes Monitoring',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2023-06-06T09:00:00', whenDate: '2023-06-06', displayDate: 'Jun 6, 2023',
          name: 'Hemoglobin A1c (HbA1c)', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-401',
          clinicalCode: { text: 'HBA1C', code: [{ value: '4548-4', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '7.4', value: '7.4', unitText: '%', rangeDisplayText: '< 7.0' },
        },
      ],
    },
    {
      groupName: 'Comprehensive Metabolic Panel',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2023-06-06T09:00:00', whenDate: '2023-06-06', displayDate: 'Jun 6, 2023',
          name: 'eGFR', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-402',
          clinicalCode: { text: 'EGFR', code: [{ value: '62238-1', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '56', value: '56', unitText: 'mL/min/1.73m2', rangeDisplayText: '> 60' },
        },
      ],
    },
  ],
});

// --- NT-proBNP elevated post-ED visit (Nov 2024 cardiology workup) ---
motherLabResults.push({
  labTestDate: { date: 22, month: 10, year: 2024, hour: 10, minute: 30, second: 0, hasTimePart: true },
  labResultDate: '2024-11-22T10:30:00',
  labResultDisplayDate: 'Nov 22, 2024',
  labResultDisplayDateText: 'November 22, 2024',
  laboratoryName: 'Alberta Precision Laboratories',
  orderedByName: 'Dr. Linda Chen',
  orderByType: 'Cardiology',
  source: 'APL', clientId: 105, thingId: 'demo-mom-thing-105', versionStamp: 'v1',
  isReadOnly: true, isItemRestricted: false, customData: [],
  group: [
    {
      groupName: 'Cardiac Biomarkers',
      laboratoryName: 'Alberta Precision Laboratories',
      isOtherSection: false, hasGroupWithOutResult: false,
      labOrderStatus: 'Final', attachmentCount: 0, attachment: [], customData: [],
      results: [
        {
          when: '2024-11-22T10:30:00', whenDate: '2024-11-22', displayDate: 'Nov 22, 2024',
          name: 'NT-proBNP', index: 0, eduContent: '', resultUniqueId: 'demo-mom-r-501',
          clinicalCode: { text: 'NTBNP', code: [{ value: '33762-6', family: 'LOINC', type: 'test' }] },
          customData: [], labOrderStatus: 'Final', labOrderStatusValue: 'F',
          values: { displayValue: '1840', value: '1840', unitText: 'ng/L', rangeDisplayText: '< 300' },
        },
      ],
    },
  ],
});

const motherImmunizations: ImmunizationRecord[] = [
  {
    itemKey: { thingId: 'demo-mom-imm-001', versionStamp: 'v1' },
    effectiveDate: { date: 18, month: 9, year: 2024, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Influenza Vaccine (2024-2025, high-dose, senior formulation)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'October 18, 2024' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Sanofi Pasteur (Fluzone High-Dose)' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-MOM-FLU-2024' },
    ],
  },
  {
    itemKey: { thingId: 'demo-mom-imm-002', versionStamp: 'v1' },
    effectiveDate: { date: 22, month: 9, year: 2024, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'COVID-19 mRNA Vaccine (XBB.1.5 booster)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'October 22, 2024' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Pfizer-BioNTech' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-MOM-COV-2024' },
      { kind: 5, name: 'Dose', data: null, displayString: 'Fall 2024 booster' },
    ],
  },
  {
    itemKey: { thingId: 'demo-mom-imm-003', versionStamp: 'v1' },
    effectiveDate: { date: 8, month: 4, year: 2020, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Pneumococcal Conjugate (PCV20)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'May 8, 2020' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Pfizer' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-MOM-PCV20' },
    ],
  },
  {
    itemKey: { thingId: 'demo-mom-imm-004', versionStamp: 'v1' },
    effectiveDate: { date: 14, month: 3, year: 2019, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Shingrix (Zoster Recombinant)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'April 14, 2019' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'GlaxoSmithKline' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-MOM-SHIN-1' },
      { kind: 5, name: 'Dose', data: null, displayString: '1st of 2' },
    ],
  },
  {
    itemKey: { thingId: 'demo-mom-imm-005', versionStamp: 'v1' },
    effectiveDate: { date: 20, month: 8, year: 2019, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Shingrix (Zoster Recombinant)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'September 20, 2019' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'GlaxoSmithKline' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-MOM-SHIN-2' },
      { kind: 5, name: 'Dose', data: null, displayString: '2nd of 2 (series complete)' },
    ],
  },
  {
    itemKey: { thingId: 'demo-mom-imm-006', versionStamp: 'v1' },
    effectiveDate: { date: 5, month: 8, year: 2022, hasTimePart: false, hour: 0, minute: 0, second: 0 },
    isReadOnly: true, isItemRestricted: false, thingBasedStyleClass: '', clientId: '',
    values: [
      { kind: 1, name: 'Name', data: null, displayString: 'Tdap (Tetanus, Diphtheria, Pertussis)' },
      { kind: 2, name: 'Date Administered', data: null, displayString: 'September 5, 2022' },
      { kind: 3, name: 'Manufacturer', data: null, displayString: 'Sanofi Pasteur' },
      { kind: 4, name: 'Lot Number', data: null, displayString: 'DEMO-MOM-TDAP' },
    ],
  },
];

// Polypharmacy: 12 active prescriptions plus 2 OTC supplements.
const motherMedications: unknown[] = [
  { name: 'Metformin', strength: '500 mg', form: 'Tablet', route: 'Oral', frequency: 'Twice daily with meals',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2002-08-14', status: 'Active', note: DEMO_NOTE },
  { name: 'Glipizide', strength: '5 mg', form: 'Tablet', route: 'Oral', frequency: 'Twice daily before meals',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2018-02-20', status: 'Active', note: DEMO_NOTE },
  { name: 'Apixaban (Eliquis)', strength: '5 mg', form: 'Tablet', route: 'Oral', frequency: 'Twice daily',
    prescribedBy: 'Dr. Linda Chen', prescribedDate: '2018-11-03', status: 'Active', note: DEMO_NOTE },
  { name: 'Metoprolol succinate (Lopresor SR)', strength: '50 mg', form: 'Extended-release tablet', route: 'Oral', frequency: 'Once daily',
    prescribedBy: 'Dr. Linda Chen', prescribedDate: '2018-11-03', status: 'Active', note: DEMO_NOTE },
  { name: 'Spironolactone', strength: '12.5 mg', form: 'Tablet', route: 'Oral', frequency: 'Once daily',
    prescribedBy: 'Dr. Linda Chen', prescribedDate: '2022-05-18', status: 'Active', note: DEMO_NOTE },
  { name: 'Furosemide (Lasix)', strength: '20 mg', form: 'Tablet', route: 'Oral', frequency: 'As needed for ankle swelling',
    prescribedBy: 'Dr. Linda Chen', prescribedDate: '2022-05-18', status: 'Active', note: DEMO_NOTE },
  { name: 'Amlodipine', strength: '5 mg', form: 'Tablet', route: 'Oral', frequency: 'Once daily',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2015-06-10', status: 'Active', note: DEMO_NOTE },
  { name: 'Losartan', strength: '50 mg', form: 'Tablet', route: 'Oral', frequency: 'Once daily',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2019-09-04', status: 'Active', note: DEMO_NOTE },
  { name: 'Donepezil (Aricept)', strength: '5 mg', form: 'Tablet', route: 'Oral', frequency: 'Once daily at bedtime',
    prescribedBy: 'Dr. Emily Watson', prescribedDate: '2023-01-30', status: 'Active', note: DEMO_NOTE },
  { name: 'Levothyroxine', strength: '75 mcg', form: 'Tablet', route: 'Oral', frequency: 'Once daily, fasting',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2010-04-12', status: 'Active', note: DEMO_NOTE },
  { name: 'Acetaminophen (Tylenol Arthritis)', strength: '650 mg', form: 'Extended-release tablet', route: 'Oral', frequency: 'Three times daily (max 3 g/day)',
    prescribedBy: 'Dr. Anita Hayes', prescribedDate: '2023-08-22', status: 'Active', note: DEMO_NOTE },
  { name: 'Diclofenac 1% topical (Voltaren Emulgel)', strength: '1%', form: 'Topical gel', route: 'Topical to knees', frequency: 'Twice daily as needed',
    prescribedBy: 'Dr. Anita Hayes', prescribedDate: '2023-08-22', status: 'Active', note: DEMO_NOTE },
  { name: 'Vitamin D3', strength: '1000 IU', form: 'Softgel', route: 'Oral', frequency: 'Once daily',
    prescribedBy: 'OTC (recommended by Dr. Mitchell)', prescribedDate: '2020-01-15', status: 'Active', note: DEMO_NOTE },
  { name: 'Calcium carbonate', strength: '500 mg', form: 'Tablet', route: 'Oral', frequency: 'Twice daily with meals',
    prescribedBy: 'OTC (recommended by Dr. Mitchell)', prescribedDate: '2020-01-15', status: 'Active', note: DEMO_NOTE },
  { name: 'Atorvastatin', strength: '20 mg', form: 'Tablet', route: 'Oral', frequency: 'Once daily at bedtime',
    prescribedBy: 'Dr. Sarah Mitchell', prescribedDate: '2015-03-10',
    status: 'Discontinued 2022-02-14 \u2014 statin-associated muscle pain (myalgia); CK normal, symptoms resolved off therapy',
    note: DEMO_NOTE },
];

const motherDiagnosticImaging: unknown[] = [
  {
    labTestDate: { date: 12, month: 2, year: 2024, hour: 10, minute: 0, second: 0, hasTimePart: true },
    labResultDisplayDateText: 'March 12, 2024',
    laboratoryName: 'Foothills Medical Centre \u2014 DEXA Scan',
    orderedByName: 'Dr. Anita Hayes',
    source: 'AHS',
    thingId: 'demo-mom-img-001',
    group: [
      {
        groupName: 'DEXA (Bone Density)',
        labOrderStatus: 'Final',
        results: [
          {
            name: 'Lumbar Spine T-score',
            values: { displayValue: '-2.6 (osteoporosis)', unitText: '' },
            displayDate: 'Mar 12, 2024',
          },
          {
            name: 'Femoral Neck T-score',
            values: { displayValue: '-2.1 (osteopenia)', unitText: '' },
            displayDate: 'Mar 12, 2024',
          },
          {
            name: 'Total Hip T-score',
            values: { displayValue: '-1.8 (osteopenia)', unitText: '' },
            displayDate: 'Mar 12, 2024',
          },
        ],
        attachment: [],
      },
    ],
  },
  {
    labTestDate: { date: 20, month: 10, year: 2024, hour: 13, minute: 0, second: 0, hasTimePart: true },
    labResultDisplayDateText: 'November 20, 2024',
    laboratoryName: 'Foothills Medical Centre \u2014 Cardiology',
    orderedByName: 'Dr. Linda Chen',
    source: 'AHS',
    thingId: 'demo-mom-img-002',
    group: [
      {
        groupName: 'Transthoracic Echocardiogram',
        labOrderStatus: 'Final',
        results: [
          {
            name: 'Echo Report',
            values: {
              displayValue: 'LVEF 58% (preserved). Mild concentric LV hypertrophy. Grade II diastolic dysfunction. Left atrial enlargement. No significant valvular disease. RVSP 38 mmHg (mildly elevated). Findings consistent with HFpEF.',
              unitText: '',
            },
            displayDate: 'Nov 20, 2024',
          },
        ],
        attachment: [],
      },
    ],
  },
  {
    labTestDate: { date: 18, month: 10, year: 2024, hour: 23, minute: 14, second: 0, hasTimePart: true },
    labResultDisplayDateText: 'November 18, 2024',
    laboratoryName: 'Rockyview General Hospital \u2014 Emergency Department',
    orderedByName: 'Dr. Amir Khan',
    source: 'AHS',
    thingId: 'demo-mom-img-003',
    group: [
      {
        groupName: '12-Lead ECG',
        labOrderStatus: 'Final',
        results: [
          {
            name: 'ECG Interpretation',
            values: {
              displayValue: 'Atrial fibrillation with rapid ventricular response, rate 138 bpm. No ST-segment abnormalities. QTc 432 ms.',
              unitText: '',
            },
            displayDate: 'Nov 18, 2024',
          },
        ],
        attachment: [],
      },
    ],
  },
];

const motherHeightWeight = {
  height: [
    {
      effectiveDate: { date: 8, month: 11, year: 2024 },
      values: [{ displayString: '163', name: 'Height (cm)' }],
      note: DEMO_NOTE,
    },
  ],
  weight: [
    {
      effectiveDate: { date: 8, month: 11, year: 2024 },
      values: [{ displayString: '68', name: 'Weight (kg)' }],
      note: DEMO_NOTE,
    },
    {
      effectiveDate: { date: 4, month: 11, year: 2023 },
      values: [{ displayString: '71', name: 'Weight (kg)' }],
      note: DEMO_NOTE,
    },
  ],
  bmi: [
    {
      effectiveDate: { date: 8, month: 11, year: 2024 },
      values: [{ displayString: '25.6', name: 'BMI' }],
      note: DEMO_NOTE,
    },
  ],
};

// BP includes an orthostatic drop (lying \u2192 standing) flagged for the falls workup.
const motherBloodPressure = [
  {
    effectiveDate: { date: 8, month: 11, year: 2024, hour: 9, minute: 5, second: 0 },
    values: [
      { displayString: '138', name: 'Systolic (mmHg)' },
      { displayString: '82', name: 'Diastolic (mmHg)' },
      { displayString: '62', name: 'Pulse (bpm)' },
      { displayString: 'Seated, left arm, after 5 min rest', name: 'Position' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 22, month: 9, year: 2024, hour: 11, minute: 0, second: 0 },
    values: [
      { displayString: '142', name: 'Systolic (mmHg)' },
      { displayString: '85', name: 'Diastolic (mmHg)' },
      { displayString: '64', name: 'Pulse (bpm)' },
      { displayString: 'Seated, left arm', name: 'Position' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 15, month: 9, year: 2024, hour: 9, minute: 30, second: 0 },
    values: [
      { displayString: '138', name: 'Systolic (mmHg)' },
      { displayString: '82', name: 'Diastolic (mmHg)' },
      { displayString: '58', name: 'Pulse (bpm)' },
      { displayString: 'Lying (supine), 5 min rest', name: 'Position' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 15, month: 9, year: 2024, hour: 9, minute: 33, second: 0 },
    values: [
      { displayString: '122', name: 'Systolic (mmHg)' },
      { displayString: '76', name: 'Diastolic (mmHg)' },
      { displayString: '72', name: 'Pulse (bpm)' },
      { displayString: 'Standing, 3 min after standing \u2014 orthostatic drop \u22ef16 mmHg systolic', name: 'Position' },
    ],
    note: DEMO_NOTE,
  },
];

// Home fingerstick log: a couple of pre-supper hypos consistent with glipizide + CKD3a.
const motherBloodGlucose = [
  {
    effectiveDate: { date: 4, month: 11, year: 2024, hour: 17, minute: 30, second: 0 },
    values: [
      { displayString: '3.8', name: 'Glucose (mmol/L)' },
      { displayString: 'Before supper (hypo \u2014 corrected with juice)', name: 'Context' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 28, month: 10, year: 2024, hour: 17, minute: 45, second: 0 },
    values: [
      { displayString: '4.0', name: 'Glucose (mmol/L)' },
      { displayString: 'Before supper', name: 'Context' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 21, month: 10, year: 2024, hour: 17, minute: 20, second: 0 },
    values: [
      { displayString: '4.2', name: 'Glucose (mmol/L)' },
      { displayString: 'Before supper (felt shaky)', name: 'Context' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 4, month: 11, year: 2024, hour: 7, minute: 30, second: 0 },
    values: [
      { displayString: '8.4', name: 'Glucose (mmol/L)' },
      { displayString: 'Fasting', name: 'Context' },
    ],
    note: DEMO_NOTE,
  },
];

const motherVitalSigns = [
  {
    effectiveDate: { date: 8, month: 11, year: 2024, hour: 9, minute: 0, second: 0 },
    values: [
      { displayString: '62', name: 'Heart rate (bpm)' },
      { displayString: '36.6', name: 'Temperature (\u00b0C)' },
      { displayString: '16', name: 'Respiratory rate (breaths/min)' },
    ],
    note: DEMO_NOTE,
  },
];

const motherBloodOxygen = [
  {
    effectiveDate: { date: 8, month: 11, year: 2024, hour: 9, minute: 0, second: 0 },
    values: [{ displayString: '96', name: 'SpO2 (%)' }],
    note: DEMO_NOTE,
  },
];

const motherExercise = [
  {
    effectiveDate: { date: 6, month: 11, year: 2024, hour: 10, minute: 0, second: 0 },
    exerciseValues: [
      { name: 'Activity', displayString: 'Walking (with cane, neighbourhood loop)' },
      { name: 'Duration', displayString: '18 min' },
      { name: 'Distance', displayString: '0.7 km' },
      { name: 'Notes', displayString: 'Stopped twice to rest, mild knee pain' },
    ],
    durationUnit: 'min',
    distanceUnit: 'km',
    calorieUnit: 'kcal',
    note: DEMO_NOTE,
  },
];

const motherReferrals = [
  {
    referralDate: '2024-10-19',
    referringProvider: 'Dr. Amir Khan (Emergency Medicine)',
    referredTo: 'Dr. Linda Chen, Cardiology',
    reason: 'New atrial fibrillation with RVR, post-ED follow-up',
    status: 'Completed (seen Nov 20, 2024)',
    note: DEMO_NOTE,
  },
  {
    referralDate: '2022-11-04',
    referringProvider: 'Dr. Sarah Mitchell (Family Medicine)',
    referredTo: 'Dr. Emily Watson, Cognitive Neurology / Memory Clinic',
    reason: 'Subjective memory concerns; MoCA 26 in clinic',
    status: 'Active (ongoing 6-month follow-up)',
    note: DEMO_NOTE,
  },
  {
    referralDate: '2023-04-12',
    referringProvider: 'Dr. Sarah Mitchell (Family Medicine)',
    referredTo: 'Dr. Anita Hayes, Geriatric Medicine',
    reason: 'Polypharmacy review, deprescribing assessment',
    status: 'Active (annual review)',
    note: DEMO_NOTE,
  },
  {
    referralDate: '2024-10-22',
    referringProvider: 'Dr. Sarah Mitchell (Family Medicine)',
    referredTo: 'Occupational Therapy \u2014 Home Safety Assessment',
    reason: 'Fall at home Oct 16, 2024; assess home environment, mobility aids',
    status: 'Completed (Nov 5, 2024 \u2014 grab bars recommended)',
    note: DEMO_NOTE,
  },
];

const motherProcedures = [
  {
    procedureDate: '2024-11-18',
    procedureName: 'Cardioversion (chemical, IV diltiazem)',
    location: 'Rockyview General Hospital ED',
    provider: 'Dr. Amir Khan',
    note: DEMO_NOTE,
  },
  {
    procedureDate: '2018-12-04',
    procedureName: 'Coronary angiography (diagnostic, no intervention)',
    location: 'Foothills Medical Centre, Cath Lab',
    provider: 'Dr. Linda Chen',
    note: DEMO_NOTE,
  },
];

const motherSleep: unknown[] = [];
const motherDietaryIntake: unknown[] = [];
const motherPeakFlow: unknown[] = [];
const motherWaistCircumference = [
  {
    effectiveDate: { date: 8, month: 11, year: 2024 },
    values: [{ displayString: '94', name: 'Waist (cm)' }],
    note: DEMO_NOTE,
  },
];
const motherSymptomJournal = [
  {
    effectiveDate: { date: 21, month: 10, year: 2024, hour: 17, minute: 20, second: 0 },
    values: [
      { displayString: 'Felt shaky and lightheaded before supper. BG 4.2. Better after juice.', name: 'Symptom note' },
    ],
    note: DEMO_NOTE,
  },
  {
    effectiveDate: { date: 16, month: 9, year: 2024, hour: 14, minute: 0, second: 0 },
    values: [
      { displayString: 'Fell in the kitchen getting up from chair. No head strike. Bruised right hip. Daughter took me to walk-in.', name: 'Symptom note' },
    ],
    note: DEMO_NOTE,
  },
];

// ============================================================================
// MyChart data
// ============================================================================

const motherMyChartAllergies = {
  patientName: 'Margaret User',
  allergies: [
    {
      name: 'Sulfa drugs (sulfonamide antibiotics)',
      reaction: 'Hives and facial swelling',
      severity: 'Moderate',
      noted: '1998',
      source: 'Patient reported',
      note: DEMO_NOTE,
    },
    {
      name: 'Codeine',
      reaction: 'Severe nausea and vomiting',
      severity: 'Mild (intolerance)',
      noted: '2010',
      source: 'Patient reported',
      note: DEMO_NOTE,
    },
    {
      name: 'No known environmental or food allergies',
      reaction: '',
      severity: '',
      noted: '',
      source: '',
      note: DEMO_NOTE,
    },
  ],
};

const motherMyChartHealthIssues = {
  patientName: 'Margaret User',
  healthIssues: [
    { name: 'Type 2 diabetes mellitus', icd10: 'E11.9', noted: '2002-08-14', status: 'Active', note: DEMO_NOTE },
    { name: 'Atrial fibrillation, paroxysmal', icd10: 'I48.0', noted: '2018-11-03', status: 'Active', note: DEMO_NOTE },
    { name: 'Heart failure with preserved ejection fraction (HFpEF)', icd10: 'I50.31', noted: '2022-05-18', status: 'Active', note: DEMO_NOTE },
    { name: 'Mild neurocognitive disorder, Alzheimer-type', icd10: 'G31.84', noted: '2023-01-30', status: 'Active', note: DEMO_NOTE },
    { name: 'Chronic kidney disease, stage 3a', icd10: 'N18.31', noted: '2022-06-20', status: 'Active', note: DEMO_NOTE },
    { name: 'Hypothyroidism', icd10: 'E03.9', noted: '2010-04-12', status: 'Active', note: DEMO_NOTE },
    { name: 'Essential hypertension', icd10: 'I10', noted: '2008-03-15', status: 'Active', note: DEMO_NOTE },
    { name: 'Mixed hyperlipidemia', icd10: 'E78.2', noted: '2005-09-22', status: 'Active', note: DEMO_NOTE },
    { name: 'Osteoarthritis, bilateral knees', icd10: 'M17.0', noted: '2015-07-08', status: 'Active', note: DEMO_NOTE },
    { name: 'Osteoporosis without current pathological fracture', icd10: 'M81.0', noted: '2024-03-12', status: 'Active', note: DEMO_NOTE },
    { name: 'History of fall', icd10: 'Z91.81', noted: '2024-10-16', status: 'Active', note: DEMO_NOTE },
  ],
};

const motherMyChartHealthSummary = {
  patientName: 'Margaret User',
  summary: 'Patient: Margaret User (DOB 1952-03-22, age 72). Active issues: T2D, paroxysmal AFib (on anticoagulation), HFpEF, mild Alzheimer-type cognitive impairment, CKD 3a, hypothyroidism, hypertension, hyperlipidemia, OA knees, osteoporosis. Recent ED visit Nov 18, 2024 for AFib with RVR (chemically cardioverted). Ongoing memory clinic follow-up (MoCA trending 26\u219224\u219222). Polypharmacy: 12 active prescriptions plus 2 OTC supplements; statin discontinued 2022 for myalgia. Lives alone, daughter (Demo User) holds full proxy access and manages medications via blister pack.',
  note: DEMO_NOTE,
};

const motherMyChartUpcomingVisits = [
  {
    appointmentId: 'demo-mom-appt-001',
    dateTime: '2025-02-04T10:00:00',
    provider: 'Dr. Linda Chen',
    specialty: 'Cardiology',
    department: 'Foothills Medical Centre \u2014 Cardiology Clinic',
    visitType: 'Follow-up (AFib, HFpEF management)',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-mom-appt-002',
    dateTime: '2025-01-22T14:30:00',
    provider: 'Dr. Emily Watson',
    specialty: 'Cognitive Neurology',
    department: 'Cognitive Assessment Clinic',
    visitType: '6-month memory clinic follow-up (MoCA + caregiver report)',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-mom-appt-003',
    dateTime: '2025-01-15T09:15:00',
    provider: 'Dr. Sarah Mitchell',
    specialty: 'Family Medicine',
    department: 'Sunnyside Family Clinic',
    visitType: 'Routine follow-up (proxy attending: daughter)',
    note: DEMO_NOTE,
  },
];

const motherMyChartPastVisits = [
  {
    appointmentId: 'demo-mom-pastappt-001',
    dateTime: '2024-11-20T13:00:00',
    provider: 'Dr. Linda Chen',
    specialty: 'Cardiology',
    department: 'Foothills Medical Centre \u2014 Cardiology Clinic',
    visitType: 'Post-ED follow-up (new AFib)',
    summary: 'Cardiology consult after Nov 18 ED visit for AFib with RVR. Started apixaban 5 mg BID and metoprolol succinate 50 mg daily. Echo shows preserved EF 58% with grade II diastolic dysfunction (HFpEF). Will see again in 12 weeks.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-mom-pastappt-002',
    dateTime: '2024-11-18T23:14:00',
    provider: 'Dr. Amir Khan',
    specialty: 'Emergency Medicine',
    department: 'Rockyview General Hospital ED',
    visitType: 'Emergency visit \u2014 palpitations, dyspnea',
    summary: 'Brought in by daughter for 4 hours of palpitations and shortness of breath. ECG: AFib with RVR rate 138. Treated with IV diltiazem, converted to sinus. NT-proBNP elevated (1840). Discharged home with cardiology referral. Anticoagulation started in ED.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-mom-pastappt-003',
    dateTime: '2024-11-05T10:00:00',
    provider: 'Janet Cooper, OT',
    specialty: 'Occupational Therapy',
    department: 'AHS Home Care \u2014 OT',
    visitType: 'Home safety assessment (post-fall)',
    summary: 'In-home OT assessment after Oct 16 fall. Recommendations: grab bars in bathroom (installed), remove throw rugs, night light in hallway, raised toilet seat. Patient and daughter present.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-mom-pastappt-004',
    dateTime: '2024-09-12T14:00:00',
    provider: 'Dr. Emily Watson',
    specialty: 'Cognitive Neurology',
    department: 'Cognitive Assessment Clinic',
    visitType: '6-month memory clinic follow-up',
    summary: 'MoCA 22/30 (down from 24 in March 2024, baseline 26 at first visit Jan 2023). Domains affected: delayed recall (1/5), orientation to date. Donepezil tolerated. Discussed advance care planning with daughter present. Next visit in 4 months.',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-mom-pastappt-005',
    dateTime: '2024-08-22T11:00:00',
    provider: 'Dr. Anita Hayes',
    specialty: 'Geriatric Medicine',
    department: 'Senior Health Clinic',
    visitType: 'Annual comprehensive geriatric assessment',
    summary: 'CGA completed. Polypharmacy review: discussed deprescribing glipizide given CKD3a + hypo episodes; family declined change pending cardiology stability. Considering empagliflozin once renal/cardiac stable. Recommended topical NSAID over oral for knee OA. Advance care planning document started (to be finalized).',
    note: DEMO_NOTE,
  },
  {
    appointmentId: 'demo-mom-pastappt-006',
    dateTime: '2024-08-08T09:30:00',
    provider: 'Dr. Sarah Mitchell',
    specialty: 'Family Medicine',
    department: 'Sunnyside Family Clinic',
    visitType: 'MISSED \u2014 no-show',
    summary: 'Patient did not attend scheduled visit. Front desk could not reach patient by phone. Daughter contacted later \u2014 reported mother forgot the appointment. Rescheduled for Aug 21. (Daughter has since enabled appointment reminders to her own phone.)',
    note: DEMO_NOTE,
  },
];

const motherMyChartMessages = [
  {
    messageId: 'demo-mom-msg-001',
    from: 'Demo User (proxy, daughter)',
    to: 'Dr. Sarah Mitchell, Family Medicine',
    subject: 'Mom\u2019s blood sugars dropping before supper',
    sentDate: '2024-11-05T19:30:00',
    body: 'Hi Dr. Mitchell \u2014 I\u2019m writing on behalf of my mom (Margaret User). I\u2019ve noticed her home glucose readings have been low (3.8\u20134.2) before supper a few times this past month, and she felt shaky on Oct 21. She\u2019s taking glipizide 5 mg twice daily and her kidney function has been getting a bit worse. Should we be holding the supper dose or reducing it? I\u2019m worried about her falling. Thanks \u2014 Demo',
    status: 'Read by provider',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-mom-msg-002',
    from: 'Dr. Sarah Mitchell, Family Medicine',
    to: 'Demo User (proxy, daughter) \u2014 RE: Margaret User',
    subject: 'RE: Mom\u2019s blood sugars dropping before supper',
    sentDate: '2024-11-06T08:15:00',
    body: 'Hi Demo \u2014 thanks for flagging this. You\u2019re right to be concerned. Please hold the evening glipizide dose starting tonight; she can keep taking the morning dose with breakfast. I\u2019ll have my MOA book her for next week to recheck her A1c and renal function and we\u2019ll talk about whether to switch her off glipizide entirely. In the meantime, please make sure she has snacks available and check a fingerstick if she feels off. \u2014 Dr. M',
    status: 'Read',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-mom-msg-003',
    from: 'Demo User (proxy, daughter)',
    to: 'Dr. Emily Watson, Cognitive Neurology',
    subject: 'Advance care planning paperwork \u2014 next steps',
    sentDate: '2024-11-12T20:45:00',
    body: 'Hi Dr. Watson \u2014 following up from the September visit. My mom and I started filling out the personal directive forms but I\u2019m not sure if we need a separate goals-of-care designation done with a physician. Dr. Hayes mentioned this in August too. Can you let me know if this is something that gets done with you, with Dr. Mitchell, or with Geriatrics? We\u2019d like to get it sorted before her January visit. Thanks \u2014 Demo',
    status: 'Read by provider',
    note: DEMO_NOTE,
  },
  {
    messageId: 'demo-mom-msg-004',
    from: 'Blister Pack Pharmacy (Sunnyside Drugs)',
    to: 'Demo User (proxy, daughter)',
    subject: 'Mom\u2019s blister pack ready for pickup \u2014 Nov 11',
    sentDate: '2024-11-08T14:00:00',
    body: 'Hi Demo \u2014 Margaret\u2019s weekly blister pack is ready for pickup starting Monday Nov 11. The new apixaban and metoprolol from cardiology have been added to the morning and evening slots. We\u2019ve also added a sticker reminder note for the held evening glipizide doses per Dr. Mitchell\u2019s update. \u2014 Sunnyside Drugs',
    status: 'Read',
    note: DEMO_NOTE,
  },
];

const motherMyChartCareTeam = {
  patientName: 'Margaret User',
  careTeam: [
    { name: 'Dr. Sarah Mitchell', role: 'Family Physician (Primary Care)', phone: '(403) 555-0101', clinic: 'Sunnyside Family Clinic', note: DEMO_NOTE },
    { name: 'Dr. Linda Chen', role: 'Cardiologist', phone: '(403) 555-0210', clinic: 'Foothills Cardiology', note: DEMO_NOTE },
    { name: 'Dr. Emily Watson', role: 'Cognitive Neurologist', phone: '(403) 555-0322', clinic: 'Cognitive Assessment Clinic', note: DEMO_NOTE },
    { name: 'Dr. Anita Hayes', role: 'Geriatrician', phone: '(403) 555-0418', clinic: 'Senior Health Clinic', note: DEMO_NOTE },
    { name: 'Dr. James Park', role: 'Endocrinologist (T2D)', phone: '(403) 555-0501', clinic: 'Endocrine Health Group', note: DEMO_NOTE },
    { name: 'Janet Cooper, OT', role: 'Occupational Therapist (home safety)', phone: '(403) 555-0612', clinic: 'AHS Home Care \u2014 OT', note: DEMO_NOTE },
  ],
};

const motherMyChartImmunizations = motherImmunizations.map((imm, i) => ({
  immunizationId: 'demo-mom-mc-imm-' + (i + 1),
  name: imm.values?.[0]?.displayString,
  dateAdministered: imm.values?.[1]?.displayString,
  manufacturer: imm.values?.[2]?.displayString,
  note: DEMO_NOTE,
}));

const motherMyChartMedications = motherMedications.map((m, i) => ({
  medicationId: 'demo-mom-mc-med-' + (i + 1),
  ...(m as Record<string, unknown>),
  note: DEMO_NOTE,
}));

const motherMyChartTestResults = [
  {
    resultId: 'demo-mom-tr-001',
    name: 'NT-proBNP',
    collectedDate: '2024-11-22',
    value: '1840 ng/L (elevated; ref < 300)',
    orderedBy: 'Dr. Linda Chen',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-mom-tr-002',
    name: 'Hemoglobin A1c',
    collectedDate: '2024-12-08',
    value: '7.9% (above target < 7.0%)',
    orderedBy: 'Dr. Sarah Mitchell',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-mom-tr-003',
    name: 'eGFR',
    collectedDate: '2024-12-08',
    value: '48 mL/min/1.73m\u00b2 (CKD stage 3a)',
    orderedBy: 'Dr. Sarah Mitchell',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-mom-tr-004',
    name: 'DEXA Bone Density',
    collectedDate: '2024-03-12',
    value: 'Lumbar spine T-score -2.6 (osteoporosis)',
    orderedBy: 'Dr. Anita Hayes',
    note: DEMO_NOTE,
  },
  {
    resultId: 'demo-mom-tr-005',
    name: 'Echocardiogram',
    collectedDate: '2024-11-20',
    value: 'LVEF 58% preserved; grade II diastolic dysfunction; consistent with HFpEF',
    orderedBy: 'Dr. Linda Chen',
    note: DEMO_NOTE,
  },
];

// ---------------------------------------------------------------------------
// Mock MHR Client (Margaret's data)
// ---------------------------------------------------------------------------

function createMotherMHRClient(): MHRClient {
  return {
    getSessionStatus: async () => motherSessionStatus,
    // getUser is intercepted by clients.ts to surface Self's profile with
    // selectedRecordId mutated to the active persona's recordId. This impl
    // is therefore unused, but must exist to satisfy the type cast.
    getUser: async () => motherUserProfile,
    getLabResults: async () => motherLabResults,
    getImmunizations: async () => motherImmunizations,
    getMedications: async () => motherMedications,
    getDiagnosticImaging: async () => motherDiagnosticImaging,
    getHeightWeight: async () => motherHeightWeight,
    getVitalSigns: async () => motherVitalSigns,
    getBloodOxygen: async () => motherBloodOxygen,
    getBloodPressure: async () => motherBloodPressure,
    getExercise: async () => motherExercise,
    getReferrals: async () => motherReferrals,
    getProcedures: async () => motherProcedures,
    getBloodGlucose: async () => motherBloodGlucose,
    getSleep: async () => motherSleep,
    getDietaryIntake: async () => motherDietaryIntake,
    // Not on insulin therapy — managed with metformin + glipizide.
    getInsulin: async () => ({ injections: [], usage: [] }),
    getPeakFlow: async () => motherPeakFlow,
    getWaistCircumference: async () => motherWaistCircumference,
    getSymptomJournal: async () => motherSymptomJournal,
    downloadAttachment: async () => ({
      buffer: Buffer.from(`${DEMO_NOTE} \u2014 no real attachment in demo mode.`),
      contentType: 'text/plain',
    }),
  } as unknown as MHRClient;
}

// ---------------------------------------------------------------------------
// Mock MyChart Client (Margaret's data)
// ---------------------------------------------------------------------------

function createMotherMyChartClient(): MyChartClient {
  return {
    getUpcomingVisits: async () => motherMyChartUpcomingVisits,
    getPastVisits: async () => motherMyChartPastVisits,
    getVisitDetails: async () => ({
      ...motherMyChartPastVisits[0],
      Details: motherMyChartPastVisits[0]?.summary,
      note: DEMO_NOTE,
    }),
    getHealthSummary: async () => motherMyChartHealthSummary,
    getAllergies: async () => motherMyChartAllergies,
    getHealthIssues: async () => motherMyChartHealthIssues,
    getCareTeam: async () => motherMyChartCareTeam,
    getConversationList: async () => motherMyChartMessages,
    getConversationDetails: async () => ({
      ID: 'demo-mom-msg-001',
      Subject: 'Mom\u2019s blood sugars dropping before supper',
      Messages: motherMyChartMessages.slice(0, 2).map((m) => ({
        SenderName: m.from,
        Date: m.sentDate,
        Body: m.body,
      })),
      note: DEMO_NOTE,
    }),
    getMedicalHistory: async () => ({
      History: [
        {
          Condition: 'Cholecystectomy',
          Date: '1995-06-12',
          Type: 'Surgical',
          Details: 'Open cholecystectomy for symptomatic cholelithiasis \u2014 uncomplicated',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Hysterectomy (total abdominal)',
          Date: '2003-09-04',
          Type: 'Surgical',
          Details: 'For symptomatic fibroids \u2014 uncomplicated',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Family History: Coronary Artery Disease',
          Date: null,
          Type: 'Family',
          Details: 'Father \u2014 MI at age 64',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Family History: Alzheimer disease',
          Date: null,
          Type: 'Family',
          Details: 'Mother \u2014 diagnosed at age 78',
          note: DEMO_NOTE,
        },
        {
          Condition: 'Family History: Type 2 Diabetes',
          Date: null,
          Type: 'Family',
          Details: 'Sister \u2014 diagnosed at age 60',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getDocuments: async () => ({
      Documents: [
        {
          DocumentID: 'demo-mom-doc-001',
          DocumentName: 'ED Discharge Summary \u2014 AFib RVR',
          Date: '2024-11-18',
          Provider: 'Dr. Amir Khan',
          Department: 'Rockyview General Hospital ED',
          Type: 'Discharge Summary',
          note: DEMO_NOTE,
        },
        {
          DocumentID: 'demo-mom-doc-002',
          DocumentName: 'Personal Directive \u2014 Draft',
          Date: '2024-11-12',
          Provider: 'Demo User (proxy, daughter)',
          Department: 'Patient-uploaded',
          Type: 'Advance Care Planning',
          note: DEMO_NOTE,
        },
        {
          DocumentID: 'demo-mom-doc-003',
          DocumentName: 'OT Home Safety Report',
          Date: '2024-11-05',
          Provider: 'Janet Cooper, OT',
          Department: 'AHS Home Care \u2014 OT',
          Type: 'Care Plan',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getDocumentDetails: async () => ({
      DocumentName: 'ED Discharge Summary \u2014 AFib RVR',
      Date: '2024-11-18',
      Provider: 'Dr. Amir Khan',
      Content: 'Presented with palpitations and dyspnea. ECG: AFib with RVR rate 138. Treated with IV diltiazem, converted to sinus rhythm. Started apixaban 5 mg BID for stroke prevention (CHA\u2082DS\u2082-VASc 4). Cardiology referral placed. Discharged in stable condition with daughter.',
      note: DEMO_NOTE,
    }),
    getUpcomingOrders: async () => ({
      Orders: [
        {
          OrderName: 'HbA1c + Renal panel (CKD monitoring)',
          OrderDate: '2025-01-15',
          Status: 'Scheduled',
          Instructions: 'Fasting required \u2014 daughter to bring patient',
          Provider: 'Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
        {
          OrderName: 'INR (only if bleeding) \u2014 no routine monitoring on apixaban',
          OrderDate: 'PRN',
          Status: 'PRN',
          Instructions: 'Only check if bleeding event \u2014 apixaban does not require routine INR monitoring',
          Provider: 'Dr. Linda Chen',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getTestResultsList: async () => motherMyChartTestResults,
    getTestResultDetails: async () => ({
      OrderName: 'Diabetes Monitoring',
      OrderDate: '2024-12-08',
      Status: 'Final',
      Components: [
        { Name: 'Hemoglobin A1c (HbA1c)', Value: '7.9', Units: '%', Range: '< 7.0', Flag: 'High' },
        { Name: 'Fasting Glucose', Value: '8.5', Units: 'mmol/L', Range: '3.6 - 6.0', Flag: 'High' },
      ],
      note: DEMO_NOTE,
    }),
    getReportContent: async () => ({ ReportContent: 'No report content available in demo mode.', note: DEMO_NOTE }),
    getFamilyTree: async () => ({
      FamilyMembers: [
        { Relationship: 'Father', Conditions: ['Coronary Artery Disease \u2014 MI at age 64'], Deceased: true, note: DEMO_NOTE },
        { Relationship: 'Mother', Conditions: ['Alzheimer disease \u2014 diagnosed age 78'], Deceased: true, note: DEMO_NOTE },
        { Relationship: 'Sister', Conditions: ['Type 2 Diabetes \u2014 diagnosed age 60'], Deceased: false, note: DEMO_NOTE },
        { Relationship: 'Daughter (Demo User)', Conditions: ['Type 2 Diabetes, Hypertension, Hyperlipidemia'], Deceased: false, note: DEMO_NOTE },
      ],
      note: DEMO_NOTE,
    }),
    getPatientGoals: async () => ({
      Goals: [
        {
          GoalName: 'HbA1c Target (relaxed for age/CKD)',
          Target: '< 8.0%',
          Current: '7.9%',
          Status: 'At goal (relaxed target for frailty)',
          StartDate: '2024-08-22',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Stay in own home',
          Target: 'Maintain independent living with daughter support',
          Current: 'Living alone with daily check-ins and blister pack',
          Status: 'On track',
          StartDate: '2024-08-22',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Avoid falls',
          Target: 'Zero falls in next 12 months',
          Current: '1 fall in past 12 months (Oct 16, 2024)',
          Status: 'In Progress (OT home modifications complete)',
          StartDate: '2024-11-05',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getCareTeamGoals: async () => ({
      Goals: [
        {
          GoalName: 'Reduce polypharmacy / deprescribe where safe',
          Description: 'Review glipizide use given CKD3a and hypo episodes; consider switch when cardiac status stable',
          DueDate: '2025-01-22',
          Status: 'In Progress \u2014 family declined change in November pending cardiology stability',
          Owner: 'Dr. Anita Hayes',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Finalize advance care planning document',
          Description: 'Personal directive and goals-of-care designation \u2014 patient has capacity, daughter is alternate decision-maker',
          DueDate: '2025-01-22',
          Status: 'In Progress',
          Owner: 'Dr. Emily Watson + Dr. Sarah Mitchell',
          note: DEMO_NOTE,
        },
        {
          GoalName: 'Stroke prevention',
          Description: 'Maintain apixaban 5 mg BID; CHA\u2082DS\u2082-VASc 4 \u2014 risk of stroke without anticoagulation ~4%/yr',
          DueDate: 'Ongoing',
          Status: 'On track',
          Owner: 'Dr. Linda Chen',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getReferralsList: async () => ({
      Referrals: motherReferrals.map((r, i) => ({
        ReferralID: 'demo-mom-mc-ref-' + (i + 1),
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
      ReferralID: 'demo-mom-mc-ref-1',
      Specialty: 'Cardiology',
      Provider: 'Dr. Linda Chen',
      Reason: 'New atrial fibrillation with rapid ventricular response, post-ED follow-up',
      Status: 'Completed (seen Nov 20, 2024)',
      note: DEMO_NOTE,
    }),
    getMedications: async () => motherMyChartMedications,
    getImmunizations: async () => motherMyChartImmunizations,
    getHistoricalResults: async () => ({
      Components: [
        {
          Name: 'Hemoglobin A1c (HbA1c)',
          Units: '%',
          Range: '< 7.0',
          Results: [
            { Date: '2023-06-06', Value: '7.4', Flag: 'High' },
            { Date: '2023-12-04', Value: '7.6', Flag: 'High' },
            { Date: '2024-06-12', Value: '7.8', Flag: 'High' },
            { Date: '2024-12-08', Value: '7.9', Flag: 'High' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'eGFR',
          Units: 'mL/min/1.73m\u00b2',
          Range: '> 60',
          Results: [
            { Date: '2023-06-06', Value: '56', Flag: 'Low' },
            { Date: '2023-12-04', Value: '52', Flag: 'Low' },
            { Date: '2024-06-12', Value: '50', Flag: 'Low' },
            { Date: '2024-12-08', Value: '48', Flag: 'Low' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'Creatinine',
          Units: 'umol/L',
          Range: '45 - 84',
          Results: [
            { Date: '2023-12-04', Value: '95', Flag: 'High' },
            { Date: '2024-06-12', Value: '100', Flag: 'High' },
            { Date: '2024-12-08', Value: '105', Flag: 'High' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'Potassium',
          Units: 'mmol/L',
          Range: '3.5 - 5.0',
          Results: [
            { Date: '2023-12-04', Value: '4.6' },
            { Date: '2024-06-12', Value: '4.8' },
            { Date: '2024-12-08', Value: '5.0', Flag: 'High-normal' },
          ],
          note: DEMO_NOTE,
        },
        {
          Name: 'Hemoglobin',
          Units: 'g/L',
          Range: '120 - 160',
          Results: [
            { Date: '2024-06-12', Value: '114', Flag: 'Low' },
            { Date: '2024-12-08', Value: '108', Flag: 'Low' },
          ],
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    getAppointmentRequests: async () => ({
      Requests: [
        {
          RequestID: 'demo-mom-apptreq-001',
          RequestType: 'Specialist Follow-up',
          Specialty: 'Geriatrics',
          Reason: 'Discuss whether to stop glipizide given hypos and worsening kidney function',
          SubmittedDate: '2024-11-08',
          Status: 'Pending scheduling',
          RequestedBy: 'Demo User (proxy, daughter)',
          note: DEMO_NOTE,
        },
      ],
      note: DEMO_NOTE,
    }),
    keepAlive: async () => {},
    downloadDocumentBinary: async () => ({
      buffer: Buffer.from(`${DEMO_NOTE} \u2014 no real document in demo mode.`),
      contentType: 'text/plain',
    }),
    // getProxyAccessList, switchToProxy, switchToSelf are intercepted by
    // clients.ts (they mutate shared active-context state).
    getProxyAccessList: async () => ({ ProxyList: [], note: DEMO_NOTE }),
    switchToProxy: async () => {},
    switchToSelf: async () => {},
  } as unknown as MyChartClient;
}

// ---------------------------------------------------------------------------
// Persona export
// ---------------------------------------------------------------------------

export const motherPersona: Persona = {
  id: 'mother',
  recordId: 'rec-demo-mother',
  proxyEid: 'mother',
  displayName: 'Margaret User',
  relationshipType: 'Mother',
  isCustodian: false,
  isSelf: false,
  dob: '1952-03-22',
  age: 72,
  patientInfo: 'DOB: 1952-03-22',
  accessLevel: 'Full',
  description: '72-year-old female \u2014 T2D, paroxysmal AFib, HFpEF, mild Alzheimer-type dementia, CKD 3a, hypothyroidism, hypertension, hyperlipidemia, osteoarthritis, osteoporosis',
  mhrClient: createMotherMHRClient(),
  myChartClient: createMotherMyChartClient(),
};
