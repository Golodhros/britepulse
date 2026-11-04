import { useState } from 'react';
import { Bar, Line, ResponsiveContainer, Tooltip } from '@britecharts/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const pages = ['/checkout', '/search', '/'];
const dates = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];
const sampleRuns = [2100, 2020, 2150, 1980, 1890, 1840];

export default function App() {
  const [page, setPage] = useState(pages[0]);
  const [metric, setMetric] = useState<'lcp' | 'bundle'>('lcp');
  const scale = page === '/checkout' ? 1 : page === '/search' ? 0.8 : 0.6;
  const values = sampleRuns.map(value => Math.round((metric === 'lcp' ? value : value / 5) * scale));
  const unit = metric === 'lcp' ? 'ms' : 'KB';
  const history = { data: dates.map((date, i) => ({ date, name: 1, topicName: metric === 'lcp' ? 'LCP' : 'JavaScript', value: values[i] })) };
  const comparison = [{ name: 'Baseline', value: values[0] }, { name: 'Candidate', value: values.at(-1)! }];
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow">BRITEPULSE / LOCAL REPORT</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">A clearer view of performance</h1><p className="mt-2 text-muted-foreground">Compare releases. Understand the change.</p></div>
        <span className="rounded-full border bg-card px-3 py-1 text-sm">Sample report</span>
      </header>
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" role="note">You are viewing illustrative data. Lighthouse collection, bundle analysis, and saved history are not connected yet.</div>
      <section aria-label="Report filters" className="flex flex-wrap gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium">Page<select value={page} onChange={event => setPage(event.target.value)}>{pages.map(route => <option key={route}>{route}</option>)}</select></label>
        <label className="flex flex-col gap-2 text-sm font-medium">Measurement<select value={metric} onChange={event => setMetric(event.target.value as typeof metric)}><option value="lcp">Largest Contentful Paint</option><option value="bundle">Emitted JavaScript size</option></select></label>
      </section>
      <section className="grid gap-5 sm:grid-cols-3" aria-label="Comparison summary">
        {[['Baseline', `${values[0].toLocaleString()} ${unit}`, dates[0]], ['Candidate', `${values.at(-1)!.toLocaleString()} ${unit}`, dates.at(-1)!], ['Change', `${((values.at(-1)! / values[0] - 1) * 100).toFixed(1)}%`, 'Lower is better']].map(([title, value, description]) => (
          <Card key={title}><CardHeader><CardDescription>{title}</CardDescription><CardTitle className="text-3xl tabular-nums">{value}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{description}</CardContent></Card>
        ))}
      </section>
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card><CardHeader><CardTitle>Performance over time</CardTitle><CardDescription>{page} · {metric === 'lcp' ? 'Median of 3 valid samples per run' : 'Emitted JavaScript size'} · {unit}</CardDescription></CardHeader><CardContent><ResponsiveContainer render={({ width }) => <Tooltip data={history} title={unit} topicLabel="topics" render={props => <Line {...props} width={width} height={280} grid="horizontal" a11yTitle={`${page} sample performance history in ${unit}`} />} />} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Release comparison</CardTitle><CardDescription>Baseline and candidate · {unit}</CardDescription></CardHeader><CardContent><ResponsiveContainer render={({ width }) => <Tooltip data={comparison} title={unit} render={props => <Bar {...props} width={width} height={280} a11yTitle={`Baseline and candidate in ${unit}`} />} />} /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Run details</CardTitle><CardDescription>Exact values behind the charts. All entries below are sample data.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Sample run history for {page}</caption><thead><tr><th scope="col">Date</th><th scope="col">Page</th><th scope="col">{metric === 'lcp' ? 'Median LCP' : 'JavaScript size'}</th>{metric === 'lcp' && <th scope="col">Samples</th>}</tr></thead><tbody>{dates.map((date, i) => <tr key={date}><th scope="row" className="font-normal">{date}</th><td>{page}</td><td className="tabular-nums">{values[i].toLocaleString()} {unit}</td>{metric === 'lcp' && <td>3</td>}</tr>)}</tbody></table></CardContent></Card>
      <footer className="text-sm text-muted-foreground">BritePulse · Local performance insights</footer>
    </main>
  );
}
