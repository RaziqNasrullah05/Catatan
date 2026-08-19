/**
 * Kerangka pemuatan. Bentuknya sengaja meniru tata letak isi sebenarnya
 * supaya tidak ada pergeseran tampilan saat data datang.
 */

export function NoteListSkeleton({ layout = 'list', count = 5 }) {
  const grid = layout.startsWith('grid');
  return (
    <div className={`note-list layout-${layout}`} aria-hidden="true">
      {Array.from({ length: grid ? 6 : count }).map((_, i) => (
        <div className="note-row" key={i}>
          <span className="sk" style={{ height: 17, width: `${55 + ((i * 13) % 30)}%`, display: 'block' }} />
          <span className="sk" style={{ height: 12, width: '92%', display: 'block', marginTop: 9 }} />
          <span className="sk" style={{ height: 12, width: '70%', display: 'block', marginTop: 6 }} />
          <span className="sk" style={{ height: 10, width: 78, display: 'block', marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function TaskListSkeleton({ count = 4 }) {
  return (
    <div className="task-group" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="task-row" key={i}>
          <span className="sk" style={{ width: 17, height: 17, borderRadius: 5, marginTop: 3, flex: 'none' }} />
          <span style={{ flex: 1 }}>
            <span className="sk" style={{ height: 14, width: `${50 + ((i * 17) % 35)}%`, display: 'block' }} />
            <span className="sk" style={{ height: 10, width: 90, display: 'block', marginTop: 7 }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function NoteEditorSkeleton() {
  const widths = ['92%', '78%', '85%', '60%', '90%', '72%'];
  return (
    <div style={{ padding: '18px 20px' }} aria-hidden="true">
      <span className="sk" style={{ height: 28, width: '62%', display: 'block', borderRadius: 8 }} />
      <span className="sk" style={{ height: 12, width: 96, display: 'block', marginTop: 14 }} />
      <div style={{ marginTop: 26 }}>
        {widths.map((w, i) => (
          <span className="sk" key={i} style={{ height: 14, width: w, display: 'block', marginBottom: 13 }} />
        ))}
      </div>
    </div>
  );
}

export function PeopleSkeleton({ count = 3 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          {i > 0 && <div className="m3-divider" />}
          <div className="m3-row">
            <span className="sk" style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none' }} />
            <span className="m3-body">
              <span className="sk" style={{ height: 15, width: `${45 + i * 12}%`, display: 'block' }} />
              <span className="sk" style={{ height: 11, width: 120, display: 'block', marginTop: 8 }} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}