import React, { useEffect, useMemo, useState } from 'react';
import { getActivity } from '../hooks/useBackend.js';

function formatTimestamp(ts) {
  if (!ts) return 'Unknown time';
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) {
      return ts;
    }
    return date.toLocaleString();
  } catch (error) {
    return ts;
  }
}

function normalizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return [...events].sort((a, b) => {
    const timeA = new Date(a.ts || 0).getTime();
    const timeB = new Date(b.ts || 0).getTime();
    return timeB - timeA;
  });
}

export default function ActivityPanel({ repoId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getActivity(repoId);
      setEvents(normalizeEvents(data?.events));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEvents([]);
    setError(null);
    if (repoId) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId]);

  const renderedEvents = useMemo(() => normalizeEvents(events), [events]);

  if (!repoId) {
    return (
      <div className="panel-section activity-panel">
        <p className="muted">Select a repository to view activity.</p>
      </div>
    );
  }

  return (
    <div className="panel-section activity-panel">
      <div className="panel-header">
        <h3>Recent Activity</h3>
        <button type="button" className="secondary" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="muted">Loading activity…</p>}
      {renderedEvents.length === 0 && !loading && <p className="muted">No activity recorded yet.</p>}
      {renderedEvents.length > 0 && (
        <ul className="activity-list">
          {renderedEvents.map((event, index) => {
            const details = event.details || {};
            return (
              <li key={`${event.ts || 'event'}-${index}`} className="activity-event">
                <div className="activity-meta">
                  <span className="activity-action">{event.action}</span>
                  <span className="activity-time">{formatTimestamp(event.ts)}</span>
                </div>
                <div className="activity-body">
                  {event.branch && <span className="activity-branch">Branch: {event.branch}</span>}
                  {event.msg && <span className="activity-message">{event.msg}</span>}
                  {event.hash && <span className="activity-hash">Commit: {event.hash}</span>}
                  {event.user && <span className="activity-user">By {event.user}</span>}
                  {Object.keys(details).length > 0 && (
                    <dl className="activity-details">
                      {Object.entries(details).map(([key, value]) => (
                        <React.Fragment key={key}>
                          <dt>{key}</dt>
                          <dd>{String(value)}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
