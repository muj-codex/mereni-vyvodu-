import type { FormDraft, Identification } from '../core/types';
import { emptyIdentification } from '../core/current';
import {
  editReference,
  type ReferenceKey,
  type ReferenceState,
  type ReferenceValues,
} from '../series/reference/directory';
// UI metadata travels with the existing identification object. No database schema,
// calculation type, migration or backup/restore logic changes are needed.
export type ReferenceIdentification = Identification & {
  node?: string;
  referenceAutofill?: ReferenceState;
};
export function draftReference(draft: FormDraft) {
  const identification = (draft.identification ?? emptyIdentification()) as ReferenceIdentification;
  const values: ReferenceValues = {
    node: identification.node ?? '',
    location: identification.location,
    placement: identification.placement,
    actualMtp: Number.isFinite(draft.config.actualMtp) ? String(draft.config.actualMtp) : '',
  };
  return { identification, values, state: identification.referenceAutofill };
}
export function editDraftReference(draft: FormDraft, key: ReferenceKey, value: string): FormDraft {
  const current = draftReference(draft);
  const result = editReference(current.values, current.state, key, value);
  const identification: ReferenceIdentification = {
    ...current.identification,
    node: result.values.node,
    location: result.values.location,
    placement: result.values.placement,
    referenceAutofill: result.state,
  };
  return {
    ...draft,
    identification,
    config: {
      ...draft.config,
      actualMtp:
        result.values.actualMtp === '' ? NaN : Number(result.values.actualMtp.replace(',', '.')),
    },
  };
}
