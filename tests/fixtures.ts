import type { LabResult, UserProfile } from '../src/types.js';

export function cmsPage(
  pageUri: string,
  kind: 'medication' | 'lab',
  mappingId: number,
  overrides: Record<string, string> = {},
  locale = 'en-CA',
  listSettings = false,
) {
  const settings = {
    locale,
    mappingId,
    settings: {
      moduleName: kind === 'medication' ? 'Medication' : 'Labresult',
      showAddNewButton: 'False',
      filterType: 'FilterByConfiguredAppIds',
      enableAPIPagination: 'False',
      ...overrides,
    },
  };
  return {
    pageUri,
    permalink: pageUri.slice(1).replaceAll('/', '-').toLowerCase(),
    zones: [{
      widgets: [{
        widgetType: 'Control',
        name: kind === 'medication'
          ? 'GRH.IPHR.Web.Portal.UserCtrls.AngularCtrls.MedicationCtrl.Medication'
          : 'GRH.IPHR.Web.Portal.UserCtrls.AngularCtrls.LabResultCtrls.LabResult',
        isHidden: false,
        settings: listSettings ? [settings] : settings,
      }],
    }],
  };
}

export function cmsConfig(medicationId = 101, labId = 102, imagingId = 103) {
  return {
    pages: [
      cmsPage('/HealthSummary/Medicines', 'medication', medicationId),
      cmsPage('/HealthSummary/Medicines', 'medication', 104, {
        filterType: 'FilterByNonConfiguredAppIds',
        showAddNewButton: 'True',
      }),
      cmsPage('/ResultsAndReadings/LabResults', 'lab', labId),
      cmsPage('/ResultsAndReadings/DiagnosticImagingReports', 'lab', imagingId),
    ],
  };
}

export const profile: UserProfile = {
  personId: 'synthetic-person',
  name: 'Synthetic user',
  selectedRecordId: 'synthetic-record',
  authorizedRecords: [{
    id: 'synthetic-record',
    name: 'Synthetic user',
    displayName: 'Synthetic user',
    relationshipType: 'Self',
    isCustodian: true,
    patientInfo: '',
  }],
  defaultUserLanguage: 'en-CA',
  isEmergencyAccessMode: false,
  createdDateTimeUtc: '2020-01-01T00:00:00Z',
};

export function labResult(name = 'Example test') {
  return {
    labTestDate: { date: 1, month: 1, year: 2020, hour: 0, minute: 0, second: 0, hasTimePart: false },
    labResultDate: '2020-01-01',
    labResultDisplayDate: '2020-01-01',
    labResultDisplayDateText: 'Jan 1, 2020',
    laboratoryName: 'Synthetic laboratory',
    orderedByName: 'Synthetic provider',
    orderByType: 'Synthetic facility',
    source: 'Synthetic fixture',
    clientId: 0,
    thingId: 'synthetic-result',
    versionStamp: 'synthetic-version',
    isReadOnly: true,
    isItemRestricted: false,
    customData: [],
    group: [{
      groupName: 'Example panel',
      laboratoryName: 'Synthetic laboratory',
      isOtherSection: false,
      hasGroupWithOutResult: false,
      labOrderStatus: 'Final',
      attachmentCount: 0,
      attachment: [],
      customData: [],
      results: [{
        when: '2020-01-01',
        whenDate: '2020-01-01',
        displayDate: '2020-01-01',
        name,
        values: { value: '1', displayValue: '1 units', unitText: 'units' },
        index: 0,
        clinicalCode: { text: 'Example', code: [] },
        eduContent: '',
        resultUniqueId: 'synthetic-component',
        customData: [],
        labOrderStatus: 'Final',
        labOrderStatusValue: 'f',
      }],
    }],
  } satisfies LabResult;
}

export function requestUrl(input: RequestInfo | URL): URL {
  return new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
}

export function homePage(token = 'synthetic-token'): Response {
  return new Response(`<html><input type="hidden" name="__RequestVerificationToken" value="${token}"></html>`, {
    headers: { 'Content-Type': 'text/html' },
  });
}
