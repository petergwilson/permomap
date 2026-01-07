import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin } from 'prosemirror-state'

// User object for demo
//Default
export const USER = {
  initials: "DF",
  color: "#1976d2"
}

// 1. Custom Mark to render underline + initials bubble
export const CustomUnderline = Underline.extend({
  name: 'customUnderline',
  addAttributes() {
    return {
      user: { default: USER.initials },
      color: { default: USER.color }
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-custom-underline]' }]
  },
  renderHTML({ HTMLAttributes }) {
  return [
    'span',
    {
      ...HTMLAttributes,
      'data-custom-underline': HTMLAttributes.user ?? USER.initials,
      'data-initials': HTMLAttributes.user ?? USER.initials, // for CSS
      style: `
        text-decoration: underline;
        text-decoration-color: ${HTMLAttributes.color || USER.color};
        color: ${HTMLAttributes.color || USER.color};
        font-weight: bold;
        display: inline-block;
        position: relative;
      `
    },
    0 // <--- only this! NO SIBLINGS!
  ]},
addProseMirrorPlugins() {
  return [
    new Plugin({
      appendTransaction: (transactions, oldState, newState) => {
        if (!transactions.some(tr => tr.docChanged)) return null;
        let tr = newState.tr;
        let modified = false;

        transactions.forEach(transaction => {
          transaction.steps.forEach((step) => {
            // Only for insertions
            if (step.slice && step.slice.size > 0 && step.from !== undefined) {
              const shouldMark = shouldAutoUnderline(newState, step.from);
              if (shouldMark) {
                const from = step.from;
                const to = from + step.slice.size;
                tr = tr.addMark(
                  from, to,
                  newState.schema.marks.customUnderline.create({
                    user: USER.initials,
                    color: USER.color
                  })
                );
                modified = true;
              }
            }
          })
        });
        return modified ? tr : null;
      }
    })
  ]
}
})

// Strike Mark with Bubble (for deletions)
export const CustomStrike = Strike.extend({
  name: 'customStrike',
  addAttributes() {
    return {
      user: { default: USER.initials },
      color: { default: USER.color },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-custom-strike]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-custom-strike': HTMLAttributes.user ?? USER.initials,
        'data-initials': HTMLAttributes.user ?? USER.initials,
        style: `
          text-decoration: line-through;
          text-decoration-color: ${HTMLAttributes.color || USER.color};
          color: ${HTMLAttributes.color || USER.color};
          font-weight: bold;
          display: inline-block;
          position: relative;
        `,
      },
      0
    ]
  },
})
export function shouldAutoUnderline(newState, pos) {
  // If there's any clean text node in the current paragraph/parent, return true.
  // If everything before is struck, or we're at doc start, return false.

  // Get parent node at position
  const $pos = newState.doc.resolve(pos)
  const parent = $pos.parent

  // If parent is empty (new paragraph), just type plain!
  if (parent.childCount === 0) return false

  // Scan all text nodes in paragraph
  let hasClean = false
  parent.forEach(child => {
    if (child.isText && !child.marks.some(m => m.type.name === "customStrike")) {
      hasClean = true
    }
  })
  if (!hasClean) return false // all struck, don't auto-mark!

  // If there is clean text, and we are inserting after clean text, auto-mark
  // We could be more granular, but this is the main idea.
  return true
}