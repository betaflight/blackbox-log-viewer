// Sends step response images + flight log configuration to Claude for PID/filter tuning advice,
// using the Anthropic API key/model configured under Settings -> AI Analysis Settings.
// Ported from https://github.com/bph838/rotorflight-blackbox-bellsandwhistles (js/tuning_ai.js).
// `dangerouslyAllowBrowser: true` is Anthropic's supported bring-your-own-key browser pattern
// (the SDK sets `anthropic-dangerous-direct-browser-access`) - the user supplies their own key,
// stored locally (see stores/settings.js), never sent anywhere but api.anthropic.com.

import Anthropic from "@anthropic-ai/sdk";
import AI_MODELS from "./data/ai_models.json";

const MODELS_BY_ID = {};
for (const m of AI_MODELS.models) {
  MODELS_BY_ID[m.id] = m;
}

export const DEFAULT_MODEL = AI_MODELS.defaultModel;

function createClient(apiKey) {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

function imageBase64FromDataUrl(dataUrl) {
  return (dataUrl || "").replace(/^data:image\/\w+;base64,/, "");
}

/**
 * Estimated cost in USD for one API response, from its `usage` object. Cache writes are priced at
 * the 5-minute-TTL premium (1.25x input) since that's what this app requests.
 */
export function estimateCostUsd(model, usage) {
  const pricing = MODELS_BY_ID[model];
  if (!pricing || !usage) return 0;

  let cost = 0;
  cost += ((usage.input_tokens || 0) / 1e6) * pricing.pricePerMillionInputTokens;
  cost += ((usage.output_tokens || 0) / 1e6) * pricing.pricePerMillionOutputTokens;
  cost += ((usage.cache_creation_input_tokens || 0) / 1e6) * pricing.pricePerMillionInputTokens * 1.25;
  cost += ((usage.cache_read_input_tokens || 0) / 1e6) * pricing.pricePerMillionInputTokens * 0.1;

  return cost;
}

/**
 * options: { configSummary, instructions, expertMode }
 */
export function buildPromptText(options) {
  const instructions =
    (options.instructions || "").trim() || "(No specific instructions given - provide general tuning suggestions.)";

  let text =
    "You are helping tune the PID controller of an RC helicopter flight controller running Rotorflight " +
    "(forked from Betaflight). Attached is a step response graph generated from a blackbox log, showing " +
    "setpoint-vs-gyro tracking (Roll in red, Pitch in green, Yaw in blue) for the 0-500ms period after a " +
    "stick input, with 1.0 on the y-axis representing perfect tracking.\n\n" +
    `Current flight controller configuration extracted from the log:\n${options.configSummary}\n\n` +
    `User instructions: ${instructions}\n\n` +
    "Analyse the attached step response graph and suggest specific, actionable PID changes " +
    "to address the user's instructions, referencing the actual curve shapes you see (overshoot, " +
    "settling time, oscillation, delay) for each axis.\n\n";

  if (options.expertMode) {
    text +=
      "Expert mode is enabled: beyond PID and filter changes, also review the rest of the configuration " +
      "above for other settings worth adjusting - rate profiles, feedforward, TPA (throttle PID " +
      "attenuation), I-term relax, RPM filtering, governor/collective settings, voltage sag " +
      "compensation, mixer settings, and anything else that looks misconfigured or suboptimal given the " +
      "behaviour shown in the step response. Flag these in addition to, not instead of, any PID/filter " +
      "changes.\n\n";
  }

  text +=
    "For every change you recommend, clearly state which setting to change in the Rotorflight Configurator " +
    "and where to find it, using this format: the exact field name as it appears in the Configurator UI, " +
    "the tab/page it lives on (e.g. PID Tuning, Filters, Rates), the current value (from the configuration " +
    "above), and the new value you recommend. Do not just describe the change conceptually - name the " +
    "actual Configurator setting for the user to go and edit.\n\n" +
    "Present any PID gain changes grouped by axis in this order: Roll, then Pitch, then Yaw, and within " +
    "each axis give the gains in this order: P, I, D.\n\n" +
    "If earlier messages above contain step response graphs, configuration and analysis from previous " +
    "entries in this tuning log, use that history to track what has already been tried and how the " +
    "response changed as a result, rather than repeating suggestions that were already applied unless " +
    "they still need further adjustment.";

  return text;
}

function entryToHistoryContent(entry) {
  const content = [];

  if (entry.image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: imageBase64FromDataUrl(entry.image) },
    });
  }

  let text = `Step response captured ${entry.timestamp}\n\nConfiguration:\n${entry.config || "(none)"}`;
  if (entry.notes) {
    text += `\n\nUser notes: ${entry.notes}`;
  }

  content.push({ type: "text", text });

  return content;
}

function lastAssistantText(entry) {
  const conversation = (entry.ai && entry.ai.conversation) || [];

  for (let i = conversation.length - 1; i >= 0; i--) {
    if (conversation[i].role === "assistant") {
      return typeof conversation[i].content === "string" ? conversation[i].content : null;
    }
  }

  return null;
}

/**
 * Turns every entry already in the log into a user/assistant message pair (image + config/notes,
 * plus that entry's own final AI answer if it has one), so a new request has the whole tuning
 * log's history as context. Pass excludingEntryId to leave out the entry currently being asked
 * about (it's supplied separately as the new message, not as history).
 */
export function buildHistoryMessages(log, excludingEntryId) {
  const messages = [];
  const entries = (log && log.entries) || [];

  for (const entry of entries) {
    if (excludingEntryId && entry.id === excludingEntryId) continue;

    messages.push({ role: "user", content: entryToHistoryContent(entry) });

    const assistantText = lastAssistantText(entry);
    if (assistantText) {
      messages.push({ role: "assistant", content: assistantText });
    }
  }

  return messages;
}

/**
 * options may include an `onChunk(textSnapshot)` callback - if given, it's called every time more
 * response text arrives, with the full text accumulated so far (not just the latest delta), so
 * callers can render progressively instead of waiting for the whole response.
 */
function sendMessages(options, messages, onResult, onError) {
  let client;
  try {
    client = createClient(options.apiKey);
  } catch (e) {
    onError(`Could not load the Anthropic SDK: ${e.message}`);
    return;
  }

  const model = options.model || DEFAULT_MODEL;
  const requestParams = {
    model,
    // Adaptive thinking counts against this same budget, and models like Opus can spend most or
    // all of a small budget on thinking before writing any answer - leaving too little here is
    // what previously caused empty/cut-off responses. Streaming (below) means we're not racing a
    // client-side HTTP timeout to get the full response back.
    max_tokens: 16000,
    messages,
  };

  // Adaptive thinking isn't supported on every model (e.g. Haiku 4.5) - only request it where it's valid
  const modelInfo = MODELS_BY_ID[model];
  if (!modelInfo || modelInfo.supportsAdaptiveThinking) {
    requestParams.thinking = { type: "adaptive" };
  }

  // Effort isn't supported on every model (e.g. Haiku 4.5, which errors if it's sent) - only
  // request it where it's valid
  if (options.effort && (!modelInfo || modelInfo.supportsEffort)) {
    requestParams.output_config = { effort: options.effort };
  }

  // A custom Agent Skill (uploaded separately to the Anthropic account via the Skills API/
  // Console, identified by its skill_id) is loaded into a code-execution container - it isn't
  // picked up automatically just because it exists on the account.
  if (options.skillId) {
    requestParams.tools = [{ type: "code_execution_20260521", name: "code_execution" }];
    requestParams.container = {
      skills: [{ type: "custom", skill_id: options.skillId, version: options.skillVersion || "latest" }],
    };
    requestParams.betas = ["code-execution-2025-08-25", "skills-2025-10-02"];
  }

  let stream;
  try {
    stream = client.beta.messages.stream(requestParams);
  } catch (e) {
    onError(e && e.message ? e.message : String(e));
    return;
  }

  if (typeof options.onChunk === "function") {
    stream.on("text", (textDelta, textSnapshot) => {
      options.onChunk(textSnapshot);
    });
  }

  stream.on("finalMessage", (response) => {
    let text = "";
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }

    if (response.stop_reason === "max_tokens") {
      text = `${text ? `${text}\n\n` : ""}_(This response was cut off - it ran out of its token budget, often because most of it was spent on internal reasoning before any answer was written. Try again, or ask a more focused follow-up question.)_`;
    }

    text = text || "(No text response received)";

    const updatedMessages = messages.concat([{ role: "assistant", content: text }]);
    const costUsd = estimateCostUsd(model, response.usage);
    onResult(text, updatedMessages, costUsd);
  });

  stream.on("error", (error) => {
    onError(error && error.message ? error.message : String(error));
  });
}

/**
 * Starts a new tuning-advice conversation about a single entry (its image + config summary), with
 * the rest of the tuning log's history prepended as context.
 *
 * options: { apiKey, model, effort, skillId, skillVersion, historyMessages, entry: {image,
 * config}, instructions, expertMode, onChunk }
 * effort, if given, is passed through as output_config.effort ('low'/'medium'/'high'/'xhigh'/
 * 'max') on models that support it - ignored otherwise.
 * skillId, if given, is the ID of a custom Agent Skill previously uploaded to this Anthropic
 * account (via the Console or Skills API) - it's loaded into a code-execution container for this
 * request. skillVersion defaults to 'latest'.
 * onChunk(textSnapshot), if given, is called repeatedly as the response streams in, with the full
 * response text accumulated so far - use it to render progressively instead of waiting for the
 * whole answer.
 * onResult(resultText, entryMessages, costUsd) - entryMessages is *this entry's own* conversation
 * (not including historyMessages/repeats of it) - keep it and pass it back into ask() for
 * follow-ups, and persist it as entry.ai.conversation. costUsd is this call's estimated price -
 * add it to any running total you're keeping for the entry.
 */
export function analyze(options, onResult, onError) {
  if (!options.apiKey) {
    onError("No Anthropic API key configured. Add one under Settings → AI Analysis Settings.");
    return;
  }

  const historyMessages = options.historyMessages || [];
  const content = [];

  if (options.entry.image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: imageBase64FromDataUrl(options.entry.image) },
    });
  }

  content.push({
    type: "text",
    text: buildPromptText({ configSummary: options.entry.config, instructions: options.instructions, expertMode: options.expertMode }),
  });

  const initialMessage = { role: "user", content };

  sendMessages(
    options,
    historyMessages.concat([initialMessage]),
    (text, updatedMessages, costUsd) => {
      onResult(text, updatedMessages.slice(historyMessages.length), costUsd);
    },
    onError,
  );
}

/**
 * Continues an existing entry's conversation with a follow-up question.
 *
 * options: { apiKey, model, effort, skillId, skillVersion, historyMessages, messages, question,
 * onChunk }
 * `messages` is this entry's own conversation so far (as returned by a previous analyze()/ask() call).
 * effort, if given, is passed through as output_config.effort on models that support it.
 * skillId/skillVersion behave as documented on analyze().
 * onChunk(textSnapshot), if given, is called repeatedly as the response streams in, with the full
 * response text accumulated so far.
 * onResult(resultText, entryMessages, costUsd) - pass the updated entryMessages back in for the
 * next follow-up; costUsd is this call's estimated price.
 */
export function ask(options, onResult, onError) {
  if (!options.apiKey) {
    onError("No Anthropic API key configured. Add one under Settings → AI Analysis Settings.");
    return;
  }

  const question = (options.question || "").trim();
  if (!question) {
    onError("Please enter a question.");
    return;
  }

  const historyMessages = options.historyMessages || [];
  const messages = (options.messages || []).concat([{ role: "user", content: question }]);

  sendMessages(
    options,
    historyMessages.concat(messages),
    (text, updatedMessages, costUsd) => {
      onResult(text, updatedMessages.slice(historyMessages.length), costUsd);
    },
    onError,
  );
}
