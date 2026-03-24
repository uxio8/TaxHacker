// Stable public facade. Consumers should import from models/attention rather than
// reaching into attention-runtime directly while internals stay free to split.
export type { NavigationAttentionSummary, RuntimeDependencies, RuntimeInput } from "./attention-runtime.ts"
export {
  getAttentionSummaryRuntime as getAttentionSummary,
  getNavigationAttentionSummaryRuntime as getNavigationAttentionSummary,
} from "./attention-runtime.ts"
