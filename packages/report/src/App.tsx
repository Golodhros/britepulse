import { useState } from 'react';
import { Bar, ResponsiveContainer, Tooltip } from '@britecharts/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  reportDocumentSchema,
  type ReportDocument,
  type ReportRow,
} from '../../britepulse/src/report-data.js';

type LoadState = { report: ReportDocument | null; error: string | null };

function initialReport(): LoadState {
  if (typeof document === 'undefined') return { report: null, error: null };
  const text = document.querySelector('#britepulse-report-data')?.textContent;
  if (!text) return { report: null, error: null };
  try {
    return { report: reportDocumentSchema.parse(JSON.parse(text)), error: null };
  } catch {
    return { report: null, error: 'The comparison data is invalid or uses an unsupported format.' };
  }
}

function value(value: number | null, unit: string): string {
  return value === null ? 'Unknown' : `${value} ${unit}`;
}

function Samples({ row }: { row: ReportRow }) {
  if (!row.baselineSamples && !row.candidateSamples) return null;

  return (
    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
      {[
        ['Baseline', row.baselineSamples],
        ['Candidate', row.candidateSamples],
      ].map(([label, sample]) => {
        if (typeof sample !== 'object' || sample === null)
          return <p key={String(label)}>{String(label)}: samples unavailable</p>;

        return (
          <p key={String(label)}>
            {String(label)}: {sample.validSamples} valid / {sample.attemptedSamples} attempted ·
            median absolute deviation {value(sample.medianAbsoluteDeviation, sample.unit)}
          </p>
        );
      })}
    </div>
  );
}

type MetricDelta = ReportDocument['comparison']['metrics'][string];

function signedChange(amount: number | null, unit: string): string {
  if (amount === null) return 'Unavailable';

  return `${amount > 0 ? '+' : ''}${amount} ${unit}`;
}

function MetricCards({ metric, label }: { metric: MetricDelta; label: string }) {
  const percentage =
    metric.percent === null ? 'Percentage unavailable' : `${metric.percent.toFixed(2)}%`;
  const cards = [
    { title: 'Baseline', text: value(metric.baseline, metric.unit), description: label },
    { title: 'Candidate', text: value(metric.candidate, metric.unit), description: label },
    { title: 'Change', text: signedChange(metric.absolute, metric.unit), description: percentage },
  ];

  return (
    <section className="grid gap-5 sm:grid-cols-3" aria-label="Selected metric">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <CardDescription>{card.title}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{card.text}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{card.description}</CardContent>
        </Card>
      ))}
    </section>
  );
}

function ComparisonView({ report }: { report: ReportDocument }) {
  const subjects = [...new Set(report.rows.map((row) => row.subject))];
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const visible = report.rows.filter((row) => row.subject === subject);
  const [selectedKey, setSelectedKey] = useState(visible[0]?.key ?? '');
  const row = visible.find((item) => item.key === selectedKey) ?? visible[0];
  const metric = row ? report.comparison.metrics[row.key]! : null;
  const compatible = report.comparison.compatible;
  const chart =
    metric && compatible && metric.baseline !== null && metric.candidate !== null
      ? [
          { name: 'Baseline', value: metric.baseline },
          { name: 'Candidate', value: metric.candidate },
        ]
      : null;
  const partial = !report.baselineComplete || !report.candidateComplete;
  const smallSample =
    row &&
    [row.baselineSamples, row.candidateSamples].some((sample) => sample && sample.validSamples < 3);

  return (
    <>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border px-3 py-1">
          {compatible ? 'Compatible profiles' : 'Incompatible profiles'}
        </span>
        {partial && <span className="rounded-full border px-3 py-1">Partial measurements</span>}
      </div>
      {!compatible && (
        <p role="alert" className="rounded-lg border p-4">
          These profiles cannot be compared. Numeric differences and comparison charts are
          unavailable.
        </p>
      )}
      {(partial || smallSample) && (
        <p role="note" className="rounded-lg border border-dashed p-4 text-sm">
          Inspect these measurements with their sample counts and diagnostics. Partial data or fewer
          than three valid samples cannot establish a passing budget. Budget evaluation is not
          implemented.
        </p>
      )}
      <section className="grid gap-5 sm:grid-cols-2" aria-label="Run identities">
        {[
          ['Baseline', report.baseline],
          ['Candidate', report.candidate],
        ].map(([label, run]) => {
          if (typeof run !== 'object') return null;

          return (
            <Card key={String(label)}>
              <CardHeader>
                <CardDescription>{String(label)}</CardDescription>
                <CardTitle>{run.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 break-all text-sm">
                <p>{run.id}</p>
                <p>
                  {run.createdAt} · {run.environment} · {run.status}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>
      {!row || !metric ? (
        <p role="status">This comparison has no measurements to display.</p>
      ) : (
        <>
          <section aria-label="Comparison filters" className="flex flex-wrap gap-6">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Subject
              <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                {subjects.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Measurement
              <select value={row.key} onChange={(event) => setSelectedKey(event.target.value)}>
                {visible.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label} ({report.comparison.metrics[item.key]!.unit})
                  </option>
                ))}
              </select>
            </label>
          </section>
          <MetricCards metric={metric} label={row.label} />
          <Card>
            <CardHeader>
              <CardTitle>Baseline and candidate</CardTitle>
              <CardDescription>
                {row.subject} · {row.label} · {metric.unit} ·{' '}
                {metric.direction === 'lower' ? 'Lower' : 'Higher'} is better
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chart ? (
                <ResponsiveContainer
                  render={({ width }) => (
                    <Tooltip
                      data={chart}
                      title={metric.unit}
                      render={(props) => (
                        <Bar
                          {...props}
                          width={width}
                          height={280}
                          a11yTitle={`Baseline and candidate ${row.label} in ${metric.unit}`}
                        />
                      )}
                    />
                  )}
                />
              ) : (
                <p role="status">
                  A comparison chart requires compatible profiles and a known value on both sides.
                </p>
              )}
              <Samples row={row} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Exact measurements</CardTitle>
              <CardDescription>{subject} · unknown values are not zero</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Stored comparison values for {subject}</caption>
                <thead>
                  <tr>
                    <th scope="col">Measurement</th>
                    <th scope="col">Baseline</th>
                    <th scope="col">Candidate</th>
                    <th scope="col">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => {
                    const delta = report.comparison.metrics[item.key]!;

                    return (
                      <tr key={item.key}>
                        <th scope="row" className="font-normal">
                          {item.label}
                        </th>
                        <td>{value(delta.baseline, delta.unit)}</td>
                        <td>{value(delta.candidate, delta.unit)}</td>
                        <td>
                          {delta.absolute === null
                            ? 'Unavailable'
                            : value(delta.absolute, delta.unit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Evidence and diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="list-disc space-y-1 pl-5">
            {[
              ...new Set([
                ...report.comparison.diagnostics,
                ...report.baseline.diagnostics,
                ...report.candidate.diagnostics,
              ]),
            ].map((message) => (
              <li key={message} className="break-words">
                {message}
              </li>
            ))}
          </ul>
          <details>
            <summary>Collection metadata</summary>
            <pre className="mt-3 overflow-x-auto text-xs">
              {JSON.stringify({ baseline: report.baseline, candidate: report.candidate }, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </>
  );
}

export default function App() {
  const [state, setState] = useState(initialReport);

  return (
    <main className="mx-auto max-w-6xl space-y-7 px-5 py-10 sm:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">BRITEPULSE / COMPARISON REPORT</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Understand the change</h1>
          <p className="mt-2 text-muted-foreground">Stored baseline and candidate measurements.</p>
        </div>
        <label className="flex max-w-xs flex-col gap-2 text-sm">
          Open comparison JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                setState({
                  report: reportDocumentSchema.parse(JSON.parse(await file.text())),
                  error: null,
                });
              } catch {
                setState({
                  report: null,
                  error: 'Choose a valid BritePulse comparison report JSON file.',
                });
              }
            }}
          />
        </label>
      </header>
      {state.error && <p role="alert">{state.error}</p>}
      {state.report ? (
        <ComparisonView key={state.report.comparison.id} report={state.report} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No comparison loaded</CardTitle>
            <CardDescription>
              Generate a report from two saved runs with the compare and report commands, or open a
              saved comparison JSON file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code>britepulse compare --baseline &lt;run ID&gt; --candidate &lt;run ID&gt;</code>
          </CardContent>
        </Card>
      )}
      <footer className="text-sm text-muted-foreground">
        BritePulse · Local measurements · No statistical significance or budget verdict is implied.
      </footer>
    </main>
  );
}
