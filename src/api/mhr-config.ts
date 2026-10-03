import { UpstreamContractError } from '../utils/errors.js';
import { isRecord } from './response-helpers.js';

export type MhrView = 'medications' | 'labs' | 'imaging';

const VIEWS = {
  medications: {
    page: '/healthsummary/medicines',
    control: 'GRH.IPHR.Web.Portal.UserCtrls.AngularCtrls.MedicationCtrl.Medication',
  },
  labs: {
    page: '/resultsandreadings/labresults',
    control: 'GRH.IPHR.Web.Portal.UserCtrls.AngularCtrls.LabResultCtrls.LabResult',
  },
  imaging: {
    page: '/resultsandreadings/diagnosticimagingreports',
    control: 'GRH.IPHR.Web.Portal.UserCtrls.AngularCtrls.LabResultCtrls.LabResult',
  },
} as const;

export function resolveMhrMapping(configuration: unknown, view: MhrView, locale = 'en-CA'): number {
  const expected = VIEWS[view];
  const matches = new Set<number>();

  function visit(value: unknown, page = ''): void {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, page);
      return;
    }
    if (!isRecord(value)) return;
    const currentPage = typeof value.pageUri === 'string'
      ? value.pageUri.replace(/\/+$/, '').toLowerCase()
      : page;

    if (
      currentPage === expected.page &&
      value.name === expected.control &&
      value.isHidden !== true && value.isHidden !== 'True'
    ) {
      const entries = Array.isArray(value.settings) ? value.settings : [value.settings];
      for (const entry of entries) {
        if (!isRecord(entry) || !isRecord(entry.settings) || typeof entry.locale !== 'string') continue;
        if (entry.locale.toLowerCase() !== locale.toLowerCase()) continue;
        if (view === 'medications' && (
          entry.settings.filterType !== 'FilterByConfiguredAppIds' ||
          entry.settings.showAddNewButton !== 'False'
        )) continue;
        const id = typeof entry.mappingId === 'number' ? entry.mappingId
          : typeof entry.mappingId === 'string' && /^\d+$/.test(entry.mappingId) ? Number(entry.mappingId) : NaN;
        if (Number.isSafeInteger(id) && id > 0) matches.add(id);
      }
    }
    for (const child of Object.values(value)) {
      if (child !== null && typeof child === 'object') visit(child, currentPage);
    }
  }

  visit(configuration);
  const [mapping] = matches;
  if (matches.size !== 1 || mapping === undefined) throw new UpstreamContractError('mhr');
  return mapping;
}
