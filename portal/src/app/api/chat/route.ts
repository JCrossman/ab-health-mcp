import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { executeHealthTool } from "@/lib/health/direct-client";
import { resolveModel } from "@/lib/ai/model-resolver";
import { getApiKey } from "@/lib/ai/providers";
import {
  getOrchestatedTools,
  getOrchestrationPrompt,
} from "@/lib/mcp/orchestrator";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are Alberta Health Portal's AI assistant. You help users understand their Alberta health records by accessing data from My Health Records (MHR) and AHS MyChart (Connect Care).

Key rules:
- You are NOT a doctor. Always remind users to consult their healthcare provider for medical decisions.
- You can explain health data, identify trends, and answer questions about lab results, medications, immunizations, vitals, and more.
- You fetch real data from government health portals — never make up health information.
- Be clear, empathetic, and use plain language when explaining medical terms.
- If the user hasn't connected their health account yet, guide them to use the "Connect" button in the header.
- Never log, store, or repeat back sensitive personal health information beyond what's needed to answer the user's question.
- When presenting health data, format it clearly with relevant context (reference ranges, dates, trends).
- Use markdown formatting: **bold** for emphasis, tables for structured data, lists for clarity.

Chart capability:
When a user asks to visualize data as a graph or chart, you CAN create interactive charts. Output a fenced code block with the language tag "chart" containing a JSON object:

\`\`\`chart
{
  "type": "line",
  "title": "Chart Title",
  "xKey": "date",
  "xLabel": "Date",
  "yLabel": "Value",
  "series": [{ "key": "value", "label": "Series Name", "color": "#3b82f6" }],
  "data": [
    { "date": "Jan 2024", "value": 7.2 },
    { "date": "Jul 2024", "value": 6.8 }
  ],
  "referenceLines": [{ "y": 7.0, "label": "Target", "color": "#ef4444" }]
}
\`\`\`

Chart rules:
- Supported types: "line" (trends over time), "bar" (comparisons), "area" (cumulative/ranges)
- Always include a descriptive title
- Use referenceLines for clinical targets/normal ranges when relevant (e.g., HbA1c target, blood pressure thresholds)
- Multiple series can be plotted on the same chart (e.g., systolic + diastolic BP)
- Use colors that are distinguishable: #3b82f6 (blue), #10b981 (green), #f59e0b (amber), #ef4444 (red), #8b5cf6 (purple)
- xKey must match a key in each data object
- Provide the chart along with a brief text explanation of trends observed

Available health data tools (when connected):

MHR (My Health Records — province-wide):
- get_lab_results: Community lab results (DynaLIFE, etc.)
- get_medications: Prescription medications from pharmacies
- get_immunizations: Province-wide vaccination records
- get_vitals, get_blood_pressure, get_blood_oxygen, get_blood_glucose: Vital signs
- get_referrals, get_procedures: Referrals and procedures
- get_diagnostic_imaging: Imaging reports (X-rays, ultrasounds, CTs, MRIs)
- get_health_overview: Summary dashboard
- get_user_profile: Patient demographics
- download_attachment: Download PDF reports and images from lab results or diagnostic imaging

MyChart (AHS Connect Care — hospital/specialist):
- mc_get_test_results: Hospital lab results with full report content and scan attachments
- mc_get_documents: Clinical documents (pathology reports, discharge summaries)
- mc_download_document: Download document scans, images, and PDFs
- mc_get_health_summary: Health summary overview
- mc_get_health_issues: Active diagnoses and conditions
- mc_get_medications: Hospital-prescribed medications
- mc_get_immunizations: AHS vaccination records
- mc_get_allergies: Allergy records
- mc_get_care_team: Care team providers
- mc_get_visits: Past and upcoming appointments with details
- mc_get_messages: Messages from care team, test result letters
- mc_get_medical_history: Medical, surgical, and family history
- mc_get_referrals: AHS referral details
- mc_get_upcoming_orders: Scheduled tests and procedures
- mc_get_goals: Patient and care team goals
- mc_get_family_tree: Family medical pedigree
- mc_get_historical_results: Test result trends over time
- mc_get_appointment_requests: Pending appointment requests
- mc_list_proxy_access: Shared/family member records`;

const dateRangeSchema = z
  .enum(["All", "LastWeek", "LastMonth", "Last3Months", "Last6Months", "LastYear"])
  .optional()
  .describe("Date range filter");

function healthTool(
  description: string,
  toolName: string,
  inputSchema: z.ZodObject<z.ZodRawShape>,
  getUserId: () => string
) {
  return tool({
    description,
    inputSchema,
    execute: async (args: Record<string, unknown>) =>
      executeHealthTool(getUserId(), toolName, args),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Rate limit: 30 messages/minute per user
  const rateLimited = checkRateLimit(`chat:${userId}`, RATE_LIMITS.chat);
  if (rateLimited) return rateLimited;

  const getUserId = () => userId;
  const { messages: uiMessages, model: preferredModel } = await req.json();
  const messages = await convertToModelMessages(uiMessages);

  let resolved;
  try {
    resolved = resolveModel(userId, preferredModel);
  } catch {
    resolved = null;
  }

  // Check if we have a usable model (server key or user's BYOK key)
  if (!resolved || (!process.env.OPENAI_API_KEY && resolved.providerId === "openai" && !getApiKey(userId, "openai"))) {
    return new Response(
      `data: {"type":"error","errorText":"No AI provider configured. Go to Settings → API Keys and add an API key (e.g. OpenAI, Anthropic, or Google), or set OPENAI_API_KEY in the server environment."}\n\ndata: [DONE]\n`,
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
  }

  const { model, providerId, canadianHosted } = resolved;

  const privacyNote = canadianHosted
    ? ""
    : `\nNote: This conversation is processed by ${providerId} on servers that may be outside Canada.`;

  // Discover tools from user-enabled external MCPs
  let dynamicTools: Record<string, ReturnType<typeof tool>> = {};
  let orchestrationPrompt = "";
  try {
    dynamicTools = await getOrchestatedTools(userId);
    orchestrationPrompt = getOrchestrationPrompt(userId);
  } catch {
    // External MCP connection failures shouldn't block chat
  }

  const result = streamText({
    model,
    system: SYSTEM_PROMPT + privacyNote + orchestrationPrompt,
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      check_connection: healthTool(
        "Check if the user's health account is connected and session is active.",
        "check_connection",
        z.object({}),
        getUserId
      ),
      get_health_overview: healthTool(
        "Get a summary overview of the user's health data including recent labs, medications, and vitals.",
        "get_health_overview",
        z.object({}),
        getUserId
      ),
      get_user_profile: healthTool(
        "Get the user's profile information (name, demographics).",
        "get_user_profile",
        z.object({}),
        getUserId
      ),
      get_lab_results: healthTool(
        "Get lab test results (CBC, metabolic panels, etc.).",
        "get_lab_results",
        z.object({
          date_range: dateRangeSchema,
          test_name: z.string().optional().describe("Filter by test name"),
        }),
        getUserId
      ),
      get_medications: healthTool(
        "Get current and past medications.",
        "get_medications",
        z.object({}),
        getUserId
      ),
      get_immunizations: healthTool(
        "Get immunization/vaccination records.",
        "get_immunizations",
        z.object({ date_range: dateRangeSchema }),
        getUserId
      ),
      get_vitals: healthTool(
        "Get vital signs data.",
        "get_vitals",
        z.object({ date_range: dateRangeSchema }),
        getUserId
      ),
      get_blood_pressure: healthTool(
        "Get blood pressure readings.",
        "get_blood_pressure",
        z.object({ date_range: dateRangeSchema }),
        getUserId
      ),
      get_blood_glucose: healthTool(
        "Get blood glucose readings.",
        "get_blood_glucose",
        z.object({ date_range: dateRangeSchema }),
        getUserId
      ),
      get_referrals: healthTool(
        "Get referral records.",
        "get_referrals",
        z.object({
          date_range: z.enum(["AllData", "LastWeek", "LastMonth", "Last3Months", "Last6Months", "LastYear"]).optional(),
        }),
        getUserId
      ),
      get_diagnostic_imaging: healthTool(
        "Get diagnostic imaging reports.",
        "get_diagnostic_imaging",
        z.object({ date_range: dateRangeSchema }),
        getUserId
      ),
      mc_get_health_summary: healthTool(
        "Get MyChart health summary.",
        "mc_get_health_summary",
        z.object({}),
        getUserId
      ),
      mc_get_allergies: healthTool(
        "Get allergy records from MyChart.",
        "mc_get_allergies",
        z.object({}),
        getUserId
      ),
      mc_get_care_team: healthTool(
        "Get care team information from MyChart.",
        "mc_get_care_team",
        z.object({}),
        getUserId
      ),
      mc_get_visits: healthTool(
        "Get visit records from MyChart (upcoming, past, or all). Can also get details for a specific visit.",
        "mc_get_visits",
        z.object({
          time_frame: z.enum(["upcoming", "past", "all"]).optional(),
          visit_id: z.string().optional().describe("CSN identifier for a specific visit to get details"),
        }),
        getUserId
      ),
      mc_get_medications: healthTool(
        "Get medication records from MyChart.",
        "mc_get_medications",
        z.object({}),
        getUserId
      ),
      mc_get_test_results: healthTool(
        "Get test results from MyChart. Can list all results, get details for a specific test (includes report content and scan attachments), or fetch a specific report.",
        "mc_get_test_results",
        z.object({
          search_string: z.string().optional().describe("Filter test results by name"),
          order_id: z.string().optional().describe("Order key to get detailed results for a specific test"),
          report_id: z.string().optional().describe("Report ID to fetch full report content"),
        }),
        getUserId
      ),
      mc_get_health_issues: healthTool(
        "Get active diagnoses and health conditions from MyChart.",
        "mc_get_health_issues",
        z.object({}),
        getUserId
      ),
      mc_get_messages: healthTool(
        "Get patient messages and conversations from MyChart — includes messages from care team, appointment notifications, and test result letters.",
        "mc_get_messages",
        z.object({
          folder: z.enum(["inbox", "sent", "all"]).optional().describe("Message folder. Defaults to inbox."),
          message_id: z.string().optional().describe("Conversation ID to get full details"),
          page: z.number().optional().describe("Page number for pagination"),
        }),
        getUserId
      ),
      mc_get_medical_history: healthTool(
        "Get medical and family history from MyChart.",
        "mc_get_medical_history",
        z.object({}),
        getUserId
      ),
      mc_get_documents: healthTool(
        "Get clinical documents from MyChart. Can list all documents or get details for a specific document.",
        "mc_get_documents",
        z.object({
          document_id: z.string().optional().describe("DCS ID of a specific document to retrieve"),
          file_extension: z.string().optional().describe("File extension for the document (e.g., PDF)"),
        }),
        getUserId
      ),
      mc_download_document: healthTool(
        "Download a document or image scan from MyChart. Use with dcs_id and file_extension from test result scans or clinical documents. Returns the file content.",
        "mc_download_document",
        z.object({
          dcs_id: z.string().describe("Document content service ID from test result scans or document listings"),
          file_extension: z.string().describe("File extension (e.g., JPG, PNG, PDF)"),
        }),
        getUserId
      ),
      mc_get_upcoming_orders: healthTool(
        "Get upcoming tests and procedures ordered in MyChart.",
        "mc_get_upcoming_orders",
        z.object({}),
        getUserId
      ),
      mc_get_family_tree: healthTool(
        "Get family tree and pedigree from MyChart.",
        "mc_get_family_tree",
        z.object({}),
        getUserId
      ),
      mc_get_goals: healthTool(
        "Get patient and care team goals from MyChart.",
        "mc_get_goals",
        z.object({}),
        getUserId
      ),
      mc_get_referrals: healthTool(
        "Get referral details from MyChart (AHS). Can list all referrals or get details for a specific one.",
        "mc_get_referrals",
        z.object({
          referral_id: z.string().optional().describe("Referral ID to get details for a specific referral"),
        }),
        getUserId
      ),
      mc_get_immunizations: healthTool(
        "Get immunization records from MyChart.",
        "mc_get_immunizations",
        z.object({}),
        getUserId
      ),
      mc_get_historical_results: healthTool(
        "Get historical trend data for specific test result components from MyChart. Shows how values changed over time.",
        "mc_get_historical_results",
        z.object({
          order_id: z.string().describe("Order ID from test result details"),
          component_ids: z.array(z.string()).describe("Component IDs from test result details"),
        }),
        getUserId
      ),
      mc_get_appointment_requests: healthTool(
        "Get pending appointment requests from MyChart.",
        "mc_get_appointment_requests",
        z.object({}),
        getUserId
      ),
      mc_list_proxy_access: healthTool(
        "Check for shared health records and proxy access in MyChart (family member records).",
        "mc_list_proxy_access",
        z.object({}),
        getUserId
      ),
      download_attachment: healthTool(
        "Download a PDF report or file attachment from a lab result or diagnostic imaging report (MHR). Use the thing_id and filename from the attachment metadata returned by get_lab_results or get_diagnostic_imaging.",
        "download_attachment",
        z.object({
          thing_id: z.string().describe("Attachment thing ID from lab result or imaging metadata"),
          filename: z.string().describe("Filename from the attachment metadata"),
        }),
        getUserId
      ),
      // Spread in dynamically discovered tools from enabled MCPs
      ...dynamicTools,
    },
  });

  return result.toUIMessageStreamResponse();
}
