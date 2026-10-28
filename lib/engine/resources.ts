/*
 * Every "Humor engine" page is described here: which table it shows, which
 * columns, and what an admin may do (read is always allowed; create, update
 * and delete only where listed). The page, the forms and the server actions
 * all read this one description, and the actions refuse anything not listed.
 */

export type RefName = "providers" | "models" | "termTypes" | "flavors" | "stepTypes" | "inputTypes" | "outputTypes";

export const REFS: Record<RefName, { table: string; label: string }> = {
  providers: { table: "llm_providers", label: "name" },
  models: { table: "llm_models", label: "name" },
  termTypes: { table: "term_types", label: "name" },
  flavors: { table: "humor_flavors", label: "slug" },
  stepTypes: { table: "humor_flavor_step_types", label: "slug" },
  inputTypes: { table: "llm_input_types", label: "slug" },
  outputTypes: { table: "llm_output_types", label: "slug" },
};

export type Column = {
  /** Column name, or a dotted path into an embedded row ("images.url"). */
  key: string;
  label: string;
  kind?: "text" | "long" | "number" | "bool" | "datetime" | "image" | "mono";
  ref?: RefName;
  /** Turn the value into a link: "{value}" is replaced by the cell value. */
  href?: string;
};

export type Field = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "number" | "bool" | "select";
  ref?: RefName;
  required?: boolean;
  placeholder?: string;
};

export type Op = "create" | "update" | "delete";

export type Resource = {
  slug: string;
  table: string;
  title: string;
  /** What the page is for, in plain words. */
  blurb: string;
  group: "Prompt chains" | "Content" | "LLMs" | "Sign-up access";
  ops: Op[];
  select: string;
  order: { column: string; ascending?: boolean }[];
  pageSize: number;
  /** Column searched with the search box (case-insensitive "contains"). */
  search?: string;
  /** URL filters, e.g. ?chain=12 -> llm_prompt_chain_id = 12. */
  filters?: { param: string; column: string; label: string }[];
  /** Links shown on each row; "{id}" is replaced by the row id. */
  rowLinks?: { label: string; href: string }[];
  columns: Column[];
  fields?: Field[];
};

const created: Column = { key: "created_datetime_utc", label: "Created", kind: "datetime" };
const modified: Column = { key: "modified_datetime_utc", label: "Last changed", kind: "datetime" };

export const RESOURCES: Resource[] = [
  {
    slug: "prompt-chains",
    table: "llm_prompt_chains",
    title: "Prompt chains",
    blurb: "Every run of a prompt chain: one caption request going through a humor flavor's steps.",
    group: "Prompt chains",
    ops: [],
    select: "id, created_datetime_utc, caption_request_id, caption_requests(images(url))",
    order: [{ column: "id", ascending: false }],
    pageSize: 25,
    filters: [{ param: "request", column: "caption_request_id", label: "Generation request" }],
    rowLinks: [{ label: "LLM responses", href: "/engine/llm-responses?chain={id}" }],
    columns: [
      { key: "id", label: "Chain", kind: "mono" },
      { key: "caption_requests.images.url", label: "Image", kind: "image" },
      { key: "caption_request_id", label: "Request", kind: "mono", href: "/engine/generation-requests?id={value}" },
      created,
    ],
  },
  {
    slug: "humor-flavors",
    table: "humor_flavors",
    title: "Humor flavors",
    blurb: "The named prompt-chain recipes. Each flavor is a list of steps that run in order.",
    group: "Prompt chains",
    ops: [],
    select: "id, slug, description, is_pinned, created_datetime_utc",
    order: [{ column: "id", ascending: true }],
    pageSize: 25,
    search: "slug",
    rowLinks: [{ label: "Steps", href: "/engine/prompt-chain-steps?flavor={id}" }],
    columns: [
      { key: "id", label: "ID", kind: "mono" },
      { key: "slug", label: "Flavor", kind: "text" },
      { key: "description", label: "Description", kind: "long" },
      { key: "is_pinned", label: "Pinned", kind: "bool" },
    ],
  },
  {
    slug: "prompt-chain-steps",
    table: "humor_flavor_steps",
    title: "Prompt chain steps",
    blurb: "The steps of each flavor: which model runs, with which system and user prompt, in what order.",
    group: "Prompt chains",
    ops: [],
    select:
      "id, humor_flavor_id, order_by, humor_flavor_step_type_id, llm_model_id, llm_temperature, llm_input_type_id, llm_output_type_id, description, llm_system_prompt, llm_user_prompt",
    order: [
      { column: "humor_flavor_id", ascending: true },
      { column: "order_by", ascending: true },
    ],
    pageSize: 25,
    search: "description",
    filters: [{ param: "flavor", column: "humor_flavor_id", label: "Flavor" }],
    columns: [
      { key: "humor_flavor_id", label: "Flavor", ref: "flavors" },
      { key: "order_by", label: "Step", kind: "number" },
      { key: "humor_flavor_step_type_id", label: "Type", ref: "stepTypes" },
      { key: "llm_model_id", label: "Model", ref: "models" },
      { key: "llm_temperature", label: "Temp.", kind: "number" },
      { key: "llm_input_type_id", label: "Input", ref: "inputTypes" },
      { key: "llm_output_type_id", label: "Output", ref: "outputTypes" },
      { key: "description", label: "Description", kind: "long" },
      { key: "llm_system_prompt", label: "System prompt", kind: "long" },
      { key: "llm_user_prompt", label: "User prompt", kind: "long" },
    ],
  },
  {
    slug: "prompt-chain-mix",
    table: "humor_flavor_mix",
    title: "Prompt chain mix",
    blurb: "How many captions each flavor contributes when the app generates a new batch.",
    group: "Prompt chains",
    ops: ["update"],
    select: "id, humor_flavor_id, caption_count, modified_datetime_utc",
    order: [{ column: "id", ascending: true }],
    pageSize: 50,
    columns: [
      { key: "humor_flavor_id", label: "Flavor", ref: "flavors" },
      { key: "caption_count", label: "Captions per batch", kind: "number" },
      modified,
    ],
    fields: [{ key: "caption_count", label: "Captions per batch", kind: "number", required: true }],
  },
  {
    slug: "generation-requests",
    table: "caption_requests",
    title: "Generation requests",
    blurb: "Every time someone asked the engine to caption an image.",
    group: "Content",
    ops: [],
    select: "id, created_datetime_utc, profile_id, image_id, images(url)",
    order: [{ column: "id", ascending: false }],
    pageSize: 25,
    filters: [{ param: "id", column: "id", label: "Request" }],
    rowLinks: [
      { label: "Prompt chains", href: "/engine/prompt-chains?request={id}" },
      { label: "LLM responses", href: "/engine/llm-responses?request={id}" },
    ],
    columns: [
      { key: "id", label: "Request", kind: "mono" },
      { key: "images.url", label: "Image", kind: "image" },
      { key: "image_id", label: "Image ID", kind: "mono" },
      created,
    ],
  },
  {
    slug: "llm-responses",
    table: "llm_model_responses",
    title: "LLM responses",
    blurb: "Every raw answer a model gave, with the exact prompts it was sent and how long it took.",
    group: "Content",
    ops: [],
    select:
      "id, created_datetime_utc, llm_model_id, humor_flavor_id, llm_prompt_chain_id, caption_request_id, processing_time_seconds, llm_temperature, llm_model_response, llm_system_prompt, llm_user_prompt",
    order: [{ column: "created_datetime_utc", ascending: false }],
    pageSize: 20,
    search: "llm_model_response",
    filters: [
      { param: "chain", column: "llm_prompt_chain_id", label: "Prompt chain" },
      { param: "request", column: "caption_request_id", label: "Generation request" },
    ],
    columns: [
      created,
      { key: "llm_model_id", label: "Model", ref: "models" },
      { key: "humor_flavor_id", label: "Flavor", ref: "flavors" },
      { key: "llm_prompt_chain_id", label: "Chain", kind: "mono", href: "/engine/llm-responses?chain={value}" },
      { key: "processing_time_seconds", label: "Seconds", kind: "number" },
      { key: "llm_model_response", label: "Response", kind: "long" },
      { key: "llm_system_prompt", label: "System prompt", kind: "long" },
      { key: "llm_user_prompt", label: "User prompt", kind: "long" },
    ],
  },
  {
    slug: "ai-media",
    table: "captions",
    title: "AI-generated captions",
    blurb: "The captions the engine produced, with their image and how many likes they got.",
    group: "Content",
    ops: [],
    select: "id, created_datetime_utc, content, like_count, humor_flavor_id, llm_prompt_chain_id, images(url)",
    order: [{ column: "created_datetime_utc", ascending: false }],
    pageSize: 25,
    search: "content",
    columns: [
      { key: "images.url", label: "Image", kind: "image" },
      { key: "content", label: "Caption", kind: "long" },
      { key: "humor_flavor_id", label: "Flavor", ref: "flavors" },
      { key: "like_count", label: "Likes", kind: "number" },
      { key: "llm_prompt_chain_id", label: "Chain", kind: "mono", href: "/engine/llm-responses?chain={value}" },
      created,
    ],
  },
  {
    slug: "images",
    table: "images",
    title: "Images",
    blurb: "The images captions are written for. Edit their descriptions, or remove one.",
    group: "Content",
    ops: ["update", "delete"],
    select: "id, url, image_description, additional_context, is_public, is_common_use, created_datetime_utc",
    order: [{ column: "created_datetime_utc", ascending: false }],
    pageSize: 20,
    search: "image_description",
    columns: [
      { key: "url", label: "Image", kind: "image" },
      { key: "image_description", label: "Description", kind: "long" },
      { key: "additional_context", label: "Context", kind: "text" },
      { key: "is_public", label: "Public", kind: "bool" },
      { key: "is_common_use", label: "Common use", kind: "bool" },
    ],
    fields: [
      { key: "image_description", label: "Description", kind: "textarea" },
      { key: "additional_context", label: "Additional context", kind: "text" },
      { key: "is_public", label: "Public", kind: "bool" },
      { key: "is_common_use", label: "Common use", kind: "bool" },
    ],
  },
  {
    slug: "terms",
    table: "terms",
    title: "Terms",
    blurb: "Slang and campus vocabulary the engine can use in captions.",
    group: "Content",
    ops: ["create", "update", "delete"],
    select: "id, term, definition, example, priority, term_type_id, modified_datetime_utc",
    order: [{ column: "priority", ascending: false }, { column: "term", ascending: true }],
    pageSize: 25,
    search: "term",
    columns: [
      { key: "term", label: "Term", kind: "text" },
      { key: "term_type_id", label: "Type", ref: "termTypes" },
      { key: "definition", label: "Definition", kind: "long" },
      { key: "example", label: "Example", kind: "long" },
      { key: "priority", label: "Priority", kind: "number" },
    ],
    fields: [
      { key: "term", label: "Term", kind: "text", required: true },
      { key: "term_type_id", label: "Type", kind: "select", ref: "termTypes" },
      { key: "definition", label: "Definition", kind: "textarea", required: true },
      { key: "example", label: "Example", kind: "textarea", required: true },
      { key: "priority", label: "Priority", kind: "number", placeholder: "0" },
    ],
  },
  {
    slug: "examples",
    table: "caption_examples",
    title: "AI generation examples",
    blurb: "Example captions shown to the model so it learns what a good caption looks like.",
    group: "Content",
    ops: ["create", "update", "delete"],
    select: "id, image_description, caption, explanation, priority, modified_datetime_utc",
    order: [{ column: "priority", ascending: false }, { column: "id", ascending: true }],
    pageSize: 20,
    search: "caption",
    columns: [
      { key: "caption", label: "Caption", kind: "long" },
      { key: "image_description", label: "Image description", kind: "long" },
      { key: "explanation", label: "Why it works", kind: "long" },
      { key: "priority", label: "Priority", kind: "number" },
    ],
    fields: [
      { key: "caption", label: "Caption", kind: "textarea", required: true },
      { key: "image_description", label: "Image description", kind: "textarea", required: true },
      { key: "explanation", label: "Why it works", kind: "textarea", required: true },
      { key: "priority", label: "Priority", kind: "number", placeholder: "0" },
    ],
  },
  {
    slug: "llm-models",
    table: "llm_models",
    title: "LLM models",
    blurb: "The models prompt-chain steps can run on.",
    group: "LLMs",
    ops: ["create", "update", "delete"],
    select: "id, name, llm_provider_id, provider_model_id, is_temperature_supported, modified_datetime_utc",
    order: [{ column: "id", ascending: true }],
    pageSize: 50,
    search: "name",
    columns: [
      { key: "id", label: "ID", kind: "mono" },
      { key: "name", label: "Name", kind: "text" },
      { key: "llm_provider_id", label: "Provider", ref: "providers" },
      { key: "provider_model_id", label: "Provider's model ID", kind: "mono" },
      { key: "is_temperature_supported", label: "Temperature", kind: "bool" },
    ],
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "llm_provider_id", label: "Provider", kind: "select", ref: "providers", required: true },
      { key: "provider_model_id", label: "Provider's model ID", kind: "text", required: true, placeholder: "e.g. gpt-4.1-mini" },
      { key: "is_temperature_supported", label: "Supports temperature", kind: "bool" },
    ],
  },
  {
    slug: "llm-providers",
    table: "llm_providers",
    title: "LLM providers",
    blurb: "Companies whose models the engine calls.",
    group: "LLMs",
    ops: ["create", "update", "delete"],
    select: "id, name, created_datetime_utc, modified_datetime_utc",
    order: [{ column: "id", ascending: true }],
    pageSize: 50,
    rowLinks: [],
    columns: [{ key: "id", label: "ID", kind: "mono" }, { key: "name", label: "Name", kind: "text" }, created, modified],
    fields: [{ key: "name", label: "Name", kind: "text", required: true }],
  },
  {
    slug: "signup-domains",
    table: "allowed_signup_domains",
    title: "Allowed sign-up domains",
    blurb: "Anyone with an e-mail address at one of these domains may sign up.",
    group: "Sign-up access",
    ops: ["create", "update", "delete"],
    select: "id, apex_domain, created_datetime_utc, modified_datetime_utc",
    order: [{ column: "apex_domain", ascending: true }],
    pageSize: 50,
    search: "apex_domain",
    columns: [{ key: "apex_domain", label: "Domain", kind: "mono" }, created, modified],
    fields: [{ key: "apex_domain", label: "Domain", kind: "text", required: true, placeholder: "e.g. columbia.edu" }],
  },
  {
    slug: "whitelisted-emails",
    table: "whitelist_email_addresses",
    title: "Whitelisted e-mails",
    blurb: "Individual addresses allowed to sign up even if their domain is not on the list.",
    group: "Sign-up access",
    ops: ["create", "update", "delete"],
    select: "id, email_address, created_datetime_utc, modified_datetime_utc",
    order: [{ column: "email_address", ascending: true }],
    pageSize: 50,
    search: "email_address",
    columns: [{ key: "email_address", label: "E-mail", kind: "mono" }, created, modified],
    fields: [{ key: "email_address", label: "E-mail address", kind: "text", required: true, placeholder: "name@example.com" }],
  },
];

export function getResource(slug: string) {
  return RESOURCES.find((r) => r.slug === slug) ?? null;
}

export function opsLabel(r: Resource) {
  const letters = ["Read", ...(r.ops.includes("create") ? ["Create"] : []), ...(r.ops.includes("update") ? ["Update"] : []), ...(r.ops.includes("delete") ? ["Delete"] : [])];
  return letters.join(" · ");
}
