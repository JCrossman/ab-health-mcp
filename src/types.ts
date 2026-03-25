// Core type definitions derived from API-SPEC.md

// --- Auth ---

export interface AuthResult {
  success: boolean;
  userName?: string;
  personId?: string;
}

// --- Immunizations ---

export interface ImmunizationDate {
  date: number;
  month: number;
  year: number;
  hasTimePart: boolean;
  hour: number;
  minute: number;
  second: number;
}

export interface ImmunizationValue {
  kind: number;
  name: string;
  data: unknown;
  displayString: string;
  sortKey?: number;
}

export interface ImmunizationItemKey {
  thingId: string;
  versionStamp: string;
}

export interface ImmunizationRecord {
  itemKey: ImmunizationItemKey;
  effectiveDate: ImmunizationDate;
  isReadOnly: boolean;
  isItemRestricted: boolean;
  thingBasedStyleClass: string;
  clientId: string;
  values: ImmunizationValue[];
}

// --- Session ---

export interface SessionStatus {
  isSessionExpired: boolean;
  numberOfMilliSecondsLeftForSessionExpire: number;
}

// --- User Profile ---

export interface AuthorizedRecord {
  id: string;
  isCustodian: boolean;
  displayName: string;
  name: string;
  relationshipType: string;
  patientInfo: string;
}

export interface UserProfile {
  personId: string;
  authorizedRecords: AuthorizedRecord[];
  selectedRecordId: string;
  defaultUserLanguage: string;
  isEmergencyAccessMode: boolean;
  createdDateTimeUtc: string;
  name: string;
}

// --- Lab Results ---

export interface LabResultParams {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  testName?: string;
}

export interface LabTestCode {
  value: string;
  family: string;
  type: string;
  version?: string;
}

export interface LabClinicalCode {
  text: string;
  code: LabTestCode[];
}

export interface LabTestValues {
  displayValue: string;
  value?: string;
  unitText: string;
  rangeDisplayText?: string;
  prevDisplayValue?: string;
}

export interface LabTestResult {
  when: string;
  whenDate: string;
  displayDate: string;
  name: string;
  values: LabTestValues;
  index: number;
  clinicalCode: LabClinicalCode;
  eduContent: string;
  resultUniqueId: string;
  customData: unknown[];
  labOrderStatus: string;
  labOrderStatusValue: string;
}

export interface LabAttachment {
  name: string;
  viewUrl: string;
  downloadUrl: string;
  contentType: string;
}

export interface LabGroup {
  groupName: string;
  laboratoryName: string;
  isOtherSection: boolean;
  hasGroupWithOutResult: boolean;
  labOrderStatus: string;
  attachmentCount: number;
  attachment: LabAttachment[];
  results: LabTestResult[];
  customData: unknown[];
}

export interface LabTestDate {
  date: number;
  month: number;
  year: number;
  hour: number;
  minute: number;
  second: number;
  hasTimePart: boolean;
}

export interface LabResult {
  labTestDate: LabTestDate;
  labResultDate: string;
  labResultDisplayDate: string;
  labResultDisplayDateText: string;
  laboratoryName: string;
  orderedByName: string;
  orderByType: string;
  source: string;
  clientId: number;
  thingId: string;
  versionStamp: string;
  isReadOnly: boolean;
  isItemRestricted: boolean;
  customData: unknown[];
  group: LabGroup[];
}
