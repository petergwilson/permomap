// This plugin marks inserted text on user input with underline+user mark
import { Plugin } from 'prosemirror-state'

export function MarkNewInsertionsPlugin() {
  return new Plugin({
    appendTransaction(transactions, oldState, newState) {
      // Only care about user input transactions
      if (!transactions.some(tr => tr.docChanged && tr.getMeta('inputType'))) {
        return null;
      }

      const tr = newState.tr;
      let changed = false;

      // For every transaction, for every step: check for insertions
      transactions.forEach(transaction => {
        transaction.steps.forEach((step) => {
          // ReplaceStep used for insertions in ProseMirror
          if (step.slice && step.slice.size > 0 && step.from !== undefined) {
            const from = step.from;
            const to = from + step.slice.size;
            // Mark the new inserted range
            tr.addMark(
              from,
              to,
              newState.schema.marks.customUnderline.create({
                user: user.initials,
                color: user.color
              })
            )
            changed = true;
          }
        });
      });

      return changed ? tr : null;
    }
  })
}