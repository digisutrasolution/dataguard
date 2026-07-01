import { PageHeader, Card } from '../components/ui';

const ENDPOINTS: { method: string; path: string; desc: string; body?: string }[] = [
  { method: 'POST', path: '/api/validate', desc: 'Validate a single number.', body: '{ "number": "9876543210", "defaultCountry": "IN" }' },
  { method: 'POST', path: '/api/jobs', desc: 'Submit a bulk validation/detection job (async).', body: '{ "numbers": ["..."], "service": "advanced", "defaultCountry": "IN", "priority": "normal" }' },
  { method: 'GET', path: '/api/jobs/:id', desc: 'Poll job status, progress, and result sample.' },
  { method: 'POST', path: '/api/detect', desc: 'Number detection (registered/unregistered/unknown).', body: '{ "number": "9876543210", "defaultCountry": "IN" }' },
  { method: 'POST', path: '/api/generate', desc: 'Generate numbers for a country.', body: '{ "country": "IN", "quantity": 100, "format": "e164" }' },
  { method: 'GET', path: '/api/balance', desc: 'Current wallet balance.' },
  { method: 'GET', path: '/api/history', desc: 'Recent validation jobs.' },
  { method: 'GET', path: '/api/invoices', desc: 'List invoices.' },
];
const mb = { background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '12px 14px', overflowX: 'auto' as const };

export default function ApiDocs() {
  return (
    <>
      <PageHeader title="API documentation" sub="REST API for programmatic phone validation" />

      <Card title="Authentication" className="" >
        <p style={{ marginTop: 0 }}>Send your API key in the <code>x-api-key</code> header on every request. Create keys under <a href="/api-keys" style={{ color: 'var(--brand)' }}>API keys</a>.</p>
        <pre className="mono" style={mb}>{`curl https://api.dataguard.example/api/validate \\
  -H "x-api-key: dg_live_xxxxxxxxxxxx" \\
  -H "content-type: application/json" \\
  -d '{ "number": "9876543210", "defaultCountry": "IN" }'`}</pre>
        <p className="hint" style={{ marginBottom: 0 }}>Base URL (local dev): <code>http://localhost:4000</code>. Rate limits are per key (configurable). Responses are JSON.</p>
      </Card>

      <div style={{ height: 14 }} />
      <Card title="Endpoints" pad={false} className="card-pad-0">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.method + e.path}>
                  <td><span className={`pill ${e.method === 'GET' ? 'ok' : 'run'}`}>{e.method}</span></td>
                  <td className="mono">{e.path}</td>
                  <td>{e.desc}{e.body && <div className="mono hint" style={{ marginTop: 4 }}>{e.body}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 14 }} />
      <Card title="Example response — POST /api/validate">
        <pre className="mono" style={mb}>{`{
  "raw": "9876543210",
  "e164": "+919876543210",
  "national": "098765 43210",
  "iso2": "IN",
  "numberType": "MOBILE",
  "status": "valid"
}`}</pre>
      </Card>
    </>
  );
}
