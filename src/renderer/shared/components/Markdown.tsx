import { Fragment, type ReactNode } from 'react'

/** Inline **bold** handling. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i} className="font-semibold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  )
}

/** A deliberately small markdown renderer: headings, bullet/numbered lists, paragraphs, bold. */
export function Markdown({ content }: { content: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []

  const flushList = () => {
    if (list.length) {
      const items = list
      blocks.push(
        <ul key={blocks.length} className="my-2 ml-5 list-disc space-y-1">
          {items.map((li, i) => (
            <li key={i}>{inline(li)}</li>
          ))}
        </ul>,
      )
      list = []
    }
  }

  for (const raw of content.split('\n')) {
    const line = raw.trimEnd()
    const listMatch = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line)
    if (listMatch) {
      list.push(listMatch[1]!)
      continue
    }
    flushList()
    if (!line.trim()) continue
    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={blocks.length} className="mb-1 mt-3 font-semibold text-foreground">
          {inline(line.slice(4))}
        </h4>,
      )
    } else if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={blocks.length} className="mb-1 mt-4 text-base font-semibold text-foreground">
          {inline(line.slice(3))}
        </h3>,
      )
    } else if (line.startsWith('# ')) {
      blocks.push(
        <h2 key={blocks.length} className="mb-2 mt-4 text-lg font-semibold text-foreground">
          {inline(line.slice(2))}
        </h2>,
      )
    } else {
      blocks.push(
        <p key={blocks.length} className="my-1.5 leading-relaxed">
          {inline(line)}
        </p>,
      )
    }
  }
  flushList()

  return <div className="text-sm text-muted-foreground">{blocks}</div>
}
