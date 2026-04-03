import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER } from './tool-factory.js';

export const mcSwitchContextTool = {
  name: 'mc_switch_context',
  description: 'Switch MyChart to view a different patient\'s records (Friends & Family proxy access). You MUST call this before using mc_* tools to view shared records. Use mc_list_proxy_access first to get available patient IDs. After switching, use mc_get_test_results for lab results (not get_lab_results — that only shows the logged-in user\'s MHR data). All mc_* prefixed tools will return the selected patient\'s data. Use proxy_id="self" to switch back to your own records.',
  handler: async (params: { proxy_id: string }) => {
    try {
      const client = await ensureMyChartSession();

      if (params.proxy_id === 'self') {
        await client.switchToSelf();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ switched: true, context: 'self', disclaimer: MEDICAL_DISCLAIMER }) }],
        };
      }

      await client.switchToProxy(params.proxy_id);

      // Verify the switch by checking current context
      const proxyData = await client.getProxyAccessList() as Record<string, unknown>;
      const subjects = (proxyData.ProxySubjectList ?? []) as Array<Record<string, unknown>>;
      const selected = subjects.find(s => s.IsSelected);
      const viewingName = (selected?.DisplayName as string) ?? 'unknown';

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            switched: true,
            context: selected?.IsSelf ? 'self' : 'proxy',
            viewing: viewingName,
            privacyNotice: `You are now viewing health records for ${viewingName}. All data retrieved will be sent to Claude. The same privacy considerations apply as for your own records.`,
            note: 'Context switched. Use mc_get_test_results, mc_get_medications, and other mc_* tools to view this patient\'s data. Do NOT use get_lab_results (MHR) — it always returns the logged-in user\'s data.',
            disclaimer: MEDICAL_DISCLAIMER,
          }),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: formatError(error) }],
        isError: true,
      };
    }
  },
};
