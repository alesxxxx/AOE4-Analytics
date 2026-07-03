import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, RotateCcw, ArrowRight } from 'lucide-react'
import { QUIZ_QUESTIONS, scoreQuiz, type QuizResult } from './civQuizData'

/** ~10-question civ picker: answer, get your best-match civ (+ two runners-up). */
export function CivQuiz() {
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const navigate = useNavigate()

  const done = step >= QUIZ_QUESTIONS.length
  const results: QuizResult[] = done ? scoreQuiz(picked) : []

  const choose = (tags: string[]) => {
    setPicked((p) => [...p, ...tags])
    setStep((s) => s + 1)
  }

  const restart = () => {
    setStep(0)
    setPicked([])
  }

  if (done) {
    const [top, ...runnersUp] = results
    return (
      <div className="max-w-lg space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Your civ match</h3>
        </div>

        {top && (
          <button
            type="button"
            onClick={() => navigate(`/civ/${top.civ.slug}`)}
            className="w-full rounded-lg border border-primary/40 bg-primary/[0.06] p-4 text-left transition-colors hover:bg-primary/[0.1]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-semibold text-primary">{top.civ.name}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{top.civ.focus}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {top.civ.summary}
            </p>
          </button>
        )}

        {runnersUp.slice(0, 2).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Also worth a look
            </p>
            {runnersUp.slice(0, 2).map((r) => (
              <button
                key={r.civ.slug}
                type="button"
                onClick={() => navigate(`/civ/${r.civ.slug}`)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-secondary"
              >
                <span className="font-medium">{r.civ.name}</span>
                <span className="truncate text-xs text-muted-foreground">{r.civ.focus}</span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={restart}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retake the quiz
        </button>
      </div>
    )
  }

  const q = QUIZ_QUESTIONS[step]!

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {step + 1} of {QUIZ_QUESTIONS.length}
        </span>
        <button type="button" onClick={restart} className="hover:text-foreground">
          Start over
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(step / QUIZ_QUESTIONS.length) * 100}%` }}
        />
      </div>

      <h3 className="text-base font-semibold">{q.prompt}</h3>
      <div className="space-y-2">
        {q.options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => choose(opt.tags)}
            className="w-full rounded-md border border-border px-3.5 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-secondary"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
